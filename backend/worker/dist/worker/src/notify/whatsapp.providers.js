"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockWhatsAppProvider = exports.TerminalWhatsAppProvider = exports.TwilioWhatsAppProvider = void 0;
const twilio_1 = __importDefault(require("twilio"));
class TwilioWhatsAppProvider {
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
    async sendWhatsApp(payload) {
        const normalizedTo = payload.to.startsWith("whatsapp:") ? payload.to : `whatsapp:${payload.to}`;
        await this.twilioClient.messages.create({
            to: normalizedTo,
            from: this.twilioMessagingServiceSid ? undefined : this.twilioFrom,
            messagingServiceSid: this.twilioMessagingServiceSid,
            body: payload.body
        });
    }
}
exports.TwilioWhatsAppProvider = TwilioWhatsAppProvider;
class TerminalWhatsAppProvider {
    async sendWhatsApp(payload) {
        const preview = [
            "----- WHATSAPP (terminal mode) -----",
            `To: ${payload.to}`,
            "",
            payload.body,
            "-----------------------------------"
        ].join("\n");
        console.log(preview);
    }
}
exports.TerminalWhatsAppProvider = TerminalWhatsAppProvider;
class MockWhatsAppProvider {
    async sendWhatsApp(payload) {
        console.log(`[WHATSAPP:MOCK] To: ${payload.to} | ${payload.body}`);
    }
}
exports.MockWhatsAppProvider = MockWhatsAppProvider;
//# sourceMappingURL=whatsapp.providers.js.map