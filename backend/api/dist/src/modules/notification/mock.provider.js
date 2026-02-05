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
exports.FakeWhatsAppProvider = exports.MockEmailProvider = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
let MockEmailProvider = class MockEmailProvider {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async sendEmail(to, subject, body) {
        await this.prisma.notification.create({
            data: {
                channel: "EMAIL",
                recipient: to,
                subject,
                body,
                status: "SENT"
            }
        });
        console.log(`[EMAIL] To: ${to} | ${subject}`);
    }
};
exports.MockEmailProvider = MockEmailProvider;
exports.MockEmailProvider = MockEmailProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], MockEmailProvider);
let FakeWhatsAppProvider = class FakeWhatsAppProvider {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async sendWhatsApp(to, body) {
        await this.prisma.notification.create({
            data: {
                channel: "WHATSAPP",
                recipient: to,
                subject: "WhatsApp",
                body,
                status: "SENT"
            }
        });
        console.log(`[WHATSAPP:FAKE] To: ${to} | ${body}`);
    }
};
exports.FakeWhatsAppProvider = FakeWhatsAppProvider;
exports.FakeWhatsAppProvider = FakeWhatsAppProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FakeWhatsAppProvider);
//# sourceMappingURL=mock.provider.js.map