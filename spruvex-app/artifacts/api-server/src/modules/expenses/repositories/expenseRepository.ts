import { eq, and, gte, lte, desc } from "drizzle-orm";
import { expensesTable, type Expense, type InsertExpense } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface ExpenseListFilters {
  from?: string;
  to?: string;
  category?: string;
}

export const expenseRepository = {
  async list(db: DbClient, companyId: string, filters: ExpenseListFilters): Promise<Expense[]> {
    const conditions = [eq(expensesTable.companyId, companyId)];
    if (filters.from) conditions.push(gte(expensesTable.date, filters.from));
    if (filters.to) conditions.push(lte(expensesTable.date, filters.to));
    if (filters.category) conditions.push(eq(expensesTable.category, filters.category));
    return db.select().from(expensesTable).where(and(...conditions)).orderBy(desc(expensesTable.date));
  },

  async insert(db: DbClient, row: InsertExpense): Promise<Expense> {
    const [expense] = await db.insert(expensesTable).values(row).returning();
    return expense;
  },

  async delete(db: DbClient, companyId: string, id: string): Promise<void> {
    await db.delete(expensesTable)
      .where(and(eq(expensesTable.id, id), eq(expensesTable.companyId, companyId)));
  },
};
