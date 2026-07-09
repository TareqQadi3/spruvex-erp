import { eq, and, gte, lte, desc, inArray, sql } from "drizzle-orm";
import {
  journalEntriesTable, journalEntryLinesTable, accountsTable,
  type JournalEntry, type InsertJournalEntry, type InsertJournalEntryLine,
} from "@workspace/db";
import type { DbClient } from "../types";

export interface JournalEntryFilters {
  from?: string;
  to?: string;
  sourceType?: string;
}

export interface TrialBalanceRow {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountNameAr: string | null;
  accountType: string;
  totalDebit: string;
  totalCredit: string;
}

export interface IJournalRepository {
  insertEntry(db: DbClient, entry: InsertJournalEntry): Promise<JournalEntry>;
  insertLines(db: DbClient, lines: InsertJournalEntryLine[]): Promise<void>;
  listEntries(db: DbClient, companyId: string, filters: JournalEntryFilters): Promise<JournalEntry[]>;
  getLinesForEntries(db: DbClient, companyId: string, entryIds: string[]): Promise<Array<{
    id: string; journalEntryId: string; accountId: string; accountCode: string | null;
    accountName: string | null; accountNameAr: string | null; debit: string; credit: string; memo: string | null;
  }>>;
  getTrialBalance(db: DbClient, companyId: string, asOf?: string): Promise<TrialBalanceRow[]>;
}

export const journalRepository: IJournalRepository = {
  async insertEntry(db, entry) {
    const [row] = await db.insert(journalEntriesTable).values(entry).returning();
    return row;
  },

  async insertLines(db, lines) {
    if (lines.length === 0) return;
    await db.insert(journalEntryLinesTable).values(lines);
  },

  async listEntries(db, companyId, filters) {
    const conditions = [eq(journalEntriesTable.companyId, companyId)];
    if (filters.from) conditions.push(gte(journalEntriesTable.date, filters.from));
    if (filters.to) conditions.push(lte(journalEntriesTable.date, filters.to));
    if (filters.sourceType) conditions.push(eq(journalEntriesTable.sourceType, filters.sourceType));
    return db.select().from(journalEntriesTable)
      .where(and(...conditions))
      .orderBy(desc(journalEntriesTable.date), desc(journalEntriesTable.id));
  },

  async getLinesForEntries(db, companyId, entryIds) {
    if (entryIds.length === 0) return [];
    return db.select({
      id: journalEntryLinesTable.id,
      journalEntryId: journalEntryLinesTable.journalEntryId,
      accountId: journalEntryLinesTable.accountId,
      accountCode: accountsTable.code,
      accountName: accountsTable.name,
      accountNameAr: accountsTable.nameAr,
      debit: journalEntryLinesTable.debit,
      credit: journalEntryLinesTable.credit,
      memo: journalEntryLinesTable.memo,
    }).from(journalEntryLinesTable)
      .leftJoin(accountsTable, eq(journalEntryLinesTable.accountId, accountsTable.id))
      .where(and(
        inArray(journalEntryLinesTable.journalEntryId, entryIds),
        eq(journalEntryLinesTable.companyId, companyId),
      ));
  },

  async getTrialBalance(db, companyId, asOf) {
    const conditions = [eq(journalEntryLinesTable.companyId, companyId)];
    if (asOf) conditions.push(lte(journalEntriesTable.date, asOf));
    return db.select({
      accountId: journalEntryLinesTable.accountId,
      accountCode: accountsTable.code,
      accountName: accountsTable.name,
      accountNameAr: accountsTable.nameAr,
      accountType: accountsTable.type,
      totalDebit: sql<string>`coalesce(sum(${journalEntryLinesTable.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${journalEntryLinesTable.credit}), 0)`,
    }).from(journalEntryLinesTable)
      .innerJoin(journalEntriesTable, eq(journalEntryLinesTable.journalEntryId, journalEntriesTable.id))
      .innerJoin(accountsTable, eq(journalEntryLinesTable.accountId, accountsTable.id))
      .where(and(...conditions))
      .groupBy(journalEntryLinesTable.accountId, accountsTable.code, accountsTable.name, accountsTable.nameAr, accountsTable.type)
      .orderBy(accountsTable.code);
  },
};
