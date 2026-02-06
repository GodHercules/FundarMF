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
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
const perf_1 = require("../../shared/perf");
const request_context_1 = require("../../shared/request-context");
const email_template_1 = require("./email.template");
const notification_queue_1 = require("./notification.queue");
let NotificationService = class NotificationService {
    queue;
    prisma;
    constructor(queue, prisma) {
        this.queue = queue;
        this.prisma = prisma;
    }
    async sendEmail(to, subject, body) {
        const { html, text } = (0, email_template_1.renderBaseEmail)({ title: subject, body });
        const from = process.env.EMAIL_FROM ?? "no-reply@fundarmf.local";
        const replyTo = process.env.EMAIL_REPLY_TO?.trim() || undefined;
        const correlationId = (0, request_context_1.getRequestContext)()?.correlationId;
        await (0, perf_1.timeAsync)("externalMs", () => this.queue.enqueueEmail({
            to,
            subject,
            text,
            html,
            from,
            replyTo,
            correlationId
        }));
    }
    async sendWhatsApp(to, body) {
        const correlationId = (0, request_context_1.getRequestContext)()?.correlationId;
        await (0, perf_1.timeAsync)("externalMs", () => this.queue.enqueueWhatsApp({
            to,
            body,
            correlationId
        }));
    }
    async createInApp(payload) {
        return this.prisma.userNotification.create({
            data: {
                userId: payload.userId,
                processId: payload.processId,
                title: payload.title,
                body: payload.body,
                type: payload.type
            }
        });
    }
    async listInApp(userId, limit = 50, offset = 0) {
        const take = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 200) : 50;
        const skip = Number.isFinite(offset) && offset > 0 ? offset : 0;
        return this.prisma.userNotification.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            take,
            skip
        });
    }
    async unreadCount(userId) {
        return this.prisma.userNotification.count({
            where: { userId, readAt: null }
        });
    }
    async markRead(userId, notificationId) {
        const result = await this.prisma.userNotification.updateMany({
            where: { id: notificationId, userId },
            data: { readAt: new Date() }
        });
        return { ok: result.count > 0 };
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [notification_queue_1.NotificationQueue,
        prisma_service_1.PrismaService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map