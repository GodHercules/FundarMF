import "dotenv/config";
import PgBoss from "pg-boss";
import { autoAssign, checkSla, generateReports, cancelInactiveProcesses } from "./jobs";

type JobDefinition = {
  name: string;
  everyMs: number;
  handler: () => Promise<unknown>;
};

const toPositiveMs = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const msToCron = (everyMs: number) => {
  const minute = 60_000;
  if (everyMs % minute !== 0) return null;
  const minutes = everyMs / minute;
  if (minutes < 60) return `*/${minutes} * * * *`;
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (hours < 24) return `0 */${hours} * * *`;
    if (hours % 24 === 0) {
      const days = hours / 24;
      return `0 0 */${days} * *`;
    }
  }
  return null;
};

const jobs: JobDefinition[] = [
  {
    name: "autoAssign",
    everyMs: toPositiveMs(process.env.WORKER_AUTO_ASSIGN_EVERY_MS, 3_600_000),
    handler: autoAssign
  },
  {
    name: "slaCheck",
    everyMs: toPositiveMs(process.env.WORKER_SLA_CHECK_EVERY_MS, 3_600_000),
    handler: checkSla
  },
  {
    name: "generateReports",
    everyMs: toPositiveMs(process.env.WORKER_REPORTS_EVERY_MS, 3_600_000),
    handler: generateReports
  },
  {
    name: "cancelInactiveProcesses",
    everyMs: toPositiveMs(process.env.WORKER_CANCEL_INACTIVE_EVERY_MS, 3_600_000),
    handler: cancelInactiveProcesses
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

const boss = new PgBoss({ connectionString });

const setupJob = async (job: JobDefinition) => {
  const cron = msToCron(job.everyMs);
  if (!cron) {
    throw new Error(
      `WORKER_*_EVERY_MS for ${job.name} must be a whole number of minutes and map to cron.`
    );
  }

  await boss.createQueue(job.name);

  try {
    await boss.unschedule(job.name);
  } catch (err) {
    console.warn(`No existing schedule for ${job.name} to remove.`);
  }

  await boss.schedule(job.name, cron);
  await boss.work(job.name, { teamSize: concurrency }, async () => job.handler());
  await boss.send(job.name);
};

const bootstrap = async () => {
  boss.on("error", (err) => console.error("PgBoss error", err));
  await boss.start();

  for (const job of jobs) {
    await setupJob(job);
  }

  console.log("FundarMF worker running (pg-boss on Postgres).");
};

const shutdown = async () => {
  try {
    await boss.stop();
  } finally {
    process.exit(0);
  }
};

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
