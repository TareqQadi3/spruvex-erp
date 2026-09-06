import { describe, it, expect, afterAll } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  companiesTable,
  subscriptionsTable,
  usersTable,
  warehousesTable,
  productsTable,
  paymentMethodsTable,
  salesTable,
  saleItemsTable,
  salePaymentsTable,
  stockTable,
  stockMovementsTable,
  offlineQueueTable,
  syncLogsTable,
  auditLogsTable,
} from "@workspace/db";
import { pushOperations } from "./syncService";
import type { TenantContext } from "../../../shared/types/tenantContext";

interface Fixture {
  companyId: string;
  tenant: TenantContext;
  deviceId: string;
  productId: string;
  paymentMethodId: string;
  productStock: number;
}

async function createFixture(stockCount = 10): Promise<Fixture> {
  const companyId = randomUUID();
  await db.insert(companiesTable).values({ id: companyId, name: "vitest-offline-sync-co" });
  await db.insert(subscriptionsTable).values({ companyId, status: "active" });
  await db.insert(warehousesTable).values({ companyId, name: "Main", isRepairStock: false, isDefault: true });
  const [user] = await db
    .insert(usersTable)
    .values({ companyId, username: `vitest-os-${randomUUID().slice(0, 8)}`, passwordHash: "unused" })
    .returning();
  const tenant: TenantContext = { userId: user.id, companyId, role: "admin" };
  const [product] = await db
    .insert(productsTable)
    .values({
      companyId,
      name: "Test Widget",
      sku: `VITEST-OS-${randomUUID().slice(0, 8)}`,
      sellingPrice: "100.00",
      costPrice: "40.00",
      stock: stockCount,
    })
    .returning();
  const [method] = await db
    .insert(paymentMethodsTable)
    .values({ companyId, name: "Cash", percentFee: "0", fixedFee: "0" })
    .returning();
  const deviceId = `device-${randomUUID().slice(0, 8)}`;
  return { companyId, tenant, deviceId, productId: product.id, paymentMethodId: method.id, productStock: stockCount };
}

async function destroyFixture(companyId: string): Promise<void> {
  await db.delete(offlineQueueTable).where(eq(offlineQueueTable.companyId, companyId));
  await db.delete(syncLogsTable).where(eq(syncLogsTable.companyId, companyId));
  await db.delete(auditLogsTable).where(eq(auditLogsTable.companyId, companyId));
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
}

