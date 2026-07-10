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

function rateLimitInMemory(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= max) {
    return false;
  }
  bucket.count += 1;
  return true;
}

// Shared fixed-window counter across every instance — required once this
// runs behind more than one process/replica, since the in-memory map above
// is per-process and would let each replica grant its own full quota.
async function rateLimitRedis(key: string, windowMs: number, max: number): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return rateLimitInMemory(key, windowMs, max);

  try {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      await redis.pexpire(redisKey, windowMs);
    }
    return count <= max;
  } catch (err) {
    logger.warn({ err, key }, "Redis rate limit check failed, falling back to in-memory for this request");
    return rateLimitInMemory(key, windowMs, max);
  }
}

interface RateLimiterOptions {
  windowMs: number;
  max: number;
  // Prefix so different limiters never share a counter bucket for the same
  // underlying key (e.g. an IP hitting both the general and auth limiters).
  keyPrefix: string;
  keyFn: (req: Request) => string | undefined;
}

function createRateLimiter(options: RateLimiterOptions) {
  return function rateLimiter(req: Request, _res: Response, next: NextFunction): void {
    const rawKey = options.keyFn(req);
    if (!rawKey) {
      next();
      return;
    }
    const key = `${options.keyPrefix}:${rawKey}`;

    rateLimitRedis(key, options.windowMs, options.max)
      .then((allowed) => {
        if (!allowed) {
          next(AppError.rateLimited());
          return;
        }
        next();
      })
      .catch(next);
  };
}

// General-purpose limiter for every request. Keyed by tenant when the
// caller is authenticated (req.tenant is set by requireAuth, which most
// routers apply per-route AFTER this middleware runs globally in app.ts —
// so req.tenant is typically NOT yet populated here), falling back to the
// client IP otherwise. The IP fallback is what actually protects
// unauthenticated surfaces (login, register-company, public endpoints,
// webhooks) — without it this limiter was previously a no-op for every
// request that reached it before any router-level requireAuth ran, i.e.
// effectively all of them, since it's mounted before any router.
export const rateLimitPerTenant = createRateLimiter({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS_PER_TENANT,
  keyPrefix: "tenant",
  keyFn: (req) => req.tenant?.companyId ?? `ip:${req.ip}`,
});

// Stricter, IP-keyed limiter specifically for authentication endpoints
// (login, register, register-company) — the highest-value brute-force /
// credential-stuffing / signup-spam target, and one the general limiter's
// 300-req/min budget is far too loose to meaningfully protect on its own.
export const rateLimitAuth = createRateLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  keyPrefix: "auth",
  keyFn: (req) => `ip:${req.ip}`,
});
