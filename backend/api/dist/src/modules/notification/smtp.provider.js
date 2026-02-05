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
exports.TwilioWhatsAppProvider = exports.SmtpEmailProvider = void 0;
const common_1 = require("@nestjs/common");
const nodemailer_1 = __importDefault(require("nodemailer"));
const twilio_1 = __importDefault(require("twilio"));
let SmtpEmailProvider = class SmtpEmailProvider {
    transporter;
    from;
    constructor() {
        const host = process.env.SMTP_HOST;
        const port = Number(process.env.SMTP_PORT ?? 587);
        const secure = (process.env.SMTP_SECURE ?? "false") === "true";
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        this.from = process.env.EMAIL_FROM ?? "no-reply@fundarmf.local";
        if (!host) {
            throw new Error("SMTP_HOST is required to use SmtpEmailProvider");
        }
        this.transporter = nodemailer_1.default.createTransport({
            host,
            port,
            secure,
            auth: user && pass ? { user, pass } : undefined
        });
    }
    async sendEmail(to, subject, body) {
        const html = body
            .split("\n")
            .map((line) => line.trim())
            .map((line) => (line ? `<p style="margin:0 0 8px;">${line}</p>` : "<br/>"))
            .join("");
        await this.transporter.sendMail({
            from: this.from,
            to,
            subject,
            text: body,
            html
        });
    }
};
exports.SmtpEmailProvider = SmtpEmailProvider;
exports.SmtpEmailProvider = SmtpEmailProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], SmtpEmailProvider);
let TwilioWhatsAppProvider = class TwilioWhatsAppProvider {
    twilioClient;
    twilioFrom;
    twilioMessagingServiceSid;
    constructor() {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
        const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
        if (!accountSid || !authToken) {
            throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required for TwilioWhatsAppProvider");
        }
        this.twilioClient = (0, twilio_1.default)(accountSid, authToken);
        this.twilioFrom = fromNumber;
        this.twilioMessagingServiceSid = messagingServiceSid?.trim() ? messagingServiceSid : undefined;
        if (!this.twilioMessagingServiceSid && !this.twilioFrom) {
            throw new Error("TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID is required.");
        }
    }
    async sendWhatsApp(to, body) {
        const normalizedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
        await this.twilioClient.messages.create({
            to: normalizedTo,
            from: this.twilioMessagingServiceSid ? undefined : this.twilioFrom,
            messagingServiceSid: this.twilioMessagingServiceSid,
            body
        });
    }
};
exports.TwilioWhatsAppProvider = TwilioWhatsAppProvider;
exports.TwilioWhatsAppProvider = TwilioWhatsAppProvider = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], TwilioWhatsAppProvider);
//# sourceMappingURL=smtp.provider.js.map