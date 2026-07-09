import { eq, and, or, ilike, desc, sql } from "drizzle-orm";
import { customersTable, salesTable, repairsTable, type Customer, type InsertCustomer } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface CustomerUpdate {
  name?: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  outstandingBalance?: string;
}

export interface ICustomerRepository {
  list(db: DbClient, companyId: string, search?: string): Promise<Customer[]>;
  findById(db: DbClient, companyId: string, id: string): Promise<Customer | undefined>;
  insert(db: DbClient, row: InsertCustomer): Promise<Customer>;
  update(db: DbClient, companyId: string, id: string, changes: CustomerUpdate): Promise<Customer | undefined>;
  delete(db: DbClient, companyId: string, id: string): Promise<void>;
  incrementOutstandingBalance(db: DbClient, companyId: string, id: string, delta: number): Promise<void>;
  incrementTotalPurchases(db: DbClient, companyId: string, id: string, delta: number): Promise<void>;
  recentSales(db: DbClient, companyId: string, customerId: string, limit: number): Promise<unknown[]>;
  recentRepairs(db: DbClient, companyId: string, customerId: string, limit: number): Promise<unknown[]>;
}

export const customerRepository: ICustomerRepository = {
  async list(db, companyId, search) {
    const conditions = [eq(customersTable.companyId, companyId)];
    if (search) {
      conditions.push(or(
        ilike(customersTable.name, `%${search}%`),
        ilike(customersTable.phone, `%${search}%`),
      )!);
    }
    return db.select().from(customersTable).where(and(...conditions)).orderBy(customersTable.name);
  },

  async findById(db, companyId, id) {
    const [customer] = await db.select().from(customersTable)
      .where(and(eq(customersTable.id, id), eq(customersTable.companyId, companyId)));
    return customer;
  },

  async insert(db, row) {
    const [customer] = await db.insert(customersTable).values(row).returning();
    return customer;
  },

  async update(db, companyId, id, changes) {
    const [customer] = await db.update(customersTable).set(changes)
      .where(and(eq(customersTable.id, id), eq(customersTable.companyId, companyId)))
      .returning();
    return customer;
  },

  async delete(db, companyId, id) {
    await db.delete(customersTable)
      .where(and(eq(customersTable.id, id), eq(customersTable.companyId, companyId)));
  },

  async incrementOutstandingBalance(db, companyId, id, delta) {
    if (delta === 0) return;
    await db.update(customersTable)
      .set({ outstandingBalance: sql`${customersTable.outstandingBalance} + ${delta}` })
      .where(and(eq(customersTable.id, id), eq(customersTable.companyId, companyId)));
  },

  async incrementTotalPurchases(db, companyId, id, delta) {
    await db.update(customersTable)
      .set({ totalPurchases: sql`${customersTable.totalPurchases} + ${delta}` })
      .where(and(eq(customersTable.id, id), eq(customersTable.companyId, companyId)));
  },

  async recentSales(db, companyId, customerId, limit) {
    return db.select().from(salesTable)
      .where(and(eq(salesTable.customerId, customerId), eq(salesTable.companyId, companyId)))
      .orderBy(desc(salesTable.createdAt))
      .limit(limit);
  },

  async recentRepairs(db, companyId, customerId, limit) {
    return db.select().from(repairsTable)
      .where(and(eq(repairsTable.customerId, customerId), eq(repairsTable.companyId, companyId)))
      .orderBy(desc(repairsTable.createdAt))
      .limit(limit);
  },
};
