import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable, DEFAULT_ROLES, type Permission } from "@workspace/db";
import { JWT_SECRET } from "./jwt-secret";
import { getEffectiveState } from "../modules/subscriptions/services/planLimitsService";
import { permissionResolver } from "../modules/rbac/services/permissionResolverService";
import { ensureUserRoleAssigned } from "../modules/rbac/services/userRoleSyncService";

export interface AuthedRequest extends Request {
  user?: { id: string; username: string; role: string; companyId: string; branchId?: string };
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction): void {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    // Tokens come from two issuers: the legacy login ({ id, username, ... })
    // and the modular auth service ({ sub, ... }, no username). Accept both.
    const decoded = jwt.verify(auth.slice(7), JWT_SECRET) as {
      id?: string;
      sub?: string;
      username?: string;
      role: string;
      companyId: string;
      branchId?: string;
    };
    const userId = decoded.id ?? decoded.sub;
    if (!decoded.companyId || !userId) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }
    req.user = {
      id: userId,
      username: decoded.username ?? "",
      role: decoded.role,
      companyId: decoded.companyId,
      branchId: decoded.branchId,
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

const INACTIVE_STATUSES = new Set(["expired", "suspended", "cancelled"]);

// The legacy router aggregate (routes/index.ts) mounts this once, right
// after requireAuth, for every legacy-stack endpoint — the entire live POS
// surface (products, sales, customers, repairs, purchases, accounting,
// warehouses...). Those routers never checked subscription status at all
// before this: a suspended/expired/cancelled company could keep using the
// whole app freely. Response shape matches this legacy stack's convention
// (`{ error: "..." }`, a flat string — see pos-system's api.ts, which reads
// `err.error` as a string), not the modular `{ error: { code, message } }`
// envelope.
export async function requireActiveSubscription(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const state = await getEffectiveState(req.user.companyId);
    if (INACTIVE_STATUSES.has(state.status)) {
      res.status(403).json({ error: "Subscription inactive" });
      return;
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

// Checks a user's effective permissions live from the DB: a per-user `permissions`
// override (set by an admin) if present, otherwise the role's default permission set.
// Admins always pass — they're the ones granting permissions, not bound by them.
//
// Dot-namespaced codes (Phase 6, e.g. "products.create") are a distinct
// branch: those resolve through the real roles/permissions/role_permissions/
// user_roles tables (the same source the modular routers' requirePermission
// uses) rather than the older flat users.role/users.permissions JSON — this
// is the bridge that lets legacy-pipeline routes (req.user, not req.tenant)
// enforce the new granular catalog without a full router migration. The
// flat-code branch below is untouched for existing callers.
export function requirePermission(permission: Permission | string) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (permission.includes(".")) {
      if (req.user.role === "admin") {
        next();
        return;
      }
      try {
        await ensureUserRoleAssigned(req.user.companyId, req.user.id, req.user.role);
        const granted = await permissionResolver.resolve(req.user.companyId, req.user.id);
        if (!granted.includes(permission)) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
        next();
      } catch (err) {
        next(err);
      }
      return;
    }
    if (req.user.role === "admin") {
      next();
      return;
    }
    const [row] = await db.select({ permissions: usersTable.permissions })
      .from(usersTable).where(eq(usersTable.id, req.user.id));
    const granted: string[] = row?.permissions
      ? JSON.parse(row.permissions)
      : DEFAULT_ROLES.find(r => r.name === req.user!.role)?.permissions ?? [];
    if (!granted.includes(permission)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
