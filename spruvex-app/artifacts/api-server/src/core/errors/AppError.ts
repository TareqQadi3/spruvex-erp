import { ErrorCode } from "./errorCodes";

export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(statusCode: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static unauthorized(message = "Unauthorized"): AppError {
    return new AppError(401, ErrorCode.UNAUTHORIZED, message);
  }

  static forbidden(message = "Forbidden"): AppError {
    return new AppError(403, ErrorCode.FORBIDDEN, message);
  }

  static notFound(message = "Not found"): AppError {
    return new AppError(404, ErrorCode.NOT_FOUND, message);
  }

  static validation(message: string, details?: unknown): AppError {
    return new AppError(400, ErrorCode.VALIDATION_ERROR, message, details);
  }

  static conflict(message = "Conflict"): AppError {
    return new AppError(409, ErrorCode.CONFLICT, message);
  }

  static tenantMismatch(message = "Resource does not belong to this company"): AppError {
    // Reported as 404 (see AppError.notFound doc in errorHandler): a cross-tenant
    // id guess must not be distinguishable from a nonexistent id.
    return new AppError(404, ErrorCode.TENANT_MISMATCH, message);
  }

  static rateLimited(message = "Too many requests"): AppError {
    return new AppError(429, ErrorCode.RATE_LIMITED, message);
  }

  static internal(message = "Internal server error"): AppError {
    return new AppError(500, ErrorCode.INTERNAL_ERROR, message);
  }
}
