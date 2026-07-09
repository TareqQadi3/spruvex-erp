import Redis from "ioredis";
import { env } from "../../config/env";

// BullMQ mandates its own connection instance with maxRetriesPerRequest: null
// (required for its blocking commands) — kept separate from
// core/cache/redisClient's connection, which is tuned for fast-fail
// cache/rate-limit reads instead and must never block indefinitely.
let connection: Redis | null = null;

export function getQueueConnection(): Redis {
  if (connection) return connection;
  if (!env.redisUrl) {
    throw new Error("REDIS_URL must be set to run the worker process (job queue has no in-process fallback).");
  }
  connection = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
  return connection;
}
