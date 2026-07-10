// Integration test — exercises the real, modular createSale against the
// actual configured DATABASE_URL (same DB this project verifies against
// live throughout development), not a mock. Requires DATABASE_URL to be
// set (see spruvex-app/.env or CI's ephemeral Postgres service). Each test
// creates its own throwaway company and cleans everything up afterward, so
// this is safe to run repeatedly against a real dev database.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import {
  db,
  pool,
  companiesTable,
  subscriptionsTable,
  productsTable,
  paymentMethodsTable,
  salesTable,
  saleItemsTable,
  salePaymentsTable,
  warehousesTable,
  stockTable,
  stockMovementsTable,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSale } from "./saleService";
import { AppError } from "../../../core/errors/AppError";
import type { TenantContext } from "../../../shared/types/tenantContext";

const companyId = randomUUID();
let tenant: TenantContext;
let productId: string;
let paymentMethodId: string;

beforeAll(async () => {
  await db.insert(companiesTable).values({ id: companyId, name: "vitest sales integration co" });
  await db.insert(subscriptionsTable).values({ companyId, status: "active" });
  // createSale routes stock deduction through the inventory engine, which
  // requires a default warehouse (see backfillDefaultWarehouses.ts / the
  // Phase 10 fix) — without one, every sale would fail with "No default
  // warehouse configured for this company".
  await db.insert(warehousesTable).values({ companyId, name: "Main", isRepairStock: false, isDefault: true });
  const [user] = await db
    .insert(usersTable)
    .values({ companyId, username: `vitest-sales-${randomUUID().slice(0, 8)}`, passwordHash: "unused" })
    .returning();
  tenant = { userId: user.id, companyId, role: "admin" };

  const [product] = await db
    .insert(productsTable)
    .values({ companyId, name: "Test Widget", sku: `VITEST-${randomUUID().slice(0, 8)}`, sellingPrice: "100.00", costPrice: "40.00", stock: 10 })
    .returning();
  productId = product.id;

  const [method] = await db
    .insert(paymentMethodsTable)
    .values({ companyId, name: "Cash", percentFee: "0", fixedFee: "0" })
    .returning();
  paymentMethodId = method.id;
});

afterAll(async () => {
  // Order matters: rows referencing company/product/warehouse/sale are
  // deleted before the rows they reference.
  await db.delete(saleItemsTable).where(eq(saleItemsTable.companyId, companyId));
  await db.delete(salePaymentsTable).where(eq(salePaymentsTable.companyId, companyId));
  await db.delete(salesTable).where(eq(salesTable.companyId, companyId));
  await db.delete(stockMovementsTable).where(eq(stockMovementsTable.companyId, companyId));
  await db.delete(stockTable).where(eq(stockTable.companyId, companyId));
  await db.delete(warehousesTable).where(eq(warehousesTable.companyId, companyId));
  await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.companyId, companyId));
  await db.delete(productsTable).where(eq(productsTable.companyId, companyId));
  await db.delete(usersTable).where(eq(usersTable.companyId, companyId));
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
  await pool.end();
});

describe("saleService.createSale (sales — integration, real DB)", () => {
  it("rejects when the payment total does not equal the computed sale total", async () => {
    await expect(
      createSale(tenant, {
        items: [{ productId, quantity: 1 }],
        payments: [{ paymentMethodId, amount: 50 }], // product sells for 100, this is short
      }),
    ).rejects.toThrow(/does not match/);
  });

  it("rejects when requested quantity exceeds available stock", async () => {
    await expect(
      createSale(tenant, {
        items: [{ productId, quantity: 999 }],
        payments: [{ paymentMethodId, amount: 99900 }],
      }),
    ).rejects.toThrow(/Insufficient stock/);
  });

  it("creates a real sale, deducts stock, and returns matching totals when the payment is exact", async () => {
    const before = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    const stockBefore = before[0].stock;

    const sale = await createSale(tenant, {
      items: [{ productId, quantity: 2 }],
      payments: [{ paymentMethodId, amount: 200 }],
    });

    expect(sale.total).toBe("200.00");
    expect(sale.items).toHaveLength(1);
    expect(sale.items[0].quantity).toBe(2);
    expect(sale.payments).toHaveLength(1);
    expect(sale.payments[0].amount).toBe("200.00");

    const after = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    expect(after[0].stock).toBe(stockBefore - 2);
  });

  it("rejects a product belonging to a different company (tenant isolation)", async () => {
    const otherCompanyId = randomUUID();
    await db.insert(companiesTable).values({ id: otherCompanyId, name: "vitest other co" });
    try {
      await expect(
        createSale({ ...tenant, companyId: otherCompanyId }, {
          items: [{ productId, quantity: 1 }], // real product, but belongs to `companyId`, not otherCompanyId
          payments: [{ paymentMethodId, amount: 100 }],
        }),
      ).rejects.toThrow();
    } finally {
      await db.delete(companiesTable).where(eq(companiesTable.id, otherCompanyId));
    }
  });
});

// Sanity check that AppError is the actual error type thrown, not a generic
// Error — callers (route handlers) depend on .statusCode being present.
describe("createSale error shape", () => {
  it("throws an AppError (not a bare Error) on validation failure", async () => {
    try {
      await createSale(tenant, { items: [{ productId, quantity: 999 }], payments: [{ paymentMethodId, amount: 1 }] });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
    }
  });
});
