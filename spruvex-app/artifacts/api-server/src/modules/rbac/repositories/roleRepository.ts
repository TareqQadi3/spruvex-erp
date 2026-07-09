import { and, eq, isNull, or } from "drizzle-orm";
import { rolesTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { BaseRepository } from "../../../shared/repositories/baseRepository";

export class RoleRepository extends BaseRepository<typeof rolesTable> {
  constructor() {
    super(rolesTable, rolesTable.companyId, rolesTable.id);
  }

  // "Accessible" = global system templates (company_id IS NULL) or the
  // tenant's own custom roles — never another tenant's roles.
  async listAccessible(companyId: string, client: DbOrTx = db) {
    return client
      .select()
      .from(rolesTable)
      .where(or(isNull(rolesTable.companyId), eq(rolesTable.companyId, companyId)));
  }

  async findAccessibleById(companyId: string, roleId: string, client: DbOrTx = db) {
    const [role] = await client
      .select()
      .from(rolesTable)
      .where(and(eq(rolesTable.id, roleId), or(isNull(rolesTable.companyId), eq(rolesTable.companyId, companyId))))
      .limit(1);
    return role ?? null;
  }

  async findGlobalByName(name: string, client: DbOrTx = db) {
    const [role] = await client
      .select()
      .from(rolesTable)
      .where(and(eq(rolesTable.name, name), isNull(rolesTable.companyId)))
      .limit(1);
    return role ?? null;
  }

  async create(input: { companyId: string; name: string; displayName: string }, client: DbOrTx = db) {
    const [role] = await client.insert(rolesTable).values(input).returning();
    return role;
  }

  // Writes only ever target a company's own role — the strict composite match
  // means a global template or another tenant's role simply matches 0 rows.
  async updateOwn(companyId: string, roleId: string, input: { displayName?: string }, client: DbOrTx = db) {
    const [role] = await client.update(rolesTable).set(input).where(this.scopeToRecord(companyId, roleId)).returning();
    return role ?? null;
  }

  async deleteOwn(companyId: string, roleId: string, client: DbOrTx = db) {
    const [role] = await client.delete(rolesTable).where(this.scopeToRecord(companyId, roleId)).returning();
    return role ?? null;
  }
}
