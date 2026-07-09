import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import {
  salesTable, saleItemsTable, salePaymentsTable, productsTable, customersTable, cashSessionsTable, paymentMethodsTable,
  saleReturnsTable, saleReturnItemsTable,
  type Sale, type SaleItem, type SalePayment, type InsertSale, type InsertSaleItem, type InsertSalePayment, type Product,
  type SaleReturn, type InsertSaleReturn, type InsertSaleReturnItem,
} from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export interface SaleListFilters {
  from?: string;
  to?: string;
  customerId?: string;
}

const SALE_SELECT = {
  id: salesTable.id,
  customerId: salesTable.customerId,
  customerName: customersTable.name,
  subtotal: salesTable.subtotal,
  discount: salesTable.discount,
  total: salesTable.total,
  amountPaid: salesTable.amountPaid,
  change: salesTable.change,
  paymentMethod: salesTable.paymentMethod,
  status: salesTable.status,
  notes: salesTable.notes,
  cashSessionId: salesTable.cashSessionId,
  createdAt: salesTable.createdAt,
};

export const salesRepository = {
  async list(db: DbClient, companyId: string, filters: SaleListFilters) {
    const conditions = [eq(salesTable.companyId, companyId)];
    if (filters.from) conditions.push(gte(salesTable.createdAt, new Date(filters.from)));
    if (filters.to) {
      const toDate = new Date(filters.to);
      toDate.setDate(toDate.getDate() + 1);
      conditions.push(lte(salesTable.createdAt, toDate));
    }
    if (filters.customerId) conditions.push(eq(salesTable.customerId, filters.customerId));

    return db.select(SALE_SELECT).from(salesTable)
      .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .where(and(...conditions))
      .orderBy(desc(salesTable.createdAt));
  },

  async findById(db: DbClient, companyId: string, id: string) {
    const [sale] = await db.select(SALE_SELECT).from(salesTable)
      .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .where(and(eq(salesTable.id, id), eq(salesTable.companyId, companyId)));
    return sale;
  },

  async findRawById(db: DbClient, companyId: string, id: string): Promise<Sale | undefined> {
    const [sale] = await db.select().from(salesTable)
      .where(and(eq(salesTable.id, id), eq(salesTable.companyId, companyId)));
    return sale;
  },

  async getItems(db: DbClient, companyId: string, saleId: string): Promise<SaleItem[]> {
    return db.select().from(saleItemsTable)
      .where(and(eq(saleItemsTable.saleId, saleId), eq(saleItemsTable.companyId, companyId)));
  },

  async getPayments(db: DbClient, companyId: string, saleId: string): Promise<SalePayment[]> {
    return db.select().from(salePaymentsTable)
      .where(and(eq(salePaymentsTable.saleId, saleId), eq(salePaymentsTable.companyId, companyId)));
  },

  async insertSale(db: DbClient, row: InsertSale): Promise<Sale> {
    const [sale] = await db.insert(salesTable).values(row).returning();
    return sale;
  },

  async insertItem(db: DbClient, row: InsertSaleItem): Promise<void> {
    await db.insert(saleItemsTable).values(row);
  },

  async insertPayment(db: DbClient, row: InsertSalePayment): Promise<void> {
    await db.insert(salePaymentsTable).values(row);
  },

  async updateStatus(db: DbClient, companyId: string, id: string, status: string, notes?: string): Promise<Sale | undefined> {
    const [sale] = await db.update(salesTable).set({ status, ...(notes !== undefined ? { notes } : {}) })
      .where(and(eq(salesTable.id, id), eq(salesTable.companyId, companyId)))
      .returning();
    return sale;
  },

  // --- cross-domain reads/writes this domain legitimately owns the call site for
  // (mirrors the pre-existing inline pattern in purchases.ts touching productsTable) ---

  async findProduct(db: DbClient, companyId: string, productId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.companyId, companyId)));
    return product;
  },

  async adjustProductStock(db: DbClient, companyId: string, productId: string, delta: number): Promise<void> {
    await db.update(productsTable).set({ stock: sql`${productsTable.stock} + ${delta}` })
      .where(and(eq(productsTable.id, productId), eq(productsTable.companyId, companyId)));
  },

  async findPaymentMethod(db: DbClient, companyId: string, paymentMethodId: string) {
    const [method] = await db.select().from(paymentMethodsTable)
      .where(and(eq(paymentMethodsTable.id, paymentMethodId), eq(paymentMethodsTable.companyId, companyId)));
    return method;
  },

  async incrementCashSessionTotal(db: DbClient, companyId: string, cashSessionId: string, amount: number): Promise<void> {
    await db.update(cashSessionsTable).set({ totalSales: sql`${cashSessionsTable.totalSales} + ${amount}` })
      .where(and(eq(cashSessionsTable.id, cashSessionId), eq(cashSessionsTable.companyId, companyId)));
  },

  // --- returns ---

  async findItemById(db: DbClient, companyId: string, saleItemId: string): Promise<SaleItem | undefined> {
    const [item] = await db.select().from(saleItemsTable)
      .where(and(eq(saleItemsTable.id, saleItemId), eq(saleItemsTable.companyId, companyId)));
    return item;
  },

  async incrementItemReturnedQuantity(db: DbClient, companyId: string, saleItemId: string, delta: number): Promise<void> {
    await db.update(saleItemsTable).set({ returnedQuantity: sql`${saleItemsTable.returnedQuantity} + ${delta}` })
      .where(and(eq(saleItemsTable.id, saleItemId), eq(saleItemsTable.companyId, companyId)));
  },

  async insertReturn(db: DbClient, row: InsertSaleReturn): Promise<SaleReturn> {
    const [ret] = await db.insert(saleReturnsTable).values(row).returning();
    return ret;
  },

  async insertReturnItem(db: DbClient, row: InsertSaleReturnItem): Promise<void> {
    await db.insert(saleReturnItemsTable).values(row);
  },

  async getReturnsForSale(db: DbClient, companyId: string, saleId: string) {
    return db.select().from(saleReturnsTable)
      .where(and(eq(saleReturnsTable.saleId, saleId), eq(saleReturnsTable.companyId, companyId)))
      .orderBy(desc(saleReturnsTable.createdAt));
  },

  async getReturnItems(db: DbClient, companyId: string, saleReturnId: string) {
    return db.select().from(saleReturnItemsTable)
      .where(and(eq(saleReturnItemsTable.saleReturnId, saleReturnId), eq(saleReturnItemsTable.companyId, companyId)));
  },

  async findReturnById(db: DbClient, companyId: string, id: string): Promise<SaleReturn | undefined> {
    const [ret] = await db.select().from(saleReturnsTable)
      .where(and(eq(saleReturnsTable.id, id), eq(saleReturnsTable.companyId, companyId)));
    return ret;
  },

  async updateReturnTotals(db: DbClient, companyId: string, id: string, refundAmount: number, exchangeAmount: number, netAmount: number): Promise<void> {
    await db.update(saleReturnsTable)
      .set({ refundAmount: refundAmount.toString(), exchangeAmount: exchangeAmount.toString(), netAmount: netAmount.toString() })
      .where(and(eq(saleReturnsTable.id, id), eq(saleReturnsTable.companyId, companyId)));
  },
};
