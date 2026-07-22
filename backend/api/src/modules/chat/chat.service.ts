import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import fs from "fs";
import path from "path";

import { isClientOwner } from "../../common/auth/identity";
import { Actor } from "../../common/auth/types";
import { PrismaService } from "../../shared/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationService } from "../notification/notification.service";

type FaqIntent = {
  id: string;
  title: string;
  keywords: string[];
  answer: string;
  followUps?: string[];
};

type FaqData = {
  intents: FaqIntent[];
  fallback: { question: string };
};

type BotState = {
  attempts: number;
  pendingCategory?: string | null;
  lastIntent?: string | null;
  handoff?: boolean;
};

type ChatStepData = Record<string, unknown>;

const asRecord = (value: unknown): ChatStepData =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as ChatStepData) : {};

const URGENCY_KEYWORDS = ["urgente", "imediato", "agora", "hoje", "procon", "reclamação", "reclamacao"];
const FRUSTRATION_KEYWORDS = ["não funcionou", "nao funcionou", "já tentei", "ja tentei", "não resolve", "nao resolve", "erro", "falha", "travou"];

let cachedFaq: FaqData | null = null;

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function loadFaq(): FaqData {
  if (cachedFaq) return cachedFaq;
  const fallback: FaqData = {
    intents: [],
    fallback: { question: "Posso ajudar com documentos, dados de sócios, endereço, prazos ou erros de upload." }
  };
  try {
    const basePath = process.env.CHAT_FAQ_PATH ?? path.resolve(process.cwd(), "src/modules/chat/faq.json");
    const raw = fs.readFileSync(basePath, "utf-8");
    cachedFaq = JSON.parse(raw) as FaqData;
    return cachedFaq;
  } catch {
    cachedFaq = fallback;
    return fallback;
  }
}

function findIntent(text: string, faq: FaqData) {
  const normalized = normalizeText(text);
  return faq.intents.find((intent) =>
    intent.keywords.some((keyword) => normalized.includes(normalizeText(keyword)))
  );
}

function shouldHandoff(text: string, attempts: number) {
  const normalized = normalizeText(text);
  if (URGENCY_KEYWORDS.some((keyword) => normalized.includes(keyword))) return true;
  if (FRUSTRATION_KEYWORDS.some((keyword) => normalized.includes(keyword)) && attempts >= 1) return true;
  return false;
}

function buildBotMessage(intent?: FaqIntent) {
  if (!intent) return null;
  const extra = intent.followUps?.length ? `\n\n${intent.followUps.map((line) => ` ${line}`).join("\n")}` : "";
  return `${intent.answer}${extra}`;
}

function getSocioDisplayName(socio: unknown) {
  const record = asRecord(socio);
  return record.tipoPessoa === "CNPJ" ? record.socioRazaoSocial : record.socioNome;
}

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly auditService: AuditService
  ) {}

  private async ensureAccess(processId: string, actor: Actor) {
    const process = await this.prisma.process.findUnique({ where: { id: processId } });
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

  private async notifyOwner(
    process: { id: string; ownerId: string | null; clientEmail: string; clientName?: string | null },
    payload: { title: string; body: string; type: string }
  ) {
    if (!process.ownerId) return;
    const owner = await this.prisma.user.findUnique({ where: { id: process.ownerId } });
    if (!owner) return;

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

  private async buildHandoffSummary(processId: string, threadId: string, lastMessage: string) {
    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    const step2 = await this.prisma.processStep.findUnique({
      where: { processId_stepKey: { processId, stepKey: "ETAPA_2" } }
    });
    const step2Data = asRecord(step2?.data);
    const endereco = asRecord(step2Data.endereco);
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
      `Sócios (nomes): ${socios.map(getSocioDisplayName).filter(Boolean).join(", ") || "-"}`,
      `E-mail CNPJ: ${step2Data.emailCnpj ?? "-"}`,
      `Telefone CNPJ: ${step2Data.telefoneCnpj ?? "-"}`,
      `Transcrição recente:\n${transcript || "-"}`
    ].join("\n");
  }

  async listMessages(processId: string, actor: Actor) {
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

  async addMessage(processId: string, actor: Actor, body: string) {
    const process = await this.ensureAccess(processId, actor);

    const thread = await this.prisma.chatThread.upsert({
      where: { processId },
      update: {},
      create: { processId, botState: { attempts: 0 } satisfies Prisma.InputJsonObject }
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
      const previousState = (thread.botState ?? { attempts: 0 }) as BotState;
      let nextState: BotState = {
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
        } else {
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
          } else {
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
    } else {
      await this.notificationService.sendEmail(process.clientEmail, "Resposta do operador", body);
      await this.notificationService.sendWhatsApp(
        process.clientPhone ?? process.clientEmail,
        `Resposta do operador: ${body}`
      );
    }

    await this.auditService.record(actor, "chat_message", "ChatThread", thread.id, { processId });

    return message;
  }
}
