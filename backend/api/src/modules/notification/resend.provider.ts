import { Resend } from "resend";

import { EmailProvider } from "./notification.types";

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

  async sendEmail(to: string, subject: string, body: string) {
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
      html,
      headers: {
        "Content-Type": "text/html; charset=UTF-8"
      }
    });
  }
}
