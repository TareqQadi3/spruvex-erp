import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
import { RATE_LIMIT_MAX_REQUESTS_PER_TENANT, RATE_LIMIT_WINDOW_MS } from "../../config/constants";
import { getRedisClient } from "../cache/redisClient";
import { logger } from "../logging/logger";

interface Bucket {
  count: number;
  windowStart: number;
}

// In-memory fallback — correct only for a single process; used automatically
// when REDIS_URL isn't configured, or if Redis is briefly unreachable.
const buckets = new Map<string, Bucket>();

function rateLimitInMemory(key: string): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS_PER_TENANT) {
    return false;
  }
  bucket.count += 1;
  return true;
}

// Shared fixed-window counter across every instance — required once this
// runs behind more than one process/replica, since the in-memory map above
// is per-process and would let each replica grant its own full quota.
async function rateLimitRedis(key: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return rateLimitInMemory(key);

  try {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, RATE_LIMIT_WINDOW_MS);
    }
    return count <= RATE_LIMIT_MAX_REQUESTS_PER_TENANT;
  } catch (err) {
    logger.warn({ err, key }, "Redis rate limit check failed, falling back to in-memory for this request");
    return rateLimitInMemory(key);
  }
}

export function rateLimitPerTenant(req: Request, _res: Response, next: NextFunction): void {
  const key = req.tenant?.companyId;
  if (!key) {
    next();
    return;
  }

  rateLimitRedis(key)
    .then((allowed) => {
      if (!allowed) {
        next(AppError.rateLimited());
        return;
      }
      next();
    })
    .catch(next);
}
