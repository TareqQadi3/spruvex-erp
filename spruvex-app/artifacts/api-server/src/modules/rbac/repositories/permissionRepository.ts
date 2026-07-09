import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { permissionsTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { BaseRepository } from "../../../shared/repositories/baseRepository";

export class PermissionRepository extends BaseRepository<typeof permissionsTable> {
  constructor() {
    super(permissionsTable, permissionsTable.companyId, permissionsTable.id);
  }

  async listAccessible(companyId: string, client: DbOrTx = db) {
    return client
      .select()
      .from(permissionsTable)
      .where(or(isNull(permissionsTable.companyId), eq(permissionsTable.companyId, companyId)));
  }

  async findAccessibleById(companyId: string, permissionId: string, client: DbOrTx = db) {
    const [permission] = await client
      .select()
      .from(permissionsTable)
      .where(
        and(
          eq(permissionsTable.id, permissionId),
          or(isNull(permissionsTable.companyId), eq(permissionsTable.companyId, companyId)),
        ),
      )
      .limit(1);
    return permission ?? null;
  }

  // Used to resolve permissionCodes[] from a role create/update request into
  // ids — only codes the requesting tenant can actually see are resolved.
  async findManyAccessibleByCodes(companyId: string, codes: string[], client: DbOrTx = db) {
    if (codes.length === 0) return [];
    return client
      .select()
      .from(permissionsTable)
      .where(
        and(
          inArray(permissionsTable.code, codes),
          or(isNull(permissionsTable.companyId), eq(permissionsTable.companyId, companyId)),
        ),
      );
  }

  async create(input: { companyId: string; code: string; module: string; description?: string }, client: DbOrTx = db) {
    const [permission] = await client.insert(permissionsTable).values(input).returning();
    return permission;
  }

  async updateOwn(
    companyId: string,
    permissionId: string,
    input: { module?: string; description?: string },
    client: DbOrTx = db,
  ) {
    const [permission] = await client
      .update(permissionsTable)
      .set(input)
      .where(this.scopeToRecord(companyId, permissionId))
      .returning();
    return permission ?? null;
  }

  async deleteOwn(companyId: string, permissionId: string, client: DbOrTx = db) {
    const [permission] = await client
      .delete(permissionsTable)
      .where(this.scopeToRecord(companyId, permissionId))
      .returning();
    return permission ?? null;
  }
}
