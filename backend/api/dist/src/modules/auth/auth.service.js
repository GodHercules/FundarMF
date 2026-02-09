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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dayjs_1 = __importDefault(require("dayjs"));
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../shared/prisma.service");
const session_service_1 = require("./session.service");
const notification_service_1 = require("../notification/notification.service");
const audit_service_1 = require("../audit/audit.service");
const perf_1 = require("../../shared/perf");
const email_template_1 = require("../notification/email.template");
let AuthService = class AuthService {
    prisma;
    sessionService;
    notificationService;
    auditService;
    constructor(prisma, sessionService, notificationService, auditService) {
        this.prisma = prisma;
        this.sessionService = sessionService;
        this.notificationService = notificationService;
        this.auditService = auditService;
    }
    hash(value) {
        return crypto_1.default.createHash("sha256").update(value).digest("hex");
    }
    normalizeWhatsApp(value) {
        const cleaned = value.replace(/[^\d+]/g, "");
        if (cleaned.startsWith("+"))
            return cleaned;
        if (cleaned.startsWith("00"))
            return `+${cleaned.slice(2)}`;
        return `+${cleaned}`;
    }
    buildCustomerAccessWhatsApp(linkUrl, otp, name) {
        const brand = process.env.WHATSAPP_BRAND ?? process.env.COMPANY_NAME ?? "MF Contabilidade";
        const location = process.env.COMPANY_LOCATION ?? "Bahia, Brazil";
        const linkTtl = Number(process.env.LINK_TTL_HOURS ?? 120);
        const otpTtl = Number(process.env.OTP_TTL_MINUTES ?? 1440);
        return [
            `${brand} | Acesso ao portal`,
            name ? `Olá, ${name}!` : "Olá!",
            location,
            "Seu link de acesso seguro está pronto.",
            `Link: ${linkUrl}`,
            otp ? `Código (OTP): ${otp}` : "Código (OTP): não necessário",
            `Validade do link: ${linkTtl}h.`,
            otp ? `Validade do código: ${otpTtl}min.` : ""
        ]
            .filter(Boolean)
            .join("\n");
    }
    buildCustomerAccessEmail(linkUrl, otp, name) {
        const linkTtl = Number(process.env.LINK_TTL_HOURS ?? 120);
        const otpTtl = Number(process.env.OTP_TTL_MINUTES ?? 1440);
        const lines = [
            name ? `Olá, ${name},` : "Olá,",
            "",
            "Seu acesso seguro ao portal do cliente FundarMF foi solicitado.",
            "",
            "Siga os passos abaixo:",
            `1) Abra este link: ${linkUrl}`,
            otp ? `2) Informe o código (OTP): ${otp}` : "2) Não é necessário código neste acesso.",
            "",
            `Este link expira em ${linkTtl} horas.`,
            otp ? `O código expira em ${otpTtl} minutos.` : "",
            "",
            "Se você não solicitou este acesso, ignore este e-mail."
        ].filter(Boolean);
        return lines.join("\n");
    }
    async requestCustomerLink(email, whatsapp, name, requestedBy) {
        if (!email && !whatsapp) {
            throw new common_1.BadRequestException("Informe e-mail ou WhatsApp.");
        }
        const normalizedWhatsapp = whatsapp ? this.normalizeWhatsApp(whatsapp) : undefined;
        const token = crypto_1.default.randomBytes(24).toString("hex");
        const tokenHash = this.hash(token);
        const tokenExpiresAt = (0, dayjs_1.default)().add(Number(process.env.LINK_TTL_HOURS ?? 120), "hour").toDate();
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = this.hash(otp);
        const otpExpiresAt = (0, dayjs_1.default)().add(Number(process.env.OTP_TTL_MINUTES ?? 1440), "minute").toDate();
        await this.prisma.customerLinkToken.create({
            data: {
                email,
                whatsapp: normalizedWhatsapp,
                tokenHash,
                tokenExpiresAt,
                otpHash,
                otpExpiresAt,
                otpSentCount: 1,
                lastOtpSentAt: new Date()
            }
        });
        const linkUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/client/link?token=${token}`;
        const notifyTasks = [];
        if (email) {
            const subject = "Seu acesso ao FundarMF";
            const emailText = this.buildCustomerAccessEmail(linkUrl, otp, name);
            const emailRendered = (0, email_template_1.renderBaseEmail)({
                title: subject,
                body: emailText,
                ctaLabel: "Abrir acesso",
                ctaUrl: linkUrl
            });
            notifyTasks.push(this.notificationService.sendEmail(email, subject, emailText));
            // Attach the exact draft to the webhook too, so n8n can send it if desired.
            void this.notificationService.sendWebhook({
                email,
                whatsapp: normalizedWhatsapp,
                link: linkUrl,
                otp,
                reason: "link_created",
                requestedBy,
                emails: {
                    client: {
                        to: email,
                        subject,
                        text: emailRendered.text,
                        html: emailRendered.html
                    }
                }
            });
        }
        if (normalizedWhatsapp) {
            notifyTasks.push(this.notificationService.sendWhatsApp(normalizedWhatsapp, this.buildCustomerAccessWhatsApp(linkUrl, otp, name)));
        }
        if (notifyTasks.length > 0) {
            await Promise.all(notifyTasks);
        }
        if (!email) {
            // If there's no email, still notify webhook with link + otp metadata.
            void this.notificationService.sendWebhook({
                email,
                whatsapp: normalizedWhatsapp,
                link: linkUrl,
                otp,
                reason: "link_created",
                requestedBy
            });
        }
        await this.auditService.record({ role: "SYSTEM" }, "customer_link_requested", "CustomerLinkToken", undefined, { email, whatsapp: normalizedWhatsapp });
        return { otpRequired: true };
    }
    async verifyCustomerLink(token, otp) {
        const tokenHash = this.hash(token);
        const link = await this.prisma.customerLinkToken.findUnique({ where: { tokenHash } });
        if (!link || link.usedAt || (0, dayjs_1.default)(link.tokenExpiresAt).isBefore((0, dayjs_1.default)())) {
            throw new common_1.BadRequestException({ code: "LINK_INVALID" });
        }
        if (link.otpHash) {
            if (!otp) {
                throw new common_1.BadRequestException({ code: "OTP_REQUIRED" });
            }
            if ((0, dayjs_1.default)(link.otpExpiresAt).isBefore((0, dayjs_1.default)())) {
                throw new common_1.BadRequestException({ code: "OTP_EXPIRED" });
            }
            if (this.hash(otp) !== link.otpHash) {
                throw new common_1.BadRequestException({ code: "OTP_INVALID" });
            }
        }
        await this.prisma.customerLinkToken.update({
            where: { id: link.id },
            data: { usedAt: new Date() }
        });
        const actor = { role: "CLIENTE", email: link.email ?? undefined, whatsapp: link.whatsapp ?? undefined };
        const { token: sessionToken } = await this.sessionService.createSession(actor, Number(process.env.SESSION_TTL_HOURS ?? 48));
        await this.auditService.record(actor, "customer_login", "Session", undefined, {
            email: link.email ?? undefined,
            whatsapp: link.whatsapp ?? undefined
        });
        return { sessionToken };
    }
    async resendCustomerOtp(token) {
        const tokenHash = this.hash(token);
        const link = await this.prisma.customerLinkToken.findUnique({ where: { tokenHash } });
        if (!link || link.usedAt || (0, dayjs_1.default)(link.tokenExpiresAt).isBefore((0, dayjs_1.default)())) {
            throw new common_1.BadRequestException({ code: "LINK_INVALID" });
        }
        if (!link.email) {
            throw new common_1.BadRequestException("E-mail não disponível para reenvio do OTP.");
        }
        if (link.otpSentCount >= 5) {
            throw new common_1.BadRequestException({ code: "OTP_LIMIT_REACHED" });
        }
        if (link.lastOtpSentAt && (0, dayjs_1.default)().diff((0, dayjs_1.default)(link.lastOtpSentAt), "hour") < 24) {
            throw new common_1.BadRequestException({ code: "OTP_TOO_SOON" });
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = this.hash(otp);
        const otpExpiresAt = (0, dayjs_1.default)().add(Number(process.env.OTP_TTL_MINUTES ?? 1440), "minute").toDate();
        await this.prisma.customerLinkToken.update({
            where: { id: link.id },
            data: {
                otpHash,
                otpExpiresAt,
                otpSentCount: link.otpSentCount + 1,
                lastOtpSentAt: new Date()
            }
        });
        const linkUrl = `${process.env.FRONTEND_URL ?? "http://localhost:3000"}/client/link?token=${token}`;
        const subject = "Seu novo OTP do FundarMF";
        const emailText = this.buildCustomerAccessEmail(linkUrl, otp);
        const emailRendered = (0, email_template_1.renderBaseEmail)({
            title: subject,
            body: emailText,
            ctaLabel: "Abrir acesso",
            ctaUrl: linkUrl
        });
        await this.notificationService.sendEmail(link.email, subject, emailText);
        void this.notificationService.sendWebhook({
            email: link.email,
            whatsapp: link.whatsapp ?? undefined,
            link: linkUrl,
            otp,
            reason: "otp_resent",
            requestedBy: { email: link.email ?? undefined, role: "CLIENTE" },
            emails: {
                client: {
                    to: link.email,
                    subject,
                    text: emailRendered.text,
                    html: emailRendered.html
                }
            }
        });
        await this.auditService.record({ role: "SYSTEM" }, "customer_otp_resent", "CustomerLinkToken", link.id, { email: link.email });
        return { ok: true };
    }
    async loginUser(email, password, role) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || user.role !== role || !user.active) {
            throw new common_1.UnauthorizedException("Credenciais inválidas.");
        }
        const ok = await (0, perf_1.timeAsync)("hashMs", () => bcryptjs_1.default.compare(password, user.passwordHash));
        if (!ok) {
            throw new common_1.UnauthorizedException("Credenciais inválidas.");
        }
        const actor = { role: role === "OPERATOR" ? "OPERADOR" : "MASTER", userId: user.id, email: user.email };
        const { token } = await this.sessionService.createSession(actor, Number(process.env.SESSION_TTL_HOURS ?? 48));
        await this.auditService.record(actor, "user_login", "Session", undefined, { email: user.email });
        return { token };
    }
    async loginAny(email, password) {
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (!user || !user.active) {
            throw new common_1.UnauthorizedException("Credenciais inválidas.");
        }
        const ok = await (0, perf_1.timeAsync)("hashMs", () => bcryptjs_1.default.compare(password, user.passwordHash));
        if (!ok) {
            throw new common_1.UnauthorizedException("Credenciais inválidas.");
        }
        const actor = {
            role: user.role === "OPERATOR" ? "OPERADOR" : "MASTER",
            userId: user.id,
            email: user.email
        };
        const { token } = await this.sessionService.createSession(actor, Number(process.env.SESSION_TTL_HOURS ?? 48));
        await this.auditService.record(actor, "user_login", "Session", undefined, { email: user.email });
        return { token, role: user.role };
    }
    async logout(sessionId, actor) {
        if (sessionId) {
            await this.prisma.session.deleteMany({ where: { id: sessionId } });
        }
        await this.auditService.record(actor, "logout", "Session");
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        session_service_1.SessionService,
        notification_service_1.NotificationService,
        audit_service_1.AuditService])
], AuthService);
//# sourceMappingURL=auth.service.js.map