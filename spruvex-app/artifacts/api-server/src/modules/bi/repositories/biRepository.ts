import { and, desc, asc, eq, gte, lte, sql } from "drizzle-orm";
import {
  salesTable,
  saleItemsTable,
  productsTable,
  customersTable,
  expensesTable,
  branchesTable,
  usersTable,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

// All functions here are companyId-scoped and take an explicit inclusive
// [from, to] Date range — the caller (route handler or the AI assistant
// module) decides the window; nothing here hardcodes "last N days".

function toDateString(d: Date): string {
  return d.toISOString().split("T")[0];
}

function salesDateRange(companyId: string, from: Date, to: Date) {
  return withTenantScope(
    salesTable.companyId,
    companyId,
    and(gte(salesTable.createdAt, from), lte(salesTable.createdAt, to), eq(salesTable.status, "completed")),
  );
}

// --- Sales / profit summary --------------------------------------------------

export interface SalesProfitSummary {
  revenue: number;
  costOfGoods: number;
  grossProfit: number;
  expenses: number;
  netProfit: number;
  salesCount: number;
}

export async function getSalesProfitSummary(
  companyId: string,
  from: Date,
  to: Date,
  client: DbOrTx = db,
): Promise<SalesProfitSummary> {
  const [salesData] = await client
    .select({
      revenue: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      salesCount: sql<number>`count(*)::int`,
    })
    .from(salesTable)
    .where(salesDateRange(companyId, from, to));

  const [costData] = await client
    .select({
      cost: sql<number>`coalesce(sum(${saleItemsTable.quantity} * ${productsTable.costPrice}::numeric), 0)`,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(salesDateRange(companyId, from, to));

  const [expenseData] = await client
    .select({
      total: sql<number>`coalesce(sum(${expensesTable.amount}::numeric), 0)`,
    })
    .from(expensesTable)
    .where(
      withTenantScope(
        expensesTable.companyId,
        companyId,
        and(gte(expensesTable.date, toDateString(from)), lte(expensesTable.date, toDateString(to))),
      ),
    );

  const revenue = Number(salesData?.revenue ?? 0);
  const costOfGoods = Number(costData?.cost ?? 0);
  const grossProfit = revenue - costOfGoods;
  const expenses = Number(expenseData?.total ?? 0);
  const netProfit = grossProfit - expenses;

  return {
    revenue,
    costOfGoods,
    grossProfit,
    expenses,
    netProfit,
    salesCount: Number(salesData?.salesCount ?? 0),
  };
}

// --- Sales trend --------------------------------------------------------------

export interface TrendPoint {
  date: string;
  revenue: number;
  salesCount: number;
  profit: number;
}

export async function getSalesTrend(
  companyId: string,
  from: Date,
  to: Date,
  client: DbOrTx = db,
): Promise<TrendPoint[]> {
  // Revenue/count and cost-of-goods are two separate grouped queries (like
  // getSalesProfitSummary) rather than one query joined to saleItems: joining
  // sales to saleItems here would multiply each sale's revenue by its
  // line-item count before the per-day sum, double-counting revenue for any
  // multi-item sale.
  const salesRows = await client
    .select({
      date: sql<string>`date_trunc('day', ${salesTable.createdAt})::date::text`,
      revenue: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      salesCount: sql<number>`count(*)::int`,
    })
    .from(salesTable)
    .where(salesDateRange(companyId, from, to))
    .groupBy(sql`date_trunc('day', ${salesTable.createdAt})::date`)
    .orderBy(sql`date_trunc('day', ${salesTable.createdAt})::date`);

  const costRows = await client
    .select({
      date: sql<string>`date_trunc('day', ${salesTable.createdAt})::date::text`,
      cost: sql<number>`coalesce(sum(${saleItemsTable.quantity} * ${productsTable.costPrice}::numeric), 0)`,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(salesDateRange(companyId, from, to))
    .groupBy(sql`date_trunc('day', ${salesTable.createdAt})::date`);

  const costByDate = new Map(costRows.map((r) => [r.date, Number(r.cost)]));

  return salesRows.map((r) => ({
    date: r.date,
    revenue: Number(r.revenue),
    salesCount: Number(r.salesCount),
    profit: Number(r.revenue) - (costByDate.get(r.date) ?? 0),
  }));
}

// --- Product performance -------------------------------------------------------

export interface ProductPerformance {
  productId: string;
  productName: string;
  quantitySold: number;
  revenue: number;
  profit: number;
}

async function getProductPerformance(
  companyId: string,
  from: Date,
  to: Date,
  limit: number,
  order: "asc" | "desc",
  client: DbOrTx,
): Promise<ProductPerformance[]> {
  const quantitySoldExpr = sql<number>`sum(${saleItemsTable.quantity})::int`;
  const revenueExpr = sql<number>`coalesce(sum(${saleItemsTable.subtotal}::numeric), 0)`;
  const profitExpr = sql<number>`coalesce(sum(${saleItemsTable.subtotal}::numeric - (${saleItemsTable.quantity} * ${productsTable.costPrice}::numeric)), 0)`;

  const rows = await client
    .select({
      productId: saleItemsTable.productId,
      productName: saleItemsTable.productName,
      quantitySold: quantitySoldExpr,
      revenue: revenueExpr,
      profit: profitExpr,
    })
    .from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(salesDateRange(companyId, from, to))
    .groupBy(saleItemsTable.productId, saleItemsTable.productName)
    .orderBy(order === "desc" ? desc(sql`sum(${saleItemsTable.quantity})`) : asc(sql`sum(${saleItemsTable.quantity})`))
    .limit(limit);

  return rows.map((r) => ({
    productId: r.productId,
    productName: r.productName,
    quantitySold: Number(r.quantitySold),
    revenue: Number(r.revenue),
    profit: Number(r.profit),
  }));
}

export async function getTopProducts(
  companyId: string,
  from: Date,
  to: Date,
  limit: number,
  client: DbOrTx = db,
): Promise<ProductPerformance[]> {
  return getProductPerformance(companyId, from, to, limit, "desc", client);
}

export async function getWorstProducts(
  companyId: string,
  from: Date,
  to: Date,
  limit: number,
  client: DbOrTx = db,
): Promise<ProductPerformance[]> {
  return getProductPerformance(companyId, from, to, limit, "asc", client);
}

// --- Low stock ------------------------------------------------------------------

export interface LowStockProduct {
  productId: string;
  name: string;
  sku: string | null;
  stock: number;
  lowStockThreshold: number;
}

export async function getLowStockProducts(
  companyId: string,
  limit: number,
  client: DbOrTx = db,
): Promise<LowStockProduct[]> {
  const rows = await client
    .select({
      productId: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      stock: productsTable.stock,
      lowStockThreshold: productsTable.lowStockThreshold,
    })
    .from(productsTable)
    .where(
      withTenantScope(productsTable.companyId, companyId, lte(productsTable.stock, productsTable.lowStockThreshold)),
    )
    .orderBy(asc(sql`${productsTable.stock} - ${productsTable.lowStockThreshold}`))
    .limit(limit);

  return rows.map((r) => ({
    productId: r.productId,
    name: r.name,
    sku: r.sku,
    stock: Number(r.stock),
    lowStockThreshold: Number(r.lowStockThreshold),
  }));
}

// --- Customer performance ---------------------------------------------------------

export interface CustomerPerformance {
  customerId: string;
  name: string;
  totalSpent: number;
  orderCount: number;
}

export async function getTopCustomers(
  companyId: string,
  from: Date,
  to: Date,
  limit: number,
  client: DbOrTx = db,
): Promise<CustomerPerformance[]> {
  const rows = await client
    .select({
      customerId: salesTable.customerId,
      name: customersTable.name,
      totalSpent: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      orderCount: sql<number>`count(*)::int`,
    })
    .from(salesTable)
    .innerJoin(customersTable, eq(salesTable.customerId, customersTable.id))
    .where(
      withTenantScope(
        salesTable.companyId,
        companyId,
        and(
          gte(salesTable.createdAt, from),
          lte(salesTable.createdAt, to),
          eq(salesTable.status, "completed"),
          sql`${salesTable.customerId} is not null`,
        ),
      ),
    )
    .groupBy(salesTable.customerId, customersTable.name)
    .orderBy(desc(sql`sum(${salesTable.total}::numeric)`))
    .limit(limit);

  return rows
    .filter((r): r is typeof r & { customerId: string } => r.customerId !== null)
    .map((r) => ({
      customerId: r.customerId,
      name: r.name,
      totalSpent: Number(r.totalSpent),
      orderCount: Number(r.orderCount),
    }));
}

// --- Branch performance -------------------------------------------------------

export interface BranchPerformance {
  branchId: string | null;
  branchName: string;
  revenue: number;
  salesCount: number;
}

export async function getBranchPerformance(
  companyId: string,
  from: Date,
  to: Date,
  client: DbOrTx = db,
): Promise<BranchPerformance[]> {
  const rows = await client
    .select({
      branchId: salesTable.branchId,
      branchName: branchesTable.name,
      revenue: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      salesCount: sql<number>`count(*)::int`,
    })
    .from(salesTable)
    .leftJoin(branchesTable, eq(salesTable.branchId, branchesTable.id))
    .where(salesDateRange(companyId, from, to))
    .groupBy(salesTable.branchId, branchesTable.name)
    .orderBy(desc(sql`sum(${salesTable.total}::numeric)`));

  return rows.map((r) => ({
    branchId: r.branchId,
    branchName: r.branchId === null ? "غير مصنّف" : (r.branchName ?? "غير مصنّف"),
    revenue: Number(r.revenue),
    salesCount: Number(r.salesCount),
  }));
}

// --- User performance -----------------------------------------------------------

export interface UserPerformance {
  userId: string | null;
  username: string;
  revenue: number;
  salesCount: number;
}

export async function getUserPerformance(
  companyId: string,
  from: Date,
  to: Date,
  client: DbOrTx = db,
): Promise<UserPerformance[]> {
  const rows = await client
    .select({
      userId: salesTable.createdByUserId,
      username: usersTable.username,
      revenue: sql<number>`coalesce(sum(${salesTable.total}::numeric), 0)`,
      salesCount: sql<number>`count(*)::int`,
    })
    .from(salesTable)
    .leftJoin(usersTable, eq(salesTable.createdByUserId, usersTable.id))
    .where(salesDateRange(companyId, from, to))
    .groupBy(salesTable.createdByUserId, usersTable.username)
    .orderBy(desc(sql`sum(${salesTable.total}::numeric)`));

  return rows.map((r) => ({
    userId: r.userId,
    username: r.userId === null ? "غير معروف" : (r.username ?? "غير معروف"),
    revenue: Number(r.revenue),
    salesCount: Number(r.salesCount),
  }));
}

// --- Expenses breakdown ----------------------------------------------------------

export interface ExpenseBreakdown {
  category: string;
  total: number;
}

export async function getExpensesBreakdown(
  companyId: string,
  from: Date,
  to: Date,
  client: DbOrTx = db,
): Promise<ExpenseBreakdown[]> {
  const rows = await client
    .select({
      category: expensesTable.category,
      total: sql<number>`coalesce(sum(${expensesTable.amount}::numeric), 0)`,
    })
    .from(expensesTable)
    .where(
      withTenantScope(
        expensesTable.companyId,
        companyId,
        and(gte(expensesTable.date, toDateString(from)), lte(expensesTable.date, toDateString(to))),
      ),
    )
    .groupBy(expensesTable.category)
    .orderBy(desc(sql`sum(${expensesTable.amount}::numeric)`));

  return rows.map((r) => ({ category: r.category, total: Number(r.total) }));
}

// --- Cashflow summary -------------------------------------------------------------

export interface CashflowSummary {
  income: number;
  expenses: number;
  net: number;
}

export async function getCashflowSummary(
  companyId: string,
  from: Date,
  to: Date,
  client: DbOrTx = db,
): Promise<CashflowSummary> {
  const [incomeData] = await client
    .select({
      income: sql<number>`coalesce(sum(${salesTable.amountPaid}::numeric), 0)`,
    })
    .from(salesTable)
    .where(salesDateRange(companyId, from, to));

  const [expenseData] = await client
    .select({
      total: sql<number>`coalesce(sum(${expensesTable.amount}::numeric), 0)`,
    })
    .from(expensesTable)
    .where(
      withTenantScope(
        expensesTable.companyId,
        companyId,
        and(gte(expensesTable.date, toDateString(from)), lte(expensesTable.date, toDateString(to))),
      ),
    );

  const income = Number(incomeData?.income ?? 0);
  const expenses = Number(expenseData?.total ?? 0);

  return { income, expenses, net: income - expenses };
}
