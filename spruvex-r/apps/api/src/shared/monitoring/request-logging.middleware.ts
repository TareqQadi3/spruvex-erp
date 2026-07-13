import { Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const logger = new Logger("HTTP");

/**
 * One structured line per request (method, path, status, duration, a
 * request id correlating this line to any error log / support ticket).
 * This is the "basic usage monitoring" + "important logs" baseline for the
 * pilot — no metrics pipeline required to answer "what's being hit and how
 * often/slow" or "which request was this error from".
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
  res.setHeader("X-Request-Id", requestId);
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    const line = `${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs.toFixed(1)}ms rid=${requestId}`;
    if (res.statusCode >= 500) logger.error(line);
    else logger.log(line);
  });

  next();
}
