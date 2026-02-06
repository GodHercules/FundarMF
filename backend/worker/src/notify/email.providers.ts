import nodemailer, { Transporter } from "nodemailer";
import { Resend } from "resend";
import { EmailJobPayload } from "./types";

export type EmailSendInput = EmailJobPayload;

export interface EmailProvider {
  sendEmail(payload: EmailSendInput): Promise<void>;
}

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

  async sendEmail(payload: EmailSendInput) {
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

export class ResendEmailProvider implements EmailProvider {
  private readonly resend: Resend;
  private readonly from: string;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error("RESEND_API_KEY is required to use ResendEmailProvider");
    }
    this.resend = new Resend(apiKey);
    this.from = process.env.EMAIL_FROM ?? "no-reply@fundarmf.local";
  }

  async sendEmail(payload: EmailSendInput) {
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

export class TerminalEmailProvider implements EmailProvider {
  async sendEmail(payload: EmailSendInput) {
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

export class MockEmailProvider implements EmailProvider {
  async sendEmail(payload: EmailSendInput) {
    console.log(
      `[EMAIL:MOCK] To: ${payload.to} | ${payload.subject} | ${payload.text.replace(/\n/g, " ")}`
    );
  }
}
