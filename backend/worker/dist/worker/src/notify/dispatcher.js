"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationDispatcher = void 0;
const email_providers_1 = require("./email.providers");
const whatsapp_providers_1 = require("./whatsapp.providers");
const config_1 = require("./config");
const withTimeout = async (promise, timeoutMs) => {
    let timeout;
    try {
        const timer = new Promise((_, reject) => {
            timeout = setTimeout(() => reject(new Error("notify_timeout")), timeoutMs);
        });
        return await Promise.race([promise, timer]);
    }
    finally {
        if (timeout)
            clearTimeout(timeout);
    }
};
const logAttempt = (payload) => {
    console.log(JSON.stringify(payload));
};
class NotificationDispatcher {
    prisma;
    emailProvider;
    whatsappProvider;
    constructor(prisma) {
        this.prisma = prisma;
    }
    getEmailProvider(mode) {
        if (mode === "terminal")
            return new email_providers_1.TerminalEmailProvider();
        if (mode === "mock")
            return new email_providers_1.MockEmailProvider();
        if (!this.emailProvider) {
            const provider = (0, config_1.getEmailProviderMode)();
            if (provider === "resend") {
                this.emailProvider = new email_providers_1.ResendEmailProvider();
            }
            else {
                this.emailProvider = new email_providers_1.SmtpEmailProvider();
            }
        }
        return this.emailProvider;
    }
    getWhatsAppProvider(mode) {
        if (mode === "terminal")
            return new whatsapp_providers_1.TerminalWhatsAppProvider();
        if (mode === "mock")
            return new whatsapp_providers_1.MockWhatsAppProvider();
        if (!this.whatsappProvider) {
            const provider = (0, config_1.getWhatsAppProviderMode)();
            if (provider === "twilio") {
                this.whatsappProvider = new whatsapp_providers_1.TwilioWhatsAppProvider();
            }
            else {
                this.whatsappProvider = new whatsapp_providers_1.MockWhatsAppProvider();
            }
        }
        return this.whatsappProvider;
    }
    async handleEmail(job) {
        const mode = (0, config_1.getNotifyMode)();
        const attempt = job.retryCount + 1;
        const startedAt = Date.now();
        const payload = job.data;
        const timeoutMs = (0, config_1.getNotifyTimeoutMs)();
        console.log("[notify] worker received email", JSON.stringify({
            correlationId: payload.correlationId,
            jobId: job.id,
            attempt,
            mode,
            to: payload.to,
            subject: payload.subject
        }));
        if (!(0, config_1.isEmailEnabled)()) {
            logAttempt({
                level: "info",
                event: "notify_email_skipped",
                correlationId: payload.correlationId,
                jobId: job.id,
                attempt,
                mode,
                to: payload.to,
                subject: payload.subject
            });
            await this.prisma.notification.create({
                data: {
                    channel: "EMAIL",
                    recipient: payload.to,
                    subject: payload.subject,
                    body: payload.text,
                    status: "SKIPPED"
                }
            });
            return;
        }
        try {
            const provider = this.getEmailProvider(mode);
            await withTimeout(provider.sendEmail(payload), timeoutMs);
            const durationMs = Date.now() - startedAt;
            logAttempt({
                level: "info",
                event: "notify_email_sent",
                correlationId: payload.correlationId,
                jobId: job.id,
                attempt,
                mode,
                durationMs,
                to: payload.to,
                subject: payload.subject
            });
            await this.prisma.notification.create({
                data: {
                    channel: "EMAIL",
                    recipient: payload.to,
                    subject: payload.subject,
                    body: payload.text,
                    status: mode === "real" ? "SENT" : mode.toUpperCase()
                }
            });
        }
        catch (err) {
            const durationMs = Date.now() - startedAt;
            logAttempt({
                level: "error",
                event: "notify_email_failed",
                correlationId: payload.correlationId,
                jobId: job.id,
                attempt,
                mode,
                durationMs,
                to: payload.to,
                subject: payload.subject,
                error: err instanceof Error ? err.message : String(err)
            });
            await this.prisma.notification.create({
                data: {
                    channel: "EMAIL",
                    recipient: payload.to,
                    subject: payload.subject,
                    body: payload.text,
                    status: "ERROR"
                }
            });
            throw err;
        }
    }
    async handleWhatsApp(job) {
        const mode = (0, config_1.getNotifyMode)();
        const attempt = job.retryCount + 1;
        const startedAt = Date.now();
        const payload = job.data;
        const timeoutMs = (0, config_1.getNotifyTimeoutMs)();
        console.log("[notify] worker received whatsapp", JSON.stringify({
            correlationId: payload.correlationId,
            jobId: job.id,
            attempt,
            mode,
            to: payload.to
        }));
        if (!(0, config_1.isWhatsAppEnabled)()) {
            logAttempt({
                level: "info",
                event: "notify_whatsapp_skipped",
                correlationId: payload.correlationId,
                jobId: job.id,
                attempt,
                mode,
                to: payload.to
            });
            await this.prisma.notification.create({
                data: {
                    channel: "WHATSAPP",
                    recipient: payload.to,
                    subject: "WhatsApp",
                    body: payload.body,
                    status: "SKIPPED"
                }
            });
            return;
        }
        try {
            const provider = this.getWhatsAppProvider(mode);
            await withTimeout(provider.sendWhatsApp(payload), timeoutMs);
            const durationMs = Date.now() - startedAt;
            logAttempt({
                level: "info",
                event: "notify_whatsapp_sent",
                correlationId: payload.correlationId,
                jobId: job.id,
                attempt,
                mode,
                durationMs,
                to: payload.to
            });
            await this.prisma.notification.create({
                data: {
                    channel: "WHATSAPP",
                    recipient: payload.to,
                    subject: "WhatsApp",
                    body: payload.body,
                    status: mode === "real" ? "SENT" : mode.toUpperCase()
                }
            });
        }
        catch (err) {
            const durationMs = Date.now() - startedAt;
            logAttempt({
                level: "error",
                event: "notify_whatsapp_failed",
                correlationId: payload.correlationId,
                jobId: job.id,
                attempt,
                mode,
                durationMs,
                to: payload.to,
                error: err instanceof Error ? err.message : String(err)
            });
            await this.prisma.notification.create({
                data: {
                    channel: "WHATSAPP",
                    recipient: payload.to,
                    subject: "WhatsApp",
                    body: payload.body,
                    status: "ERROR"
                }
            });
            throw err;
        }
    }
}
exports.NotificationDispatcher = NotificationDispatcher;
//# sourceMappingURL=dispatcher.js.map