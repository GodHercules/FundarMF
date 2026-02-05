"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizePhone = normalizePhone;
exports.isClientOwner = isClientOwner;
function normalizePhone(value) {
    if (!value)
        return undefined;
    const digits = value.replace(/\D/g, "");
    if (!digits)
        return undefined;
    if (digits.startsWith("00")) {
        return `+${digits.slice(2)}`;
    }
    return `+${digits}`;
}
function isClientOwner(actor, clientEmail, clientPhone) {
    if (actor.email && clientEmail && actor.email === clientEmail) {
        return true;
    }
    if (actor.whatsapp && clientPhone) {
        return normalizePhone(actor.whatsapp) === normalizePhone(clientPhone);
    }
    return false;
}
//# sourceMappingURL=identity.js.map