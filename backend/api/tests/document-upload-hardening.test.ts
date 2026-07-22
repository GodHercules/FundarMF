import { describe, expect, it, vi } from "vitest";
import { DocumentItemKey, DocumentItemStatus, ProcessStatus } from "@prisma/client";
import { DocumentService } from "../src/modules/document/document.service";

type TestState = {
  process: {
    id: string;
    status: ProcessStatus;
    ownerId: string;
    clientEmail: string;
    clientPhone: string;
    updatedAt: Date;
  };
  items: any[];
  files: any[];
};

const client = { role: "CLIENTE" as const, email: "cliente@exemplo.com" };

function makeFile(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  const buffer = Buffer.from("%PDF-1.7\nvalid test payload", "utf8");
  return {
    fieldname: "files",
    originalname: "documento.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    size: buffer.length,
    destination: "",
    filename: "documento.pdf",
    path: "",
    buffer,
    stream: undefined as never,
    ...overrides
  };
}

function makeHarness(options: { totalBytes?: number; transactionDelayMs?: number } = {}) {
  const state: TestState = {
    process: {
      id: "process-1",
      status: ProcessStatus.EM_ANDAMENTO,
      ownerId: "operator-1",
      clientEmail: client.email,
      clientPhone: "+5571999999999",
      updatedAt: new Date(0)
    },
    items: [],
    files: options.totalBytes
      ? [{ id: "existing-file", itemId: "existing-item", size: options.totalBytes }]
      : []
  };

  const cloneState = () => ({
    items: state.items.map((item) => ({ ...item })),
    files: state.files.map((file) => ({ ...file }))
  });

  let lockTail = Promise.resolve();
  const prisma: any = {
    process: {
      findUnique: vi.fn(async () => state.process),
      update: vi.fn(async ({ data }: any) => {
        state.process.updatedAt = data.updatedAt;
        return state.process;
      })
    },
    processStep: {
      findUnique: vi.fn(async () => ({ data: { endereco: { escritorioVirtual: "Sim" } } }))
    },
    documentFile: {
      aggregate: vi.fn(async () => ({
        _sum: { size: state.files.reduce((sum, file) => sum + (file.size ?? 0), 0) }
      }))
    },
    documentItem: {
      findFirst: vi.fn(async ({ where }: any) =>
        state.items.find(
          (item) =>
            item.processId === where.processId &&
            item.itemKey === where.itemKey &&
            (item.socioId ?? null) === (where.socioId ?? null)
        ) ?? null
      ),
      create: vi.fn(async ({ data }: any) => {
        const item = {
          id: `item-${state.items.length + 1}`,
          processId: data.processId,
          itemKey: data.itemKey,
          socioId: data.socioId ?? null,
          version: 0,
          status: DocumentItemStatus.PENDENTE,
          reason: null
        };
        state.items.push(item);
        return item;
      }),
      update: vi.fn(async ({ where, data }: any) => {
        const item = state.items.find((candidate) => candidate.id === where.id);
        if (!item) throw new Error("item not found");
        Object.assign(item, data);
        return item;
      })
    }
  };

  const storage = {
    deleteFilesByItem: vi.fn(async () => undefined),
    saveFile: vi.fn(async (input: any) => {
      const file = { id: `file-${state.files.length + 1}`, ...input };
      state.files.push(file);
      return file;
    })
  };

  prisma.$transaction = vi.fn(async (callback: (tx: any) => Promise<unknown>) => {
    let release!: () => void;
    const previous = lockTail;
    lockTail = new Promise<void>((resolve) => (release = resolve));
    await previous;
    const snapshot = cloneState();
    try {
      if (options.transactionDelayMs) await new Promise((resolve) => setTimeout(resolve, options.transactionDelayMs));
      return await callback(prisma);
    } catch (error) {
      state.items = snapshot.items;
      state.files = snapshot.files;
      throw error;
    } finally {
      release();
    }
  });

  const service = new DocumentService(
    prisma,
    { record: vi.fn(async () => undefined) } as any,
    storage as any,
    { sendEmail: vi.fn(), sendWhatsApp: vi.fn(), createInApp: vi.fn() } as any
  );

  return { service, prisma, storage, state };
}

