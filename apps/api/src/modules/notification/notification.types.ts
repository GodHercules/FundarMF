export interface NotificationProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
  sendWhatsApp(to: string, body: string): Promise<void>;
}

export const NOTIFICATION_PROVIDER = "NOTIFICATION_PROVIDER";
