import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import type { Request, Response } from "express";

/**
 * Global error boundary (Phase 8 monitoring foundation): every unhandled
 * exception is logged with request context server-side. Known HttpExceptions
 * (validation errors, 403s, 404s, ...) pass their own status/message through
 * unchanged — they're already safe to show. Anything else (a genuine bug) is
 * logged in full but the client only ever sees a generic 500 message, never
 * a stack trace or internal error detail.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("UnhandledException");

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      if (status >= 500) {
        this.logger.error(
          `${req.method} ${req.originalUrl} -> ${status}: ${exception.message}`,
          exception.stack,
        );
      }
      res.status(status).json(exception.getResponse());
      return;
    }

    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(`${req.method} ${req.originalUrl} -> 500: ${error.message}`, error.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: "Internal server error",
    });
  }
}
