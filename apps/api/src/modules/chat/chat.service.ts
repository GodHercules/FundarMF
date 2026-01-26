import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../shared/prisma.service";
import { Actor } from "../../common/auth/types";
import { isClientOwner } from "../../common/auth/identity";
import { NotificationService } from "../notification/notification.service";
import { AuditService } from "../audit/audit.service";

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

    if (actor.role === "FUNCIONARIO" && process.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    return process;
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
      create: { processId }
    });

    const message = await this.prisma.chatMessage.create({
      data: {
        threadId: thread.id,
        authorRole: actor.role === "CLIENTE" ? "CLIENTE" : "FUNCIONARIO",
        authorId: actor.userId,
        body
      }
    });

    if (actor.role === "CLIENTE") {
      const owner = process.ownerId
        ? await this.prisma.user.findUnique({ where: { id: process.ownerId } })
        : null;
      await this.notificationService.sendEmail(
        owner?.email ?? "master@fundarmf.local",
        "Novo chamado do cliente",
        body
      );
      await this.notificationService.sendWhatsApp(
        owner?.email ?? "master@fundarmf.local",
        `Novo chamado do cliente: ${body}`
      );
    } else {
      await this.notificationService.sendEmail(process.clientEmail, "Resposta do funcionário", body);
      await this.notificationService.sendWhatsApp(
        process.clientPhone ?? process.clientEmail,
        `Resposta do funcionário: ${body}`
      );
    }

    await this.auditService.record(actor, "chat_message", "ChatThread", thread.id, { processId });

    return message;
  }
}
