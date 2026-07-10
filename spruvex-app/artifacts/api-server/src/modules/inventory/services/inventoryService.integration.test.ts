// Integration test — real DATABASE_URL, real tables. Specifically locks
// down the default-warehouse resolution behavior that caused a real,
// previously-shipped bug (a fresh company had no default warehouse, so
// every inventory-engine write failed with "No default warehouse
// configured") — see registerCompany + backfillDefaultWarehouses.ts.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { db, pool, companiesTable, productsTable, warehousesTable, stockTable, stockMovementsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { getStock, adjustStock } from "./inventoryService";
import { AppError } from "../../../core/errors/AppError";
import type { TenantContext } from "../../../shared/types/tenantContext";

const companyId = randomUUID();
let tenant: TenantContext;
let productId: string;

beforeAll(async () => {
  await db.insert(companiesTable).values({ id: companyId, name: "vitest inventory integration co" });
  // stock_movements.createdBy has a real FK to users — a random UUID (not a
  // genuine row) would violate it, so the test tenant needs an actual user.
  const [user] = await db
    .insert(usersTable)
    .values({ companyId, username: `vitest-inv-${randomUUID().slice(0, 8)}`, passwordHash: "unused" })
    .returning();
  tenant = { userId: user.id, companyId, role: "admin" };

  const [product] = await db
    .insert(productsTable)
    .values({ companyId, name: "Test Widget", sku: `VITEST-${randomUUID().slice(0, 8)}`, sellingPrice: "10.00", stock: 0 })
    .returning();
  productId = product.id;
});

afterAll(async () => {
  await db.delete(stockMovementsTable).where(eq(stockMovementsTable.companyId, companyId));
  await db.delete(stockTable).where(eq(stockTable.companyId, companyId));
  await db.delete(warehousesTable).where(eq(warehousesTable.companyId, companyId));
  await db.delete(productsTable).where(eq(productsTable.companyId, companyId));
  await db.delete(usersTable).where(eq(usersTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
  await pool.end();
});

describe("inventory default-warehouse resolution (integration, real DB)", () => {
  it("fails clearly when the company has no default warehouse — the exact bug this locks down", async () => {
    await expect(getStock(companyId, productId)).rejects.toThrow(/No default warehouse configured/);
  });

  it("succeeds once a default warehouse exists, and stock lands in it", async () => {
    const [warehouse] = await db
      .insert(warehousesTable)
      .values({ companyId, name: "Main", isDefault: true })
      .returning();

    const stock = await getStock(companyId, productId);
    expect(stock.byWarehouse).toHaveLength(1);
    expect(stock.byWarehouse[0].warehouseId).toBe(warehouse.id);
    expect(stock.totalQuantity).toBe(0);

    await adjustStock(tenant, { productId, warehouseId: warehouse.id, quantityDelta: 5, reason: "vitest adjustment" });
    const after = await getStock(companyId, productId, warehouse.id);
    expect(after.totalQuantity).toBe(5);
  });

  it("rejects an adjustment that would push quantity negative", async () => {
    const [warehouse] = await db.select().from(warehousesTable).where(eq(warehousesTable.companyId, companyId)).limit(1);
    await expect(
      adjustStock(tenant, { productId, warehouseId: warehouse.id, quantityDelta: -999, reason: "vitest over-deduct" }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
