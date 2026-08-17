import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { KanbanStage, Prisma, ProcessStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { Document, Packer, Paragraph, TextRun } from "docx";
import PDFDocument from "pdfkit";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { parse } from "node-html-parser";

import { Actor } from "../../common/auth/types";
import { PrismaService } from "../../shared/prisma.service";
import { AuditService } from "../audit/audit.service";

const execFileAsync = promisify(execFile);
const EDITOR_SCHEMA = "1";
const allowedMime = new Set(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);

type EditorMark = { type: "bold" | "italic" | "underline" | "strike" | "code" | "link"; attrs?: { href?: string } };
type EditorInline = { type: "text"; text: string; marks?: EditorMark[] };
type EditorDoc = { type: "doc"; content: Array<{ type: "paragraph" | "heading" | "blockquote" | "bulletList" | "orderedList"; attrs?: { level?: number; textAlign?: string }; content?: EditorInline[] }> };

function hash(data: Buffer | string) { return createHash("sha256").update(data).digest("hex"); }
function normalizeDocument(value: unknown) { return String(value ?? "").replace(/\D/g, ""); }
function safeName(value: string) { return value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 100) || "documento"; }
function editorFromText(text: string): EditorDoc {
  const paragraphs = text.replace(/\r/g, "").split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return { type: "doc", content: (paragraphs.length ? paragraphs : [""]).map((part) => ({ type: "paragraph", content: [{ type: "text", text: part }] })) };
}
function editorFromHtml(html: string): EditorDoc {
  const root = parse(html);
  const nodes = root.querySelectorAll("p,h1,h2,h3,li");
  const content = nodes.map((node) => {
    const tag = node.tagName.toLowerCase();
    const text = node.textContent.replace(/\s+/g, " ").trim();
    if (!text) return null;
    return { type: tag.startsWith("h") ? "heading" : "paragraph", attrs: tag.startsWith("h") ? { level: Number(tag.slice(1)) } : undefined, content: [{ type: "text", text }] };
  }).filter(Boolean) as EditorDoc["content"];
  return { type: "doc", content: content.length ? content : editorFromText(root.textContent).content };
}
function textFromEditor(content: unknown) {
  const doc = content as EditorDoc;
  return Array.isArray(doc?.content) ? doc.content.map((p) => (p.content ?? []).map((x) => x.text).join("")).join("\n\n") : "";
}
function validateEditor(content: unknown): asserts content is EditorDoc {
  const doc = content as EditorDoc;
  if (!doc || doc.type !== "doc" || !Array.isArray(doc.content) || doc.content.length > 5000) throw new BadRequestException("Conteúdo estruturado inválido.");
  for (const block of doc.content) {
    if (!["paragraph", "heading", "blockquote", "bulletList", "orderedList"].includes(block.type) || !Array.isArray(block.content)) throw new BadRequestException("Bloco de editor inválido.");
    if (block.attrs?.level !== undefined && (![1, 2, 3, 4, 5, 6].includes(block.attrs.level))) throw new BadRequestException("Nível de título inválido.");
    if (block.attrs?.textAlign !== undefined && !["left", "center", "right", "justify"].includes(block.attrs.textAlign)) throw new BadRequestException("Alinhamento inválido.");
    for (const mark of block.content) {
      if (!mark || typeof mark.text !== "string" || mark.text.length > 10000) throw new BadRequestException("Texto de editor inválido.");
      for (const decoration of mark.marks ?? []) {
        if (!["bold", "italic", "underline", "strike", "code", "link"].includes(decoration.type)) throw new BadRequestException("Formatação inválida.");
        if (decoration.type === "link" && (!decoration.attrs?.href || decoration.attrs.href.length > 2048)) throw new BadRequestException("Link inválido.");
      }
    }
  }
}
function hasSignature(file: Express.Multer.File) {
  if (file.mimetype === "application/pdf") return file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  return file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && file.buffer.subarray(0, 2).toString("ascii") === "PK";
}

