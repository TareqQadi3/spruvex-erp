import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db, usersTable, DEFAULT_ROLES, type Permission } from "@workspace/db";
import { JWT_SECRET } from "./jwt-secret";

export interface AuthedRequest extends Request {
  user?: { id: string; username: string; role: string; companyId: string };
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
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
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
export function requirePermission(permission: Permission) {
  return async (req: AuthedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
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
