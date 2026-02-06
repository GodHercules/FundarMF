"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockEmailProvider = exports.TerminalEmailProvider = exports.ResendEmailProvider = exports.SmtpEmailProvider = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const resend_1 = require("resend");
class SmtpEmailProvider {
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
    async sendEmail(payload) {
        await this.transporter.sendMail({
            from: payload.from ?? this.from,
            replyTo: payload.replyTo,
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
            html: payload.html
        });
    }
}
exports.SmtpEmailProvider = SmtpEmailProvider;
class ResendEmailProvider {
    resend;
    from;
    constructor() {
        const apiKey = process.env.RESEND_API_KEY;
        if (!apiKey) {
            throw new Error("RESEND_API_KEY is required to use ResendEmailProvider");
        }
        this.resend = new resend_1.Resend(apiKey);
        this.from = process.env.EMAIL_FROM ?? "no-reply@fundarmf.local";
    }
    async sendEmail(payload) {
        await this.resend.emails.send({
            from: payload.from ?? this.from,
            to: payload.to,
            subject: payload.subject,
            text: payload.text,
            html: payload.html,
            reply_to: payload.replyTo
        });
    }
}
exports.ResendEmailProvider = ResendEmailProvider;
class TerminalEmailProvider {
    async sendEmail(payload) {
        const preview = [
            "----- EMAIL (terminal mode) -----",
            `To: ${payload.to}`,
            `Subject: ${payload.subject}`,
            "",
            "HTML:",
            payload.html,
            "",
            "Text:",
            payload.text,
            "--------------------------------"
        ].join("\n");
        console.log(preview);
    }
}
exports.TerminalEmailProvider = TerminalEmailProvider;
class MockEmailProvider {
    async sendEmail(payload) {
        console.log(`[EMAIL:MOCK] To: ${payload.to} | ${payload.subject} | ${payload.text.replace(/\n/g, " ")}`);
    }
}
exports.MockEmailProvider = MockEmailProvider;
//# sourceMappingURL=email.providers.js.map