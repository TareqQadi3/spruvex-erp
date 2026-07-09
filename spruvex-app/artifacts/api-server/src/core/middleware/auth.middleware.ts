import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../../config/env";
import { AppError } from "../errors/AppError";
import type { TenantContext } from "../../shared/types/tenantContext";

// Identity claims only — no permissions here. Authorization is resolved live
// from the DB per request (see core/middleware/permission.middleware), so a
// permission/role change takes effect on the very next request instead of
// only after the token expires or is refreshed.
interface AccessTokenPayload {
  sub: string;
  companyId: string;
  branchId?: string;
  role: string;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    next(AppError.unauthorized());
    return;
  }

  let decoded: AccessTokenPayload;
  try {
    decoded = jwt.verify(header.slice(7), env.jwtSecret) as AccessTokenPayload;
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
    return;
  }

  if (!decoded.sub || !decoded.companyId) {
    next(AppError.unauthorized("Invalid or expired token"));
    return;
  }

  const tenant: TenantContext = {
    userId: decoded.sub,
    companyId: decoded.companyId,
    branchId: decoded.branchId,
    role: decoded.role,
  };
  req.tenant = tenant;
  next();
}