@Injectable()
export class CompletedService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private ensureStaff(actor: Actor) { if (actor.role !== "OPERADOR" && actor.role !== "MASTER") throw new ForbiddenException(); }
  private async ensureProcess(id: string, actor: Actor) {
    this.ensureStaff(actor);
    const process = await this.prisma.process.findFirst({ where: { id, tenantKey: actor.tenantKey ?? "default" }, include: { finalization: true } });
    if (!process || process.status !== ProcessStatus.CONCLUIDO) throw new NotFoundException("Processo finalizado não encontrado.");
    if (actor.role === "OPERADOR" && process.ownerId !== actor.userId) throw new ForbiddenException();
    return process;
  }

  private async ensureContract(id: string, actor: Actor) {
    this.ensureStaff(actor);
    const contract = await this.prisma.contract.findFirst({ where: { id, tenantKey: actor.tenantKey ?? "default" }, include: { process: true } });
    if (!contract) throw new NotFoundException("Contrato não encontrado.");
    if (actor.role === "OPERADOR" && contract.process?.ownerId !== actor.userId) throw new ForbiddenException();
    return contract;
  }

  async list(actor: Actor, query: Record<string, string>) {
    this.ensureStaff(actor);
    const take = Math.min(Math.max(Number(query.limit ?? 25) || 25, 1), 100); const skip = Math.max(Number(query.offset ?? 0) || 0, 0);
    const search = query.search?.trim();
    const where: Prisma.ProcessWhereInput = { status: ProcessStatus.CONCLUIDO, ...(actor.role === "OPERADOR" ? { ownerId: actor.userId } : {}), ...(query.from ? { finalizedAt: { gte: new Date(query.from) } } : {}), ...(query.to ? { finalizedAt: { lte: new Date(`${query.to}T23:59:59.999Z`) } } : {}), ...(query.ownerId && actor.role === "MASTER" ? { ownerId: query.ownerId } : {}), ...(query.contracts === "yes" ? { contracts: { some: {} } } : query.contracts === "no" ? { contracts: { none: {} } } : {}), ...(query.alterations === "yes" ? { alteracoesContratuais: { some: {} } } : query.alterations === "no" ? { alteracoesContratuais: { none: {} } } : {}), ...(search ? { OR: [{ clientName: { contains: search, mode: "insensitive" } }, { clientEmail: { contains: search, mode: "insensitive" } }, { companyKey: { contains: search, mode: "insensitive" } }] } : {}) };
    where.tenantKey = actor.tenantKey ?? "default";
    const [items, total] = await this.prisma.$transaction([this.prisma.process.findMany({ where, skip, take, orderBy: { updatedAt: query.order === "oldest" ? "asc" : "desc" }, include: { owner: { select: { id: true, name: true } }, finalization: true, _count: { select: { contracts: true, alteracoesContratuais: true } } } }), this.prisma.process.count({ where })]);
    return { items, total, limit: take, offset: skip };
  }

  async get(id: string, actor: Actor) {
    await this.ensureProcess(id, actor);
    return this.prisma.process.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true } },
        finalization: true,
        steps: true,
        documents: { include: { files: { select: { id: true, fileName: true, mimeType: true, size: true, createdAt: true } } } },
        contracts: {
          include: {
            versions: { orderBy: { version: "desc" }, select: { id: true, version: true, status: true, source: true, createdAt: true } },
            files: { select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
            exports: { select: { id: true, format: true, version: true, fileName: true, createdAt: true } }
          }
        }
      }
    });
  }

  async listLegacyClients(actor: Actor, search?: string) {
    this.ensureStaff(actor);
    return this.prisma.legacyClient.findMany({ where: { tenantKey: actor.tenantKey ?? "default", ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { documentNumber: { contains: normalizeDocument(search) } }] } : {}) }, orderBy: { name: "asc" }, take: 50 });
  }

  async getLegacyClient(id: string, actor: Actor) {
    this.ensureStaff(actor);
    const client = await this.prisma.legacyClient.findFirst({
      where: { id, tenantKey: actor.tenantKey ?? "default" },
      include: {
        contracts: {
          orderBy: { updatedAt: "desc" },
          include: {
            versions: { orderBy: { version: "desc" }, take: 1 },
            files: { select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true, createdAt: true } },
            exports: { select: { id: true, format: true, version: true, fileName: true, createdAt: true } }
          }
        }
      }
    });
    if (!client) throw new NotFoundException("Cliente sem processo não encontrado.");
    return client;
  }

  async createLegacyClient(body: Record<string, unknown>, actor: Actor) {
    this.ensureStaff(actor); const documentNumber = String(body.documentNumber ?? "").trim(); const normalized = normalizeDocument(documentNumber);
    if (!normalized || ![11, 14].includes(normalized.length)) throw new BadRequestException("CPF ou CNPJ inválido.");
    if (!String(body.name ?? "").trim()) throw new BadRequestException("Nome ou razão social obrigatório.");
    const tenantKey = actor.tenantKey ?? "default"; const existing = await this.prisma.legacyClient.findUnique({ where: { tenantKey_normalizedDocument: { tenantKey, normalizedDocument: normalized } } }); if (existing) throw new ConflictException("Já existe um cadastro com este CPF/CNPJ.");
    const client = await this.prisma.legacyClient.create({ data: { kind: String(body.kind ?? (normalized.length === 11 ? "PF" : "PJ")), name: String(body.name ?? "").trim(), tradeName: body.tradeName ? String(body.tradeName) : undefined, documentNumber, normalizedDocument: normalized, address: body.address ? String(body.address) : undefined, city: body.city ? String(body.city) : undefined, state: body.state ? String(body.state) : undefined, municipalRegistration: body.municipalRegistration ? String(body.municipalRegistration) : undefined, stateRegistration: body.stateRegistration ? String(body.stateRegistration) : undefined, phone: body.phone ? String(body.phone) : undefined, email: body.email ? String(body.email) : undefined, createdById: actor.userId } });
    if (tenantKey !== "default") await this.prisma.legacyClient.update({ where: { id: client.id }, data: { tenantKey } });
    await this.audit.record(actor, "legacy_client_created", "LegacyClient", client.id, { source: "CLIENTE_LEGADO", tenantKey }); return client;
  }

  async createBlank(processId: string, body: { title: string; type?: string }, actor: Actor) { const process = await this.ensureProcess(processId, actor); return this.createContract({ processId: process.id, title: body.title, type: body.type, origin: "BLANK", actor }); }
  async createLegacyBlank(clientId: string, body: { title: string; type?: string }, actor: Actor) { this.ensureStaff(actor); const client = await this.prisma.legacyClient.findFirst({ where: { id: clientId, tenantKey: actor.tenantKey ?? "default" } }); if (!client) throw new NotFoundException("Cliente legado não encontrado."); return this.createContract({ legacyClientId: client.id, title: body.title, type: body.type, origin: "CLIENTE_LEGADO", actor }); }

  private async createContract(input: { processId?: string; legacyClientId?: string; title: string; type?: string; origin: string; actor: Actor; content?: EditorDoc; original?: Express.Multer.File; conversion?: { usedOcr: boolean; metadata?: Record<string, unknown> } }) {
    if (!input.processId && !input.legacyClientId) throw new BadRequestException("Contrato deve estar vinculado a um processo ou cliente.");
    if (!input.title?.trim()) throw new BadRequestException("Título obrigatório."); const content = input.content ?? editorFromText(""); validateEditor(content);
    return this.prisma.$transaction(async (tx) => {
      const contract = await tx.contract.create({ data: { processId: input.processId, legacyClientId: input.legacyClientId, title: input.title.trim(), type: input.type, origin: input.origin, editorSchemaVersion: EDITOR_SCHEMA, conversionStatus: "CONCLUIDO", usedOcr: input.conversion?.usedOcr ?? false, conversionMetadata: input.conversion?.metadata as Prisma.InputJsonValue | undefined, createdById: input.actor.userId, versions: { create: { version: 1, status: "RASCUNHO", source: input.origin, content: content as Prisma.InputJsonValue, sha256: hash(JSON.stringify(content)), createdById: input.actor.userId } }, files: input.original ? { create: { kind: "ORIGINAL", fileName: safeName(input.original.originalname), mimeType: input.original.mimetype, sizeBytes: input.original.size, sha256: hash(input.original.buffer), data: input.original.buffer, createdById: input.actor.userId } } : undefined, conversions: { create: { status: "CONCLUIDO", usedOcr: input.conversion?.usedOcr ?? false, metadata: input.conversion?.metadata as Prisma.InputJsonValue | undefined, startedAt: new Date(), finishedAt: new Date() } } }, include: { versions: true, files: { select: { id: true, kind: true, fileName: true, mimeType: true, sizeBytes: true } } } });
      return contract;
    }).then(async (contract) => { await this.audit.record(input.actor, input.original ? "contract_uploaded" : "contract_created", "Contract", contract.id, { origin: input.origin, editable: true }); return contract; });
  }

  private async convertFile(file: Express.Multer.File) {
    if (!file?.buffer?.length || !allowedMime.has(file.mimetype) || !hasSignature(file)) throw new BadRequestException("Arquivo vazio, MIME inválido ou assinatura incompatível.");
    const extension = file.mimetype === "application/pdf" ? ".pdf" : ".docx"; const filename = file.originalname || `upload${extension}`; if (!filename.toLowerCase().endsWith(extension)) throw new BadRequestException("Extensão incompatível com o tipo do arquivo.");
    let text = ""; let conversion = "TEXT"; let metadata: Record<string, unknown> = {};
    try {
      if (file.mimetype === "application/pdf") {
        const parsed = await pdfParse(file.buffer); text = parsed.text?.trim() ?? ""; metadata.pages = parsed.numpages ?? null;
        if (!text) {
          conversion = "OCR"; const dir = await mkdtemp(join(tmpdir(), "fundarmf-ocr-")); const input = join(dir, safeName(filename));
          try { await writeFile(input, file.buffer); const command = process.env.TESSERACT_CMD ?? "tesseract"; const result = await execFileAsync(command, [input, "stdout"], { timeout: 90_000, maxBuffer: 10 * 1024 * 1024 }); text = String(result.stdout ?? "").trim(); metadata.ocr = "tesseract"; } catch { throw new BadRequestException("PDF sem camada textual: OCR indisponível, protegido ou sem conteúdo reconhecível."); } finally { await rm(dir, { recursive: true, force: true }); }
        }
      } else { const result = await mammoth.convertToHtml({ buffer: file.buffer }); text = parse(result.value).textContent.trim(); metadata = { warnings: result.messages.map((message) => message.message), html: result.value.slice(0, 2_000_000) }; }
    } catch (error) { if (error instanceof BadRequestException) throw error; throw new BadRequestException("Não foi possível converter o documento; verifique se está corrompido ou protegido."); }
    if (!text) throw new BadRequestException("O documento não possui conteúdo editável reconhecível.");
    const content = file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && typeof metadata.html === "string" ? editorFromHtml(metadata.html) : editorFromText(text);
    return { content, conversion, metadata };
  }

  async uploadContract(processId: string, file: Express.Multer.File, body: { title?: string; type?: string }, actor: Actor) {
    await this.ensureProcess(processId, actor); const converted = await this.convertFile(file);
    const contract = await this.createContract({ processId, title: body.title ?? file.originalname.replace(/\.(pdf|docx)$/i, ""), type: body.type, origin: converted.conversion === "OCR" ? "UPLOAD_PDF_OCR" : "UPLOAD", actor, content: converted.content, original: file, conversion: { usedOcr: converted.conversion === "OCR", metadata: converted.metadata } });
    await this.audit.record(actor, converted.conversion === "OCR" ? "contract_ocr_used" : "contract_converted", "Contract", contract.id, { sourceMime: file.mimetype, conversion: converted.conversion }); return contract;
  }

  async uploadLegacyContract(clientId: string, file: Express.Multer.File, body: { title?: string; type?: string }, actor: Actor) { this.ensureStaff(actor); const client = await this.prisma.legacyClient.findFirst({ where: { id: clientId, tenantKey: actor.tenantKey ?? "default" } }); if (!client) throw new NotFoundException("Cliente legado não encontrado."); const converted = await this.convertFile(file); return this.createContract({ legacyClientId: client.id, title: body.title ?? file.originalname.replace(/\.(pdf|docx)$/i, ""), type: body.type, origin: converted.conversion === "OCR" ? "UPLOAD_PDF_OCR" : "UPLOAD", actor, content: converted.content, original: file, conversion: { usedOcr: converted.conversion === "OCR", metadata: converted.metadata } }); }

  async updateContract(id: string, body: { content: unknown; title?: string; expectedVersion?: number }, actor: Actor) {
    const current = await this.ensureContract(id, actor);
    validateEditor(body.content); const expected = body.expectedVersion ?? current.currentVersion; if (expected !== current.currentVersion) throw new ConflictException("Versão desatualizada; recarregue o documento."); const next = current.currentVersion + 1; const content = body.content as Prisma.InputJsonValue;
    const updated = await this.prisma.$transaction(async (tx) => { await tx.contract.update({ where: { id }, data: { title: body.title?.trim() || undefined, currentVersion: next, status: current.status === "FINALIZADA" ? "EM_ELABORACAO" : current.status } }); return tx.contractVersion.create({ data: { contractId: id, version: next, status: "EM_ELABORACAO", content, source: "EDITOR", sha256: hash(JSON.stringify(content)), createdById: actor.userId } }); }); await this.audit.record(actor, "contract_saved", "Contract", id, { version: next }); return updated;
  }

  async reopen(id: string, body: { reason: string; kanbanStage: string }, actor: Actor) {
    if (actor.role !== "MASTER") throw new ForbiddenException(); if (!body.reason?.trim()) throw new BadRequestException("Justificativa obrigatória."); if (!(Object.values(KanbanStage) as string[]).includes(body.kanbanStage) || body.kanbanStage === KanbanStage.FINALIZADO) throw new BadRequestException("Etapa operacional inválida.");
    const process = await this.prisma.process.findUnique({ where: { id } }); if (!process || process.status !== ProcessStatus.CONCLUIDO) throw new NotFoundException("Processo finalizado não encontrado.");
    const updated = await this.prisma.process.update({ where: { id }, data: { status: ProcessStatus.EM_ANDAMENTO, kanbanStage: body.kanbanStage as KanbanStage, finalizedAt: null } });
    await this.audit.record(actor, "process_reopened", "Process", id, { reason: body.reason.trim(), previousStatus: process.status, newStatus: updated.status, newKanbanStage: updated.kanbanStage }); return updated;
  }

  async finalizeContract(id: string, actor: Actor) { const contract = await this.ensureContract(id, actor); await this.prisma.contract.update({ where: { id }, data: { status: "FINALIZADA" } }); await this.prisma.contractVersion.updateMany({ where: { contractId: id, version: contract.currentVersion }, data: { status: "FINALIZADA" } }); await this.audit.record(actor, "contract_finalized", "Contract", id, { version: contract.currentVersion }); return { ok: true, version: contract.currentVersion }; }

  async exportContract(id: string, format: "pdf" | "docx", actor: Actor) {
    const owned = await this.ensureContract(id, actor); const contract = await this.prisma.contract.findUnique({ where: { id: owned.id }, include: { versions: { orderBy: { version: "desc" }, take: 1 } } }); if (!contract || !contract.versions[0]) throw new NotFoundException("Versão não encontrada."); const version = contract.versions[0]; const text = textFromEditor(version.content); let data: Buffer; let mimeType: string; let extension: string;
    if (format === "docx") { const paragraphs = text.split(/\n\n+/).map((p) => new Paragraph({ children: [new TextRun(p)] })); data = await Packer.toBuffer(new Document({ sections: [{ properties: {}, children: paragraphs }] })); mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; extension = "docx"; } else { const chunks: Buffer[] = []; const doc = new PDFDocument({ size: "A4", margin: 56 }); doc.on("data", (c) => chunks.push(c)); const done = new Promise<void>((resolve) => doc.on("end", () => resolve())); doc.fontSize(16).text(contract.title, { align: "center" }); doc.moveDown(); doc.fontSize(11).text(text); doc.end(); await done; data = Buffer.concat(chunks); mimeType = "application/pdf"; extension = "pdf"; }
    const fileName = `${safeName(contract.title)}-v${version.version}.${extension}`; const result = await this.prisma.contractExport.upsert({ where: { contractId_version_format: { contractId: id, version: version.version, format: format.toUpperCase() } }, update: { data, sizeBytes: data.length, sha256: hash(data), createdById: actor.userId }, create: { contractId: id, version: version.version, format: format.toUpperCase(), fileName, mimeType, sizeBytes: data.length, sha256: hash(data), data, createdById: actor.userId } }); await this.audit.record(actor, "contract_exported", "ContractExport", result.id, { format: format.toUpperCase(), version: version.version }); return { id: result.id, fileName, format: format.toUpperCase(), version: version.version };
  }

  async getFile(contractId: string, fileId: string, actor: Actor) { this.ensureStaff(actor); const file = await this.prisma.contractFile.findFirst({ where: { id: fileId, contractId }, include: { contract: { include: { process: true } } } }); if (!file) throw new NotFoundException("Arquivo não encontrado."); if (actor.role === "OPERADOR" && file.contract.process?.ownerId !== actor.userId) throw new ForbiddenException(); return file; }
  async getExport(contractId: string, exportId: string, actor: Actor) { await this.ensureContract(contractId, actor); const file = await this.prisma.contractExport.findFirst({ where: { id: exportId, contractId } }); if (!file) throw new NotFoundException("Exportação não encontrada."); await this.audit.record(actor, "contract_export_downloaded", "ContractExport", file.id, { format: file.format, version: file.version }); return file; }
}
