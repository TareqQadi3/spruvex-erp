import { eq, and, isNull } from "drizzle-orm";
import { usersTable, companiesTable, rolesTable, userRolesTable } from "@workspace/db";
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
