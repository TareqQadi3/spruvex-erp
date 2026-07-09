import { logger } from "./logger";

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

export const JWT_SECRET = resolveJwtSecret();
