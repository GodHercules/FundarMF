import twilio, { Twilio } from "twilio";
import { WhatsAppJobPayload } from "./types";

export type WhatsAppSendInput = WhatsAppJobPayload;

export interface WhatsAppProvider {
  sendWhatsApp(payload: WhatsAppSendInput): Promise<void>;
}

export class TwilioWhatsAppProvider implements WhatsAppProvider {
  private readonly twilioClient: Twilio;
  private readonly twilioFrom?: string;
  private readonly twilioMessagingServiceSid?: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_WHATSAPP_FROM;
    const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;

    if (!accountSid || !authToken) {
      throw new Error("TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required for TwilioWhatsAppProvider");
    }

    this.twilioClient = twilio(accountSid, authToken);
    this.twilioFrom = fromNumber;
    this.twilioMessagingServiceSid = messagingServiceSid?.trim() ? messagingServiceSid : undefined;

    if (!this.twilioMessagingServiceSid && !this.twilioFrom) {
      throw new Error("TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID is required.");
    }
  }

  async sendWhatsApp(payload: WhatsAppSendInput) {
    const normalizedTo = payload.to.startsWith("whatsapp:") ? payload.to : `whatsapp:${payload.to}`;

    await this.twilioClient.messages.create({
      to: normalizedTo,
      from: this.twilioMessagingServiceSid ? undefined : this.twilioFrom,
      messagingServiceSid: this.twilioMessagingServiceSid,
      body: payload.body
    });
  }
}

export class TerminalWhatsAppProvider implements WhatsAppProvider {
  async sendWhatsApp(payload: WhatsAppSendInput) {
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

export class MockWhatsAppProvider implements WhatsAppProvider {
  async sendWhatsApp(payload: WhatsAppSendInput) {
    console.log(`[WHATSAPP:MOCK] To: ${payload.to} | ${payload.body}`);
  }
}
