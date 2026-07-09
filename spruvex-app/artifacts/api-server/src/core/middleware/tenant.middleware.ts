import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

// Must run after requireAuth on every protected route. requireAuth already
// guarantees req.tenant.companyId is set — this is the explicit, fail-closed
// checkpoint so a route can never reach a handler without tenant scope, even
// if middleware ordering is changed by mistake later.
export function enforceTenantIsolation(req: Request, _res: Response, next: NextFunction): void {
  if (!req.tenant?.companyId) {
    next(AppError.unauthorized("Missing tenant context"));
    return;
  }
  next();
}
