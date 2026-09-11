import { eq, and } from "drizzle-orm";
import { employeesTable, type Employee, type InsertEmployee } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface EmployeeUpdate {
  userId?: string | null;
  name?: string;
  nationalId?: string | null;
  departmentId?: string | null;
  position?: string | null;
  hireDate?: string | null;
  status?: string;
  branchId?: string | null;
}

export const employeeRepository = {
  async list(db: DbClient, companyId: string, departmentId?: string): Promise<Employee[]> {
    const conditions = [eq(employeesTable.companyId, companyId)];
    if (departmentId) conditions.push(eq(employeesTable.departmentId, departmentId));
    return db.select().from(employeesTable).where(and(...conditions)).orderBy(employeesTable.name);
  },

  async findById(db: DbClient, companyId: string, id: string): Promise<Employee | undefined> {
    const [row] = await db.select().from(employeesTable)
      .where(and(eq(employeesTable.id, id), eq(employeesTable.companyId, companyId)));
    return row;
  },

  async insert(db: DbClient, row: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employeesTable).values(row).returning();
    return employee;
  },

  async update(db: DbClient, companyId: string, id: string, changes: EmployeeUpdate): Promise<Employee | undefined> {
    const [updated] = await db.update(employeesTable).set(changes)
      .where(and(eq(employeesTable.id, id), eq(employeesTable.companyId, companyId)))
      .returning();
    return updated;
  },

  async delete(db: DbClient, companyId: string, id: string): Promise<void> {
    await db.delete(employeesTable)
      .where(and(eq(employeesTable.id, id), eq(employeesTable.companyId, companyId)));
  },
};
