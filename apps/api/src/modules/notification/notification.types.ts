export interface EmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

export interface WhatsAppProvider {
  sendWhatsApp(to: string, body: string): Promise<void>;
}

export const EMAIL_PROVIDER = "EMAIL_PROVIDER";
export const WHATSAPP_PROVIDER = "WHATSAPP_PROVIDER";
