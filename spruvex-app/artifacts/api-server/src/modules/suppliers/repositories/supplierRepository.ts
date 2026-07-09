import { eq, and, or, ilike, sql } from "drizzle-orm";
import { suppliersTable, type Supplier, type InsertSupplier } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface SupplierUpdate {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  outstandingBalance?: string;
}

export interface ISupplierRepository {
  list(db: DbClient, companyId: string, search?: string): Promise<Supplier[]>;
  findById(db: DbClient, companyId: string, id: string): Promise<Supplier | undefined>;
  insert(db: DbClient, row: InsertSupplier): Promise<Supplier>;
  update(db: DbClient, companyId: string, id: string, changes: SupplierUpdate): Promise<Supplier | undefined>;
  delete(db: DbClient, companyId: string, id: string): Promise<void>;
  incrementOutstandingBalance(db: DbClient, companyId: string, id: string, delta: number): Promise<void>;
}

export const supplierRepository: ISupplierRepository = {
  async list(db, companyId, search) {
    const conditions = [eq(suppliersTable.companyId, companyId)];
    if (search) {
      conditions.push(or(
        ilike(suppliersTable.name, `%${search}%`),
        ilike(suppliersTable.phone, `%${search}%`),
      )!);
    }
    return db.select().from(suppliersTable).where(and(...conditions)).orderBy(suppliersTable.name);
  },

  async findById(db, companyId, id) {
    const [supplier] = await db.select().from(suppliersTable)
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, companyId)));
    return supplier;
  },

  async insert(db, row) {
    const [supplier] = await db.insert(suppliersTable).values(row).returning();
    return supplier;
  },

  async update(db, companyId, id, changes) {
    const [supplier] = await db.update(suppliersTable).set(changes)
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, companyId)))
      .returning();
    return supplier;
  },

  async delete(db, companyId, id) {
    await db.delete(suppliersTable)
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, companyId)));
  },

  async incrementOutstandingBalance(db, companyId, id, delta) {
    if (delta === 0) return;
    await db.update(suppliersTable)
      .set({ outstandingBalance: sql`${suppliersTable.outstandingBalance} + ${delta}` })
      .where(and(eq(suppliersTable.id, id), eq(suppliersTable.companyId, companyId)));
  },
};
