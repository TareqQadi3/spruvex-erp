import { Queue } from "bullmq";
import { getQueueConnection } from "./redisConnection";

export const SYNC_RETRY_QUEUE_NAME = "sync-retry";
export const ZATCA_RETRY_QUEUE_NAME = "zatca-retry";

export const SYNC_RETRY_JOB_NAME = "scan-and-retry";
export const ZATCA_RETRY_JOB_NAME = "scan-and-retry";

let syncRetryQueue: Queue | null = null;
let zatcaRetryQueue: Queue | null = null;

export function getSyncRetryQueue(): Queue {
  if (!syncRetryQueue) {
    syncRetryQueue = new Queue(SYNC_RETRY_QUEUE_NAME, { connection: getQueueConnection() });
  }
  return syncRetryQueue;
}

export function getZatcaRetryQueue(): Queue {
  if (!zatcaRetryQueue) {
    zatcaRetryQueue = new Queue(ZATCA_RETRY_QUEUE_NAME, { connection: getQueueConnection() });
  }
  return zatcaRetryQueue;
}

// Schedules the two recurring "scan across all tenants and retry" jobs.
// Called once at worker startup — BullMQ deduplicates repeatable jobs by
// their key, so calling this again on a restart doesn't create duplicates.
export async function scheduleRetryJobs(): Promise<void> {
  await getSyncRetryQueue().upsertJobScheduler(
    "sync-retry-scheduler",
    { every: 60_000 },
    { name: SYNC_RETRY_JOB_NAME, data: {} },
  );
  await getZatcaRetryQueue().upsertJobScheduler(
    "zatca-retry-scheduler",
    { every: 5 * 60_000 },
    { name: ZATCA_RETRY_JOB_NAME, data: {} },
  );
}
