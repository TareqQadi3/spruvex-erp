// Integration test: proves products.stock matches sum(stock_table.quantity)
// after a sale + transfer + adjustment (T-02 acceptance criterion).
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, pool, companiesTable, subscriptionsTable, usersTable, productsTable, warehousesTable, stockTable, paymentMethodsTable } from "@workspace/db";
import { createSale } from "./saleService";
import type { TenantContext } from "../../../shared/types/tenantContext";

const companyId = randomUUID();
let tenant: TenantContext;
let productId: string;
let warehouseId: string;
let paymentMethodId: string;

async function stockMatch(): Promise<boolean> {
  const [product] = await db
    .select({ stock: productsTable.stock })
    .from(productsTable)
    .where(eq(productsTable.id, productId))
    .limit(1);
  const rows = await db
    .select({ sum: sql<string>`COALESCE(SUM(${stockTable.quantity}), 0)` })
    .from(stockTable)
    .where(eq(stockTable.productId, productId));
  const sumStock = Number(rows[0]?.sum ?? 0);
  return product ? Number(product.stock) === sumStock : false;
}

beforeAll(async () => {
  await db.insert(companiesTable).values({ id: companyId, name: "t02 co" });
  await db.insert(subscriptionsTable).values({ companyId, status: "active" });
  const [wh] = await db.insert(warehousesTable).values({ companyId, name: "Main", isDefault: true, isRepairStock: false }).returning();
  warehouseId = wh.id;
  const [product] = await db.insert(productsTable).values({ companyId, name: "T02 Widget", sku: `T02-${randomUUID().slice(0, 8)}`, sellingPrice: "50", costPrice: "20", stock: 100 }).returning();
  productId = product.id;
  await db.insert(stockTable).values({ companyId, productId, warehouseId, quantity: 100, reservedQuantity: 0 });
  const [pm] = await db.insert(paymentMethodsTable).values({ companyId, name: "Cash", percentFee: "0", fixedFee: "0" }).returning();
  paymentMethodId = pm.id;
  const [user] = await db.insert(usersTable).values({ companyId, username: `t02-${randomUUID().slice(0, 8)}`, passwordHash: "unused" }).returning();
  tenant = { userId: user.id, companyId, role: "admin" };
});

afterAll(async () => {
  await db.delete(stockTable).where(eq(stockTable.companyId, companyId));
  await db.delete(productsTable).where(eq(productsTable.companyId, companyId));
  await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.companyId, companyId));
  await db.delete(warehousesTable).where(eq(warehousesTable.companyId, companyId));
  await db.delete(usersTable).where(eq(usersTable.companyId, companyId));
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
  await pool.end();
});

describe("T-02 inventory counter: products.stock == stock_table sum", () => {
  it("matches after sale", async () => {
    expect(await stockMatch()).toBe(true);
    await createSale(tenant, {
      items: [{ productId, quantity: 2 }],
      payments: [{ paymentMethodId, amount: 100 }],
    });
    expect(await stockMatch()).toBe(true);
  });

  it("matches after transfer", async () => {
    const { transferStock } = await import("../../inventory/services/inventoryService");
    const [wh2] = await db
      .insert(warehousesTable)
      .values({ companyId, name: "Secondary", isDefault: false, isRepairStock: false })
      .returning();
    await transferStock(tenant, { productId, fromWarehouseId: warehouseId, toWarehouseId: wh2.id, quantity: 5 });
    expect(await stockMatch()).toBe(true);
    // Secondary warehouse is intentionally NOT deleted here — removing a
    // warehouse that still holds stock rows would orphan them. afterAll
    // cleans all warehouses for this company.
  });

  it("matches after adjustment", async () => {
    const { adjustStock } = await import("../../inventory/services/inventoryService");
    await adjustStock(tenant, { productId, warehouseId, quantityDelta: 3, reason: "vitest adjustment" });
    expect(await stockMatch()).toBe(true);
  });
});