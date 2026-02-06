"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const pg_boss_1 = __importDefault(require("pg-boss"));
const client_1 = require("@prisma/client");
const jobs_1 = require("./jobs");
const shared_1 = require("@fundarmf/shared");
const dispatcher_1 = require("./notify/dispatcher");
const toPositiveMs = (value, fallback) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};
const msToCron = (everyMs) => {
    const minute = 60_000;
    if (everyMs % minute !== 0)
        return null;
    const minutes = everyMs / minute;
    if (minutes < 60)
        return `*/${minutes} * * * *`;
    if (minutes % 60 === 0) {
        const hours = minutes / 60;
        if (hours < 24)
            return `0 */${hours} * * *`;
        if (hours % 24 === 0) {
            const days = hours / 24;
            return `0 0 */${days} * *`;
        }
    }
    return null;
};
const jobs = [
    {
        name: "autoAssign",
        everyMs: toPositiveMs(process.env.WORKER_AUTO_ASSIGN_EVERY_MS, 3_600_000),
        handler: jobs_1.autoAssign
    },
    {
        name: "slaCheck",
        everyMs: toPositiveMs(process.env.WORKER_SLA_CHECK_EVERY_MS, 3_600_000),
        handler: jobs_1.checkSla
    },
    {
        name: "generateReports",
        everyMs: toPositiveMs(process.env.WORKER_REPORTS_EVERY_MS, 3_600_000),
        handler: jobs_1.generateReports
    },
    {
        name: "cancelInactiveProcesses",
        everyMs: toPositiveMs(process.env.WORKER_CANCEL_INACTIVE_EVERY_MS, 3_600_000),
        handler: jobs_1.cancelInactiveProcesses
    }
];
const concurrency = (() => {
    const parsed = Number(process.env.WORKER_CONCURRENCY ?? 3);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
})();
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is required for the worker.");
}
const boss = new pg_boss_1.default({ connectionString });
const prisma = new client_1.PrismaClient();
const dispatcher = new dispatcher_1.NotificationDispatcher(prisma);
const setupJob = async (job) => {
    const cron = msToCron(job.everyMs);
    if (!cron) {
        throw new Error(`WORKER_*_EVERY_MS for ${job.name} must be a whole number of minutes and map to cron.`);
    }
    await boss.createQueue(job.name);
    try {
        await boss.unschedule(job.name);
    }
    catch (err) {
        console.warn(`No existing schedule for ${job.name} to remove.`);
    }
    await boss.schedule(job.name, cron);
    await boss.work(job.name, { teamSize: concurrency }, async () => job.handler());
    await boss.send(job.name, {});
};
const setupNotifyQueues = async () => {
    await boss.createQueue(shared_1.NOTIFY_EMAIL_JOB);
    await boss.createQueue(shared_1.NOTIFY_WHATSAPP_JOB);
    await boss.work(shared_1.NOTIFY_EMAIL_JOB, { teamSize: concurrency, includeMetadata: true }, async (jobs) => {
        for (const job of jobs) {
            await dispatcher.handleEmail(job);
        }
    });
    await boss.work(shared_1.NOTIFY_WHATSAPP_JOB, { teamSize: concurrency, includeMetadata: true }, async (jobs) => {
        for (const job of jobs) {
            await dispatcher.handleWhatsApp(job);
        }
    });
};
const bootstrap = async () => {
    boss.on("error", (err) => console.error("PgBoss error", err));
    await boss.start();
    for (const job of jobs) {
        await setupJob(job);
    }
    await setupNotifyQueues();
    console.log("FundarMF worker running (pg-boss on Postgres).");
};
const shutdown = async () => {
    try {
        await boss.stop();
        await prisma.$disconnect();
    }
    finally {
        process.exit(0);
    }
};
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
bootstrap().catch((err) => {
    console.error(err);
    process.exit(1);
});
//# sourceMappingURL=index.js.map