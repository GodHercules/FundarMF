import { Queue } from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});

export const maintenanceQueue = new Queue("fundarmf-maintenance", { connection });
export const connectionRef = connection;
