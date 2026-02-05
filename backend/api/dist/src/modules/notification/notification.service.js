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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
const notification_types_1 = require("./notification.types");
let NotificationService = class NotificationService {
    emailProvider;
    whatsappProvider;
    prisma;
    constructor(emailProvider, whatsappProvider, prisma) {
        this.emailProvider = emailProvider;
        this.whatsappProvider = whatsappProvider;
        this.prisma = prisma;
    }
    async sendEmail(to, subject, body) {
        await this.emailProvider.sendEmail(to, subject, body);
    }
    async sendWhatsApp(to, body) {
        await this.whatsappProvider.sendWhatsApp(to, body);
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
    __param(0, (0, common_1.Inject)(notification_types_1.EMAIL_PROVIDER)),
    __param(1, (0, common_1.Inject)(notification_types_1.WHATSAPP_PROVIDER)),
    __metadata("design:paramtypes", [Object, Object, prisma_service_1.PrismaService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map