"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcessService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../shared/prisma.service");
const identity_1 = require("../../common/auth/identity");
const sla_service_1 = require("../sla/sla.service");
const audit_service_1 = require("../audit/audit.service");
const notification_service_1 = require("../notification/notification.service");
const auth_service_1 = require("../auth/auth.service");
const process_email_drafts_1 = require("../notification/process-email-drafts");
const CLIENT_STEPS = ["ETAPA_1", "ETAPA_2", "ETAPA_4", "ETAPA_5", "ETAPA_6"];
const OPERATOR_STEPS = ["ETAPA_3"];
function nextStep(step) {
    const order = ["ETAPA_1", "ETAPA_2", "ETAPA_3", "ETAPA_4", "ETAPA_5", "ETAPA_6"];
    const index = order.indexOf(step);
    if (index === -1 || index === order.length - 1)
        return null;
    return order[index + 1];
}
function stepSide(step) {
    return step === "ETAPA_3" ? "OPERADOR" : "CLIENTE";
}
function hasAnyValue(value) {
    if (value === null || value === undefined)
        return false;
    if (typeof value === "string")
        return value.trim().length > 0;
    if (typeof value === "number")
        return true;
    if (typeof value === "boolean")
        return value === true;
    if (Array.isArray(value))
        return value.some((item) => hasAnyValue(item));
    if (typeof value === "object") {
        return Object.values(value).some((item) => hasAnyValue(item));
    }
    return false;
}
let ProcessService = class ProcessService {
    prisma;
    slaService;
    auditService;
    notificationService;
    authService;
    constructor(prisma, slaService, auditService, notificationService, authService) {
        this.prisma = prisma;
        this.slaService = slaService;
        this.auditService = auditService;
        this.notificationService = notificationService;
        this.authService = authService;
    }
    async sendProcessWebhook(processId, event, actor, details) {
        try {
            const process = await this.prisma.process.findUnique({ where: { id: processId } });
            if (!process)
                return;
            const owner = process.ownerId && process.ownerId.length > 0
                ? await this.prisma.user.findUnique({ where: { id: process.ownerId } }).catch(() => null)
                : null;
            const drafts = (0, process_email_drafts_1.buildProcessEmailDrafts)({
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
                    client: drafts.client ? { to: process.clientEmail, ...drafts.client } : undefined,
                    operator: drafts.operator ? { to: owner?.email ?? undefined, ...drafts.operator } : undefined,
                    both: drafts.both ? { ...drafts.both } : undefined
                }
            });
        }
        catch (err) {
            console.warn("[process] sendProcessWebhook failed", err);
        }
    }
    async notifyOwner(processId, ownerId, payload) {
        if (!ownerId)
            return;
        const owner = await this.prisma.user.findUnique({ where: { id: ownerId } });
        if (!owner)
            return;
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
    buildChecklistData() {
        return {
            step2: {
                razoesSociais: false,
                municipio: false,
                contatoCnpj: false
            },
            step4: {
                dadosCompletos: false,
                percentuaisOk: false,
                administradores: false,
                responsavelCnpj: false
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
    normalizeSocios(raw) {
        if (Array.isArray(raw)) {
            return raw.filter((item) => item && typeof item === "object");
        }
        if (raw && typeof raw === "object") {
            return [raw];
        }
        return [];
    }
    async syncDocumentItems(processId, data) {
        const socios = this.normalizeSocios(data.quadroSocietario);
        const socioIds = socios
            .map((socio) => socio.socioId)
            .filter((value) => typeof value === "string" && value.length > 0);
        if (socioIds.length > 0) {
            const existing = await this.prisma.documentItem.findMany({
                where: {
                    processId,
                    itemKey: { in: [client_1.DocumentItemKey.IDENTIFICACAO_SOCIOS, client_1.DocumentItemKey.COMPROVANTE_RESIDENCIA] }
                }
            });
            const existingKeys = new Set(existing.map((item) => `${item.itemKey}:${item.socioId ?? ""}`));
            const toCreate = [];
            for (const socioId of socioIds) {
                for (const itemKey of [client_1.DocumentItemKey.IDENTIFICACAO_SOCIOS, client_1.DocumentItemKey.COMPROVANTE_RESIDENCIA]) {
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
            where: { processId, itemKey: client_1.DocumentItemKey.FOTO_FACHADA, socioId: null }
        });
        if (!fachada) {
            await this.prisma.documentItem.create({
                data: { processId, itemKey: client_1.DocumentItemKey.FOTO_FACHADA }
            });
        }
    }
    async createProcessByOperator(actor, payload) {
        if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
            throw new common_1.ForbiddenException();
        }
        const normalizedPhone = (0, identity_1.normalizePhone)(payload.telefone) ?? payload.telefone;
        const clientName = payload.nome?.trim() || payload.email?.split("@")[0] || "Cliente";
        await this.cancelInactiveProcessesForClient(payload.email, normalizedPhone);
        const active = await this.prisma.process.findFirst({
            where: {
                clientEmail: payload.email,
                status: { notIn: [client_1.ProcessStatus.CONCLUIDO, client_1.ProcessStatus.CANCELADO] }
            }
        });
        if (active) {
            throw new common_1.BadRequestException("J existe um processo ativo para este e-mail.");
        }
        const checklistDefaults = this.buildChecklistData();
        const process = await this.prisma.process.create({
            data: {
                clientName,
                clientEmail: payload.email,
                clientPhone: normalizedPhone,
                status: client_1.ProcessStatus.AGUARDANDO_CLIENTE,
                currentStep: client_1.StepKey.ETAPA_2,
                ownerId: actor.userId,
                steps: {
                    create: {
                        stepKey: client_1.StepKey.ETAPA_1,
                        side: client_1.StepSide.CLIENTE,
                        status: client_1.ProcessStatus.CONCLUIDO,
                        data: {
                            nome: clientName,
                            email: payload.email,
                            telefone: normalizedPhone
                        }
                    }
                },
                documents: {
                    create: [{ itemKey: client_1.DocumentItemKey.FOTO_FACHADA }]
                },
                checklists: {
                    create: [
                        {
                            stepKey: client_1.StepKey.ETAPA_2,
                            status: "PENDENTE",
                            items: checklistDefaults.step2
                        },
                        {
                            stepKey: client_1.StepKey.ETAPA_4,
                            status: "PENDENTE",
                            items: checklistDefaults.step4
                        },
                        {
                            stepKey: client_1.StepKey.ETAPA_5,
                            status: "PENDENTE",
                            items: checklistDefaults.step5
                        },
                        {
                            stepKey: client_1.StepKey.ETAPA_6,
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
        await this.slaService.startSla(process.id, client_1.StepKey.ETAPA_2, client_1.StepSide.CLIENTE);
        await this.auditService.record(actor, "process_started", "Process", process.id, {
            clientEmail: payload.email
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
    }
    async sendClientLink(processId, actor, channels) {
        if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
            throw new common_1.ForbiddenException();
        }
        const process = await this.prisma.process.findUnique({ where: { id: processId } });
        if (!process) {
            throw new common_1.NotFoundException("Processo não encontrado.");
        }
        if (actor.role === "OPERADOR" && process.ownerId !== actor.userId) {
            throw new common_1.ForbiddenException();
        }
        const sendEmail = channels.sendEmail ?? true;
        const sendWhatsapp = channels.sendWhatsapp ?? Boolean(process.clientPhone);
        if (!sendEmail && !sendWhatsapp) {
            throw new common_1.BadRequestException("Selecione ao menos um canal para envio.");
        }
        await this.authService.requestCustomerLink(sendEmail ? process.clientEmail : undefined, sendWhatsapp ? process.clientPhone ?? undefined : undefined, process.clientName ?? undefined);
        await this.auditService.record(actor, "client_link_sent", "Process", processId, {
            sendEmail,
            sendWhatsapp
        });
        return { ok: true };
    }
    async listProcesses(actor, options) {
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
                    where: { clientPhone: (0, identity_1.normalizePhone)(actor.whatsapp) ?? actor.whatsapp },
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
        if (actor.role === "OPERADOR") {
            return this.prisma.process.findMany({
                where: { ownerId: actor.userId },
                orderBy: { createdAt: "desc" },
                take,
                skip
            });
        }
        return this.prisma.process.findMany({
            orderBy: { createdAt: "desc" },
            take,
            skip
        });
    }
    async cancelInactiveProcessesForClient(email, phone) {
        const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
        const normalizedPhone = phone ? (0, identity_1.normalizePhone)(phone) ?? phone : undefined;
        const candidates = await this.prisma.process.findMany({
            where: {
                status: client_1.ProcessStatus.AGUARDANDO_CLIENTE,
                currentStep: client_1.StepKey.ETAPA_2,
                createdAt: { lte: fiveDaysAgo },
                OR: [
                    { clientEmail: email },
                    normalizedPhone ? { clientPhone: normalizedPhone } : { id: "__none__" }
                ]
            },
            include: {
                steps: { where: { stepKey: client_1.StepKey.ETAPA_2 }, take: 1 }
            }
        });
        for (const process of candidates) {
            const step = process.steps[0];
            const data = (step?.data ?? {});
            if (hasAnyValue(data)) {
                continue;
            }
            await this.prisma.process.update({
                where: { id: process.id },
                data: {
                    status: client_1.ProcessStatus.CANCELADO,
                    cancelledAt: new Date(),
                    cancelledByRole: "SYSTEM",
                    cancelReason: "Inatividade do cliente"
                }
            });
        }
    }
    async getProcess(processId, actor) {
        const process = await this.prisma.process.findUnique({
            where: { id: processId },
            include: {
                steps: true,
                checklists: true,
                slaEvents: true
            }
        });
        if (!process) {
            throw new common_1.NotFoundException("Processo não encontrado.");
        }
        if (actor.role === "CLIENTE" && !(0, identity_1.isClientOwner)(actor, process.clientEmail, process.clientPhone)) {
            throw new common_1.ForbiddenException();
        }
        if (actor.role === "OPERADOR" && process.ownerId !== actor.userId) {
            throw new common_1.ForbiddenException();
        }
        return process;
    }
    ensureNotReadOnly(process) {
        if (process.status === client_1.ProcessStatus.CANCELADO || process.status === client_1.ProcessStatus.CONCLUIDO) {
            throw new common_1.BadRequestException("Processo somente leitura.");
        }
    }
    async updateStep(processId, actor, stepKey, data) {
        const process = await this.getProcess(processId, actor);
        this.ensureNotReadOnly(process);
        if (actor.role === "MASTER") {
            throw new common_1.ForbiddenException();
        }
        const operatorPreStep3 = actor.role === "OPERADOR" && stepKey === "ETAPA_3" && process.currentStep === "ETAPA_2";
        if (process.currentStep !== stepKey && !operatorPreStep3) {
            throw new common_1.BadRequestException("Etapa não é a atual do processo.");
        }
        if (actor.role === "CLIENTE" && !CLIENT_STEPS.includes(stepKey)) {
            throw new common_1.ForbiddenException();
        }
        if (actor.role === "OPERADOR" && !OPERATOR_STEPS.includes(stepKey)) {
            throw new common_1.ForbiddenException();
        }
        const existing = await this.prisma.processStep.findUnique({
            where: { processId_stepKey: { processId, stepKey } }
        });
        if (existing?.locked && actor.role === "CLIENTE") {
            const allowedFields = existing.data?.correction?.fields ?? [];
            const invalid = Object.keys(data).filter((key) => !allowedFields.includes(key));
            if (invalid.length > 0) {
                throw new common_1.BadRequestException("Campos não liberados para correção.");
            }
        }
        const existingData = (existing?.data ?? {});
        const merged = {
            ...existingData,
            ...data
        };
        const updated = await this.prisma.processStep.upsert({
            where: { processId_stepKey: { processId, stepKey } },
            update: {
                data: merged,
                status: client_1.ProcessStatus.EM_ANDAMENTO
            },
            create: {
                processId,
                stepKey,
                side: stepSide(stepKey),
                data: merged,
                status: client_1.ProcessStatus.EM_ANDAMENTO
            }
        });
        if (stepKey === "ETAPA_2") {
            await this.syncDocumentItems(processId, merged);
        }
        if (operatorPreStep3) {
            await this.prisma.process.update({
                where: { id: processId },
                data: {
                    currentStep: "ETAPA_3",
                    status: client_1.ProcessStatus.AGUARDANDO_OPERADOR
                }
            });
            await this.slaService.stopSla(processId, "ETAPA_2", "CLIENTE");
            await this.slaService.startSla(processId, "ETAPA_3", "OPERADOR");
        }
        await this.auditService.record(actor, "update_step", "ProcessStep", updated.id, { stepKey });
        return updated;
    }
    async submitStep(processId, actor, stepKey) {
        if (actor.role !== "CLIENTE") {
            throw new common_1.ForbiddenException();
        }
        const process = await this.getProcess(processId, actor);
        this.ensureNotReadOnly(process);
        if (process.currentStep !== stepKey) {
            throw new common_1.BadRequestException("Etapa inválida.");
        }
        await this.prisma.processStep.update({
            where: { processId_stepKey: { processId, stepKey } },
            data: { status: client_1.ProcessStatus.AGUARDANDO_OPERADOR, locked: true }
        });
        await this.prisma.process.update({
            where: { id: processId },
            data: { status: client_1.ProcessStatus.AGUARDANDO_OPERADOR }
        });
        await this.slaService.stopSla(processId, stepKey, "CLIENTE");
        await this.slaService.startSla(processId, stepKey, "OPERADOR");
        await this.auditService.record(actor, "submit_step", "Process", processId, { stepKey });
        await this.notifyOwner(processId, process.ownerId ?? null, {
            title: "Cliente enviou o formulário",
            body: `O cliente ${process.clientEmail} enviou o formulário final da etapa ${stepKey}.`,
            type: "client_submitted"
        });
        void this.sendProcessWebhook(processId, "client_submitted", actor, { stepKey });
        return { ok: true };
    }
    async approveStep(processId, actor, stepKey) {
        if (actor.role !== "OPERADOR") {
            throw new common_1.ForbiddenException();
        }
        const process = await this.getProcess(processId, actor);
        this.ensureNotReadOnly(process);
        if (process.ownerId !== actor.userId) {
            throw new common_1.ForbiddenException();
        }
        if (process.currentStep !== stepKey) {
            throw new common_1.BadRequestException("Etapa inválida para aprovação.");
        }
        const checklist = await this.prisma.checklist.findUnique({
            where: { processId_stepKey: { processId, stepKey } }
        });
        if (checklist && checklist.status !== "COMPLETO") {
            throw new common_1.BadRequestException("Checklist incompleto.");
        }
        if (stepKey === "ETAPA_6") {
            const docs = await this.prisma.documentItem.findMany({ where: { processId } });
            const pending = docs.find((doc) => doc.status !== "APROVADO");
            if (pending) {
                throw new common_1.BadRequestException("Documentos pendentes de aprovação.");
            }
        }
        await this.prisma.processStep.update({
            where: { processId_stepKey: { processId, stepKey } },
            data: { status: client_1.ProcessStatus.CONCLUIDO, locked: true }
        });
        await this.slaService.stopSla(processId, stepKey, "OPERADOR");
        const next = nextStep(stepKey);
        if (!next) {
            await this.prisma.process.update({
                where: { id: processId },
                data: { status: client_1.ProcessStatus.CONCLUIDO, currentStep: stepKey }
            });
            await this.slaService.stopAll(processId);
            await Promise.all([
                this.notificationService.sendEmail(process.clientEmail, "Processo concluído", "Seu processo foi concluído com sucesso."),
                this.notificationService.sendWhatsApp(process.clientPhone ?? process.clientEmail, "Processo concluído.")
            ]);
            await this.auditService.record(actor, "process_completed", "Process", processId);
            void this.sendProcessWebhook(processId, "process_completed", actor);
            return { ok: true, status: "CONCLUIDO" };
        }
        const nextSide = stepSide(next);
        const newStatus = nextSide === "CLIENTE" ? client_1.ProcessStatus.AGUARDANDO_CLIENTE : client_1.ProcessStatus.AGUARDANDO_OPERADOR;
        await this.prisma.process.update({
            where: { id: processId },
            data: { status: newStatus, currentStep: next }
        });
        await this.slaService.startSla(processId, next, nextSide);
        await this.auditService.record(actor, "approve_step", "Process", processId, { stepKey });
        void this.sendProcessWebhook(processId, "step_approved", actor, { stepKey, nextStep: next });
        return { ok: true, nextStep: next };
    }
    async requestCorrection(processId, actor, stepKey, fields, reason) {
        if (actor.role !== "OPERADOR") {
            throw new common_1.ForbiddenException();
        }
        const process = await this.getProcess(processId, actor);
        this.ensureNotReadOnly(process);
        if (process.ownerId !== actor.userId) {
            throw new common_1.ForbiddenException();
        }
        if (process.currentStep !== stepKey) {
            throw new common_1.BadRequestException("Etapa inválida para correção.");
        }
        const step = await this.prisma.processStep.findUnique({
            where: { processId_stepKey: { processId, stepKey } }
        });
        if (!step) {
            throw new common_1.BadRequestException("Etapa ainda não preenchida.");
        }
        const updated = await this.prisma.processStep.update({
            where: { processId_stepKey: { processId, stepKey } },
            data: {
                status: client_1.ProcessStatus.CORRECAO_SOLICITADA,
                locked: false,
                data: {
                    ...step.data,
                    correction: {
                        fields,
                        reason
                    }
                }
            }
        });
        await this.prisma.process.update({
            where: { id: processId },
            data: { status: client_1.ProcessStatus.CORRECAO_SOLICITADA }
        });
        await this.slaService.stopSla(processId, stepKey, "OPERADOR");
        await this.slaService.startSla(processId, stepKey, "CLIENTE");
        await Promise.all([
            this.notificationService.sendEmail(process.clientEmail, "Correção solicitada", `Correção solicitada na ${stepKey}: ${reason}`),
            this.notificationService.sendWhatsApp(process.clientPhone ?? process.clientEmail, `Correção solicitada na ${stepKey}: ${reason}`)
        ]);
        await this.notifyOwner(processId, process.ownerId ?? null, {
            title: "Correção solicitada",
            body: `Correção solicitada na ${stepKey} para ${process.clientEmail}.`,
            type: "correction_requested"
        });
        await this.auditService.record(actor, "request_correction", "Process", processId, { stepKey, fields, reason });
        void this.sendProcessWebhook(processId, "correction_requested", actor, {
            correction: { stepKey, fields, reason }
        });
        return updated;
    }
    async markInProgress(processId, actor) {
        const process = await this.getProcess(processId, actor);
        this.ensureNotReadOnly(process);
        if (actor.role !== "OPERADOR") {
            throw new common_1.ForbiddenException();
        }
        const updated = await this.prisma.process.update({
            where: { id: processId },
            data: { status: client_1.ProcessStatus.EM_ANDAMENTO }
        });
        await this.auditService.record(actor, "mark_in_progress", "Process", processId);
        void this.sendProcessWebhook(processId, "process_marked_in_progress", actor);
        return updated;
    }
    async cancelProcess(processId, actor, reason) {
        const process = await this.getProcess(processId, actor);
        this.ensureNotReadOnly(process);
        await this.prisma.process.update({
            where: { id: processId },
            data: {
                status: client_1.ProcessStatus.CANCELADO,
                cancelledAt: new Date(),
                cancelledByRole: actor.role,
                cancelledById: actor.userId,
                cancelReason: reason
            }
        });
        await this.prisma.processStep.updateMany({
            where: { processId },
            data: { locked: true }
        });
        await this.slaService.stopAll(processId);
        await Promise.all([
            this.notificationService.sendEmail(process.clientEmail, "Processo cancelado", `Seu processo foi cancelado. Motivo: ${reason}`),
            this.notificationService.sendWhatsApp(process.clientPhone ?? process.clientEmail, `Processo cancelado. Motivo: ${reason}`)
        ]);
        await this.auditService.record(actor, "process_cancelled", "Process", processId, { reason });
        void this.sendProcessWebhook(processId, "process_cancelled", actor, { cancelReason: reason });
        return { ok: true };
    }
};
exports.ProcessService = ProcessService;
exports.ProcessService = ProcessService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sla_service_1.SlaService,
        audit_service_1.AuditService,
        notification_service_1.NotificationService,
        auth_service_1.AuthService])
], ProcessService);
//# sourceMappingURL=process.service.js.map