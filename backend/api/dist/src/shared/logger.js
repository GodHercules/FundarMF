"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logEvent = void 0;
const logEvent = (level, event, payload = {}) => {
    const entry = {
        ts: new Date().toISOString(),
        level,
        event,
        ...payload
    };
    if (level === "error") {
        console.error(JSON.stringify(entry));
        return;
    }
    if (level === "warn") {
        console.warn(JSON.stringify(entry));
        return;
    }
    console.log(JSON.stringify(entry));
};
exports.logEvent = logEvent;
//# sourceMappingURL=logger.js.map