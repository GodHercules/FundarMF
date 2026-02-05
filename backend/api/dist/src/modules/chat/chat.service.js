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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const common_1 = require("@nestjs/common");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const prisma_service_1 = require("../../shared/prisma.service");
const identity_1 = require("../../common/auth/identity");
const notification_service_1 = require("../notification/notification.service");
const audit_service_1 = require("../audit/audit.service");
const URGENCY_KEYWORDS = ["urgente", "imediato", "agora", "hoje", "procon", "reclamação", "reclamacao"];
const FRUSTRATION_KEYWORDS = ["não funcionou", "nao funcionou", "já tentei", "ja tentei", "não resolve", "nao resolve", "erro", "falha", "travou"];
let cachedFaq = null;
function normalizeText(value) {
    return value
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "");
}
function loadFaq() {
    if (cachedFaq)
        return cachedFaq;
    const fallback = {
        intents: [],
        fallback: { question: "Posso ajudar com documentos, dados de sócios, endereço, prazos ou erros de upload." }
    };
    try {
        const basePath = process.env.CHAT_FAQ_PATH ?? path_1.default.resolve(process.cwd(), "src/modules/chat/faq.json");
        const raw = fs_1.default.readFileSync(basePath, "utf-8");
        cachedFaq = JSON.parse(raw);
        return cachedFaq;
    }
    catch {
        cachedFaq = fallback;
        return fallback;
    }
}
function findIntent(text, faq) {
    const normalized = normalizeText(text);
    return faq.intents.find((intent) => intent.keywords.some((keyword) => normalized.includes(normalizeText(keyword))));
}
function shouldHandoff(text, attempts) {
    const normalized = normalizeText(text);
    if (URGENCY_KEYWORDS.some((keyword) => normalized.includes(keyword)))
        return true;
    if (FRUSTRATION_KEYWORDS.some((keyword) => normalized.includes(keyword)) && attempts >= 1)
        return true;
    return false;
}
function buildBotMessage(intent) {
    if (!intent)
        return null;
    const extra = intent.followUps?.length ? `\n\n${intent.followUps.map((line) => ` ${line}`).join("\n")}` : "";
    return `${intent.answer}${extra}`;
}
let ChatService = class ChatService {
    prisma;
    notificationService;
    auditService;
    constructor(prisma, notificationService, auditService) {
        this.prisma = prisma;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }
    async ensureAccess(processId, actor) {
        const process = await this.prisma.process.findUnique({ where: { id: processId } });
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
    async notifyOwner(process, payload) {
        if (!process.ownerId)
            return;
        const owner = await this.prisma.user.findUnique({ where: { id: process.ownerId } });
        if (!owner)
            return;
        await this.notificationService.createInApp({
            userId: owner.id,
            processId: process.id,
            title: payload.title,
            body: payload.body,
            type: payload.type
        });
        await this.notificationService.sendEmail(owner.email, payload.title, payload.body);
        await this.notificationService.sendWhatsApp(owner.whatsapp ?? owner.email, payload.body);
    }
    async buildHandoffSummary(processId, threadId, lastMessage) {
        const process = await this.prisma.process.findUnique({ where: { id: processId } });
        const step2 = await this.prisma.processStep.findUnique({
            where: { processId_stepKey: { processId, stepKey: "ETAPA_2" } }
        });
        const step2Data = (step2?.data ?? {});
        const endereco = step2Data.endereco ?? {};
        const socios = Array.isArray(step2Data.quadroSocietario)
            ? step2Data.quadroSocietario
            : step2Data.quadroSocietario
                ? [step2Data.quadroSocietario]
                : [];
        const recent = await this.prisma.chatMessage.findMany({
            where: { threadId },
            orderBy: { createdAt: "desc" },
            take: 8
        });
        const transcript = recent
            .reverse()
            .map((msg) => `${msg.authorRole}: ${msg.body}`)
            .join("\n");
        return [
            `Processo: ${process?.id ?? processId}`,
            `Cliente: ${process?.clientName ?? "-"} (${process?.clientEmail ?? "-"})`,
            `Resumo: ${lastMessage}`,
            `Município: ${step2Data.municipio ?? "-"}`,
            `Endereço virtual: ${endereco.escritorioVirtual ?? "-"}`,
            `Sócios: ${socios.length || 0}`,
            `Sócios (nomes): ${socios.map((s) => s?.socioNome).filter(Boolean).join(", ") || "-"}`,
            `E-mail CNPJ: ${step2Data.emailCnpj ?? "-"}`,
            `Telefone CNPJ: ${step2Data.telefoneCnpj ?? "-"}`,
            `Transcrição recente:\n${transcript || "-"}`
        ].join("\n");
    }
    async listMessages(processId, actor) {
        await this.ensureAccess(processId, actor);
        const thread = await this.prisma.chatThread.findUnique({
            where: { processId },
            include: { messages: { orderBy: { createdAt: "asc" } } }
        });
        if (!thread) {
            return { messages: [] };
        }
        return thread;
    }
    async addMessage(processId, actor, body) {
        const process = await this.ensureAccess(processId, actor);
        const thread = await this.prisma.chatThread.upsert({
            where: { processId },
            update: {},
            create: { processId, botState: { attempts: 0 } }
        });
        const message = await this.prisma.chatMessage.create({
            data: {
                threadId: thread.id,
                authorRole: actor.role === "CLIENTE" ? "CLIENTE" : "OPERADOR",
                authorId: actor.userId,
                body
            }
        });
        if (actor.role === "CLIENTE") {
            await this.notifyOwner(process, {
                title: "Nova mensagem do cliente",
                body,
                type: "chat_from_client"
            });
            const faq = loadFaq();
            const previousState = (thread.botState ?? { attempts: 0 });
            let nextState = {
                attempts: previousState.attempts ?? 0,
                pendingCategory: previousState.pendingCategory ?? null,
                lastIntent: previousState.lastIntent ?? null,
                handoff: previousState.handoff ?? false
            };
            if (!nextState.handoff) {
                const shouldEscalate = shouldHandoff(body, nextState.attempts);
                let intent = shouldEscalate ? undefined : findIntent(body, faq);
                if (!intent && nextState.pendingCategory) {
                    intent = findIntent(body, faq);
                }
                if (intent) {
                    const reply = buildBotMessage(intent);
                    if (reply) {
                        await this.prisma.chatMessage.create({
                            data: {
                                threadId: thread.id,
                                authorRole: "BOT",
                                body: reply
                            }
                        });
                    }
                    nextState = { attempts: 0, pendingCategory: null, lastIntent: intent.id, handoff: false };
                    await this.prisma.chatThread.update({
                        where: { id: thread.id },
                        data: { botState: nextState }
                    });
                }
                else {
                    const attempts = nextState.attempts + 1;
                    if (shouldEscalate || attempts >= 2) {
                        const summary = await this.buildHandoffSummary(process.id, thread.id, body);
                        await this.notifyOwner(process, {
                            title: "Handoff do bot",
                            body: summary,
                            type: "chat_handoff"
                        });
                        await this.prisma.chatThread.update({
                            where: { id: thread.id },
                            data: { botState: { ...nextState, handoff: true, attempts }, handoffAt: new Date() }
                        });
                        await this.prisma.chatMessage.create({
                            data: {
                                threadId: thread.id,
                                authorRole: "BOT",
                                body: "Encaminhei sua dúvida para o operador responsável. Ele retornará em breve."
                            }
                        });
                    }
                    else {
                        const question = faq.fallback?.question ?? "Você poderia detalhar um pouco mais a sua dúvida?";
                        await this.prisma.chatMessage.create({
                            data: {
                                threadId: thread.id,
                                authorRole: "BOT",
                                body: question
                            }
                        });
                        nextState = { ...nextState, attempts, pendingCategory: "general" };
                        await this.prisma.chatThread.update({
                            where: { id: thread.id },
                            data: { botState: nextState }
                        });
                    }
                }
            }
        }
        else {
            await this.notificationService.sendEmail(process.clientEmail, "Resposta do operador", body);
            await this.notificationService.sendWhatsApp(process.clientPhone ?? process.clientEmail, `Resposta do operador: ${body}`);
        }
        await this.auditService.record(actor, "chat_message", "ChatThread", thread.id, { processId });
        return message;
    }
};
exports.ChatService = ChatService;
exports.ChatService = ChatService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        notification_service_1.NotificationService,
        audit_service_1.AuditService])
], ChatService);
//# sourceMappingURL=chat.service.js.map