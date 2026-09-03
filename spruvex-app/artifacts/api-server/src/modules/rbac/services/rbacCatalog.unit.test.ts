import { describe, it, expect } from "vitest";
import { PERMISSIONS, DEFAULT_ROLES, LEGACY_ROLE_TO_DEFAULT_ROLE } from "@workspace/db";

// T-08: RBAC catalog consistency. All three constants are pure code data
// (seeded into the DB by rbacSeedService / consumed by userRoleSyncService at
// runtime), but the seeding and the legacy-role sync BOTH silently skip or
// clear a grant when a referenced code or role doesn't exist:
//   - rbacSeedService does `permissionCodeToId.get(code)` and `continue`s on
//     undefined — a typo'd permission code would silently drop a grant.
//   - userRoleSyncService looks the mapped role up by name and returns
//     without granting (leaving the user with zero permissions) if it's missing.
// These tests catch a stale catalog before it reaches a tenant.

describe("RBAC catalog (roles.ts) — every reference resolves (pure data)", () => {
  const catalogCodes = new Set<string>(Object.values(PERMISSIONS));

  it("every permission code referenced by a default role exists in the PERMISSIONS catalog", () => {
    for (const role of DEFAULT_ROLES) {
      for (const code of role.permissions) {
        expect(catalogCodes.has(code), `role "${role.name}" references unknown code "${code}"`).toBe(true);
      }
    }
  });

  it("default role names are unique (the global seed index would collide otherwise)", () => {
    const names = DEFAULT_ROLES.map((role) => role.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("every legacy role string maps to a default role that actually exists", () => {
    const roleNames = new Set(DEFAULT_ROLES.map((role) => role.name));
    for (const [legacyRole, target] of Object.entries(LEGACY_ROLE_TO_DEFAULT_ROLE)) {
      expect(roleNames.has(target), `legacy role "${legacyRole}" maps to missing role "${target}"`).toBe(true);
    }
  });

  it("legacy roles only ever map to Phase-6 roles, never to themselves when deprecated", () => {
    // admin -> owner, store_manager -> manager, warehouse_staff ->
    // inventory_staff are renames; cashier/accountant map onto themselves.
    expect(LEGACY_ROLE_TO_DEFAULT_ROLE).toEqual({
      admin: "owner",
      store_manager: "manager",
      cashier: "cashier",
      warehouse_staff: "inventory_staff",
      accountant: "accountant",
    });
  });

  it("admin and owner carry the full catalog — flat legacy codes included, so old routes keep working", () => {
    const full = Object.values(PERMISSIONS);
    for (const roleName of ["admin", "owner"] as const) {
      const role = DEFAULT_ROLES.find((r) => r.name === roleName);
      expect(role).toBeDefined();
      expect(role!.permissions.slice().sort()).toEqual(full.slice().sort());
    }
  });

  it("manager is a strict subset of owner and excludes the owner-only codes", () => {
    const owner = DEFAULT_ROLES.find((r) => r.name === "owner")!;
    const manager = DEFAULT_ROLES.find((r) => r.name === "manager")!;
    const ownerOnly = [PERMISSIONS.USERS_MANAGE, PERMISSIONS.BRANCHES_MANAGE, PERMISSIONS.REPORTS_VIEW_ALL_BRANCHES];

    for (const code of manager.permissions) {
      expect(owner.permissions).toContain(code);
    }
    for (const code of ownerOnly) {
      expect(owner.permissions).toContain(code);
      expect(manager.permissions).not.toContain(code);
    }
  });
});
