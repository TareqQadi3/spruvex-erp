import { logger } from "../core/logging/logger";

function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET environment variable is required (min 16 chars) in production.",
    );
  }

  logger.warn(
    "JWT_SECRET is not set — using an insecure development-only fallback. Set JWT_SECRET before deploying.",
  );
  return "dev-only-insecure-secret-do-not-use-in-prod";
}

function resolvePort(): number {
  const raw = process.env.PORT;
  if (!raw) throw new Error("PORT environment variable is required but was not provided.");
  const port = Number(raw);
  if (Number.isNaN(port) || port <= 0) throw new Error(`Invalid PORT value: "${raw}"`);
  return port;
}

function resolveAllowedOrigins(): string[] | undefined {
  return process.env.ALLOWED_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: resolvePort(),
  jwtSecret: resolveJwtSecret(),
  databaseUrl: process.env.DATABASE_URL,
  allowedOrigins: resolveAllowedOrigins(),
  logLevel: process.env.LOG_LEVEL ?? "info",
  // Optional — caching and rate limiting fall back to in-process behavior
  // when unset (see core/cache/redisClient.ts). The worker process (see
  // worker.ts) requires this to be set, since its job queue has no
  // in-process fallback.
  redisUrl: process.env.REDIS_URL,
};