describe("Document upload hardening", () => {
  it("rejects a file whose declared MIME type does not match its signature", async () => {
    const { service, storage, state } = makeHarness();

    await expect(
      service.uploadFiles("process-1", DocumentItemKey.IDENTIFICACAO_SOCIOS, "socio-1", [
        makeFile({ mimetype: "image/png", originalname: "fachada.png" })
      ],
      client)
    ).rejects.toThrow("n\u00e3o corresponde ao tipo informado");

    expect(storage.saveFile).not.toHaveBeenCalled();
    expect(state.items).toHaveLength(0);
    expect(state.files).toHaveLength(0);
  });

  it("enforces per-item file count and file-size limits before opening a transaction", async () => {
    const { service, prisma } = makeHarness();
    const previousMaxFiles = process.env.UPLOAD_MAX_FILES_PER_ITEM;
    const previousMaxMb = process.env.UPLOAD_MAX_FILE_MB;
    process.env.UPLOAD_MAX_FILES_PER_ITEM = "1";
    process.env.UPLOAD_MAX_FILE_MB = "1";

    try {
      await expect(
        service.uploadFiles(
          "process-1",
          DocumentItemKey.IDENTIFICACAO_SOCIOS,
          "socio-1",
          [makeFile(), makeFile()],
          client
        )
      ).rejects.toThrow("Limite de anexos excedido");

      await expect(
        service.uploadFiles(
          "process-1",
          DocumentItemKey.IDENTIFICACAO_SOCIOS,
          "socio-1",
          [makeFile({ size: 2 * 1024 * 1024 })],
          client
        )
      ).rejects.toThrow("excede 1MB");

      expect(prisma.$transaction).not.toHaveBeenCalled();
    } finally {
      if (previousMaxFiles === undefined) delete process.env.UPLOAD_MAX_FILES_PER_ITEM;
      else process.env.UPLOAD_MAX_FILES_PER_ITEM = previousMaxFiles;
      if (previousMaxMb === undefined) delete process.env.UPLOAD_MAX_FILE_MB;
      else process.env.UPLOAD_MAX_FILE_MB = previousMaxMb;
    }
  });

  it("enforces the process total quota", async () => {
    const { service, storage, state } = makeHarness({ totalBytes: 59 * 1024 * 1024 });

    await expect(
      service.uploadFiles(
        "process-1",
        DocumentItemKey.IDENTIFICACAO_SOCIOS,
        "socio-1",
        [makeFile({ size: 2 * 1024 * 1024 })],
        client
      )
    ).rejects.toThrow("Limite total de armazenamento");

    expect(storage.saveFile).not.toHaveBeenCalled();
    expect(state.items).toHaveLength(0);
  });

  it("rolls back item and files when storage fails inside the transaction", async () => {
    const { service, storage, state } = makeHarness();
    storage.saveFile
      .mockImplementationOnce(async (input: any) => {
        const partialFile = { id: "partial-file", ...input };
        state.files.push(partialFile);
        return partialFile;
      })
      .mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(
      service.uploadFiles(
        "process-1",
        DocumentItemKey.IDENTIFICACAO_SOCIOS,
        "socio-1",
        [makeFile(), makeFile({ originalname: "documento-2.pdf" })],
        client
      )
    ).rejects.toThrow("storage unavailable");

    expect(state.items).toHaveLength(0);
    expect(state.files).toHaveLength(0);
  });

  it("serializes concurrent uploads so the process quota cannot be exceeded", async () => {
    const { service, prisma, storage, state } = makeHarness({ totalBytes: 53 * 1024 * 1024, transactionDelayMs: 5 });
    const file = makeFile({ size: 7 * 1024 * 1024 });

    const results = await Promise.allSettled([
      service.uploadFiles("process-1", DocumentItemKey.IDENTIFICACAO_SOCIOS, "socio-1", [file], client),
      service.uploadFiles("process-1", DocumentItemKey.IDENTIFICACAO_SOCIOS, "socio-1", [file], client)
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(state.files).toHaveLength(2);
    expect(state.files.reduce((sum, stored) => sum + stored.size, 0)).toBe(60 * 1024 * 1024);
    expect(prisma.process.update).toHaveBeenCalledTimes(2);
    expect(storage.saveFile.mock.calls[0]?.[1]).toBe(prisma);
  });
});
