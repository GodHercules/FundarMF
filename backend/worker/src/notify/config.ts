import { NotifyMode } from "./types";

const toBoolean = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};

const toNumber = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};

export const getNotifyMode = (): NotifyMode => {
  const raw = (process.env.NOTIFY_MODE ?? "mock").toLowerCase();
  if (raw === "real" || raw === "terminal") return raw;
  return "mock";
};

export const getNotifyTimeoutMs = () => toNumber(process.env.NOTIFY_SEND_TIMEOUT_MS, 15_000);

export const isEmailEnabled = () => toBoolean(process.env.NOTIFY_EMAIL_ENABLED, true);

export const isWhatsAppEnabled = () => toBoolean(process.env.NOTIFY_WHATSAPP_ENABLED, true);

export const getEmailProviderMode = () => (process.env.EMAIL_PROVIDER ?? "smtp").toLowerCase();

export const getWhatsAppProviderMode = () =>
  (process.env.WHATSAPP_PROVIDER ?? "twilio").toLowerCase();
