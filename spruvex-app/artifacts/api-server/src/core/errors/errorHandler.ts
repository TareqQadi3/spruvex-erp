import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "./AppError";
import { ErrorCode } from "./errorCodes";
import { logger } from "../logging/logger";

// Express recognizes an error-handling middleware solely by its 4-argument
// signature — `next` must stay declared even though it's unused, or Express
// treats this as a normal middleware and never invokes it on errors.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ err, requestId: req.id }, err.message);
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
  res.status(500).json({
    error: { code: ErrorCode.INTERNAL_ERROR, message: "Internal server error" },
  });
}
