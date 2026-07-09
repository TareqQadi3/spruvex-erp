import { and, eq } from "drizzle-orm";
import { permissionsTable, rolePermissionsTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";

export class RolePermissionRepository {
  async listForRole(roleId: string, client: DbOrTx = db) {
    return client
      .select({
        permissionId: rolePermissionsTable.permissionId,
        code: permissionsTable.code,
        module: permissionsTable.module,
        description: permissionsTable.description,
      })
      .from(rolePermissionsTable)
      .innerJoin(permissionsTable, eq(rolePermissionsTable.permissionId, permissionsTable.id))
      .where(eq(rolePermissionsTable.roleId, roleId));
  }

  async replaceForRole(companyId: string, roleId: string, permissionIds: string[], client: DbOrTx = db) {
    await client.delete(rolePermissionsTable).where(eq(rolePermissionsTable.roleId, roleId));
    if (permissionIds.length === 0) return;
    await client
      .insert(rolePermissionsTable)
      .values(permissionIds.map((permissionId) => ({ roleId, permissionId, companyId })));
  }

  async assign(companyId: string, roleId: string, permissionId: string, client: DbOrTx = db) {
    await client.insert(rolePermissionsTable).values({ roleId, permissionId, companyId }).onConflictDoNothing();
  }

  async revoke(roleId: string, permissionId: string, client: DbOrTx = db) {
    await client
      .delete(rolePermissionsTable)
      .where(and(eq(rolePermissionsTable.roleId, roleId), eq(rolePermissionsTable.permissionId, permissionId)));
  }
}
