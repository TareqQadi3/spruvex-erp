import { getRedisClient } from "./redisClient";
import { logger } from "../logging/logger";

// Cache-aside helper: on a hit, returns the cached value; on a miss (or when
// Redis isn't configured/unreachable), calls `load` and caches the result.
// Never throws on a Redis failure — a cache outage must degrade to "always
// hit the database," not take the app down.
export async function withCache<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const redis = getRedisClient();
  if (!redis) return load();

  try {
    const cached = await redis.get(key);
    if (cached !== null) return JSON.parse(cached) as T;
  } catch (err) {
    logger.warn({ err, key }, "Cache read failed, falling back to source");
  }

  const value = await load();

  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "Cache write failed (value still returned to caller)");
  }

  return value;
}

export async function invalidateCache(key: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn({ err, key }, "Cache invalidation failed");
  }
}

export async function invalidateCachePattern(pattern: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) await redis.del(...keys);
  } catch (err) {
    logger.warn({ err, pattern }, "Cache pattern invalidation failed");
  }
}
