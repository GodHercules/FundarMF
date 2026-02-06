"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWhatsAppProviderMode = exports.getEmailProviderMode = exports.isWhatsAppEnabled = exports.isEmailEnabled = exports.getNotifyTimeoutMs = exports.getNotifyMode = void 0;
const toBoolean = (value, fallback) => {
    if (!value)
        return fallback;
    return ["1", "true", "yes", "on"].includes(value.toLowerCase());
};
const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
const getNotifyMode = () => {
    const raw = (process.env.NOTIFY_MODE ?? "mock").toLowerCase();
    if (raw === "real" || raw === "terminal")
        return raw;
    return "mock";
};
exports.getNotifyMode = getNotifyMode;
const getNotifyTimeoutMs = () => toNumber(process.env.NOTIFY_SEND_TIMEOUT_MS, 15_000);
exports.getNotifyTimeoutMs = getNotifyTimeoutMs;
const isEmailEnabled = () => toBoolean(process.env.NOTIFY_EMAIL_ENABLED, true);
exports.isEmailEnabled = isEmailEnabled;
const isWhatsAppEnabled = () => toBoolean(process.env.NOTIFY_WHATSAPP_ENABLED, true);
exports.isWhatsAppEnabled = isWhatsAppEnabled;
const getEmailProviderMode = () => (process.env.EMAIL_PROVIDER ?? "smtp").toLowerCase();
exports.getEmailProviderMode = getEmailProviderMode;
const getWhatsAppProviderMode = () => (process.env.WHATSAPP_PROVIDER ?? "twilio").toLowerCase();
exports.getWhatsAppProviderMode = getWhatsAppProviderMode;
//# sourceMappingURL=config.js.map