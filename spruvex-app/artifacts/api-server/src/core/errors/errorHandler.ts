import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import type * as SentryTypes from "@sentry/node";
import { AppError } from "./AppError";
import { ErrorCode } from "./errorCodes";
import { logger } from "../logging/logger";

// ============================================================================
// Sentry error tracking — opt-in via SENTRY_DSN.
//
// Zero behavior change when SENTRY_DSN is unset: the SDK is never loaded, no
// network call is made, nothing is logged. The server behaves byte-for-byte as
// before. Only 5xx server faults (AppError >= 500 and the unhandled-error
// fallback) are reported — 4xx client errors (validation, auth) are noise.
//
// The SDK is loaded with a *runtime* dynamic import whose specifier is a
// variable, deliberately not a static import. This repo bundles with esbuild
// (build.mjs), which marks `@opentelemetry/*` as external. A static import
// would inline the SDK but leave the OTel imports unresolved in the bundle,
// crashing the server at startup (ERR_MODULE_NOT_FOUND) even without a DSN.
// A variable specifier is left as-is by esbuild, so the SDK and its
// transitive deps resolve from node_modules at runtime, where pnpm's virtual
// store links them correctly.
//
// Scrubbing: nothing sensitive is ever attached to the event. Request data is
// limited to method + path (no body, no headers, no query string, no cookies,
// no user). `beforeSend` is a second line of defense that recursively redacts
// anything that still looks like a secret (JWT/bearer tokens, Saudi phone
// numbers, emails) in exception messages, breadcrumbs, and stack traces, and
// drops local variables that would otherwise capture in-memory request bodies.
// ============================================================================

const SENTRY_MODULE = "@sentry/node";

const REDACTED = "[REDACTED]";

const JWT_RE = /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g;
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/=-]{6,}\b/gi;
const SAUDI_PHONE_RE = /(?:\+?966[-\s]?)?(?:0?5)[-\s]?\d{8}\b/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

// Keys whose values are replaced wholesale. Anything that names a password,
// a token, a credential, or customer contact data is not sent at all.
const SENSITIVE_DATA_KEYS =
  /(password|passwd|secret|token|jwt|authorization|auth|api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|phone|mobile|telephone|email|address|national[_-]?id|card|cvv|iban|ssn|company_id|customer)/i;

function redactString(value: string): string {
  return value
    .replace(JWT_RE, REDACTED)
    .replace(BEARER_RE, REDACTED)
    .replace(SAUDI_PHONE_RE, REDACTED)
    .replace(EMAIL_RE, REDACTED);
}

function redactValue(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    return key && SENSITIVE_DATA_KEYS.test(key) ? REDACTED : redactString(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, key));
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = redactValue(v, k);
    }
    return out;
  }
  return value;
}

function scrubEvent(event: SentryTypes.ErrorEvent): SentryTypes.ErrorEvent | null {
  if (event.request) {
    const url = event.request.url ?? "";
    const method = event.request.method ?? "GET";
    event.request = { method, url: url.split("?")[0] };
  }

  // Never associate a user with an event: IDs and emails are PII, and the
  // request_id tag below is enough to correlate with pino request logs.
  delete event.user;

  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (value.value) value.value = redactString(value.value);
      if (value.stacktrace?.frames) {
        for (const frame of value.stacktrace.frames) {
          // Local variables may contain request bodies/headers in memory —
          // never send them, regardless of what SDK integrations enable.
          if (frame.vars) delete frame.vars;
        }
      }
    }
  }

  if (event.breadcrumbs) {
    for (const crumb of event.breadcrumbs) {
      if (crumb.message) crumb.message = redactString(crumb.message);
      if (crumb.data && typeof crumb.data === "object")
        crumb.data = redactValue(crumb.data) as Record<string, unknown>;
    }
  }

  return event;
}

let sentryInitStarted = false;
let sentryModulePromise: Promise<typeof import("@sentry/node")> | null = null;

function reportToSentry(err: unknown, req: Request): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn || typeof dsn !== "string" || dsn.length === 0) return;

  // Fire-and-forget: the HTTP response must never wait on telemetry.
  void (async () => {
    try {
      if (!sentryModulePromise) sentryModulePromise = import(SENTRY_MODULE);
      const Sentry = await sentryModulePromise;

      if (!sentryInitStarted) {
        Sentry.init({
          dsn,
          environment: process.env.NODE_ENV ?? "development",
          tracesSampleRate: 0,
          sendDefaultPii: false,
          beforeSend: scrubEvent,
        });
        sentryInitStarted = true;
        logger.info("Sentry error reporting enabled");
      }

      const requestId = typeof req.id === "string" ? req.id : String(req.id ?? "");
      const path = (req.originalUrl ?? req.url ?? "").split("?")[0];

      Sentry.withScope((scope) => {
        scope.setTag("request_id", requestId);
        scope.setTag("http_method", req.method);
        scope.setTag("url_path", path);
        Sentry.captureException(err);
      });
    } catch (captureErr) {
      logger.warn({ err: captureErr }, "Sentry capture failed; error reporting skipped");
    }
  })();
}

// Express recognizes an error-handling middleware solely by its 4-argument
// signature — `next` must stay declared even though it's unused, or Express
// treats this as a normal middleware and never invokes it on errors.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.id }, err.message);
      reportToSentry(err, req);
    }
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: ErrorCode.VALIDATION_ERROR, message: "Invalid request", details: err.issues },
    });
    return;
  }

  logger.error({ err, requestId: req.id }, "Unhandled error");
  reportToSentry(err, req);
  res.status(500).json({
    error: { code: ErrorCode.INTERNAL_ERROR, message: "Internal server error" },
  });
}
