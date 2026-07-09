import Redis from "ioredis";
import { env } from "../../config/env";
import { logger } from "../logging/logger";

// Redis is optional infrastructure: if REDIS_URL isn't configured (e.g. a
// small single-instance deployment), the app must keep working — rate
// limiting and caching both fall back to in-process behavior. This client is
// therefore lazily created and nullable, never a hard startup dependency.
let client: Redis | null = null;
let attempted = false;

export function getRedisClient(): Redis | null {
  if (attempted) return client;
  attempted = true;

  if (!env.redisUrl) {
    logger.warn("REDIS_URL not set — caching and rate limiting will use in-process fallbacks only");
    return null;
  }

  client = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 2,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    lazyConnect: false,
  });

  client.on("error", (err) => {
    logger.error({ err }, "Redis connection error");
  });

  return client;
}

export async function closeRedisClient(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
    attempted = false;
  }
}
