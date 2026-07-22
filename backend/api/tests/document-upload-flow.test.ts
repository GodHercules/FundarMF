import { describe, expect, it, vi } from "vitest";
import { DocumentItemKey, DocumentItemStatus, ProcessStatus } from "@prisma/client";
import { DocumentService } from "../src/modules/document/document.service";

describe("Document upload flow", () => {
  it("stores client PDF and exposes it to operator list + preview with correct mimeType + role", async () => {
    const db = {
      process: {
        id: "process-1",
        status: ProcessStatus.EM_ANDAMENTO,
        ownerId: "op-1",
        clientEmail: "cliente@exemplo.com",
        clientPhone: "+5571999999999"
      },
      step2: {
        processId_stepKey: { processId: "process-1", stepKey: "ETAPA_2" },
        data: { endereco: { escritorioVirtual: "Sim" } }
      },
      items: [] as any[],
      files: [] as any[]
    };

    const prisma = {
      process: {
        findUnique: vi.fn(async ({ where }: any) => (where?.id === db.process.id ? db.process : null)),
        update: vi.fn(async () => db.process)
      },
      processStep: {
        findUnique: vi.fn(async ({ where }: any) => {
          const key = where?.processId_stepKey;
          if (key?.processId === "process-1" && key?.stepKey === "ETAPA_2") return db.step2;
          return null;
        })
      },
      documentFile: {
        aggregate: vi.fn(async () => ({
          _sum: { size: db.files.reduce((sum, f) => sum + (f.size ?? 0), 0) }
        })),
        findFirst: vi.fn(async ({ where }: any) => {
          const file = db.files.find((f) => f.id === where?.id);
          if (!file) return null;
          const item = db.items.find((i) => i.id === file.itemId);
          if (!item) return null;
          if (where?.item?.processId !== item.processId) return null;
          if (where?.item?.itemKey !== item.itemKey) return null;
          return file;
        })
      },
      documentItem: {
        findFirst: vi.fn(async ({ where }: any) =>
          db.items.find(
            (i) =>
              i.processId === where?.processId &&
              i.itemKey === where?.itemKey &&
              (i.socioId ?? null) === (where?.socioId ?? null)
          ) ?? null
        ),
        create: vi.fn(async ({ data }: any) => {
          const item = {
            id: `item-${db.items.length + 1}`,
            processId: data.processId,
            itemKey: data.itemKey,
            socioId: data.socioId ?? null,
            version: 0,
            status: DocumentItemStatus.PENDENTE,
            reason: null,
            createdAt: new Date()
          };
          db.items.push(item);
          return item;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const item = db.items.find((i) => i.id === where?.id);
          if (!item) throw new Error("missing item");
          Object.assign(item, data);
          return item;
        }),
        findMany: vi.fn(async ({ where, include }: any) => {
          const items = db.items
            .filter((i) => i.processId === where?.processId)
            .sort((a, b) => String(a.itemKey).localeCompare(String(b.itemKey)));

          if (!include?.files?.select) return items;

          const select = include.files.select;
          return items.map((item) => ({
            ...item,
            files: db.files
              .filter((f) => f.itemId === item.id)
              .map((f) => {
                const out: any = {};
                for (const key of Object.keys(select)) {
                  out[key] = f[key];
                }
                return out;
              })
          }));
        })
      },
      user: { findUnique: vi.fn(async () => null) }
    };
    (prisma as any).$transaction = vi.fn(async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma as any));

    const auditService = { record: vi.fn(async () => undefined) };
    const notificationService = {
      sendEmail: vi.fn(async () => undefined),
      sendWhatsApp: vi.fn(async () => undefined),
      createInApp: vi.fn(async () => undefined)
    };
    const storageService = {
      deleteFilesByItem: vi.fn(async (itemId: string) => {
        db.files = db.files.filter((f) => f.itemId !== itemId);
      }),
      saveFile: vi.fn(async (input: any) => {
        const file = {
          id: `file-${db.files.length + 1}`,
          itemId: input.itemId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          size: input.size,
          data: input.data,
          createdAt: new Date(),
          uploadedByRole: input.uploadedByRole
        };
        db.files.push(file);
        return file;
      })
    };

    const service = new DocumentService(prisma as any, auditService as any, storageService as any, notificationService as any);

    const pdfBuffer = Buffer.from("%PDF-1.7\n% test\n1 0 obj\n<<>>\nendobj\n", "utf8");
    const uploadFile: any = {
      originalname: "identificacao.pdf",
      mimetype: "application/octet-stream",
      size: pdfBuffer.length,
      buffer: pdfBuffer
    };

    await expect(
      service.uploadFiles(
        "process-1",
        DocumentItemKey.IDENTIFICACAO_SOCIOS,
        "socio-1",
        [uploadFile],
        { role: "CLIENTE", email: "cliente@exemplo.com" }
      )
    ).resolves.toEqual({ ok: true, version: 0 });

    const items = await service.listItems("process-1", { role: "OPERADOR", userId: "op-1" });
    expect(items).toHaveLength(1);
    expect(items[0].itemKey).toBe(DocumentItemKey.IDENTIFICACAO_SOCIOS);
    expect(items[0].files).toHaveLength(1);
    expect(items[0].files[0].mimeType).toBe("application/pdf");
    expect(items[0].files[0].uploadedByRole).toBe("CLIENTE");

    const file = await service.getFile(
      "process-1",
      DocumentItemKey.IDENTIFICACAO_SOCIOS,
      items[0].files[0].id,
      { role: "OPERADOR", userId: "op-1" }
    );
    expect(file.mimeType).toBe("application/pdf");
    expect(Buffer.isBuffer(file.data)).toBe(true);
    expect(String(file.data).startsWith("%PDF-")).toBe(true);
  });
});

