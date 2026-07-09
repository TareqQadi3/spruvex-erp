import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";
// Deliberate exception to "core has no module dependencies": permission
// checking is fundamentally an RBAC concern, and the request pipeline needs
// it directly. Nothing else in core/ reaches into modules/.
import { permissionResolver } from "../../modules/rbac/services/permissionResolverService";

// Resolves once per request and caches on req.permissions — a route chaining
// multiple requirePermission() calls (or checking the same permission twice)
// reuses the cached list instead of re-querying the DB each time.
async function getRequestPermissions(req: Request): Promise<string[]> {
  if (req.permissions) return req.permissions;
  if (!req.tenant) throw AppError.unauthorized();

  const resolved = await permissionResolver.resolve(req.tenant.companyId, req.tenant.userId, req.tenant.branchId);
  req.permissions = resolved;
  return resolved;
}

export function requirePermission(permissionCode: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenant) {
        next(AppError.unauthorized());
        return;
      }
      const permissions = await getRequestPermissions(req);
      if (!permissions.includes(permissionCode)) {
        next(AppError.forbidden(`Missing permission: ${permissionCode}`));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireRole(...roles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.tenant || !roles.includes(req.tenant.role)) {
      next(AppError.forbidden());
      return;
    }
    next();
  };
}
