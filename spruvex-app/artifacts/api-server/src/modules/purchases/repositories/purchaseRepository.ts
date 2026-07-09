import { eq, and, desc, sql } from "drizzle-orm";
import {
  purchasesTable, productsTable, suppliersTable, purchaseReturnsTable,
  type Purchase, type InsertPurchase, type Product, type Supplier,
  type InsertPurchaseReturn, type PurchaseReturn,
} from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export const purchaseRepository = {
  async list(db: DbClient, companyId: string, productId?: string) {
    const conditions = [eq(purchasesTable.companyId, companyId)];
    if (productId) conditions.push(eq(purchasesTable.productId, productId));
    return db.select({
      id: purchasesTable.id,
      productId: purchasesTable.productId,
      supplierId: purchasesTable.supplierId,
      supplierName: suppliersTable.name,
      quantity: purchasesTable.quantity,
      returnedQuantity: purchasesTable.returnedQuantity,
      totalCost: purchasesTable.totalCost,
      amountPaid: purchasesTable.amountPaid,
      createdAt: purchasesTable.createdAt,
    }).from(purchasesTable)
      .leftJoin(suppliersTable, eq(purchasesTable.supplierId, suppliersTable.id))
      .where(and(...conditions))
      .orderBy(desc(purchasesTable.createdAt));
  },

  async insert(db: DbClient, row: InsertPurchase): Promise<Purchase> {
    const [purchase] = await db.insert(purchasesTable).values(row).returning();
    return purchase;
  },

  async findProduct(db: DbClient, companyId: string, productId: string): Promise<Product | undefined> {
    const [product] = await db.select().from(productsTable)
      .where(and(eq(productsTable.id, productId), eq(productsTable.companyId, companyId)));
    return product;
  },

  async findSupplier(db: DbClient, companyId: string, supplierId: string): Promise<Supplier | undefined> {
    const [supplier] = await db.select().from(suppliersTable)
      .where(and(eq(suppliersTable.id, supplierId), eq(suppliersTable.companyId, companyId)));
    return supplier;
  },

  async adjustProductStock(db: DbClient, productId: string, delta: number, supplierId: string): Promise<void> {
    await db.update(productsTable)
      .set({ stock: sql`${productsTable.stock} + ${delta}`, supplierId })
      .where(eq(productsTable.id, productId));
  },

  async findById(db: DbClient, companyId: string, id: string): Promise<Purchase | undefined> {
    const [purchase] = await db.select().from(purchasesTable)
      .where(and(eq(purchasesTable.id, id), eq(purchasesTable.companyId, companyId)));
    return purchase;
  },

  async incrementReturnedQuantity(db: DbClient, companyId: string, id: string, delta: number): Promise<void> {
    await db.update(purchasesTable).set({ returnedQuantity: sql`${purchasesTable.returnedQuantity} + ${delta}` })
      .where(and(eq(purchasesTable.id, id), eq(purchasesTable.companyId, companyId)));
  },

  async insertReturn(db: DbClient, row: InsertPurchaseReturn): Promise<PurchaseReturn> {
    const [ret] = await db.insert(purchaseReturnsTable).values(row).returning();
    return ret;
  },

  async getReturnsForPurchase(db: DbClient, companyId: string, purchaseId: string): Promise<PurchaseReturn[]> {
    return db.select().from(purchaseReturnsTable)
      .where(and(eq(purchaseReturnsTable.purchaseId, purchaseId), eq(purchaseReturnsTable.companyId, companyId)))
      .orderBy(desc(purchaseReturnsTable.createdAt));
  },
};
