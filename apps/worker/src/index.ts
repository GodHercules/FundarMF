import "dotenv/config";
import { Worker } from "bullmq";
import { maintenanceQueue, connectionRef } from "./queue";
import { autoAssign, checkSla, generateReports } from "./jobs";

async function bootstrap() {
  await maintenanceQueue.add(
    "autoAssign",
    {},
    { repeat: { every: 60_000 }, removeOnComplete: true, removeOnFail: 100 }
  );
  await maintenanceQueue.add(
    "slaCheck",
    {},
    { repeat: { every: 60_000 }, removeOnComplete: true, removeOnFail: 100 }
  );
  await maintenanceQueue.add(
    "generateReports",
    {},
    { repeat: { every: 300_000 }, removeOnComplete: true, removeOnFail: 100 }
  );

  const worker = new Worker(
    "fundarmf-maintenance",
    async (job) => {
      switch (job.name) {
        case "autoAssign":
          return autoAssign();
        case "slaCheck":
          return checkSla();
        case "generateReports":
          return generateReports();
        default:
          return null;
      }
    },
    { connection: connectionRef, concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3) }
  );

  worker.on("completed", (job) => {
    console.log(`Job ${job.name} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`Job ${job?.name} failed`, err);
  });

  console.log("FundarMF worker running.");
}

bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
