import type { NextFunction, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { usersTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import { AppError } from "../../../core/errors/AppError";

// Cross-tenant authorization gate for SpruVex platform staff. Checks
// usersTable.isPlatformAdmin directly, looked up fresh from the DB — this
// flag is deliberately never carried on the JWT/tenant context (see
// users.ts's isPlatformAdmin column comment: a global RBAC role would let
// any tenant admin self-escalate to cross-tenant access via the existing
// role-assignment endpoint, so this boolean is the only path).
//
// Must run after requireAuth. Must NOT run alongside enforceTenantIsolation,
// and the routes it guards must NOT be scoped by req.tenant.companyId — they
// deliberately read/write across every company.
export async function requirePlatformAdmin(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.tenant) {
      next(AppError.unauthorized());
      return;
    }

    const [user] = await db
      .select({ isPlatformAdmin: usersTable.isPlatformAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, req.tenant.userId))
      .limit(1);

    if (!user?.isPlatformAdmin) {
      next(AppError.forbidden("Platform admin access required"));
      return;
    }

    next();
  } catch (err) {
    next(err);
  }
}
