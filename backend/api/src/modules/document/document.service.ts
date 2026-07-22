import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DocumentItemKey, DocumentItemStatus, ProcessStatus } from "@prisma/client";

import { isClientOwner } from "../../common/auth/identity";
import { Actor } from "../../common/auth/types";
import { PrismaService } from "../../shared/prisma.service";
import { AuditService } from "../audit/audit.service";
import { NotificationService } from "../notification/notification.service";
import { StorageService } from "../storage/storage.service";

const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const SOCIO_ITEM_KEYS: DocumentItemKey[] = [
  DocumentItemKey.IDENTIFICACAO_SOCIOS,
  DocumentItemKey.COMPROVANTE_RESIDENCIA
];

function looksLikePdf(buffer?: Buffer) {
  if (!buffer || buffer.length < 5) return false;
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function looksLikePng(buffer?: Buffer) {
  if (!buffer || buffer.length < 8) return false;
  return (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function looksLikeJpeg(buffer?: Buffer) {
  if (!buffer || buffer.length < 2) return false;
  return buffer[0] === 0xff && buffer[1] === 0xd8;
}

function normalizeMimeType(file: Express.Multer.File): string {
  const raw = String(file.mimetype ?? "").trim().toLowerCase();
  if (raw === "application/pdf" || raw === "application/x-pdf") return "application/pdf";
  if (raw === "image/jpeg" || raw === "image/jpg") return "image/jpeg";
  if (raw === "image/png") return "image/png";

  const name = String(file.originalname ?? "").trim().toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
  const buf = file.buffer;

  // Some devices upload PDFs as `application/octet-stream`.
  if ((raw === "application/octet-stream" || raw === "") && ext === ".pdf" && looksLikePdf(buf)) return "application/pdf";
  if ((raw === "application/octet-stream" || raw === "") && (ext === ".png" || looksLikePng(buf))) return "image/png";
  if (
    (raw === "application/octet-stream" || raw === "") &&
    (ext === ".jpg" || ext === ".jpeg" || looksLikeJpeg(buf))
  )
    return "image/jpeg";

  return raw;
}

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

  private async ensureAccess(processId: string, actor: Actor) {
    const processRecord = await this.getProcess(processId);
    if (actor.role === "CLIENTE") {
      if (!isClientOwner(actor, processRecord.clientEmail, processRecord.clientPhone)) {
        throw new ForbiddenException();
      }
    }
    if (actor.role === "OPERADOR" && processRecord.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }
    return processRecord;
  }

  private async isEnderecoVirtual(processId: string) {
    const step2 = await this.prisma.processStep.findUnique({
      where: { processId_stepKey: { processId, stepKey: "ETAPA_2" } }
    });
    const stepData = step2?.data;
    const endereco =
      stepData !== null && typeof stepData === "object" && !Array.isArray(stepData)
        ? (stepData as Record<string, unknown>).endereco
        : undefined;
    const enderecoData =
      endereco !== null && typeof endereco === "object" && !Array.isArray(endereco)
        ? (endereco as Record<string, unknown>)
        : {};
    return enderecoData.escritorioVirtual === "Sim";
  }

  async uploadFiles(
    processId: string,
    itemKey: DocumentItemKey,
    socioId: string | undefined,
    files: Express.Multer.File[],
    actor: Actor
  ) {
    const processRecord = await this.getProcess(processId);
    const isVirtual = await this.isEnderecoVirtual(processId);

    if (itemKey === DocumentItemKey.FOTO_FACHADA && socioId) {
      throw new BadRequestException("Foto de fachada não deve estar vinculada a sócio.");
    }

    if (actor.role === "OPERADOR" || actor.role === "MASTER") {
      if (actor.role === "OPERADOR" && processRecord.ownerId !== actor.userId) {
        throw new ForbiddenException();
      }
      if (itemKey !== DocumentItemKey.FOTO_FACHADA) {
        throw new BadRequestException("Apenas foto de fachada pode ser anexada internamente.");
      }
      if (!isVirtual) {
        throw new BadRequestException("Foto de fachada é anexada pelo cliente quando o endereço não é virtual.");
      }
    } else if (actor.role === "CLIENTE") {
      if (!isClientOwner(actor, processRecord.clientEmail, processRecord.clientPhone)) {
        throw new ForbiddenException();
      }
      if (itemKey === DocumentItemKey.FOTO_FACHADA && isVirtual) {
        throw new BadRequestException("Foto de fachada ser anexada pelo operador.");
      }
      if (SOCIO_ITEM_KEYS.includes(itemKey) && !socioId) {
        throw new BadRequestException("Selecione o sócio para enviar o documento.");
      }
    } else {
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

    const newBytes = files.reduce((sum, file) => sum + file.size, 0);
    const maxTotalBytes = maxTotalMb * 1024 * 1024;

    for (const file of files) {
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxFileMb) {
        throw new BadRequestException(`Arquivo ${file.originalname} excede ${maxFileMb}MB.`);
      }
      const normalizedMime = normalizeMimeType(file);
      const signatureMatches =
        (normalizedMime === "application/pdf" && looksLikePdf(file.buffer)) ||
        (normalizedMime === "image/png" && looksLikePng(file.buffer)) ||
        (normalizedMime === "image/jpeg" && looksLikeJpeg(file.buffer));
      if (!signatureMatches) {
        throw new BadRequestException(`Conteúdo do arquivo ${file.originalname} não corresponde ao tipo informado.`);
      }
      if (!ALLOWED_MIME.includes(normalizedMime)) {
        throw new BadRequestException("Tipo de arquivo não permitido.");
      }
    }

    const normalizedSocioId = socioId ?? null;
    const { item, version } = await this.prisma.$transaction(async (tx) => {
      // Updating the parent row first serializes concurrent uploads for the same process
      // in PostgreSQL, making the quota check and inserts atomic.
      await tx.process.update({ where: { id: processId }, data: { updatedAt: new Date() } });

      const totalProcessSize = await tx.documentFile.aggregate({
        where: { item: { processId } },
        _sum: { size: true }
      });
      const currentBytes = totalProcessSize._sum.size ?? 0;
      if (currentBytes + newBytes > maxTotalBytes) {
        throw new BadRequestException("Limite total de armazenamento por processo excedido.");
      }

      let currentItem = await tx.documentItem.findFirst({
        where: { processId, itemKey, socioId: normalizedSocioId }
      });
      if (!currentItem) {
        currentItem = await tx.documentItem.create({
          data: { processId, itemKey, socioId: normalizedSocioId }
        });
      }

      let nextVersion = currentItem.version;
      if (currentItem.status === DocumentItemStatus.REPROVADO) {
        await this.storageService.deleteFilesByItem(currentItem.id, tx);
        nextVersion += 1;
      }

      await tx.documentItem.update({
        where: { id: currentItem.id },
        data: {
          status: DocumentItemStatus.AGUARDANDO_VALIDACAO,
          version: nextVersion,
          reason: null
        }
      });

      for (const file of files) {
        const normalizedMime = normalizeMimeType(file);
        await this.storageService.saveFile(
          {
            itemId: currentItem.id,
            fileName: file.originalname,
            mimeType: normalizedMime,
            size: file.size,
            data: file.buffer,
            uploadedByRole: actor.role === "CLIENTE" ? "CLIENTE" : actor.role
          },
          tx
        );
      }

      return { item: currentItem, version: nextVersion };
    });

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
    socioId: string | undefined,
    status: "APROVADO" | "REPROVADO",
    reason: string,
    actor: Actor
  ) {
    if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
      throw new ForbiddenException();
    }

    const processRecord = await this.getProcess(processId);
    if (actor.role === "OPERADOR" && processRecord.ownerId !== actor.userId) {
      throw new ForbiddenException();
    }

    const item = await this.prisma.documentItem.findFirst({
      where: { processId, itemKey, socioId: socioId ?? null }
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

      const targetUserId = processRecord.ownerId ?? actor.userId;
      if (targetUserId) {
        const owner = await this.prisma.user.findUnique({ where: { id: targetUserId } });
        await this.notificationService.createInApp({
          userId: targetUserId,
          processId,
          title: "Documento reprovado",
          body: `Documento ${itemKey} reprovado para ${processRecord.clientEmail}.`,
          type: "document_rejected"
        });
        if (owner) {
          await this.notificationService.sendEmail(
            owner.email,
            "Documento reprovado",
            `Documento ${itemKey} reprovado para ${processRecord.clientEmail}.`
          );
          await this.notificationService.sendWhatsApp(
            owner.whatsapp ?? owner.email,
            `Documento ${itemKey} reprovado para ${processRecord.clientEmail}.`
          );
        }
      }
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
    if (actor.role === "OPERADOR" && processRecord.ownerId !== actor.userId) {
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

  async listItems(processId: string, actor: Actor) {
    await this.ensureAccess(processId, actor);
    return this.prisma.documentItem.findMany({
      where: { processId },
      include: {
        files: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            size: true,
            createdAt: true,
            uploadedByRole: true
          }
        }
      },
      orderBy: [{ itemKey: "asc" }, { createdAt: "asc" }]
    });
  }
}
