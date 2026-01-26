import { Inject, Injectable } from "@nestjs/common";
import { NOTIFICATION_PROVIDER, NotificationProvider } from "./notification.types";

@Injectable()
export class NotificationService {
  constructor(
    @Inject(NOTIFICATION_PROVIDER)
    private readonly provider: NotificationProvider
  ) {}

  async sendEmail(to: string, subject: string, body: string) {
    await this.provider.sendEmail(to, subject, body);
  }

  async sendWhatsApp(to: string, body: string) {
    await this.provider.sendWhatsApp(to, body);
  }
}
