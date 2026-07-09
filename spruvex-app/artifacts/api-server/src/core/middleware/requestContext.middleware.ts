import type { NextFunction, Request, Response } from "express";
import { REQUEST_ID_HEADER } from "../../config/constants";

// pino-http already assigns req.id per request; this just echoes it back so
// clients/support can correlate a response with the corresponding log line.
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  if (req.id) res.setHeader(REQUEST_ID_HEADER, String(req.id));
  next();
}
