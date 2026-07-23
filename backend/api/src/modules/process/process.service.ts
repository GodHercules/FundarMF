import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  AlteracaoContratualStage,
  DocumentItemKey,
  DocumentItemStatus,
  IdempotencyScope,
  KanbanStage,
  Prisma,
  ProcessStatus,
  StepKey,
  StepSide
} from "@prisma/client";

import { isClientOwner, normalizePhone } from "../../common/auth/identity";
import { Actor } from "../../common/auth/types";
import { IdempotencyService } from "../../shared/idempotency.service";
import { PrismaService } from "../../shared/prisma.service";
import { AuditService } from "../audit/audit.service";
import { AuthService } from "../auth/auth.service";
import { NotificationService } from "../notification/notification.service";
import { buildProcessEmailDrafts, ProcessEventDetails, ProcessEventKey } from "../notification/process-email-drafts";
import { SlaService } from "../sla/sla.service";

const CLIENT_STEPS: StepKey[] = ["ETAPA_1", "ETAPA_2", "ETAPA_4", "ETAPA_5", "ETAPA_6"];
const OPERATOR_STEPS: StepKey[] = ["ETAPA_3"];
const EDITABLE_CLIENT_STEP2_FIELDS = new Set([
  "razaoSocial1", "razaoSocial2", "razaoSocial3", "municipio", "emailCnpj", "telefoneCnpj", "endereco", "quadroSocietario"
]);
const EDITABLE_ADDRESS_FIELDS = new Set(["cep", "endereco", "numero", "complemento", "bairro", "cidade", "uf", "iptu", "escritorioVirtual"]);
const EDITABLE_SOCIO_FIELDS = new Set([
  "socioId", "tipoPessoa", "socioNome", "socioCpf", "socioRazaoSocial", "socioCnpj", "socioEmail", "socioTelefone",
  "socioPercentual", "socioAdministrador", "responsavelCnpj", "socioEstadoCivil", "socioProfissao", "socioRegimeCasamento",
  "adminNomeCompleto", "adminCpf", "adminEmail", "adminTelefone", "adminProfissao", "adminEstadoCivil", "adminRegimeCasamento"
]);

function sanitizeClientStep2(data: Record<string, unknown>) {
  const unknown = Object.keys(data).filter((key) => !EDITABLE_CLIENT_STEP2_FIELDS.has(key));
  if (unknown.length > 0) throw new BadRequestException(`Campos não permitidos: ${unknown.join(", ")}.`);
  const result: Record<string, unknown> = {};
  for (const key of ["razaoSocial1", "razaoSocial2", "razaoSocial3", "municipio", "emailCnpj", "telefoneCnpj"]) {
    if (key in data && typeof data[key] !== "string") throw new BadRequestException(`Campo inválido: ${key}.`);
    if (key in data) result[key] = String(data[key]).trim();
  }
  if (data.endereco !== undefined) {
    if (!data.endereco || typeof data.endereco !== "object" || Array.isArray(data.endereco)) throw new BadRequestException("Endereço inválido.");
    const address = data.endereco as Record<string, unknown>;
    const invalid = Object.keys(address).filter((key) => !EDITABLE_ADDRESS_FIELDS.has(key));
    if (invalid.length > 0) throw new BadRequestException(`Campos de endereço não permitidos: ${invalid.join(", ")}.`);
    result.endereco = Object.fromEntries(Object.entries(address).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
  }
  if (data.quadroSocietario !== undefined) {
    if (!Array.isArray(data.quadroSocietario)) throw new BadRequestException("Quadro societário inválido.");
    result.quadroSocietario = data.quadroSocietario.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) throw new BadRequestException("Sócio inválido.");
      const socio = item as Record<string, unknown>;
      const invalid = Object.keys(socio).filter((key) => !EDITABLE_SOCIO_FIELDS.has(key));
      if (invalid.length > 0) throw new BadRequestException(`Campos de sócio não permitidos: ${invalid.join(", ")}.`);
      return Object.fromEntries(Object.entries(socio).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
    });
  }
  return result;
}
const KANBAN_STAGE_EMAILS: Record<KanbanStage, (clientName: string) => string> = {
  VIABILIDADE: (clientName) =>
    `Olá, ${clientName}. Seu processo acaba de ser iniciado e encontra-se em análise na Junta Comercial / Sedur - Viabilidade Regin.`,
  DOC_INICIAL_APROVADA: (clientName) =>
    `Olá, ${clientName}. A documentação inicial foi aprovada e seu processo entrou na etapa Doc. Inicial Aprovada.`,
  DBE_RECEITA_FEDERAL: (clientName) =>
    `Olá, ${clientName}. A viabilidade Regin foi aprovada e seu processo agora encontra-se em análise na Receita Federal para liberação do DBE (Documento Básico de Entrada CNPJ).`,
  PREPARACAO_DOCUMENTOS: (clientName) =>
    `Olá, ${clientName}. O DBE (Documento Básico de Entrada CNPJ) acaba de ser liberado e seu processo agora está na fase de preparação dos documentos (contrato social, capa processo e guia para pagamento).`,
  AGUARDANDO_DOCUMENTOS: (clientName) =>
    `Olá, ${clientName}. Os documentos foram enviados para proceder com as assinaturas, favor verificar o seu e-mail.`,
  ANALISE_JUCEB: (clientName) =>
    `Olá, ${clientName}. O seu processo acaba de ser protocolado na Junta Comercial para liberação do Contrato Social registrado e CNPJ.`,
  EXIGENCIA_JUCEB: (clientName) =>
    `AtualizaÃ§Ã£o: ${clientName}, seu processo entrou em exigÃªncia JUCEB e estÃ¡ sendo tratado pela nossa equipe.`,
  FINALIZADO: (clientName) =>
    `Olá, ${clientName}. Excelente notícia! O seu processo acaba de ser liberado. Parabéns! Favor verificar as documentações enviadas no e-mail.`
};

function nextStep(step: StepKey): StepKey | null {
  const order: StepKey[] = ["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"];
  const index = order.indexOf(step);
  if (index === -1 || index === order.length - 1) return null;
  return order[index + 1];
}

function stepSide(step: StepKey): StepSide {
  return step === "ETAPA_3" ? "OPERADOR" : "CLIENTE";
}

function hasAnyValue(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return true;
  if (typeof value === "boolean") return value === true;
  if (Array.isArray(value)) return value.some((item) => hasAnyValue(item));
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) => hasAnyValue(item));
  }
  return false;
}

function normalizeCompanyKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getDuplicateCompanyMessage() {
  return "Já existe um processo ativo para esta empresa.";
}

function getStepLabel(stepKey: StepKey) {
  const labels: Record<StepKey, string> = {
    ETAPA_1: "Início",
    ETAPA_2: "Preenchimento de dados e informações",
    ETAPA_3: "Estrutura jurídica",
    ETAPA_4: "Checklist",
    ETAPA_5: "Endereço",
    ETAPA_6: "Documentos"
  };

  return labels[stepKey];
}

