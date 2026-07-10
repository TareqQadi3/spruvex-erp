import { eq, and, isNull } from "drizzle-orm";
import {
  usersTable,
  companiesTable,
  rolesTable,
  userRolesTable,
  branchesTable,
  settingsTable,
  subscriptionsTable,
  paymentMethodsTable,
  warehousesTable,
  type InsertBranch,
  type InsertSettings,
  type InsertSubscription,
  type InsertWarehouse,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

// Spans users/companies/roles/user_roles/role_permissions/permissions — this
// repository doesn't extend BaseRepository (which assumes one table); it
// composes tenant-scoping helpers per query instead.
export class UserAuthRepository {
  async findUserByUsername(username: string, client: DbOrTx = db) {
    const [user] = await client.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    return user ?? null;
  }

  async findUserById(userId: string, client: DbOrTx = db) {
    const [user] = await client.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    return user ?? null;
  }

  async createCompany(name: string, client: DbOrTx = db) {
    const [company] = await client.insert(companiesTable).values({ name }).returning();
    return company;
  }

  // Onboarding-only fields set once, right after createCompany, inside the
  // same signup transaction — kept as a separate update (rather than folding
  // into createCompany's insert) so createCompany's signature stays stable
  // for any other caller that only wants a bare company row.
  async setCompanyOnboardingFields(
    companyId: string,
    fields: { plan: string; businessType: string; enabledModules: string; trialEndsAt: Date },
    client: DbOrTx = db,
  ) {
    const [company] = await client
      .update(companiesTable)
      .set(fields)
      .where(eq(companiesTable.id, companyId))
      .returning();
    return company;
  }

  async createBranch(input: InsertBranch, client: DbOrTx = db) {
    const [branch] = await client.insert(branchesTable).values(input).returning();
    return branch;
  }

  async createSettings(input: InsertSettings, client: DbOrTx = db) {
    const [settings] = await client.insert(settingsTable).values(input).returning();
    return settings;
  }

  async createWarehouse(input: InsertWarehouse, client: DbOrTx = db) {
    const [warehouse] = await client.insert(warehousesTable).values(input).returning();
    return warehouse;
  }

  async createDefaultPaymentMethods(companyId: string, client: DbOrTx = db) {
    return client
      .insert(paymentMethodsTable)
      .values([
        { companyId, name: "Cash", percentFee: "0", fixedFee: "0" },
        { companyId, name: "Mada", percentFee: "0", fixedFee: "0" },
        { companyId, name: "Visa/Mastercard", percentFee: "2", fixedFee: "0" },
      ])
      .returning();
  }

  async createSubscription(input: InsertSubscription, client: DbOrTx = db) {
    const [subscription] = await client.insert(subscriptionsTable).values(input).returning();
    return subscription;
  }

  async createUser(
    input: { companyId: string; username: string; email?: string; passwordHash: string; role: string },
    client: DbOrTx = db,
  ) {
    const [user] = await client.insert(usersTable).values(input).returning();
    return user;
  }

  async findGlobalRoleByName(name: string, client: DbOrTx = db) {
    const [role] = await client
      .select()
      .from(rolesTable)
      .where(and(eq(rolesTable.name, name), isNull(rolesTable.companyId)))
      .limit(1);
    return role ?? null;
  }

  async assignUserRole(
    input: { companyId: string; userId: string; roleId: string; branchId?: string; grantedBy?: string },
    client: DbOrTx = db,
  ) {
    const [row] = await client.insert(userRolesTable).values(input).returning();
    return row;
  }

  // Permission resolution now lives solely in modules/rbac's PermissionResolver
  // (see permissionResolverService.ts) — this repository no longer duplicates
  // that query.
  async getUserPrimaryRoleName(companyId: string, userId: string, client: DbOrTx = db): Promise<string | null> {
    const [row] = await client
      .select({ name: rolesTable.name })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
      .where(withTenantScope(userRolesTable.companyId, companyId, eq(userRolesTable.userId, userId)))
      .limit(1);
    return row?.name ?? null;
  }
}
