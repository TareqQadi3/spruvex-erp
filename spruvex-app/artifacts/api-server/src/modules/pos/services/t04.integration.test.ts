// Integration test for T-04: branchId must be carried in the JWT and populate
// sales.branchId from every sale path, never read from the client. Old tokens
// (no branchId claim) must keep working.
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, companiesTable, subscriptionsTable, usersTable, productsTable, warehousesTable, paymentMethodsTable, branchesTable, salesTable } from "@workspace/db";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { createSale } from "./saleService";

const companyId = randomUUID();
let branchId: string;
let productId: string;
let paymentMethodId: string;
let tenant: TenantContext;

beforeAll(async () => {
  await db.insert(companiesTable).values({ id: companyId, name: "t04 co" });
  await db.insert(subscriptionsTable).values({ companyId, status: "active" });
  const [branch] = await db.insert(branchesTable).values({ companyId, name: "Main", isDefault: true, isActive: true }).returning();
  branchId = branch.id;
  const [wh] = await db.insert(warehousesTable).values({ companyId, name: "Main WH", isDefault: true, isRepairStock: false }).returning();
  const [product] = await db.insert(productsTable).values({ companyId, name: "T04 Widget", sku: `T04-${randomUUID().slice(0, 8)}`, sellingPrice: "50", costPrice: "20", stock: 50, warehouseId: wh.id }).returning();
  productId = product.id;
  const [pm] = await db.insert(paymentMethodsTable).values({ companyId, name: "Cash", percentFee: "0", fixedFee: "0" }).returning();
  paymentMethodId = pm.id;
  const [user] = await db.insert(usersTable).values({ companyId, username: `t04-${randomUUID().slice(0, 8)}`, passwordHash: "unused" }).returning();
  tenant = { userId: user.id, companyId, role: "admin", branchId };
});

afterAll(async () => {
  await db.delete(salesTable).where(eq(salesTable.companyId, companyId));
  await db.delete(productsTable).where(eq(productsTable.companyId, companyId));
  await db.delete(paymentMethodsTable).where(eq(paymentMethodsTable.companyId, companyId));
  await db.delete(warehousesTable).where(eq(warehousesTable.companyId, companyId));
  await db.delete(branchesTable).where(eq(branchesTable.companyId, companyId));
  await db.delete(usersTable).where(eq(usersTable.companyId, companyId));
  await db.delete(subscriptionsTable).where(eq(subscriptionsTable.companyId, companyId));
  await db.delete(companiesTable).where(eq(companiesTable.id, companyId));
  await pool.end();
});

describe("T-04 branchId attribution", () => {
  it("sale created with a branchId-bearing tenant stores sales.branchId (from token, not body)", async () => {
    const sale = await createSale(tenant, {
      items: [{ productId, quantity: 1 }],
      payments: [{ paymentMethodId, amount: 50 }],
      // Intentionally NO branchId in the input: it must never come from the client.
    });
    const [row] = await db.select({ branchId: salesTable.branchId }).from(salesTable).where(eq(salesTable.id, sale.id)).limit(1);
    expect(row!.branchId).toBe(branchId);
  });

  it("sale with a legacy token (no branchId claim) still works and stores NULL branchId", async () => {
    const legacyTenant: TenantContext = { userId: tenant.userId, companyId, role: "admin" };
    const sale = await createSale(legacyTenant, {
      items: [{ productId, quantity: 1 }],
      payments: [{ paymentMethodId, amount: 50 }],
    });
    const [row] = await db.select({ branchId: salesTable.branchId }).from(salesTable).where(eq(salesTable.id, sale.id)).limit(1);
    expect(row!.branchId).toBeNull();
  });
});