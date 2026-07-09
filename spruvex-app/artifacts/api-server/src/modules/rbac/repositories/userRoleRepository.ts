import { and, eq } from "drizzle-orm";
import { rolesTable, userRolesTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { BaseRepository } from "../../../shared/repositories/baseRepository";

export class UserRoleRepository extends BaseRepository<typeof userRolesTable> {
  constructor() {
    super(userRolesTable, userRolesTable.companyId, userRolesTable.id);
  }

  async listForUser(companyId: string, userId: string, client: DbOrTx = db) {
    return client
      .select({
        id: userRolesTable.id,
        roleId: userRolesTable.roleId,
        roleName: rolesTable.name,
        branchId: userRolesTable.branchId,
      })
      .from(userRolesTable)
      .innerJoin(rolesTable, eq(userRolesTable.roleId, rolesTable.id))
      .where(and(this.scopeToTenant(companyId), eq(userRolesTable.userId, userId)));
  }

  async assign(
    input: { companyId: string; userId: string; roleId: string; branchId?: string; grantedBy?: string },
    client: DbOrTx = db,
  ) {
    const [row] = await client.insert(userRolesTable).values(input).returning();
    return row;
  }

  async revokeOwn(companyId: string, userRoleId: string, client: DbOrTx = db) {
    const [row] = await client.delete(userRolesTable).where(this.scopeToRecord(companyId, userRoleId)).returning();
    return row ?? null;
  }
}
