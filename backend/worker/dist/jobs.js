"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.autoAssign = autoAssign;
exports.checkSla = checkSla;
exports.generateReports = generateReports;
const dayjs_1 = __importDefault(require("dayjs"));
const pdfkit_1 = __importDefault(require("pdfkit"));
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function autoAssign() {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const unassigned = await prisma.process.findMany({
        where: {
            ownerId: null,
            createdAt: { lt: tenMinutesAgo },
            status: { notIn: [client_1.ProcessStatus.CONCLUIDO, client_1.ProcessStatus.CANCELADO] }
        },
        orderBy: { createdAt: "asc" }
    });
    if (unassigned.length === 0)
        return { assigned: 0 };
    const operators = await prisma.user.findMany({ where: { role: "OPERATOR", active: true } });
    if (operators.length === 0)
        return { assigned: 0 };
    const load = await prisma.process.groupBy({
        by: ["ownerId"],
        where: { status: { notIn: [client_1.ProcessStatus.CONCLUIDO, client_1.ProcessStatus.CANCELADO] } },
        _count: { ownerId: true }
    });
    const loadMap = new Map(load.map((item) => [item.ownerId ?? "", item._count.ownerId]));
    const lastAssignments = await prisma.processOwnerHistory.groupBy({
        by: ["ownerId"],
        _max: { assignedAt: true }
    });
    const lastAssignedMap = new Map(lastAssignments.map((item) => [item.ownerId ?? "", item._max.assignedAt?.getTime() ?? 0]));
    for (const process of unassigned) {
        const sorted = [...operators].sort((a, b) => {
            const countA = loadMap.get(a.id) ?? 0;
            const countB = loadMap.get(b.id) ?? 0;
            if (countA !== countB)
                return countA - countB;
            const lastA = lastAssignedMap.get(a.id) ?? 0;
            const lastB = lastAssignedMap.get(b.id) ?? 0;
            return lastA - lastB;
        });
        const chosen = sorted[0];
        await prisma.$transaction(async (tx) => {
            await tx.$queryRaw `SELECT id FROM "Process" WHERE id = ${process.id} FOR UPDATE`;
            await tx.process.update({
                where: { id: process.id },
                data: { ownerId: chosen.id }
            });
            await tx.processOwnerHistory.create({
                data: { processId: process.id, ownerId: chosen.id, assignedBy: "system" }
            });
        });
        loadMap.set(chosen.id, (loadMap.get(chosen.id) ?? 0) + 1);
        lastAssignedMap.set(chosen.id, Date.now());
    }
    return { assigned: unassigned.length };
}
async function checkSla() {
    const events = await prisma.slaEvent.findMany({
        where: { status: { in: ["ON_TRACK", "AT_RISK"] } },
        include: { process: true }
    });
    let notified = 0;
    for (const event of events) {
        const totalMs = (0, dayjs_1.default)(event.dueAt).diff((0, dayjs_1.default)(event.startedAt));
        const elapsedMs = (0, dayjs_1.default)().diff((0, dayjs_1.default)(event.startedAt));
        const percent = (elapsedMs / totalMs) * 100;
        if (percent >= 100 && event.status !== "OVERDUE") {
            await prisma.slaEvent.update({
                where: { id: event.id },
                data: { status: "OVERDUE" }
            });
            await prisma.notification.create({
                data: {
                    channel: "EMAIL",
                    recipient: event.process.clientEmail,
                    subject: "SLA estourado",
                    body: `SLA estourado na ${event.stepKey} (${event.side}).`,
                    status: "SENT"
                }
            });
            await prisma.notification.create({
                data: {
                    channel: "WHATSAPP",
                    recipient: event.process.clientEmail,
                    subject: "WhatsApp",
                    body: `SLA estourado na ${event.stepKey} (${event.side}).`,
                    status: "SENT"
                }
            });
            notified += 1;
            continue;
        }
        const config = await prisma.slaConfigStep.findUnique({
            where: { stepKey_side: { stepKey: event.stepKey, side: event.side } }
        });
        const alertPercent = config?.alertPercent ?? 80;
        if (percent >= alertPercent && event.status === "ON_TRACK") {
            await prisma.slaEvent.update({
                where: { id: event.id },
                data: { status: "AT_RISK" }
            });
            await prisma.notification.create({
                data: {
                    channel: "EMAIL",
                    recipient: event.process.clientEmail,
                    subject: "SLA em risco",
                    body: `SLA em risco na ${event.stepKey} (${event.side}).`,
                    status: "SENT"
                }
            });
            await prisma.notification.create({
                data: {
                    channel: "WHATSAPP",
                    recipient: event.process.clientEmail,
                    subject: "WhatsApp",
                    body: `SLA em risco na ${event.stepKey} (${event.side}).`,
                    status: "SENT"
                }
            });
            notified += 1;
        }
    }
    return { notified };
}
async function generateReports() {
    const processes = await prisma.process.findMany({
        where: {
            status: client_1.ProcessStatus.CONCLUIDO,
            reports: { none: {} }
        },
        include: {
            steps: true,
            checklists: true,
            documents: { include: { files: true } },
            slaEvents: true
        }
    });
    for (const process of processes) {
        const doc = new pdfkit_1.default();
        const chunks = [];
        doc.on("data", (chunk) => chunks.push(chunk));
        doc.fontSize(18).text("Relatório Final - FundarMF", { align: "center" });
        doc.moveDown();
        doc.fontSize(12).text(`Processo: ${process.id}`);
        doc.text(`Cliente: ${process.clientName ?? "-"} (${process.clientEmail})`);
        doc.text(`Status: ${process.status}`);
        doc.moveDown();
        doc.fontSize(14).text("Etapas", { underline: true });
        for (const step of process.steps) {
            doc.fontSize(12).text(`${step.stepKey} - ${step.status}`);
        }
        doc.moveDown();
        doc.fontSize(14).text("Checklist", { underline: true });
        for (const checklist of process.checklists) {
            doc.fontSize(12).text(`${checklist.stepKey}: ${checklist.status}`);
        }
        doc.moveDown();
        doc.fontSize(14).text("Documentos", { underline: true });
        for (const item of process.documents) {
            doc.fontSize(12).text(`${item.itemKey}: ${item.status} (v${item.version})`);
        }
        doc.moveDown();
        doc.fontSize(14).text("SLA", { underline: true });
        for (const sla of process.slaEvents) {
            doc.fontSize(12).text(`${sla.stepKey} ${sla.side}: ${sla.status}`);
        }
        doc.end();
        const buffer = await new Promise((resolve) => {
            doc.on("end", () => resolve(Buffer.concat(chunks)));
        });
        await prisma.report.create({
            data: {
                processId: process.id,
                fileName: `relatorio-${process.id}.pdf`,
                mimeType: "application/pdf",
                data: buffer
            }
        });
    }
    return { generated: processes.length };
}
//# sourceMappingURL=jobs.js.map
