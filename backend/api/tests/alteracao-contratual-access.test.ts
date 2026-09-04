import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { AlteracaoContratualStage, ProcessStatus } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import { AuditService } from "../src/modules/audit/audit.service";
import { AuthService } from "../src/modules/auth/auth.service";
import { NotificationService } from "../src/modules/notification/notification.service";
import { ProcessService } from "../src/modules/process/process.service";
import { SlaService } from "../src/modules/sla/sla.service";
import { IdempotencyService } from "../src/shared/idempotency.service";
import { PrismaService } from "../src/shared/prisma.service";

const completedProcess = {
  id: "process-1",
  ownerId: "operator-1",
  clientEmail: "client@example.com",
  clientPhone: "+5571999999999",
  status: ProcessStatus.CONCLUIDO,
  steps: [],
  checklists: [],
  slaEvents: []
};

type AlterationRequest = {
  id: string;
  processId: string;
  alterationType: string;
  stage: AlteracaoContratualStage;
  version: number;
  process: { ownerId: string };
};

function createService(options?: { process?: unknown; request?: AlterationRequest; updateCount?: number }) {
  const request: AlterationRequest = options?.request ?? {
    id: "alteration-1",
    processId: "process-1",
    alterationType: "ALTERACAO_ENDERECO",
    stage: AlteracaoContratualStage.SOLICITACAO_RECEBIDA,
    version: 1,
    process: { ownerId: "operator-1" }
  };
  const tx = {
    alteracaoContratual: {
      upsert: vi.fn().mockResolvedValue(request),
      updateMany: vi.fn().mockResolvedValue({ count: options?.updateCount ?? 1 }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ ...request, version: 2, stage: AlteracaoContratualStage.ANALISE_JURIDICA })
    },
    alteracaoContratualHistory: {
      create: vi.fn().mockResolvedValue({}),
      createMany: vi.fn().mockResolvedValue({ count: 1 })
    }
  };
  const prisma = {
    process: { findUnique: vi.fn().mockResolvedValue(options?.process ?? completedProcess) },
    alteracaoContratual: {
      findUnique: vi.fn().mockResolvedValue(request),
      findMany: vi.fn().mockResolvedValue([request])
    },
    $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx))
  };
  const auditService = { record: vi.fn().mockResolvedValue(undefined) };
  const notificationService = { sendEmail: vi.fn().mockResolvedValue(undefined), sendWebhook: vi.fn().mockResolvedValue(undefined) };
  const service = new ProcessService(
    prisma as unknown as PrismaService,
    {} as unknown as SlaService,
    auditService as unknown as AuditService,
    notificationService as unknown as NotificationService,
    {} as unknown as AuthService,
    {} as unknown as IdempotencyService
  );
  return { service, prisma, tx, auditService, notificationService };
}

function createStandaloneService() {
  const request = {
    id: "alteration-standalone",
    legacyClientId: "legacy-client-1",
    alterationType: "ALTERACAO_ENDERECO",
    stage: AlteracaoContratualStage.DOC_INICIAL_APROVADA,
    version: 1
  };
  const tx = {
    legacyClient: {
      upsert: vi.fn().mockResolvedValue({ id: "legacy-client-1", name: "Empresa Avulsa" })
    },
    alteracaoContratual: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(request)
    },
    alteracaoContratualHistory: { createMany: vi.fn().mockResolvedValue({ count: 1 }) }
  };
  const prisma = { $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)) };
  const auditService = { record: vi.fn().mockResolvedValue(undefined) };
  const notificationService = { sendEmail: vi.fn().mockResolvedValue(undefined), sendWebhook: vi.fn().mockResolvedValue(undefined) };
  const service = new ProcessService(
    prisma as unknown as PrismaService,
    {} as unknown as SlaService,
    auditService as unknown as AuditService,
    notificationService as unknown as NotificationService,
    {} as unknown as AuthService,
    {} as unknown as IdempotencyService
  );
  return { service, tx, auditService };
}

