import { eq, and, inArray } from "drizzle-orm";
import { accountsTable, type Account, type InsertAccount } from "@workspace/db";
import type { DbClient } from "../types";

export interface AccountUpdate {
  name?: string;
  nameAr?: string | null;
  parentId?: string | null;
  isActive?: boolean;
}

export interface IAccountRepository {
  listByOrg(db: DbClient, companyId: string): Promise<Account[]>;
  findByCodes(db: DbClient, companyId: string, codes: string[]): Promise<Account[]>;
  findById(db: DbClient, companyId: string, id: string): Promise<Account | undefined>;
  insertMany(db: DbClient, rows: InsertAccount[]): Promise<Account[]>;
  insertOne(db: DbClient, row: InsertAccount): Promise<Account>;
  update(db: DbClient, companyId: string, id: string, changes: AccountUpdate): Promise<Account | undefined>;
}

export const accountRepository: IAccountRepository = {
  async listByOrg(db, companyId) {
    return db.select().from(accountsTable)
      .where(eq(accountsTable.companyId, companyId))
      .orderBy(accountsTable.code);
  },

  async findByCodes(db, companyId, codes) {
    if (codes.length === 0) return [];
    return db.select().from(accountsTable)
      .where(and(eq(accountsTable.companyId, companyId), inArray(accountsTable.code, codes)));
  },

  async findById(db, companyId, id) {
    const [row] = await db.select().from(accountsTable)
      .where(and(eq(accountsTable.id, id), eq(accountsTable.companyId, companyId)));
    return row;
  },

  async insertMany(db, rows) {
    if (rows.length === 0) return [];
    return db.insert(accountsTable).values(rows).returning();
  },

  async insertOne(db, row) {
    const [inserted] = await db.insert(accountsTable).values(row).returning();
    return inserted;
  },

  async update(db, companyId, id, changes) {
    const [updated] = await db.update(accountsTable).set(changes)
      .where(and(eq(accountsTable.id, id), eq(accountsTable.companyId, companyId)))
      .returning();
    return updated;
  },
};
