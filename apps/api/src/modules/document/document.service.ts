import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentItemKey, DocumentItemStatus, ProcessStatus } from "@prisma/client";
import { PrismaService } from "../../shared/prisma.service";
import { Actor } from "../../common/auth/types";
import { isClientOwner } from "../../common/auth/identity";
import { AuditService } from "../audit/audit.service";
import { StorageService } from "../storage/storage.service";
import { NotificationService } from "../notification/notification.service";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];

@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly storageService: StorageService,
    private readonly notificationService: NotificationService
  ) {}

  private async getProcess(processId: string) {
    const process = await this.prisma.process.findUnique({ where: { id: processId } });
    if (!process) {
      throw new NotFoundException("Processo não encontrado.");
    }
    return process;
  }

  async uploadFiles(
    processId: string,
    itemKey: DocumentItemKey,
    files: Express.Multer.File[],
    actor: Actor
  ) {
    if (actor.role !== "CLIENTE") {
      throw new ForbiddenException();
    }
    const processRecord = await this.getProcess(processId);
    if (!isClientOwner(actor, processRecord.clientEmail, processRecord.clientPhone)) {
      throw new ForbiddenException();
    }
    if (processRecord.status === ProcessStatus.CANCELADO || processRecord.status === ProcessStatus.CONCLUIDO) {
      throw new BadRequestException("Processo somente leitura.");
    }

    if (!files || files.length === 0) {
      throw new BadRequestException("Nenhum arquivo enviado.");
    }

    const maxFiles = Number(process.env.UPLOAD_MAX_FILES_PER_ITEM ?? 12);
    const maxFileMb = Number(process.env.UPLOAD_MAX_FILE_MB ?? 8);
    const maxTotalMb = Number(process.env.UPLOAD_MAX_TOTAL_MB ?? 60);

    if (files.length > maxFiles) {
      throw new BadRequestException("Limite de anexos excedido.");
    }

    const totalProcessSize = await this.prisma.documentFile.aggregate({
      where: { item: { processId } },
      _sum: { size: true }
    });
    const currentBytes = totalProcessSize._sum.size ?? 0;
    const newBytes = files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalBytes = maxTotalMb * 1024 * 1024;

    if (currentBytes + newBytes > maxTotalBytes) {
      throw new BadRequestException("Limite total de armazenamento por processo excedido.");
    }

    for (const file of files) {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxFileMb) {
        throw new BadRequestException(`Arquivo ${file.originalname} excede ${maxFileMb}MB.`);
      }
      if (!ALLOWED_MIME.includes(file.mimetype)) {
        throw new BadRequestException("Tipo de arquivo não permitido.");
      }
    }

    const item = await this.prisma.documentItem.findUnique({
      where: { processId_itemKey: { processId, itemKey } }
    });
    if (!item) {
      throw new NotFoundException("Item de documento não encontrado.");
    }

    let version = item.version;
    if (item.status === DocumentItemStatus.REPROVADO) {
      await this.storageService.deleteFilesByItem(item.id);
      version += 1;
    }

    await this.prisma.documentItem.update({
      where: { id: item.id },
      data: {
        status: DocumentItemStatus.AGUARDANDO_VALIDACAO,
        version,
        reason: null
      }
    });

    for (const file of files) {
      await this.storageService.saveFile({
        itemId: item.id,
        fileName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        data: file.buffer,
        uploadedByRole: "CLIENTE"
      });
    }

    await this.auditService.record(actor, "upload_documents", "DocumentItem", item.id, {
      itemKey,
      count: files.length,
      version
    });

    return { ok: true, version };
  }

  async validateItem(
    processId: string,
    itemKey: DocumentItemKey,
    status: "APROVADO" | "REPROVADO",
    reason: string,
    actor: Actor
  ) {
    if (actor.role !== "FUNCIONARIO") {
      throw new ForbiddenException();
    }

    const processRecord = await this.getProcess(processId);
    if (processRecord.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    const item = await this.prisma.documentItem.findUnique({
      where: { processId_itemKey: { processId, itemKey } }
    });
    if (!item) {
      throw new NotFoundException("Item de documento não encontrado.");
    }

    await this.prisma.documentItem.update({
      where: { id: item.id },
      data: {
        status: status === "APROVADO" ? DocumentItemStatus.APROVADO : DocumentItemStatus.REPROVADO,
        reason
      }
    });

    await this.auditService.record(actor, "validate_documents", "DocumentItem", item.id, { status, reason });

    if (status === "REPROVADO") {
      await this.notificationService.sendEmail(
        processRecord.clientEmail,
        "Documentos reprovados",
        `Item ${itemKey} reprovado. Motivo: ${reason}`
      );
      await this.notificationService.sendWhatsApp(
        processRecord.clientPhone ?? processRecord.clientEmail,
        `Item ${itemKey} reprovado. Motivo: ${reason}`
      );
    }

    return { ok: true };
  }

  async getFile(
    processId: string,
    itemKey: DocumentItemKey,
    fileId: string,
    actor: Actor,
    action: "preview_document" | "download_document" = "preview_document"
  ) {
    const processRecord = await this.getProcess(processId);
    if (actor.role === "CLIENTE") {
      throw new ForbiddenException();
    }
    if (actor.role === "FUNCIONARIO" && processRecord.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    const file = await this.prisma.documentFile.findFirst({
      where: {
        id: fileId,
        item: { processId, itemKey }
      }
    });
    if (!file) {
      throw new NotFoundException("Arquivo não encontrado.");
    }

    await this.auditService.record(actor, action, "DocumentFile", file.id, { itemKey });

    return file;
  }
}