describe("ProcessService contractual alterations", () => {
  it("creates an alteration for a standalone client and stores notification data", async () => {
    const { service, tx, auditService } = createStandaloneService();

    const result = await service.createAlteracaoContratual(undefined, { role: "OPERADOR", userId: "operator-1" }, "ALTERACAO_ENDERECO", undefined, {
      name: "Empresa Avulsa",
      email: "cliente@example.com",
      documentNumber: "12.345.678/0001-90"
    });

    expect(result.id).toBe("alteration-standalone");
    expect(tx.legacyClient.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantKey_normalizedDocument: { tenantKey: "default", normalizedDocument: "12345678000190" } },
      create: expect.objectContaining({ name: "Empresa Avulsa", email: "cliente@example.com" })
    }));
    expect(tx.alteracaoContratual.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ legacyClientId: "legacy-client-1" })
    }));
    expect(auditService.record).toHaveBeenCalledWith(expect.anything(), "alteracao_contratual_requested", "AlteracaoContratual", "alteration-standalone", expect.objectContaining({ documentNumber: "12345678000190" }));
  });

  it("requires the standalone client's name, email and CNPJ", async () => {
    const { service } = createStandaloneService();
    await expect(service.createAlteracaoContratual(undefined, { role: "MASTER" }, "ALTERACAO_ENDERECO")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("accepts and normalizes an alphanumeric CNPJ", async () => {
    const { service, tx } = createStandaloneService();

    await service.createAlteracaoContratual(undefined, { role: "OPERADOR", userId: "operator-1" }, "razao-social", undefined, {
      name: "Empresa Alfa",
      email: "alfa@example.com",
      documentNumber: "12.ABC.345/DEFG-67"
    });

    expect(tx.legacyClient.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenantKey_normalizedDocument: { tenantKey: "default", normalizedDocument: "12ABC345DEFG67" } }
    }));
  });

  it("rejects letters in the CNPJ verification digits", async () => {
    const { service } = createStandaloneService();

    await expect(service.createAlteracaoContratual(undefined, { role: "OPERADOR", userId: "operator-1" }, "razao-social", undefined, {
      name: "Empresa Inválida",
      email: "invalida@example.com",
      documentNumber: "12.ABC.345/DEFG-6A"
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates an alteration and its initial history for the owning client", async () => {
    const { service, prisma, tx, auditService } = createService();

    const result = await service.createAlteracaoContratual(
      "process-1",
      { role: "CLIENTE", userId: "client-1", email: "client@example.com" },
      "ALTERACAO_ENDERECO"
    );

    expect(result.id).toBe("alteration-1");
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(tx.alteracaoContratual.upsert).toHaveBeenCalledWith({
      where: { processId_alterationType: { processId: "process-1", alterationType: "ALTERACAO_ENDERECO" } },
      update: {},
      create: {
        processId: "process-1",
        alterationType: "ALTERACAO_ENDERECO",
        stage: "DOC_INICIAL_APROVADA",
        requestedByRole: "CLIENTE",
        requestedById: "client-1"
      }
    });
    expect(tx.alteracaoContratualHistory.createMany).toHaveBeenCalledTimes(1);
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ role: "CLIENTE" }),
      "alteracao_contratual_requested",
      "AlteracaoContratual",
      "alteration-1",
      expect.objectContaining({ processId: "process-1" })
    );
  });

  it("denies a client access to another client's process and never opens a transaction", async () => {
    const { service, prisma } = createService();

    await expect(
      service.createAlteracaoContratual(
        "process-1",
        { role: "CLIENTE", email: "attacker@example.com" },
        "ALTERACAO_ENDERECO"
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("denies alteration requests before process completion", async () => {
    const { service } = createService({ process: { ...completedProcess, status: ProcessStatus.EM_ANDAMENTO } });

    await expect(
      service.createAlteracaoContratual("process-1", { role: "CLIENTE", email: "client@example.com" }, "ALTERACAO_ENDERECO")
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("isolates stage updates between operators while allowing master", async () => {
    const { service, tx } = createService();

    await expect(
      service.updateAlteracaoContratualStage(
        "alteration-1",
        { role: "OPERADOR", userId: "operator-2" },
        AlteracaoContratualStage.ANALISE_JURIDICA,
        1
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.alteracaoContratual.updateMany).not.toHaveBeenCalled();

    await expect(
      service.updateAlteracaoContratualStage(
        "alteration-1",
        { role: "MASTER", userId: "master-1" },
        AlteracaoContratualStage.ANALISE_JURIDICA,
        1
      )
    ).resolves.toMatchObject({ ok: true, request: expect.any(Object) });
    expect(tx.alteracaoContratual.updateMany).toHaveBeenCalledTimes(1);
  });

  it("rejects stale versions and non-adjacent stage jumps", async () => {
    const { service, tx } = createService();

    await expect(
      service.updateAlteracaoContratualStage(
        "alteration-1",
        { role: "OPERADOR", userId: "operator-1" },
        AlteracaoContratualStage.ANALISE_JURIDICA,
        2
      )
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.updateAlteracaoContratualStage(
        "alteration-1",
        { role: "OPERADOR", userId: "operator-1" },
        AlteracaoContratualStage.PROTOCOLO,
        1
      )
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.alteracaoContratual.updateMany).not.toHaveBeenCalled();
  });

  it("allows a modern alteration to move from exigencia to finalizado", async () => {
    const { service, tx } = createService({
      request: {
        id: "alteration-1",
        processId: "process-1",
        alterationType: "ALTERACAO_ENDERECO",
        stage: AlteracaoContratualStage.EXIGENCIA_JUCEB,
        version: 1,
        process: { ownerId: "operator-1" }
      }
    });

    await expect(
      service.updateAlteracaoContratualStage(
        "alteration-1",
        { role: "OPERADOR", userId: "operator-1" },
        AlteracaoContratualStage.FINALIZADO,
        1
      )
    ).resolves.toMatchObject({ ok: true, request: expect.any(Object) });
    expect(tx.alteracaoContratual.updateMany).toHaveBeenCalledTimes(1);
  });

  it("allows a modern alteration to finalize without going through exigencia", async () => {
    const { service, tx } = createService({
      request: {
        id: "alteration-1",
        processId: "process-1",
        alterationType: "ALTERACAO_ENDERECO",
        stage: AlteracaoContratualStage.ANALISE_JUCEB,
        version: 1,
        process: { ownerId: "operator-1" }
      }
    });

    await expect(
      service.updateAlteracaoContratualStage(
        "alteration-1",
        { role: "OPERADOR", userId: "operator-1" },
        AlteracaoContratualStage.FINALIZADO,
        1
      )
    ).resolves.toMatchObject({ ok: true, request: expect.any(Object) });
    expect(tx.alteracaoContratual.updateMany).toHaveBeenCalledTimes(1);
  });

  it("requires an operator or master to change the stage", async () => {
    const { service } = createService();

    await expect(
      service.updateAlteracaoContratualStage(
        "alteration-1",
        { role: "CLIENTE", email: "client@example.com" },
        AlteracaoContratualStage.ANALISE_JURIDICA,
        1
      )
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("does not notify the client when the alteration enters exigencia juceb", async () => {
    const { service, prisma, notificationService } = createService();

    const notifyAlteracaoStage = Reflect.get(service, "notifyAlteracaoStage") as (id: string, stage: AlteracaoContratualStage) => Promise<void>;
    await notifyAlteracaoStage.call(service, "alteration-1", AlteracaoContratualStage.EXIGENCIA_JUCEB);

    expect(prisma.alteracaoContratual.findUnique).not.toHaveBeenCalled();
    expect(notificationService.sendEmail).not.toHaveBeenCalled();
    expect(notificationService.sendWebhook).not.toHaveBeenCalled();
  });

  it("notifies the client that a new alteration is under analysis", async () => {
    const { service, prisma, notificationService } = createService();
    prisma.alteracaoContratual.findUnique.mockResolvedValue({
      id: "alteration-1",
      alterationType: "razao-social",
      process: { clientName: "Empresa Alfa", clientEmail: "alfa@example.com" },
      legacyClient: null
    });

    const notifyAlteracaoStage = Reflect.get(service, "notifyAlteracaoStage") as (id: string, stage: AlteracaoContratualStage) => Promise<void>;
    await notifyAlteracaoStage.call(service, "alteration-1", AlteracaoContratualStage.DOC_INICIAL_APROVADA);

    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      "alfa@example.com",
      "Sua Solicitação de alteração contratual foi recebida com sucesso",
      expect.stringContaining("Sua solicitação para alteração contratual foi recebida com sucesso.")
    );
    const emailBody = notificationService.sendEmail.mock.calls[0][2] as string;
    expect(emailBody).not.toContain("pelo motivo");
    expect(emailBody).not.toContain("Nossa equipe está trabalhando");
  });
});
