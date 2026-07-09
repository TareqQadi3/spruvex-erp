import "./loadEnv";
import { Worker } from "bullmq";
import { logger } from "./core/logging/logger";
import { checkDatabaseConnection, closeDatabaseConnection } from "./core/database/connection";
import { getQueueConnection } from "./core/queue/redisConnection";
import { SYNC_RETRY_QUEUE_NAME, ZATCA_RETRY_QUEUE_NAME, scheduleRetryJobs } from "./core/queue/queues";
import { runSyncRetryJob, runZatcaRetryJob } from "./core/queue/retryJobs";

// Separate process/container from the API server (see Dockerfile's `worker`
// build target and docker-compose.yml's `worker` service) — runs the two
// recurring background jobs this app needs: retrying failed offline-sync
// operations, and flagging invoices stuck mid-ZATCA-submission. Reuses the
// exact same service functions the live API uses; no business logic lives
// here, only scheduling and dispatch.
async function main(): Promise<void> {
  await checkDatabaseConnection();
  const connection = getQueueConnection();

  const syncWorker = new Worker(
    SYNC_RETRY_QUEUE_NAME,
    async () => {
      const result = await runSyncRetryJob();
      logger.info(result, "Sync retry job completed");
      return result;
    },
    { connection },
  );

  const zatcaWorker = new Worker(
    ZATCA_RETRY_QUEUE_NAME,
    async () => {
      const result = await runZatcaRetryJob();
      logger.info(result, "ZATCA stuck-submission scan completed");
      return result;
    },
    { connection },
  );

  syncWorker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "Sync retry job failed"));
  zatcaWorker.on("failed", (job, err) => logger.error({ jobId: job?.id, err }, "ZATCA retry job failed"));

  await scheduleRetryJobs();
  logger.info("Worker process started — sync retry (every 60s), ZATCA stuck-submission scan (every 5m)");

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, "Worker shutting down");
    await Promise.all([syncWorker.close(), zatcaWorker.close()]);
    await connection.quit();
    await closeDatabaseConnection();
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error({ err }, "Failed to start worker");
  process.exit(1);
});
