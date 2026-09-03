// Performance baseline script for the POS sale path (T-09).
// Measures wall-clock latency of the real createSale + inventory deduction
// service path against the configured DATABASE_URL (same code the HTTP route
// calls), and prints a p50/p95/max summary. This is the backend half of the
// "<300ms POS response" target — the frontend/harness half needs a browser
// and is documented in the perf doc.
//
// Run from spruvex-app:  pnpm -C artifacts/api-server exec tsx benchmarks/measure-sale-latency.ts
import { randomUUID } from "node:crypto";
import {
  db,
  pool,
  companiesTable,
  subscriptionsTable,
  usersTable,
  productsTable,
  warehousesTable,
  paymentMethodsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { createSale } from "../src/modules/pos/services/saleService";
import type { TenantContext } from "../src/shared/types/tenantContext";

const N = Number(process.env.N || 30);

const companyId = randomUUID();

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

async function main() {
  await db.insert(companiesTable).values({ id: companyId, name: "perf baseline co" });
  await db.insert(subscriptionsTable).values({ companyId, status: "active" });
  await db.insert(warehousesTable).values({ companyId, name: "Main", isDefault: true, isRepairStock: false });
  const [user] = await db
    .insert(usersTable)
    .values({ companyId, username: `perf-${randomUUID().slice(0, 8)}`, passwordHash: "unused" })
    .returning();
  const tenant: TenantContext = { userId: user.id, companyId, role: "admin" };

  const [product] = await db
    .insert(productsTable)
    .values({
      companyId,
      name: "Perf Widget",
      sku: `PERF-${randomUUID().slice(0, 8)}`,
      sellingPrice: "50.00",
      costPrice: "20.00",
      stock: 100000,
    })
    .returning();
  const [pm] = await db
    .insert(paymentMethodsTable)
    .values({ companyId, name: "Cash", percentFee: "0", fixedFee: "0" })
    .returning();

  const latencies: number[] = [];
  for (let i = 0; i < N; i++) {
    const start = performance.now();
    await createSale(tenant, {
      items: [{ productId: product.id, quantity: 1 }],
      payments: [{ paymentMethodId: pm.id, amount: 50 }],
    });
    latencies.push(performance.now() - start);
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  console.log(`sale path latency over ${N} runs (ms):`);
  console.log(`  min  : ${sorted[0]?.toFixed(1)}`);
  console.log(`  p50  : ${percentile(sorted, 50).toFixed(1)}`);
  console.log(`  p95  : ${percentile(sorted, 95).toFixed(1)}`);
  console.log(`  max  : ${sorted[sorted.length - 1]?.toFixed(1)}`);
  console.log(`  mean : ${(sum / N).toFixed(1)}`);
  console.log(`target: <300ms p95 (declared POS target)`);

  // Cleanup.
  const { stockMovementsTable, stockTable, saleItemsTable, salePaymentsTable, salesTable } =
    await import("@workspace/db");
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
}

main().catch((err) => {
  console.error("benchmark failed", err);
  process.exit(1);
});
