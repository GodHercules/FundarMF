"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationModule = void 0;
const common_1 = require("@nestjs/common");
const notification_service_1 = require("./notification.service");
const prisma_service_1 = require("../../shared/prisma.service");
const mock_provider_1 = require("./mock.provider");
const notification_types_1 = require("./notification.types");
const resend_provider_1 = require("./resend.provider");
const smtp_provider_1 = require("./smtp.provider");
const notification_controller_1 = require("./notification.controller");
const notification_queue_1 = require("./notification.queue");
let NotificationModule = class NotificationModule {
};
exports.NotificationModule = NotificationModule;
exports.NotificationModule = NotificationModule = __decorate([
    (0, common_1.Module)({
        controllers: [notification_controller_1.NotificationController],
        providers: [
            notification_service_1.NotificationService,
            prisma_service_1.PrismaService,
            {
                provide: notification_types_1.EMAIL_PROVIDER,
                useFactory: (prisma) => {
                    const notifyMode = (process.env.NOTIFY_MODE ?? "mock").toLowerCase();
                    if (notifyMode === "terminal")
                        return new mock_provider_1.TerminalEmailProvider();
                    if (notifyMode === "mock")
                        return new mock_provider_1.MockEmailProvider(prisma);
                    const mode = (process.env.EMAIL_PROVIDER ?? "").toLowerCase();
                    if (mode === "resend" || process.env.RESEND_API_KEY) {
                        return new resend_provider_1.ResendEmailProvider();
                    }
                    if (mode === "smtp" || process.env.SMTP_HOST) {
                        return new smtp_provider_1.SmtpEmailProvider();
                    }
                    return new mock_provider_1.MockEmailProvider(prisma);
                },
                inject: [prisma_service_1.PrismaService]
            },
            {
                provide: notification_types_1.WHATSAPP_PROVIDER,
                useFactory: (prisma) => {
                    const notifyMode = (process.env.NOTIFY_MODE ?? "mock").toLowerCase();
                    if (notifyMode === "terminal")
                        return new mock_provider_1.TerminalWhatsAppProvider();
                    if (notifyMode === "mock")
                        return new mock_provider_1.FakeWhatsAppProvider(prisma);
                    const mode = (process.env.WHATSAPP_PROVIDER ?? "fake").toLowerCase();
                    if (mode === "twilio") {
                        return new smtp_provider_1.TwilioWhatsAppProvider();
                    }
                    return new mock_provider_1.FakeWhatsAppProvider(prisma);
                },
                inject: [prisma_service_1.PrismaService]
            },
            notification_queue_1.NotificationQueue
        ],
        exports: [notification_service_1.NotificationService]
    })
], NotificationModule);
//# sourceMappingURL=notification.module.js.map