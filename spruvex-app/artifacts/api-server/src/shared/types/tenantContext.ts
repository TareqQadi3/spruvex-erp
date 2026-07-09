// The decoded, trusted request identity — populated by core/middleware/auth.middleware
// from the JWT only. Never accept any of these fields from a request body/query.
// Deliberately has no `permissions` field: authorization is resolved live from
// the DB per request (see core/middleware/permission.middleware + modules/rbac's
// PermissionResolver), never trusted from token claims.
export interface TenantContext {
  userId: string;
  companyId: string;
  branchId?: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      tenant?: TenantContext;
      // Per-request cache for resolved permission codes — populated on first
      // requirePermission() call, reused by any subsequent one in the same
      // request instead of re-querying the DB.
      permissions?: string[];
    }
  }
}
