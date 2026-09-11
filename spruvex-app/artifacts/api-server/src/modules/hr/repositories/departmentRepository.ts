import { eq, and } from "drizzle-orm";
import { departmentsTable, type Department, type InsertDepartment } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface DepartmentUpdate {
  name?: string;
  managerId?: string | null;
}

export const departmentRepository = {
  async list(db: DbClient, companyId: string): Promise<Department[]> {
    return db.select().from(departmentsTable)
      .where(eq(departmentsTable.companyId, companyId))
      .orderBy(departmentsTable.name);
  },

  async findById(db: DbClient, companyId: string, id: string): Promise<Department | undefined> {
    const [row] = await db.select().from(departmentsTable)
      .where(and(eq(departmentsTable.id, id), eq(departmentsTable.companyId, companyId)));
    return row;
  },

  async insert(db: DbClient, row: InsertDepartment): Promise<Department> {
    const [department] = await db.insert(departmentsTable).values(row).returning();
    return department;
  },

  async update(db: DbClient, companyId: string, id: string, changes: DepartmentUpdate): Promise<Department | undefined> {
    const [updated] = await db.update(departmentsTable).set(changes)
      .where(and(eq(departmentsTable.id, id), eq(departmentsTable.companyId, companyId)))
      .returning();
    return updated;
  },

  async delete(db: DbClient, companyId: string, id: string): Promise<void> {
    await db.delete(departmentsTable)
      .where(and(eq(departmentsTable.id, id), eq(departmentsTable.companyId, companyId)));
  },
};
