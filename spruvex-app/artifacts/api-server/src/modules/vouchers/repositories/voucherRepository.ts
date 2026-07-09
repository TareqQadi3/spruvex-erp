import { eq, and, gte, lte, desc } from "drizzle-orm";
import { vouchersTable, type Voucher, type InsertVoucher } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface VoucherListFilters {
  type?: string;
  from?: string;
  to?: string;
}

export const voucherRepository = {
  async list(db: DbClient, companyId: string, filters: VoucherListFilters): Promise<Voucher[]> {
    const conditions = [eq(vouchersTable.companyId, companyId)];
    if (filters.type) conditions.push(eq(vouchersTable.type, filters.type));
    if (filters.from) conditions.push(gte(vouchersTable.date, filters.from));
    if (filters.to) conditions.push(lte(vouchersTable.date, filters.to));
    return db.select().from(vouchersTable).where(and(...conditions)).orderBy(desc(vouchersTable.date));
  },

  async insert(db: DbClient, row: InsertVoucher & { voucherNumber: string }): Promise<Voucher> {
    const [voucher] = await db.insert(vouchersTable).values(row).returning();
    return voucher;
  },

  async delete(db: DbClient, companyId: string, id: string): Promise<void> {
    await db.delete(vouchersTable)
      .where(and(eq(vouchersTable.id, id), eq(vouchersTable.companyId, companyId)));
  },
};
