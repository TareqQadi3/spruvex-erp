import * as Sentry from "@sentry/node";

/**
 * Optional error tracking (pilot monitoring). Fully inert unless SENTRY_DSN
 * is set — no external calls, no behavior change, safe default for anyone
 * who hasn't set up a Sentry project yet.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    tracesSampleRate: 0,
  });
}

export function captureException(error: unknown): void {
  if (!process.env.SENTRY_DSN) return;
  Sentry.captureException(error);
}
