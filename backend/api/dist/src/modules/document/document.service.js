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
exports.DocumentService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../shared/prisma.service");
const identity_1 = require("../../common/auth/identity");
const audit_service_1 = require("../audit/audit.service");
const storage_service_1 = require("../storage/storage.service");
const notification_service_1 = require("../notification/notification.service");
const ALLOWED_MIME = ["application/pdf", "image/jpeg", "image/png"];
const SOCIO_ITEM_KEYS = [
    client_1.DocumentItemKey.IDENTIFICACAO_SOCIOS,
    client_1.DocumentItemKey.COMPROVANTE_RESIDENCIA
];
function looksLikePdf(buffer) {
    if (!buffer || buffer.length < 5)
        return false;
    return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}
function looksLikePng(buffer) {
    if (!buffer || buffer.length < 8)
        return false;
    return (buffer[0] === 0x89 &&
        buffer[1] === 0x50 &&
        buffer[2] === 0x4e &&
        buffer[3] === 0x47 &&
        buffer[4] === 0x0d &&
        buffer[5] === 0x0a &&
        buffer[6] === 0x1a &&
        buffer[7] === 0x0a);
}
function looksLikeJpeg(buffer) {
    if (!buffer || buffer.length < 2)
        return false;
    return buffer[0] === 0xff && buffer[1] === 0xd8;
}
function normalizeMimeType(file) {
    const raw = String(file.mimetype ?? "").trim().toLowerCase();
    if (raw === "application/pdf" || raw === "application/x-pdf")
        return "application/pdf";
    if (raw === "image/jpeg" || raw === "image/jpg")
        return "image/jpeg";
    if (raw === "image/png")
        return "image/png";
    const name = String(file.originalname ?? "").trim().toLowerCase();
    const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    const buf = file.buffer;
    // Some devices upload PDFs as `application/octet-stream`.
    if ((raw === "application/octet-stream" || raw === "") && ext === ".pdf" && looksLikePdf(buf))
        return "application/pdf";
    if ((raw === "application/octet-stream" || raw === "") && (ext === ".png" || looksLikePng(buf)))
        return "image/png";
    if ((raw === "application/octet-stream" || raw === "") &&
        (ext === ".jpg" || ext === ".jpeg" || looksLikeJpeg(buf)))
        return "image/jpeg";
    return raw;
}
let DocumentService = class DocumentService {
    prisma;
    auditService;
    storageService;
    notificationService;
    constructor(prisma, auditService, storageService, notificationService) {
        this.prisma = prisma;
        this.auditService = auditService;
        this.storageService = storageService;
        this.notificationService = notificationService;
    }
    async getProcess(processId) {
        const process = await this.prisma.process.findUnique({ where: { id: processId } });
        if (!process) {
            throw new common_1.NotFoundException("Processo não encontrado.");
        }
        return process;
    }
    async ensureAccess(processId, actor) {
        const processRecord = await this.getProcess(processId);
        if (actor.role === "CLIENTE") {
            if (!(0, identity_1.isClientOwner)(actor, processRecord.clientEmail, processRecord.clientPhone)) {
                throw new common_1.ForbiddenException();
            }
        }
        if (actor.role === "OPERADOR" && processRecord.ownerId !== actor.userId) {
            throw new common_1.ForbiddenException();
        }
        return processRecord;
    }
    async isEnderecoVirtual(processId) {
        const step2 = await this.prisma.processStep.findUnique({
            where: { processId_stepKey: { processId, stepKey: "ETAPA_2" } }
        });
        const endereco = step2?.data?.endereco ?? {};
        return endereco?.escritorioVirtual === "Sim";
    }
    async uploadFiles(processId, itemKey, socioId, files, actor) {
        const processRecord = await this.getProcess(processId);
        const isVirtual = await this.isEnderecoVirtual(processId);
        if (itemKey === client_1.DocumentItemKey.FOTO_FACHADA && socioId) {
            throw new common_1.BadRequestException("Foto de fachada não deve estar vinculada a sócio.");
        }
        if (actor.role === "OPERADOR" || actor.role === "MASTER") {
            if (actor.role === "OPERADOR" && processRecord.ownerId !== actor.userId) {
                throw new common_1.ForbiddenException();
            }
            if (itemKey !== client_1.DocumentItemKey.FOTO_FACHADA) {
                throw new common_1.BadRequestException("Apenas foto de fachada pode ser anexada internamente.");
            }
            if (!isVirtual) {
                throw new common_1.BadRequestException("Foto de fachada é anexada pelo cliente quando o endereço não é virtual.");
            }
        }
        else if (actor.role === "CLIENTE") {
            if (!(0, identity_1.isClientOwner)(actor, processRecord.clientEmail, processRecord.clientPhone)) {
                throw new common_1.ForbiddenException();
            }
            if (itemKey === client_1.DocumentItemKey.FOTO_FACHADA && isVirtual) {
                throw new common_1.BadRequestException("Foto de fachada ser anexada pelo operador.");
            }
            if (SOCIO_ITEM_KEYS.includes(itemKey) && !socioId) {
                throw new common_1.BadRequestException("Selecione o sócio para enviar o documento.");
            }
        }
        else {
            throw new common_1.ForbiddenException();
        }
        if (processRecord.status === client_1.ProcessStatus.CANCELADO || processRecord.status === client_1.ProcessStatus.CONCLUIDO) {
            throw new common_1.BadRequestException("Processo somente leitura.");
        }
        if (!files || files.length === 0) {
            throw new common_1.BadRequestException("Nenhum arquivo enviado.");
        }
        const maxFiles = Number(process.env.UPLOAD_MAX_FILES_PER_ITEM ?? 12);
        const maxFileMb = Number(process.env.UPLOAD_MAX_FILE_MB ?? 8);
        const maxTotalMb = Number(process.env.UPLOAD_MAX_TOTAL_MB ?? 60);
        if (files.length > maxFiles) {
            throw new common_1.BadRequestException("Limite de anexos excedido.");
        }
        const totalProcessSize = await this.prisma.documentFile.aggregate({
            where: { item: { processId } },
            _sum: { size: true }
        });
        const currentBytes = totalProcessSize._sum.size ?? 0;
        const newBytes = files.reduce((sum, file) => sum + file.size, 0);
        const maxTotalBytes = maxTotalMb * 1024 * 1024;
        if (currentBytes + newBytes > maxTotalBytes) {
            throw new common_1.BadRequestException("Limite total de armazenamento por processo excedido.");
        }
        for (const file of files) {
            const sizeMb = file.size / (1024 * 1024);
            if (sizeMb > maxFileMb) {
                throw new common_1.BadRequestException(`Arquivo ${file.originalname} excede ${maxFileMb}MB.`);
            }
            const normalizedMime = normalizeMimeType(file);
            if (!ALLOWED_MIME.includes(normalizedMime)) {
                throw new common_1.BadRequestException("Tipo de arquivo não permitido.");
            }
        }
        const normalizedSocioId = socioId ?? null;
        let item = await this.prisma.documentItem.findFirst({
            where: { processId, itemKey, socioId: normalizedSocioId }
        });
        if (!item) {
            item = await this.prisma.documentItem.create({
                data: { processId, itemKey, socioId: normalizedSocioId }
            });
        }
        let version = item.version;
        if (item.status === client_1.DocumentItemStatus.REPROVADO) {
            await this.storageService.deleteFilesByItem(item.id);
            version += 1;
        }
        await this.prisma.documentItem.update({
            where: { id: item.id },
            data: {
                status: client_1.DocumentItemStatus.AGUARDANDO_VALIDACAO,
                version,
                reason: null
            }
        });
        for (const file of files) {
            const normalizedMime = normalizeMimeType(file);
            await this.storageService.saveFile({
                itemId: item.id,
                fileName: file.originalname,
                mimeType: normalizedMime,
                size: file.size,
                data: file.buffer,
                uploadedByRole: actor.role === "CLIENTE" ? "CLIENTE" : actor.role
            });
        }
        await this.auditService.record(actor, "upload_documents", "DocumentItem", item.id, {
            itemKey,
            count: files.length,
            version
        });
        return { ok: true, version };
    }
    async validateItem(processId, itemKey, socioId, status, reason, actor) {
        if (actor.role !== "OPERADOR" && actor.role !== "MASTER") {
            throw new common_1.ForbiddenException();
        }
        const processRecord = await this.getProcess(processId);
        if (actor.role === "OPERADOR" && processRecord.ownerId !== actor.userId) {
            throw new common_1.ForbiddenException();
        }
        const item = await this.prisma.documentItem.findFirst({
            where: { processId, itemKey, socioId: socioId ?? null }
        });
        if (!item) {
            throw new common_1.NotFoundException("Item de documento não encontrado.");
        }
        await this.prisma.documentItem.update({
            where: { id: item.id },
            data: {
                status: status === "APROVADO" ? client_1.DocumentItemStatus.APROVADO : client_1.DocumentItemStatus.REPROVADO,
                reason
            }
        });
        await this.auditService.record(actor, "validate_documents", "DocumentItem", item.id, { status, reason });
        if (status === "REPROVADO") {
            await this.notificationService.sendEmail(processRecord.clientEmail, "Documentos reprovados", `Item ${itemKey} reprovado. Motivo: ${reason}`);
            await this.notificationService.sendWhatsApp(processRecord.clientPhone ?? processRecord.clientEmail, `Item ${itemKey} reprovado. Motivo: ${reason}`);
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
                    await this.notificationService.sendEmail(owner.email, "Documento reprovado", `Documento ${itemKey} reprovado para ${processRecord.clientEmail}.`);
                    await this.notificationService.sendWhatsApp(owner.whatsapp ?? owner.email, `Documento ${itemKey} reprovado para ${processRecord.clientEmail}.`);
                }
            }
        }
        return { ok: true };
    }
    async getFile(processId, itemKey, fileId, actor, action = "preview_document") {
        const processRecord = await this.getProcess(processId);
        if (actor.role === "CLIENTE") {
            throw new common_1.ForbiddenException();
        }
        if (actor.role === "OPERADOR" && processRecord.ownerId !== actor.userId) {
            throw new common_1.ForbiddenException();
        }
        const file = await this.prisma.documentFile.findFirst({
            where: {
                id: fileId,
                item: { processId, itemKey }
            }
        });
        if (!file) {
            throw new common_1.NotFoundException("Arquivo não encontrado.");
        }
        await this.auditService.record(actor, action, "DocumentFile", file.id, { itemKey });
        return file;
    }
    async listItems(processId, actor) {
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
};
exports.DocumentService = DocumentService;
exports.DocumentService = DocumentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_service_1.AuditService,
        storage_service_1.StorageService,
        notification_service_1.NotificationService])
], DocumentService);
//# sourceMappingURL=document.service.js.map