import { Injectable } from "@nestjs/common";
import nodemailer, { Transporter } from "nodemailer";
import twilio, { Twilio } from "twilio";
import { EmailProvider, WhatsAppProvider } from "./notification.types";

@Injectable()
export class SmtpEmailProvider implements EmailProvider {
  private readonly transporter: Transporter;
  private readonly from: string;

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

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined
    });
  }

  async sendEmail(to: string, subject: string, body: string) {
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
      html,
      textEncoding: "base64",
      headers: {
        "Content-Type": "text/html; charset=UTF-8"
      }
    });
  }
}

@Injectable()
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

  async sendWhatsApp(to: string, body: string) {
    const normalizedTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;

    await this.twilioClient.messages.create({
      to: normalizedTo,
      from: this.twilioMessagingServiceSid ? undefined : this.twilioFrom,
      messagingServiceSid: this.twilioMessagingServiceSid,
      body
    });
  }
}
