import { eq, and, sum } from "drizzle-orm";
import { cashSessionsTable, salesTable, type CashSession } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface InsertCashSessionRow {
  companyId: string;
  openingBalance: string;
  notes?: string;
  status: "open";
}

export interface CloseCashSessionRow {
  status: "closed";
  closedAt: Date;
  closingBalance: string;
  expectedBalance: string;
  totalSales: string;
  notes?: string | null;
}

export interface ICashSessionRepository {
  list(db: DbClient, companyId: string): Promise<CashSession[]>;
  findOpen(db: DbClient, companyId: string): Promise<CashSession | undefined>;
  findById(db: DbClient, companyId: string, id: string): Promise<CashSession | undefined>;
  insert(db: DbClient, row: InsertCashSessionRow): Promise<CashSession>;
  sumSalesTotal(db: DbClient, companyId: string, cashSessionId: string): Promise<number>;
  close(db: DbClient, companyId: string, id: string, patch: CloseCashSessionRow): Promise<CashSession>;
}

export const cashSessionRepository: ICashSessionRepository = {
  async list(db, companyId) {
    return db.select().from(cashSessionsTable)
      .where(eq(cashSessionsTable.companyId, companyId))
      .orderBy(cashSessionsTable.openedAt);
  },

  async findOpen(db, companyId) {
    const [session] = await db.select().from(cashSessionsTable)
      .where(and(eq(cashSessionsTable.status, "open"), eq(cashSessionsTable.companyId, companyId)))
      .limit(1);
    return session;
  },

  async findById(db, companyId, id) {
    const [session] = await db.select().from(cashSessionsTable)
      .where(and(eq(cashSessionsTable.id, id), eq(cashSessionsTable.companyId, companyId)));
    return session;
  },

  async insert(db, row) {
    const [session] = await db.insert(cashSessionsTable).values(row).returning();
    return session;
  },

  async sumSalesTotal(db, companyId, cashSessionId) {
    const result = await db.select({ total: sum(salesTable.total) }).from(salesTable)
      .where(and(eq(salesTable.cashSessionId, cashSessionId), eq(salesTable.companyId, companyId)));
    return parseFloat(result[0]?.total ?? "0") || 0;
  },

  async close(db, companyId, id, patch) {
    const [updated] = await db.update(cashSessionsTable).set(patch)
      .where(and(eq(cashSessionsTable.id, id), eq(cashSessionsTable.companyId, companyId)))
      .returning();
    return updated;
  },
};
