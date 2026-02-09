"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationQueue = void 0;
const common_1 = require("@nestjs/common");
const pg_boss_1 = __importDefault(require("pg-boss"));
const crypto_1 = require("crypto");
const shared_1 = require("@fundarmf/shared");
const toNumber = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
};
let NotificationQueue = class NotificationQueue {
    boss;
    async onModuleInit() {
        const connectionString = process.env.DATABASE_URL;
        if (!connectionString) {
            throw new Error("DATABASE_URL is required to enqueue notifications.");
        }
        this.boss = new pg_boss_1.default({ connectionString });
        await this.boss.start();
    }
    async onModuleDestroy() {
        if (this.boss) {
            await this.boss.stop();
        }
    }
    async enqueueEmail(payload) {
        if (!this.boss)
            return null;
        const correlationId = payload.correlationId ?? (0, crypto_1.randomUUID)();
        const retryLimit = toNumber(process.env.NOTIFY_RETRY_LIMIT, 5);
        const retryDelay = toNumber(process.env.NOTIFY_RETRY_DELAY_MS, 60_000);
        const retryBackoff = (process.env.NOTIFY_RETRY_BACKOFF ?? "true") === "true";
        try {
            console.log("[notify] enqueue email", JSON.stringify({
                correlationId,
                to: payload.to,
                subject: payload.subject,
                mode: process.env.NOTIFY_MODE ?? "mock"
            }));
            return await this.boss.send(shared_1.NOTIFY_EMAIL_JOB, { ...payload, correlationId }, {
                retryLimit,
                retryDelay,
                retryBackoff
            });
        }
        catch (err) {
            console.error("[notify] enqueue email failed", err);
            return null;
        }
    }
    async enqueueWhatsApp(payload) {
        if (!this.boss)
            return null;
        const correlationId = payload.correlationId ?? (0, crypto_1.randomUUID)();
        const retryLimit = toNumber(process.env.NOTIFY_RETRY_LIMIT, 5);
        const retryDelay = toNumber(process.env.NOTIFY_RETRY_DELAY_MS, 60_000);
        const retryBackoff = (process.env.NOTIFY_RETRY_BACKOFF ?? "true") === "true";
        try {
            console.log("[notify] enqueue whatsapp", JSON.stringify({
                correlationId,
                to: payload.to,
                mode: process.env.NOTIFY_MODE ?? "mock"
            }));
            return await this.boss.send(shared_1.NOTIFY_WHATSAPP_JOB, { ...payload, correlationId }, {
                retryLimit,
                retryDelay,
                retryBackoff
            });
        }
        catch (err) {
            console.error("[notify] enqueue whatsapp failed", err);
            return null;
        }
    }
};
exports.NotificationQueue = NotificationQueue;
exports.NotificationQueue = NotificationQueue = __decorate([
    (0, common_1.Injectable)()
], NotificationQueue);
//# sourceMappingURL=notification.queue.js.map