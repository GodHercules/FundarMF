export type EmailJobPayload = {
  to: string;
  subject: string;
  text: string;
  html: string;
  from?: string;
  replyTo?: string;
  correlationId: string;
};

export type WhatsAppJobPayload = {
  to: string;
  body: string;
  correlationId: string;
};

export type NotifyMode = "mock" | "terminal" | "real";
