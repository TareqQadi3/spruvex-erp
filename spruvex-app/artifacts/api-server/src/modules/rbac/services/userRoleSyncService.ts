import { and, eq } from "drizzle-orm";
import { userRolesTable, LEGACY_ROLE_TO_DEFAULT_ROLE } from "@workspace/db";
import { db } from "../../../core/database/connection";
import { RoleRepository } from "../repositories/roleRepository";
import { UserRoleRepository } from "../repositories/userRoleRepository";
import { invalidatePermissionCache } from "./permissionResolverService";

const roleRepo = new RoleRepository();
const userRoleRepo = new UserRoleRepository();

// Phase 6 keeps `users.role` (the flat legacy field every existing route,
// JWT payload, and the frontend still read) as the field admins actually
// edit, while making the new roles/permissions tables the real enforcement
// source underneath it. Whenever a user's flat role is set or changes, this
// mirrors it onto a single company-wide user_roles row so granular
// requirePermission() checks resolve correctly without a UI rebuild.
// Company-wide grants only (branchId null) — replaces any prior company-wide
// auto-synced row for this user.
export async function syncUserRoleFromLegacy(companyId: string, userId: string, legacyRole: string): Promise<void> {
  const targetRoleName = LEGACY_ROLE_TO_DEFAULT_ROLE[legacyRole];

  // Unrecognized legacy role string: fail closed. Clear any prior grant so
  // the user ends up with zero resolved permissions rather than silently
  // keeping whatever role they had before — an admin typing an unknown
  // role name is far more likely a mistake than an intentional "keep old
  // access" choice, and granular routes must not stay open on a typo.
  await db.delete(userRolesTable).where(
    and(
      eq(userRolesTable.companyId, companyId),
      eq(userRolesTable.userId, userId),
    ),
  );

  if (!targetRoleName) {
    invalidatePermissionCache(companyId, userId);
    return;
  }

  const role = await roleRepo.findGlobalByName(targetRoleName);
  if (!role) {
    invalidatePermissionCache(companyId, userId);
    return;
  }

  await userRoleRepo.assign({ companyId, userId, roleId: role.id });
  invalidatePermissionCache(companyId, userId);
}

// Lazy backfill for users created before Phase 6 (or by any path that
// doesn't call syncUserRoleFromLegacy) — only acts when the user has zero
// user_roles rows, so it never clobbers a real assignment made through the
// roles API. Called from the legacy-pipeline permission bridge right before
// resolving, so nothing has to run a manual one-off migration.
export async function ensureUserRoleAssigned(companyId: string, userId: string, legacyRole: string): Promise<void> {
  const [existing] = await db.select({ id: userRolesTable.id }).from(userRolesTable)
    .where(and(eq(userRolesTable.companyId, companyId), eq(userRolesTable.userId, userId))).limit(1);
  if (existing) return;
  await syncUserRoleFromLegacy(companyId, userId, legacyRole);
}
