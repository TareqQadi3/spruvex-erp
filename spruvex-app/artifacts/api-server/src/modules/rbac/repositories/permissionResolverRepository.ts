import { eq, isNull, or } from "drizzle-orm";
import { permissionsTable, rolePermissionsTable, userRolesTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export class PermissionResolverRepository {
  // Single joined query: user_roles -> role_permissions -> permissions,
  // scoped by (company_id, user_id) and branch — one round trip, not N+1.
  // branchId undefined = only company-wide grants (user_roles.branch_id IS
  // NULL); branchId provided = company-wide grants PLUS grants scoped to that
  // specific branch, matching the "branch-scoped roles" requirement.
  async resolveCodes(companyId: string, userId: string, branchId: string | undefined, client: DbOrTx = db): Promise<string[]> {
    const branchCondition = branchId
      ? or(isNull(userRolesTable.branchId), eq(userRolesTable.branchId, branchId))
      : isNull(userRolesTable.branchId);

    const rows = await client
      .selectDistinct({ code: permissionsTable.code })
      .from(userRolesTable)
      .innerJoin(rolePermissionsTable, eq(rolePermissionsTable.roleId, userRolesTable.roleId))
      .innerJoin(permissionsTable, eq(permissionsTable.id, rolePermissionsTable.permissionId))
      .where(withTenantScope(userRolesTable.companyId, companyId, eq(userRolesTable.userId, userId), branchCondition));

    return rows.map((row) => row.code);
  }
}