describe("offline sync (integration, real DB)", () => {
  afterAll(async () => {
    await pool.end();
  });

  it("1. offline sale is not lost", async () => {
    const fx = await createFixture();
    const { companyId, tenant, deviceId, productId, paymentMethodId } = fx;
    try {
      const offlineCgId = randomUUID();
      const pushCgId = randomUUID();
      const payload = {
        items: [{ productId, quantity: 1 }],
        payments: [{ paymentMethodId, amount: 100 }],
      };

      await db.insert(offlineQueueTable).values({
        companyId,
        deviceId,
        clientGeneratedId: offlineCgId,
        entityType: "sale",
        operationType: "create_sale" as const,
        payload,
        syncStatus: "pending",
        userId: tenant.userId,
      });

      const res = await pushOperations(tenant, {
        deviceId,
        operations: [{ clientGeneratedId: pushCgId, entityType: "sale", operationType: "create_sale", payload }],
      });

      expect(res.rejected).toHaveLength(0);
      expect(res.accepted).toHaveLength(1);
      expect(res.accepted[0].clientGeneratedId).toBe(pushCgId);
      expect(res.accepted[0].result).toBeTruthy();

      const sales = await db.select().from(salesTable).where(eq(salesTable.companyId, companyId));
      expect(sales).toHaveLength(1);

      const offlineRow = await db
        .select()
        .from(offlineQueueTable)
        .where(eq(offlineQueueTable.companyId, companyId))
        .orderBy(offlineQueueTable.createdAt);
      expect(offlineRow).toHaveLength(2);
      expect(offlineRow.find((r) => r.clientGeneratedId === offlineCgId)?.syncStatus).toBe("pending");
      expect(offlineRow.find((r) => r.clientGeneratedId === pushCgId)?.syncStatus).toBe("synced");
    } finally {
      await destroyFixture(companyId);
    }
  });

  it("2. reconnect does not duplicate", async () => {
    const fx = await createFixture();
    const { companyId, tenant, deviceId, productId, paymentMethodId } = fx;
    try {
      const cgId = randomUUID();
      const payload = {
        items: [{ productId, quantity: 1 }],
        payments: [{ paymentMethodId, amount: 100 }],
      };

      const first = await pushOperations(tenant, {
        deviceId,
        operations: [{ clientGeneratedId: cgId, entityType: "sale", operationType: "create_sale", payload }],
      });
      expect(first.rejected).toHaveLength(0);
      expect(first.accepted).toHaveLength(1);
      const saleId = (first.accepted[0].result as { id?: string }).id;
      expect(saleId).toBeTruthy();

      const second = await pushOperations(tenant, {
        deviceId,
        operations: [{ clientGeneratedId: cgId, entityType: "sale", operationType: "create_sale", payload }],
      });
      expect(second.rejected).toHaveLength(0);
      expect(second.accepted).toHaveLength(1);
      expect((second.accepted[0].result as { alreadyProcessed?: boolean }).alreadyProcessed).toBe(true);

      const sales = await db.select().from(salesTable).where(eq(salesTable.companyId, companyId));
      expect(sales).toHaveLength(1);
      expect(sales[0].id).toBe(saleId);

      const queueRows = await db
        .select()
        .from(offlineQueueTable)
        .where(eq(offlineQueueTable.companyId, companyId));
      expect(queueRows).toHaveLength(1);
      expect(queueRows[0].syncStatus).toBe("synced");
    } finally {
      await destroyFixture(companyId);
    }
  });

  it("3. a bad row does not fail the batch", async () => {
    const fx = await createFixture();
    const { companyId, tenant, deviceId, productId, paymentMethodId } = fx;
    try {
      const saleCgId = randomUUID();
      const paymentCgId = randomUUID();
      const salePayload = {
        items: [{ productId, quantity: 1 }],
        payments: [{ paymentMethodId, amount: 100 }],
      };
      const paymentPayload = {
        saleId: randomUUID(),
        paymentMethodId,
        amount: 100,
      };

      const res = await pushOperations(tenant, {
        deviceId,
        operations: [
          { clientGeneratedId: saleCgId, entityType: "sale", operationType: "create_sale", payload: salePayload },
          { clientGeneratedId: paymentCgId, entityType: "payment", operationType: "create_payment", payload: paymentPayload },
        ],
      });

      expect(res.accepted).toHaveLength(1);
      expect(res.accepted[0].operationType).toBe("create_sale");
      expect(res.accepted[0].result).toBeTruthy();
      expect(res.rejected).toHaveLength(1);
      expect(res.rejected[0].operationType).toBe("create_payment");
      expect(res.rejected[0].reason.toLowerCase()).toContain("not supported");

      const sales = await db.select().from(salesTable).where(eq(salesTable.companyId, companyId));
      expect(sales).toHaveLength(1);

      const queueRows = await db
        .select()
        .from(offlineQueueTable)
        .where(eq(offlineQueueTable.companyId, companyId));
      expect(queueRows).toHaveLength(2);
      const saleQueueRow = queueRows.find((r) => r.clientGeneratedId === saleCgId);
      expect(saleQueueRow?.syncStatus).toBe("synced");
      const paymentQueueRow = queueRows.find((r) => r.clientGeneratedId === paymentCgId);
      expect(paymentQueueRow?.syncStatus).toBe("failed");
      expect(paymentQueueRow?.errorMessage).toBeTruthy();
    } finally {
      await destroyFixture(companyId);
    }
  });

  it("4. stock is deducted exactly once across a reconnect", async () => {
    const fx = await createFixture(10);
    const { companyId, tenant, deviceId, productId, paymentMethodId } = fx;
    try {
      const cgId = randomUUID();
      const quantity = 2;
      const payload = {
        items: [{ productId, quantity }],
        payments: [{ paymentMethodId, amount: 200 }],
      };

      const first = await pushOperations(tenant, {
        deviceId,
        operations: [{ clientGeneratedId: cgId, entityType: "sale", operationType: "create_sale", payload }],
      });
      expect(first.rejected).toHaveLength(0);
      expect(first.accepted).toHaveLength(1);

      const second = await pushOperations(tenant, {
        deviceId,
        operations: [{ clientGeneratedId: cgId, entityType: "sale", operationType: "create_sale", payload }],
      });
      expect(second.rejected).toHaveLength(0);
      expect(second.accepted).toHaveLength(1);
      expect((second.accepted[0].result as { alreadyProcessed?: boolean }).alreadyProcessed).toBe(true);

      const [product] = await db
        .select({ stock: productsTable.stock })
        .from(productsTable)
        .where(eq(productsTable.id, productId));
      expect(product.stock).toBe(10 - quantity);

      const sales = await db.select().from(salesTable).where(eq(salesTable.companyId, companyId));
      expect(sales).toHaveLength(1);
    } finally {
      await destroyFixture(companyId);
    }
  });
});