@Injectable()
export class ProcessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly slaService: SlaService,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly authService: AuthService,
    private readonly idempotencyService: IdempotencyService
  ) {}

  private async startSlaTx(tx: Prisma.TransactionClient, processId: string, stepKey: StepKey, side: StepSide) {
    const config = await tx.slaConfigStep.findUnique({
      where: { stepKey_side: { stepKey, side } }
    });
    if (!config) return;

    const startedAt = new Date();
    const dueAt = new Date(startedAt.getTime() + config.durationHours * 60 * 60 * 1000);
    await tx.slaEvent.upsert({
      where: { processId_stepKey_side: { processId, stepKey, side } },
      update: {
        startedAt,
        dueAt,
        status: "ON_TRACK"
      },
      create: {
        processId,
        stepKey,
        side,
        startedAt,
        dueAt,
        status: "ON_TRACK"
      }
    });
  }

  private async stopSlaTx(tx: Prisma.TransactionClient, processId: string, stepKey: StepKey, side: StepSide) {
    await tx.slaEvent.updateMany({
      where: { processId, stepKey, side },
      data: { status: "STOPPED" }
    });
  }

  private async stopAllSlaTx(tx: Prisma.TransactionClient, processId: string) {
    await tx.slaEvent.updateMany({
      where: { processId },
      data: { status: "STOPPED" }
    });
  }

  private async sendProcessEventEmails(processId: string, event: ProcessEventKey, details?: ProcessEventDetails) {
    try {
      const process = await this.prisma.process.findUnique({ where: { id: processId } });
      if (!process) return;

      const owner =
        process.ownerId && process.ownerId.length > 0
          ? await this.prisma.user.findUnique({ where: { id: process.ownerId } }).catch(() => null)
          : null;

      const drafts = buildProcessEmailDrafts({
        event,
        process: {
          id: process.id,
          clientName: process.clientName,
          clientEmail: process.clientEmail,
          clientPhone: process.clientPhone,
          status: process.status,
          currentStep: process.currentStep,
          ownerEmail: owner?.email ?? null
        },
        details
      });

      const clientTo = process.clientEmail?.trim() || "";
      const operatorTo = owner?.email?.trim() || "";

      const tasks: Promise<unknown>[] = [];
      const hasSpecific = Boolean(drafts.client || drafts.operator);

      // Prefer role-specific drafts. Use `both` only as a fallback when no specific draft exists.
      if (drafts.client && clientTo) {
        tasks.push(this.notificationService.sendEmailDraft(clientTo, drafts.client));
      } else if (!hasSpecific && drafts.both && clientTo) {
        tasks.push(this.notificationService.sendEmailDraft(clientTo, drafts.both));
      }

      if (drafts.operator && operatorTo) {
        tasks.push(this.notificationService.sendEmailDraft(operatorTo, drafts.operator));
      } else if (!hasSpecific && drafts.both && operatorTo) {
        tasks.push(this.notificationService.sendEmailDraft(operatorTo, drafts.both));
      }

      if (tasks.length > 0) {
        await Promise.all(tasks);
      }
    } catch (err) {
      console.warn("[process] sendProcessEventEmails failed", err);
    }
  }

  private async sendProcessWebhook(processId: string, event: ProcessEventKey, actor: Actor, details?: ProcessEventDetails) {
    try {
      const process = await this.prisma.process.findUnique({ where: { id: processId } });
      if (!process) return;

      const owner =
        process.ownerId && process.ownerId.length > 0
          ? await this.prisma.user.findUnique({ where: { id: process.ownerId } }).catch(() => null)
          : null;

      const drafts = buildProcessEmailDrafts({
        event,
        process: {
          id: process.id,
          clientName: process.clientName,
          clientEmail: process.clientEmail,
          clientPhone: process.clientPhone,
          status: process.status,
          currentStep: process.currentStep,
          ownerEmail: owner?.email ?? null
        },
        details
      });

      await this.notificationService.sendWebhook({
        audience: drafts.client && drafts.operator ? "both" : drafts.client ? "client" : "operator",
        reason: event,
        channel: "system",
        requestedBy: { email: actor.email, role: actor.role },
        process: {
          id: process.id,
          status: process.status,
          currentStep: process.currentStep,
          clientName: process.clientName,
          clientEmail: process.clientEmail,
          clientPhone: process.clientPhone,
          ownerEmail: owner?.email ?? null,
          ...drafts.meta,
          details
        },
        emails: {
          client: drafts.client ? { target: "client", to: process.clientEmail, ...drafts.client } : undefined,
          operator: drafts.operator ? { target: "operator", to: owner?.email ?? undefined, ...drafts.operator } : undefined,
          both: drafts.both ? { target: "both", ...drafts.both } : undefined
        }
      });
    } catch (err) {
      console.warn("[process] sendProcessWebhook failed", err);
    }
  }

  private async sendKanbanStageEmail(processId: string, stage: KanbanStage, actor: Actor) {
    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process) return;

    if (stage === KanbanStage.EXIGENCIA_JUCEB) {
      await this.auditService.record(actor, "kanban_stage_email_suppressed", "Process", processId, {
        kanbanStage: stage,
        recipient: "client",
        reason: "stage_notification_policy"
      });
      return;
    }

    const clientName = process.clientName?.trim() || "cliente";
    const body = KANBAN_STAGE_EMAILS[stage](clientName);
    const subject = `Atualização do seu processo, ${clientName}`;

    try {
      await this.notificationService.sendEmail(process.clientEmail, subject, body);

      await this.auditService.record(actor, "kanban_stage_email_requested", "Process", processId, {
        kanbanStage: stage,
        recipient: process.clientEmail
      });

      // Fallback channel for environments with n8n enabled: if provider delivery fails, webhook can replay.
      await this.notificationService.sendWebhook({
        audience: "client",
        reason: "kanban_stage_changed",
        channel: "system",
        requestedBy: { email: actor.email, role: actor.role },
        process: {
          id: process.id,
          status: process.status,
          currentStep: process.currentStep,
          kanbanStage: stage,
          clientEmail: process.clientEmail
        },
        to: process.clientEmail,
        subject,
        body
      });
    } catch (err) {
      console.error("[process] kanban stage email dispatch failed", err);
      await this.auditService.record(actor, "kanban_stage_email_error", "Process", processId, {
        kanbanStage: stage,
        recipient: process.clientEmail,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }

  private async notifyOwner(
    processId: string,
    ownerId: string | null,
    payload: { title: string; body: string; type: string }
  ) {
    if (!ownerId) return;
    const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
    if (!owner) return;

    await this.notificationService.createInApp({
      userId: owner.id,
      processId,
      title: payload.title,
      body: payload.body,
      type: payload.type
    });

    await Promise.all([
      this.notificationService.sendEmail(owner.email, payload.title, payload.body),
      this.notificationService.sendWhatsApp(owner.whatsapp ?? owner.email, payload.body)
    ]);
  }

  private buildChecklistData() {
    return {
      step2: {
        razoesSociais: false,
        municipio: false,
        contatoCnpj: false
      },
      step4: {
        dadosCompletos: false,
        percentuaisOk: false,
        administradores: false
      },
      step5: {
        enderecoOk: false,
        iptuOk: false,
        fotoOk: false,
        escritorioVirtual: false
      },
      step6: {
        identificacaoSocios: false,
        comprovanteResidencia: false,
        fotoFachada: false
      }
    };
  }

  private normalizeSocios(raw: unknown) {
    if (Array.isArray(raw)) {
      return raw.filter((item) => item && typeof item === "object") as Record<string, unknown>[];
    }
    if (raw && typeof raw === "object") {
      return [raw as Record<string, unknown>];
    }
    return [];
  }

  private hasText(value: unknown) {
    return typeof value === "string" && value.trim().length > 0;
  }

  private getSocioTipoPessoa(socio: Record<string, unknown>) {
    return socio.tipoPessoa === "CNPJ" ? "CNPJ" : "CPF";
  }

  private getStep2CompanyKey(data: Record<string, unknown>) {
    if (!this.hasText(data.razaoSocial1)) return null;
    const companyKey = normalizeCompanyKey(String(data.razaoSocial1));
    return companyKey || null;
  }

  private getStep2MissingFields(data: Record<string, unknown>) {
    const missing: string[] = [];
    const missingFields: string[] = [];

    const addMissing = (label: string, field: string) => {
      missing.push(label);
      missingFields.push(field);
    };

    if (!this.hasText(data.razaoSocial1)) addMissing("Razão social 1", "razaoSocial1");
    if (!this.hasText(data.municipio)) addMissing("Município", "municipio");
    if (!this.hasText(data.emailCnpj)) addMissing("E-mail CNPJ", "emailCnpj");
    if (!this.hasText(data.telefoneCnpj)) addMissing("Telefone CNPJ", "telefoneCnpj");

    const endereco = (data.endereco ?? {}) as Record<string, unknown>;
    const escritorioVirtual = String(endereco.escritorioVirtual ?? "").trim();
    if (!escritorioVirtual) addMissing("Endereço virtual", "endereco.escritorioVirtual");

    const needsPhysicalAddress = escritorioVirtual !== "Sim";
    if (needsPhysicalAddress) {
      const requiredAddress: Array<{ label: string; key: string; field: string }> = [
        { label: "CEP", key: "cep", field: "endereco.cep" },
        { label: "Endereço", key: "endereco", field: "endereco.endereco" },
        { label: "Número", key: "numero", field: "endereco.numero" },
        { label: "Bairro", key: "bairro", field: "endereco.bairro" },
        { label: "Cidade", key: "cidade", field: "endereco.cidade" },
        { label: "UF", key: "uf", field: "endereco.uf" },
        { label: "IPTU", key: "iptu", field: "endereco.iptu" }
      ];
      requiredAddress.forEach(({ label, key, field }) => {
        if (!this.hasText(endereco[key])) addMissing(label, field);
      });
    }

    const socios = this.normalizeSocios(data.quadroSocietario);
    if (socios.length === 0) {
      addMissing("Quadro societário", "quadroSocietario");
    }

    socios.forEach((socio, index) => {
      const prefix = `Sócio ${index + 1}`;
      const tipoPessoa = this.getSocioTipoPessoa(socio);
      const required: Array<{ label: string; key: string; field: string }> = [
        { label: `${prefix}: identificador`, key: "socioId", field: `quadroSocietario.${index}.socioId` },
        { label: `${prefix}: e-mail`, key: "socioEmail", field: `quadroSocietario.${index}.socioEmail` },
        { label: `${prefix}: telefone`, key: "socioTelefone", field: `quadroSocietario.${index}.socioTelefone` },
        { label: `${prefix}: participação`, key: "socioPercentual", field: `quadroSocietario.${index}.socioPercentual` },
        { label: `${prefix}: administrador`, key: "socioAdministrador", field: `quadroSocietario.${index}.socioAdministrador` }
      ];

      if (tipoPessoa === "CNPJ") {
        required.push({
          label: `${prefix}: razão social`,
          key: "socioRazaoSocial",
          field: `quadroSocietario.${index}.socioRazaoSocial`
        });
        required.push({ label: `${prefix}: CNPJ`, key: "socioCnpj", field: `quadroSocietario.${index}.socioCnpj` });
        required.push({
          label: `${prefix}: responsável - nome completo`,
          key: "adminNomeCompleto",
          field: `quadroSocietario.${index}.adminNomeCompleto`
        });
        required.push({
          label: `${prefix}: responsável - CPF`,
          key: "adminCpf",
          field: `quadroSocietario.${index}.adminCpf`
        });
        required.push({
          label: `${prefix}: responsável - profissão`,
          key: "adminProfissao",
          field: `quadroSocietario.${index}.adminProfissao`
        });
        required.push({
          label: `${prefix}: responsável - estado civil`,
          key: "adminEstadoCivil",
          field: `quadroSocietario.${index}.adminEstadoCivil`
        });
      } else {
        required.push({ label: `${prefix}: nome`, key: "socioNome", field: `quadroSocietario.${index}.socioNome` });
        required.push({ label: `${prefix}: CPF`, key: "socioCpf", field: `quadroSocietario.${index}.socioCpf` });
        required.push({
          label: `${prefix}: estado civil`,
          key: "socioEstadoCivil",
          field: `quadroSocietario.${index}.socioEstadoCivil`
        });
        required.push({
          label: `${prefix}: profissão`,
          key: "socioProfissao",
          field: `quadroSocietario.${index}.socioProfissao`
        });
      }

      required.forEach(({ label, key, field }) => {
        const value = (socio as Record<string, unknown>)[key];
        if (!this.hasText(value)) addMissing(label, field);
      });

      if (
        tipoPessoa !== "CNPJ" &&
        String(socio.socioEstadoCivil).trim() === "Casado(a)" &&
        !this.hasText(socio.socioRegimeCasamento)
      ) {
        addMissing(`${prefix}: regime de casamento`, `quadroSocietario.${index}.socioRegimeCasamento`);
      }

      if (
        tipoPessoa === "CNPJ" &&
        String(socio.adminEstadoCivil).trim() === "Casado(a)" &&
        !this.hasText(socio.adminRegimeCasamento)
      ) {
        addMissing(`${prefix}: responsável - regime de casamento`, `quadroSocietario.${index}.adminRegimeCasamento`);
      }
    });

    return { missing, missingFields };
  }

  private async ensureCompanyKeyAvailable(companyKey: string, currentProcessId?: string) {
    const duplicate = await this.prisma.process.findFirst({
      where: {
        companyKey,
        status: { notIn: [ProcessStatus.CONCLUIDO, ProcessStatus.CANCELADO] },
        ...(currentProcessId ? { id: { not: currentProcessId } } : {})
      },
      select: { id: true }
    });

    if (duplicate) {
      throw new BadRequestException(getDuplicateCompanyMessage());
    }
  }

  private isStep2DataComplete(data: Record<string, unknown>) {
    const missing = this.getStep2MissingFields(data);
    return missing.missing.length === 0;
  }

  private isStep3DataComplete(data: Record<string, unknown>) {
    const required = ["tipoAtividade", "naturezaJuridica", "capitalSocial", "cnae", "tributacao"];
    return required.every((field) => this.hasText(data[field]));
  }

  private hasRequiredUploadedDocuments(
    step2Data: Record<string, unknown>,
    documents: Array<{ itemKey: DocumentItemKey; socioId: string | null; files: Array<{ id: string }> }>
  ) {
    const socios = this.normalizeSocios(step2Data.quadroSocietario);
    const socioIds = socios
      .map((socio) => socio.socioId)
      .filter((value) => typeof value === "string" && value.trim().length > 0) as string[];

    if (socioIds.length !== socios.length) return false;

    const hasUpload = (itemKey: DocumentItemKey, socioId: string | null) =>
      documents.some(
        (doc) =>
          doc.itemKey === itemKey &&
          (doc.socioId ?? null) === socioId &&
          Array.isArray(doc.files) &&
          doc.files.length > 0
      );

    for (const socioId of socioIds) {
      if (!hasUpload(DocumentItemKey.IDENTIFICACAO_SOCIOS, socioId)) return false;
      if (!hasUpload(DocumentItemKey.COMPROVANTE_RESIDENCIA, socioId)) return false;
    }

    const endereco = (step2Data.endereco ?? {}) as Record<string, unknown>;
    const escritorioVirtual = String(endereco.escritorioVirtual ?? "").trim();
    if (escritorioVirtual !== "Sim" && !hasUpload(DocumentItemKey.FOTO_FACHADA, null)) {
      return false;
    }

    return true;
  }

  private mapWithKanbanEligibility(
    process: {
      steps: Array<{ stepKey: StepKey; data: Prisma.JsonValue; locked: boolean; status: ProcessStatus }>;
      documents: Array<{ itemKey: DocumentItemKey; socioId: string | null; status: DocumentItemStatus }>;
      kanbanStage: KanbanStage;
    } & Record<string, unknown>
  ) {
    const step2 = process.steps.find((step) => step.stepKey === StepKey.ETAPA_2);
    const step3 = process.steps.find((step) => step.stepKey === StepKey.ETAPA_3);
    const kanbanEligible = this.isKanbanEligible(step2, step3, process.documents);
    const { steps: _steps, documents: _documents, ...rest } = process;
    void _steps;
    void _documents;
    const kanbanStage =
      kanbanEligible && rest.kanbanStage === KanbanStage.VIABILIDADE
        ? KanbanStage.DOC_INICIAL_APROVADA
        : (rest.kanbanStage as KanbanStage);

    return { ...rest, kanbanEligible, kanbanStage };
  }

  private isKanbanEligible(
    step2: { data: Prisma.JsonValue; locked: boolean; status: ProcessStatus } | null | undefined,
    step3: { data: Prisma.JsonValue } | null | undefined,
    documents: Array<{ itemKey: DocumentItemKey; socioId: string | null; status: DocumentItemStatus }>
  ) {
    if (!step2 || !step2.locked) return false;
    const validStep2Statuses: ProcessStatus[] = [ProcessStatus.AGUARDANDO_OPERADOR, ProcessStatus.CONCLUIDO];
    if (!validStep2Statuses.includes(step2.status)) return false;

    const step2Data = (step2.data ?? {}) as Record<string, unknown>;
    if (!this.isStep2DataComplete(step2Data)) return false;

    const step3Data = (step3?.data ?? {}) as Record<string, unknown>;
    if (!this.isStep3DataComplete(step3Data)) return false;

    const socios = this.normalizeSocios(step2Data.quadroSocietario);
    const socioIds = socios
      .map((socio) => socio.socioId)
      .filter((value) => typeof value === "string" && value.trim().length > 0) as string[];

    if (socioIds.length !== socios.length) return false;

    const hasApproved = (itemKey: DocumentItemKey, socioId: string | null) =>
      documents.some(
        (doc) =>
          doc.itemKey === itemKey &&
          (doc.socioId ?? null) === socioId &&
          doc.status === DocumentItemStatus.APROVADO
      );

    for (const socioId of socioIds) {
      if (!hasApproved(DocumentItemKey.IDENTIFICACAO_SOCIOS, socioId)) return false;
      if (!hasApproved(DocumentItemKey.COMPROVANTE_RESIDENCIA, socioId)) return false;
    }

    const endereco = (step2Data.endereco ?? {}) as Record<string, unknown>;
    const escritorioVirtual = String(endereco.escritorioVirtual ?? "").trim();
    if (escritorioVirtual !== "Sim" && !hasApproved(DocumentItemKey.FOTO_FACHADA, null)) {
      return false;
    }

    return true;
  }

  private async syncDocumentItems(processId: string, data: Record<string, unknown>) {
    const socios = this.normalizeSocios(data.quadroSocietario);
    const socioIds = socios
      .map((socio) => socio.socioId)
      .filter((value) => typeof value === "string" && value.length > 0) as string[];

    if (socioIds.length > 0) {
      const existing = await this.prisma.documentItem.findMany({
        where: {
          processId,
          itemKey: { in: [DocumentItemKey.IDENTIFICACAO_SOCIOS, DocumentItemKey.COMPROVANTE_RESIDENCIA] }
        }
      });
      const existingKeys = new Set(existing.map((item) => `${item.itemKey}:${item.socioId ?? ""}`));
      const toCreate: { processId: string; itemKey: DocumentItemKey; socioId: string }[] = [];

      for (const socioId of socioIds) {
        for (const itemKey of [DocumentItemKey.IDENTIFICACAO_SOCIOS, DocumentItemKey.COMPROVANTE_RESIDENCIA]) {
          const key = `${itemKey}:${socioId}`;
          if (!existingKeys.has(key)) {
            toCreate.push({ processId, itemKey, socioId });
            existingKeys.add(key);
          }
        }
      }

      if (toCreate.length > 0) {
        await this.prisma.documentItem.createMany({ data: toCreate });
      }
    }

    const fachada = await this.prisma.documentItem.findFirst({
      where: { processId, itemKey: DocumentItemKey.FOTO_FACHADA, socioId: null }
    });
    if (!fachada) {
      await this.prisma.documentItem.create({
        data: { processId, itemKey: DocumentItemKey.FOTO_FACHADA }
      });
    }
  }

  async createProcessByOperator(
    actor: Actor,
    payload: { nome?: string; email: string; telefone: string; sendEmail?: boolean; sendWhatsapp?: boolean },
    idempotencyKey?: string
  ) {
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    const normalizedPhone = normalizePhone(payload.telefone) ?? payload.telefone;
    const clientEmail = payload.email.trim().toLowerCase();
    const clientName = payload.nome?.trim();
    const companyKey = normalizeCompanyKey(clientName ?? "");

    if (!clientName || !companyKey) {
      throw new BadRequestException("Informe o nome da empresa para iniciar o processo.");
    }

    const { data } = await this.idempotencyService.execute(
      IdempotencyScope.PROCESS_CREATE,
      idempotencyKey,
      {
        actorId: actor.userId ?? null,
        actorRole: actor.role,
        email: clientEmail,
        telefone: normalizedPhone,
        nome: payload.nome ?? null,
        sendEmail: payload.sendEmail ?? true,
        sendWhatsapp: payload.sendWhatsapp ?? Boolean(normalizedPhone)
      },
      async () => {
        await this.cancelInactiveProcessesForCompany(companyKey, clientEmail, normalizedPhone);

        await this.ensureCompanyKeyAvailable(companyKey);

        const checklistDefaults = this.buildChecklistData();
        let process;
        try {
          process = await this.prisma.process.create({
            data: {
              clientName,
              companyKey,
              clientEmail,
              clientPhone: normalizedPhone,
              status: ProcessStatus.AGUARDANDO_CLIENTE,
              currentStep: StepKey.ETAPA_2,
              ownerId: actor.userId,
              steps: {
                create: {
                  stepKey: StepKey.ETAPA_1,
                  side: StepSide.CLIENTE,
                  status: ProcessStatus.CONCLUIDO,
                  data: {
                    nome: clientName,
                    email: clientEmail,
                    telefone: normalizedPhone
                  }
                }
              },
              documents: {
                create: [{ itemKey: DocumentItemKey.FOTO_FACHADA }]
              },
              checklists: {
                create: [
                  {
                    stepKey: StepKey.ETAPA_2,
                    status: "PENDENTE",
                    items: checklistDefaults.step2
                  },
                  {
                    stepKey: StepKey.ETAPA_4,
                    status: "PENDENTE",
                    items: checklistDefaults.step4
                  },
                  {
                    stepKey: StepKey.ETAPA_5,
                    status: "PENDENTE",
                    items: checklistDefaults.step5
                  },
                  {
                    stepKey: StepKey.ETAPA_6,
                    status: "PENDENTE",
                    items: checklistDefaults.step6
                  }
                ]
              },
              ownerHistory: actor.userId
                ? {
                    create: [{ ownerId: actor.userId, assignedBy: actor.userId }]
                  }
                : undefined
            }
          });
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
            throw new BadRequestException(getDuplicateCompanyMessage());
          }
          throw error;
        }

        await this.slaService.startSla(process.id, StepKey.ETAPA_2, StepSide.CLIENTE);

        await this.auditService.record(actor, "process_started", "Process", process.id, {
          clientEmail
        });

        if (actor.userId) {
          await this.notifyOwner(process.id, actor.userId, {
            title: "Processo iniciado",
            body: `Processo ${process.id} iniciado para ${clientName}.`,
            type: "process_started"
          });
        }

        void this.sendProcessWebhook(process.id, "process_started", actor);

        if (payload.sendEmail || payload.sendWhatsapp) {
          await this.sendClientLink(process.id, actor, {
            sendEmail: payload.sendEmail ?? true,
            sendWhatsapp: payload.sendWhatsapp ?? Boolean(normalizedPhone)
          });
        }

        return process;
      },
      1800
    );

    return data;
  }

  async sendClientLink(processId: string, actor: Actor, channels: { sendEmail?: boolean; sendWhatsapp?: boolean }) {
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process) {
      throw new NotFoundException("Processo não encontrado.");
    }

    if (actor.role === "OPERADOR" && process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    const sendEmail = channels.sendEmail ?? true;
    const sendWhatsapp = channels.sendWhatsapp ?? Boolean(process.clientPhone);

    if (!sendEmail && !sendWhatsapp) {
      throw new BadRequestException("Selecione ao menos um canal para envio.");
    }

    await this.authService.requestCustomerLink(
      sendEmail ? process.clientEmail : undefined,
      sendWhatsapp ? process.clientPhone ?? undefined : undefined,
      process.clientName ?? undefined,
      { email: actor.email, role: actor.role },
      { forceNew: true }
    );

    await this.auditService.record(actor, "client_link_sent", "Process", processId, {
      sendEmail,
      sendWhatsapp
    });

    return { ok: true };
  }

  async listProcesses(actor: Actor, options?: { take?: number; skip?: number }) {
    const take = options?.take && options.take > 0 ? Math.min(options.take, 200) : 100;
    const skip = options?.skip && options.skip > 0 ? options.skip : 0;
    if (actor.role === "CLIENTE") {
      if (actor.email) {
        return this.prisma.process.findMany({
          where: { clientEmail: actor.email },
          orderBy: { createdAt: "desc" },
          take,
          skip
        });
      }
      if (actor.whatsapp) {
        return this.prisma.process.findMany({
          where: { clientPhone: normalizePhone(actor.whatsapp) ?? actor.whatsapp },
          orderBy: { createdAt: "desc" },
          take,
          skip
        });
      }
      return this.prisma.process.findMany({
        where: { clientEmail: "" },
        orderBy: { createdAt: "desc" },
        take,
        skip
      });
    }

    if (actor.role === "OPERADOR" || actor.role === "MASTER") {
      const processes = await this.prisma.process.findMany({
        where: actor.role === "OPERADOR" ? { ownerId: actor.userId } : undefined,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          steps: {
            where: { stepKey: { in: [StepKey.ETAPA_2, StepKey.ETAPA_3] } },
            select: { stepKey: true, data: true, locked: true, status: true }
          },
          documents: {
            select: { itemKey: true, socioId: true, status: true }
          }
        }
      });

      return processes.map((process) => this.mapWithKanbanEligibility(process));
    }

    return this.prisma.process.findMany({
      orderBy: { createdAt: "desc" },
      take,
      skip
    });
  }

  async listKanbanProcesses(actor: Actor, options?: { take?: number; skip?: number }) {
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    const take = options?.take && options.take > 0 ? Math.min(options.take, 200) : 200;
    const skip = options?.skip && options.skip > 0 ? options.skip : 0;

    const processes = await this.prisma.process.findMany({
      where: actor.role === "OPERADOR" ? { ownerId: actor.userId } : undefined,
      orderBy: { createdAt: "desc" },
      take,
      skip,
      include: {
        steps: {
          where: { stepKey: { in: [StepKey.ETAPA_2, StepKey.ETAPA_3] } },
          select: { stepKey: true, data: true, locked: true, status: true }
        },
        documents: {
          select: { itemKey: true, socioId: true, status: true }
        }
      }
    });

    return processes
      .map((process) => this.mapWithKanbanEligibility(process))
      .filter((process) => process.kanbanEligible === true);
  }

  private async cancelInactiveProcessesForCompany(companyKey: string, email: string, phone?: string | null) {
    const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const normalizedPhone = phone ? normalizePhone(phone) ?? phone : undefined;
    const candidates = await this.prisma.process.findMany({
      where: {
        companyKey,
        status: ProcessStatus.AGUARDANDO_CLIENTE,
        currentStep: StepKey.ETAPA_2,
        createdAt: { lte: fiveDaysAgo },
        OR: [
          { clientEmail: email },
          normalizedPhone ? { clientPhone: normalizedPhone } : { id: "__none__" }
        ]
      },
      include: {
        steps: { where: { stepKey: StepKey.ETAPA_2 }, take: 1 }
      }
    });

    for (const process of candidates) {
      const step = process.steps[0];
      const data = (step?.data ?? {}) as Record<string, unknown>;
      if (hasAnyValue(data)) {
        continue;
      }
      await this.prisma.process.update({
        where: { id: process.id },
        data: {
          status: ProcessStatus.CANCELADO,
          cancelledAt: new Date(),
          cancelledByRole: "SYSTEM",
          cancelReason: "Inatividade do cliente"
        }
      });
    }
  }

  async getProcess(processId: string, actor: Actor) {
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: {
        steps: true,
        checklists: true,
        slaEvents: true
      }
    });
    if (!process) {
      throw new NotFoundException("Processo não encontrado.");
    }

    if (actor.role === "CLIENTE" && !isClientOwner(actor, process.clientEmail, process.clientPhone)) {
      throw new ForbiddenException();
    }

    if (actor.role === "OPERADOR" && process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    return process;
  }

  async createAlteracaoContratual(processId: string, actor: Actor, alterationType: string) {
    if (actor.role !== "CLIENTE") {
      throw new ForbiddenException();
    }

    const process = await this.getProcess(processId, actor);
    if (process.status !== ProcessStatus.CONCLUIDO) {
      throw new BadRequestException("A alteração contratual só pode ser solicitada após a conclusão do processo.");
    }

    const request = await this.prisma.$transaction(async (tx) => {
      const created = await tx.alteracaoContratual.upsert({
        where: { processId_alterationType: { processId, alterationType } },
        update: {},
        create: { processId, alterationType, requestedByRole: actor.role, requestedById: actor.userId }
      });
      await tx.alteracaoContratualHistory.createMany({
        skipDuplicates: true,
        data: [{ alteracaoId: created.id, toStage: created.stage, version: created.version, actorRole: actor.role, actorId: actor.userId }]
      });
      return created;
    });

    await this.auditService.record(actor, "alteracao_contratual_requested", "AlteracaoContratual", request.id, {
      processId,
      alterationType
    });

    return request;
  }

  async listAlteracaoContratual(processId: string, actor: Actor) {
    await this.getProcess(processId, actor);
    return this.prisma.alteracaoContratual.findMany({
      where: { processId },
      orderBy: { updatedAt: "desc" }
    });
  }

  async listAllAlteracaoContratual(actor: Actor) {
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    return this.prisma.alteracaoContratual.findMany({
      where: actor.role === "OPERADOR" ? { process: { ownerId: actor.userId } } : undefined,
      orderBy: { updatedAt: "desc" },
      take: 200,
      include: { process: { select: { id: true, clientName: true, clientEmail: true, ownerId: true } } }
    });
  }

  async updateAlteracaoContratualStage(id: string, actor: Actor, stage: AlteracaoContratualStage, expectedVersion: number) {
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    const current = await this.prisma.alteracaoContratual.findUnique({
      where: { id },
      include: { process: { select: { ownerId: true } } }
    });
    if (!current) throw new NotFoundException("Solicitação de alteração não encontrada.");
    if (actor.role === "OPERADOR" && current.process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }
    if (current.stage === stage) return { ok: true, alreadyInStage: true, request: current };

    const stages: AlteracaoContratualStage[] = [
      AlteracaoContratualStage.SOLICITACAO_RECEBIDA,
      AlteracaoContratualStage.ANALISE_JURIDICA,
      AlteracaoContratualStage.AJUSTES_DOCUMENTAIS,
      AlteracaoContratualStage.PROTOCOLO,
      AlteracaoContratualStage.FINALIZADO
    ];
    if (Math.abs(stages.indexOf(stage) - stages.indexOf(current.stage)) !== 1) {
      throw new BadRequestException("Transição de etapa inválida.");
    }
    if (expectedVersion !== current.version) {
      throw new BadRequestException("A solicitação foi alterada por outro operador. Atualize a tela.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.alteracaoContratual.updateMany({
        where: { id, stage: current.stage, version: expectedVersion },
        data: { stage, version: { increment: 1 } }
      });
      if (result.count !== 1) throw new BadRequestException("A solicitação foi alterada por outro operador. Atualize a tela.");
      const updatedRequest = await tx.alteracaoContratual.findUniqueOrThrow({ where: { id } });
      await tx.alteracaoContratualHistory.create({
        data: { alteracaoId: id, fromStage: current.stage, toStage: stage, version: updatedRequest.version, actorRole: actor.role, actorId: actor.userId }
      });
      return updatedRequest;
    });

    await this.auditService.record(actor, "alteracao_contratual_stage_updated", "AlteracaoContratual", id, {
      from: current.stage,
      to: stage
    });
    return { ok: true, request: updated };
  }

  private ensureNotReadOnly(process: { status: ProcessStatus }) {
    if (process.status === ProcessStatus.CANCELADO || process.status === ProcessStatus.CONCLUIDO) {
      throw new BadRequestException("Processo somente leitura.");
    }
  }

  async updateStep(processId: string, actor: Actor, stepKey: StepKey, data: Record<string, unknown>) {
    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (actor.role === "MASTER") {
      throw new ForbiddenException();
    }

    const operatorEditingClientStep =
      actor.role === "OPERADOR" && stepKey === StepKey.ETAPA_2 && process.currentStep === StepKey.ETAPA_2;

    const operatorPreStep3 =
      actor.role === "OPERADOR" && stepKey === "ETAPA_3" && process.currentStep === "ETAPA_2";

    if (process.currentStep !== stepKey && !operatorPreStep3) {
      throw new BadRequestException("Etapa não é a atual do processo.");
    }

    if (actor.role === "CLIENTE" && !CLIENT_STEPS.includes(stepKey)) {
      throw new ForbiddenException();
    }
    if (actor.role === "OPERADOR" && !OPERATOR_STEPS.includes(stepKey) && !operatorEditingClientStep) {
      throw new ForbiddenException();
    }

    const safeData = operatorEditingClientStep ? sanitizeClientStep2(data) : data;

    const existing = await this.prisma.processStep.findUnique({
      where: { processId_stepKey: { processId, stepKey } }
    });

    if (existing?.locked && actor.role === "CLIENTE") {
      const existingData =
        existing.data !== null && typeof existing.data === "object" && !Array.isArray(existing.data)
          ? (existing.data as Record<string, unknown>)
          : {};
      const correction =
        existingData.correction !== null &&
        typeof existingData.correction === "object" &&
        !Array.isArray(existingData.correction)
          ? (existingData.correction as Record<string, unknown>)
          : {};
      const allowedFields = Array.isArray(correction.fields) ? correction.fields : [];
      const invalid = Object.keys(safeData).filter((key) => !allowedFields.includes(key));
      if (invalid.length > 0) {
        throw new BadRequestException("Campos não liberados para correção.");
      }
    }

    const existingData = (existing?.data ?? {}) as Record<string, unknown>;
    const merged = {
      ...existingData,
      ...safeData
    } as Prisma.InputJsonValue;

    const updated = await this.prisma.processStep.upsert({
      where: { processId_stepKey: { processId, stepKey } },
      update: {
        data: merged,
        status: ProcessStatus.EM_ANDAMENTO
      },
      create: {
        processId,
        stepKey,
        side: stepSide(stepKey),
        data: merged,
        status: ProcessStatus.EM_ANDAMENTO
      }
    });

    if (stepKey === "ETAPA_2") {
      const step2CompanyKey = this.getStep2CompanyKey(merged as Record<string, unknown>);
      if (step2CompanyKey) {
        await this.ensureCompanyKeyAvailable(step2CompanyKey, processId);
        await this.prisma.process.update({
          where: { id: processId },
          data: { companyKey: step2CompanyKey }
        });
      }
      await this.syncDocumentItems(processId, merged as Record<string, unknown>);
    }

    if (operatorPreStep3) {
      await this.prisma.$transaction(async (tx) => {
        await tx.process.update({
          where: { id: processId },
          data: {
            currentStep: "ETAPA_3",
            status: ProcessStatus.AGUARDANDO_OPERADOR
          }
        });
        await this.stopSlaTx(tx, processId, "ETAPA_2", "CLIENTE");
        await this.startSlaTx(tx, processId, "ETAPA_3", "OPERADOR");
      });
    }

    await this.auditService.record(actor, "update_step", "ProcessStep", updated.id, {
      stepKey,
      actorMode: operatorEditingClientStep ? "client_data_validation_edit" : "standard",
      changedFields: Object.keys(safeData)
    });

    return updated;
  }

  async submitStep(processId: string, actor: Actor, stepKey: StepKey) {
    if (actor.role !== "CLIENTE") {
      throw new ForbiddenException();
    }

    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (process.currentStep !== stepKey) {
      throw new BadRequestException("Etapa inválida.");
    }

    const current = await this.prisma.processStep.findUnique({
      where: { processId_stepKey: { processId, stepKey } }
    });
    if (!current) {
      throw new BadRequestException("Etapa ainda não preenchida.");
    }
    // Idempotency: avoid double delivery if the client retries the submit request.
    if (current.locked && current.status === ProcessStatus.AGUARDANDO_OPERADOR) {
      return { ok: true, alreadySubmitted: true };
    }

    if (stepKey === StepKey.ETAPA_2) {
      const step2Data = (current.data ?? {}) as Record<string, unknown>;
      const missing = this.getStep2MissingFields(step2Data);
      if (missing.missing.length > 0) {
        throw new BadRequestException({
          message: "Formulário do cliente incompleto.",
          code: "STEP2_INCOMPLETE",
          missingFields: missing.missingFields,
          missingLabels: missing.missing
        });
      }

      const step2CompanyKey = this.getStep2CompanyKey(step2Data);
      if (step2CompanyKey) {
        await this.ensureCompanyKeyAvailable(step2CompanyKey, processId);
      }

      const docs = await this.prisma.documentItem.findMany({
        where: { processId },
        select: {
          itemKey: true,
          socioId: true,
          files: { select: { id: true }, take: 1 }
        }
      });

      if (!this.hasRequiredUploadedDocuments(step2Data, docs)) {
        throw new BadRequestException("Documentação obrigatória ainda não foi enviada.");
      }
    }

    const submitResult = await this.prisma.$transaction(async (tx) => {
      const lock = await tx.processStep.updateMany({
        where: {
          processId,
          stepKey,
          locked: false
        },
        data: { status: ProcessStatus.AGUARDANDO_OPERADOR, locked: true }
      });

      if (lock.count === 0) {
        const already = await tx.processStep.findUnique({
          where: { processId_stepKey: { processId, stepKey } },
          select: { locked: true, status: true }
        });
        if (already?.locked && already.status === ProcessStatus.AGUARDANDO_OPERADOR) {
          return { alreadySubmitted: true };
        }
        throw new BadRequestException("Não foi possível submeter a etapa no estado atual.");
      }

      await tx.process.update({
        where: { id: processId },
        data: {
          status: ProcessStatus.AGUARDANDO_OPERADOR,
          ...(stepKey === StepKey.ETAPA_2
            ? {
                companyKey: this.getStep2CompanyKey((current.data ?? {}) as Record<string, unknown>) ?? process.companyKey
              }
            : {})
        }
      });
      await this.stopSlaTx(tx, processId, stepKey, "CLIENTE");
      await this.startSlaTx(tx, processId, stepKey, "OPERADOR");
      return { alreadySubmitted: false };
    });

    if (submitResult.alreadySubmitted) {
      return { ok: true, alreadySubmitted: true };
    }

    await this.auditService.record(actor, "submit_step", "Process", processId, { stepKey });

    await this.notifyOwner(processId, process.ownerId ?? null, {
      title: "Cliente enviou o formulário",
      body: `O cliente ${process.clientEmail} enviou o formulário final da etapa ${getStepLabel(stepKey)}.`,
      type: "client_submitted"
    });

    await this.notificationService.sendEmail(
      process.clientEmail,
      "Recebemos seus dados",
      [
        "Obrigado por mandar os seus documentos.",
        "Aguarde o contato por e-mail ou WhatsApp para acompanhar o andamento.",
        "",
        `Processo: ${process.id}`,
        `Etapa enviada: ${getStepLabel(stepKey)}`
      ].join("\n")
    );

    void this.sendProcessWebhook(processId, "client_submitted", actor, { stepKey });

    return { ok: true };
  }

  async sendClientOtp(processId: string, actor: Actor) {
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process) {
      throw new NotFoundException("Processo não encontrado.");
    }

    if (actor.role === "OPERADOR" && process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    await this.authService.resendCustomerOtpByEmail(process.clientEmail, { email: actor.email, role: actor.role });

    await this.auditService.record(actor, "client_otp_sent", "Process", processId, {
      email: process.clientEmail
    });

    return { ok: true };
  }

  async approveStep(processId: string, actor: Actor, stepKey: StepKey) {
    if (actor.role !== "OPERADOR") {
      throw new ForbiddenException();
    }

    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    if (process.currentStep !== stepKey) {
      throw new BadRequestException("Etapa inválida para aprovação.");
    }

    const checklist = await this.prisma.checklist.findUnique({
      where: { processId_stepKey: { processId, stepKey } }
    });
    if (checklist && checklist.status !== "COMPLETO") {
      throw new BadRequestException("Checklist incompleto.");
    }

    if (stepKey === "ETAPA_6") {
      const docs = await this.prisma.documentItem.findMany({ where: { processId } });
      const pending = docs.find((doc) => doc.status !== "APROVADO");
      if (pending) {
        throw new BadRequestException("Documentos pendentes de aprovação.");
      }
    }

    const next = nextStep(stepKey);
    if (!next) {
      await this.prisma.$transaction(async (tx) => {
        await tx.processStep.update({
          where: { processId_stepKey: { processId, stepKey } },
          data: { status: ProcessStatus.CONCLUIDO, locked: true }
        });
        await this.stopSlaTx(tx, processId, stepKey, "OPERADOR");
        await tx.process.update({
          where: { id: processId },
          data: { status: ProcessStatus.CONCLUIDO, currentStep: stepKey }
        });
        await this.stopAllSlaTx(tx, processId);
      });

      await Promise.all([
        this.sendProcessEventEmails(processId, "process_completed"),
        this.notificationService.sendWhatsApp(process.clientPhone ?? process.clientEmail, "Processo concluido.")
      ]);
      await this.auditService.record(actor, "process_completed", "Process", processId);
      void this.sendProcessWebhook(processId, "process_completed", actor);
      return { ok: true, status: "CONCLUIDO" };
    }

    const nextSide = stepSide(next);
    const newStatus = nextSide === "CLIENTE" ? ProcessStatus.AGUARDANDO_CLIENTE : ProcessStatus.AGUARDANDO_OPERADOR;

    await this.prisma.$transaction(async (tx) => {
      await tx.processStep.update({
        where: { processId_stepKey: { processId, stepKey } },
        data: { status: ProcessStatus.CONCLUIDO, locked: true }
      });
      await this.stopSlaTx(tx, processId, stepKey, "OPERADOR");
      await tx.process.update({
        where: { id: processId },
        data: { status: newStatus, currentStep: next }
      });
      await this.startSlaTx(tx, processId, next, nextSide);
    });

    await this.auditService.record(actor, "approve_step", "Process", processId, { stepKey });

    void this.sendProcessEventEmails(processId, "step_approved", { stepKey, nextStep: next });
    void this.sendProcessWebhook(processId, "step_approved", actor, { stepKey, nextStep: next });

    return { ok: true, nextStep: next };
  }

  async requestCorrection(processId: string, actor: Actor, stepKey: StepKey, fields: string[], reason: string) {
    if (actor.role !== "OPERADOR") {
      throw new ForbiddenException();
    }
    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    if (process.currentStep !== stepKey) {
      throw new BadRequestException("Etapa inválida para correção.");
    }

    const step = await this.prisma.processStep.findUnique({
      where: { processId_stepKey: { processId, stepKey } }
    });
    if (!step) {
      throw new BadRequestException("Etapa ainda não preenchida.");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const stepUpdated = await tx.processStep.update({
        where: { processId_stepKey: { processId, stepKey } },
        data: {
          status: ProcessStatus.CORRECAO_SOLICITADA,
          locked: false,
          data: {
            ...(step.data !== null && typeof step.data === "object" && !Array.isArray(step.data)
              ? (step.data as Record<string, unknown>)
              : {}),
            correction: {
              fields,
              reason
            }
          }
        }
      });

      await tx.process.update({
        where: { id: processId },
        data: { status: ProcessStatus.CORRECAO_SOLICITADA }
      });
      await this.stopSlaTx(tx, processId, stepKey, "OPERADOR");
      await this.startSlaTx(tx, processId, stepKey, "CLIENTE");
      return stepUpdated;
    });

    await Promise.all([
      this.notificationService.sendEmail(
        process.clientEmail,
        "Correcao solicitada",
        `Correcao solicitada na etapa ${getStepLabel(stepKey)}: ${reason}`
      ),
      this.notificationService.sendWhatsApp(
        process.clientPhone ?? process.clientEmail,
        `Correção solicitada na etapa ${getStepLabel(stepKey)}: ${reason}`
      )
    ]);

    await this.notifyOwner(processId, process.ownerId ?? null, {
      title: "Correção solicitada",
      body: `Correção solicitada na etapa ${getStepLabel(stepKey)} para ${process.clientEmail}.`,
      type: "correction_requested"
    });

    await this.auditService.record(actor, "request_correction", "Process", processId, { stepKey, fields, reason });

    void this.sendProcessWebhook(processId, "correction_requested", actor, {
      correction: { stepKey, fields, reason }
    });

    return updated;
  }

  async markInProgress(processId: string, actor: Actor) {
    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    if (actor.role !== "OPERADOR") {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.process.update({
      where: { id: processId },
      data: { status: ProcessStatus.EM_ANDAMENTO }
    });

    await this.auditService.record(actor, "mark_in_progress", "Process", processId);

    void this.sendProcessEventEmails(processId, "process_marked_in_progress");
    void this.sendProcessWebhook(processId, "process_marked_in_progress", actor);

    return updated;
  }

  async updateClientStatus(processId: string, actor: Actor, message: string) {
    const text = message.trim();
    if (!text) {
      throw new BadRequestException("Informe uma mensagem de status.");
    }
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process) {
      throw new NotFoundException("Processo não encontrado.");
    }
    this.ensureNotReadOnly(process);

    if (actor.role === "OPERADOR" && process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    const updated = await this.prisma.process.update({
      where: { id: processId },
      data: { operatorStatusNote: text }
    });

    const statusBody = [
      "Atualização do seu processo FundarMF",
      "",
      `Processo: ${process.id}`,
      `Status atual: ${process.status}`,
      `Etapa atual: ${getStepLabel(process.currentStep)}`,
      "",
      `Mensagem do operador: ${text}`,
      "",
      "Acompanhe as próximas atualizações pelo portal."
    ].join("\n");

    await Promise.all([
      this.notificationService.sendEmail(process.clientEmail, `Atualização do processo ${process.id}`, statusBody),
      this.notificationService.sendWhatsApp(process.clientPhone ?? process.clientEmail, statusBody)
    ]);

    await this.auditService.record(actor, "client_status_update", "Process", processId, {
      message: text
    });

    return { ok: true, message: text, process: updated };
  }

  async updateKanbanStage(processId: string, actor: Actor, kanbanStage: KanbanStage) {
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      include: {
        steps: {
          where: { stepKey: { in: [StepKey.ETAPA_2, StepKey.ETAPA_3] } },
          select: { stepKey: true, data: true, locked: true, status: true }
        },
        documents: {
          select: { itemKey: true, socioId: true, status: true }
        }
      }
    });
    if (!process) {
      throw new NotFoundException("Processo não encontrado.");
    }
    this.ensureNotReadOnly(process);

    if (actor.role === "OPERADOR" && process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    if (process.kanbanStage === kanbanStage) {
      return { ok: true, alreadyInStage: true, process };
    }

    const step2 = process.steps.find((step) => step.stepKey === StepKey.ETAPA_2);
    const step3 = process.steps.find((step) => step.stepKey === StepKey.ETAPA_3);
    if (!this.isKanbanEligible(step2, step3, process.documents)) {
      throw new BadRequestException(
        "Processo ainda não está apto para o Kanban. Finalize o preenchimento do cliente e a validação do operador."
      );
    }

    const updated = await this.prisma.process.update({
      where: { id: processId },
      data: { kanbanStage }
    });

    await this.auditService.record(actor, "kanban_stage_updated", "Process", processId, {
      from: process.kanbanStage,
      to: kanbanStage
    });

    await this.sendKanbanStageEmail(processId, kanbanStage, actor);

    return { ok: true, process: updated };
  }

  async cancelProcess(processId: string, actor: Actor, reason: string) {
    const process = await this.getProcess(processId, actor);
    this.ensureNotReadOnly(process);

    await this.prisma.$transaction(async (tx) => {
      await tx.process.update({
        where: { id: processId },
        data: {
          status: ProcessStatus.CANCELADO,
          cancelledAt: new Date(),
          cancelledByRole: actor.role,
          cancelledById: actor.userId,
          cancelReason: reason
        }
      });

      await tx.processStep.updateMany({
        where: { processId },
        data: { locked: true }
      });

      await this.stopAllSlaTx(tx, processId);
    });

    await Promise.all([
      this.sendProcessEventEmails(processId, "process_cancelled", { cancelReason: reason }),
      this.notificationService.sendWhatsApp(
        process.clientPhone ?? process.clientEmail,
        `Processo cancelado. Motivo: ${reason}`
      )
    ]);

    await this.auditService.record(actor, "process_cancelled", "Process", processId, { reason });

    void this.sendProcessWebhook(processId, "process_cancelled", actor, { cancelReason: reason });

    return { ok: true };
  }
}
