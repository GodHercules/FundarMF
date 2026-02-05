"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResendEmailProvider = void 0;
const resend_1 = require("resend");
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
    async sendEmail(to, subject, body) {
        const html = body
            .split("\n")
            .map((line) => line.trim())
            .map((line) => (line ? `<p style="margin:0 0 8px;">${line}</p>` : "<br/>"))
            .join("");
        await this.resend.emails.send({
            from: this.from,
            to,
            subject,
            text: body,
            html
        });
    }
}
exports.ResendEmailProvider = ResendEmailProvider;
//# sourceMappingURL=resend.provider.js.map