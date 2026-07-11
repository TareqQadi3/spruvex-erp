const REQUIRED_VARS = ["DATABASE_URL", "ADMIN_DATABASE_URL"] as const;

/**
 * Fail fast on boot when required environment variables are missing,
 * instead of failing on the first query.
 */
export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED_VARS.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
  return config;
}
