import type { DbOrTx } from "../../../core/database/transaction";
import { withCache } from "../../../core/cache/cacheService";
import { PermissionResolverRepository } from "../repositories/permissionResolverRepository";

// Short TTL: long enough to meaningfully cut DB load on a busy POS terminal
// re-checking permissions on every request, short enough that a role change
// takes effect within this window rather than requiring a manual
// invalidation call at every role/permission write site.
const PERMISSION_CACHE_TTL_SECONDS = 30;

// The single source of truth for "what can this user do" — resolves
// user_roles -> role_permissions -> permissions live from the DB, scoped by
// company (and branch, when the caller is operating in one). Global role
// templates (company_id IS NULL) and tenant-custom roles are both picked up
// automatically since user_roles.company_id is what's actually filtered on,
// not roles.company_id — the role a user was granted can be either.
export class PermissionResolver {
  constructor(private readonly repo: PermissionResolverRepository = new PermissionResolverRepository()) {}

  async resolve(companyId: string, userId: string, branchId?: string, client?: DbOrTx): Promise<string[]> {
    // A client means this is running inside someone else's ambient
    // transaction (e.g. registerCompany) — never cache a read that could be
    // observing data that hasn't committed yet.
    if (client) {
      return this.repo.resolveCodes(companyId, userId, branchId, client);
    }

    const cacheKey = `perm:${companyId}:${userId}:${branchId ?? "none"}`;
    return withCache(cacheKey, PERMISSION_CACHE_TTL_SECONDS, () => this.repo.resolveCodes(companyId, userId, branchId));
  }
}

export const permissionResolver = new PermissionResolver();
