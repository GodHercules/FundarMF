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
exports.NotificationController = void 0;
const common_1 = require("@nestjs/common");
const auth_guard_1 = require("../../common/auth/auth.guard");
const roles_guard_1 = require("../../common/auth/roles.guard");
const roles_decorator_1 = require("../../common/auth/roles.decorator");
const notification_service_1 = require("./notification.service");
const notification_test_dto_1 = require("./notification-test.dto");
let NotificationController = class NotificationController {
    notificationService;
    constructor(notificationService) {
        this.notificationService = notificationService;
    }
    async list(req, limit, offset) {
        const take = limit ? Number(limit) : undefined;
        const skip = offset ? Number(offset) : undefined;
        return this.notificationService.listInApp(req.actor.userId, take, skip);
    }
    async unread(req) {
        const count = await this.notificationService.unreadCount(req.actor.userId);
        return { count };
    }
    async markRead(id, req) {
        return this.notificationService.markRead(req.actor.userId, id);
    }
    async sendTestEmail(dto) {
        await this.notificationService.sendEmail(dto.to, dto.subject, dto.body);
        return { ok: true };
    }
    async sendTestWhatsApp(dto) {
        await this.notificationService.sendWhatsApp(dto.to, dto.body);
        return { ok: true };
    }
};
exports.NotificationController = NotificationController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)("limit")),
    __param(2, (0, common_1.Query)("offset")),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "list", null);
__decorate([
    (0, common_1.Get)("unread-count"),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "unread", null);
__decorate([
    (0, common_1.Patch)(":id/read"),
    __param(0, (0, common_1.Param)("id")),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "markRead", null);
__decorate([
    (0, common_1.Post)("test-email"),
    (0, roles_decorator_1.Roles)("MASTER"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [notification_test_dto_1.TestEmailDto]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "sendTestEmail", null);
__decorate([
    (0, common_1.Post)("test-whatsapp"),
    (0, roles_decorator_1.Roles)("MASTER"),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [notification_test_dto_1.TestWhatsAppDto]),
    __metadata("design:returntype", Promise)
], NotificationController.prototype, "sendTestWhatsApp", null);
exports.NotificationController = NotificationController = __decorate([
    (0, common_1.Controller)("notifications"),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)("OPERADOR", "MASTER"),
    __metadata("design:paramtypes", [notification_service_1.NotificationService])
], NotificationController);
//# sourceMappingURL=notification.controller.js.map