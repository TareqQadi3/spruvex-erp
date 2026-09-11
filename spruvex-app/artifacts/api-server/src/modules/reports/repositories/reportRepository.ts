import { eq, sql, and, gte, lte, desc, lt, type SQL } from "drizzle-orm";
import { salesTable, repairsTable, productsTable, customersTable, expensesTable, saleItemsTable, productBatchesTable, settingsTable } from "@workspace/db";
import type { DbClient } from "../../accounting/types";

export const reportRepository = {
  // Foundation for Phase 4 item 6 (Stock Valuation) — total cost-basis value of
  // on-hand stock, company-wide and per product. No weighted-average-cost
  // tracking yet (every unit of a product uses its current costPrice); that
  // refinement needs purchase-price history and is left for a later pass.
  async inventoryValuation(db: DbClient, companyId: string) {
    return db.select({
      productId: productsTable.id,
      name: productsTable.name,
      sku: productsTable.sku,
      stock: productsTable.stock,
      costPrice: productsTable.costPrice,
      value: sql<string>`(${productsTable.stock} * ${productsTable.costPrice})::numeric(14,2)`,
    }).from(productsTable).where(eq(productsTable.companyId, companyId));
  },

  async getExpiryAlertDays(db: DbClient, companyId: string): Promise<number> {
    const [settings] = await db.select().from(settingsTable).where(eq(settingsTable.companyId, companyId)).limit(1);
    return settings?.expiryAlertDays ?? 7;
  },

  async lowStockProducts(db: DbClient, companyId: string) {
    return db.select({
      id: productsTable.id, name: productsTable.name, sku: productsTable.sku,
      stock: productsTable.stock, lowStockThreshold: productsTable.lowStockThreshold,
    }).from(productsTable)
      .where(and(eq(productsTable.companyId, companyId), lte(productsTable.stock, productsTable.lowStockThreshold)));
  },

  async expiringBatches(db: DbClient, companyId: string, before: Date) {
    return db.select({
      id: productBatchesTable.id, productId: productBatchesTable.productId,
      batchNumber: productBatchesTable.batchNumber, quantity: productBatchesTable.quantity,
      expiryDate: productBatchesTable.expiryDate, productName: productsTable.name,
    }).from(productBatchesTable)
      .innerJoin(productsTable, eq(productBatchesTable.productId, productsTable.id))
      .where(and(eq(productBatchesTable.companyId, companyId), lt(productBatchesTable.expiryDate, before)))
      .orderBy(productBatchesTable.expiryDate);
  },

  async dashboardCounts(db: DbClient, companyId: string, today: Date, tomorrow: Date) {
    const [todaySalesData] = await db.select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
    }).from(salesTable).where(and(gte(salesTable.createdAt, today), lte(salesTable.createdAt, tomorrow), eq(salesTable.status, "completed"), eq(salesTable.companyId, companyId)));

    const [openRepairsData] = await db.select({ count: sql<number>`count(*)::int` }).from(repairsTable)
      .where(and(sql`status NOT IN ('completed', 'delivered')`, eq(repairsTable.companyId, companyId)));

    const [completedTodayData] = await db.select({ count: sql<number>`count(*)::int` }).from(repairsTable)
      .where(and(eq(repairsTable.status, "completed"), gte(repairsTable.updatedAt, today), eq(repairsTable.companyId, companyId)));

    const lowStockResult = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable)
      .where(and(lte(productsTable.stock, productsTable.lowStockThreshold), eq(productsTable.companyId, companyId)));

    const [pendingData] = await db.select({ count: sql<number>`count(*)::int` }).from(repairsTable)
      .where(and(eq(repairsTable.status, "received"), eq(repairsTable.companyId, companyId)));

    const [todayExpensesData] = await db.select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(expensesTable)
      .where(and(gte(expensesTable.date, today.toISOString().split("T")[0]), eq(expensesTable.companyId, companyId)));

    const [activeCustomersData] = await db.select({ count: sql<number>`count(distinct customer_id)::int` }).from(salesTable)
      .where(and(gte(salesTable.createdAt, new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)), eq(salesTable.companyId, companyId)));

    return { todaySalesData, openRepairsData, completedTodayData, lowStockResult, pendingData, todayExpensesData, activeCustomersData };
  },

  async recentSales(db: DbClient, companyId: string, limit: number) {
    return db.select({
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
    })
      .from(salesTable)
      .leftJoin(customersTable, eq(salesTable.customerId, customersTable.id))
      .where(eq(salesTable.companyId, companyId))
      .orderBy(desc(salesTable.createdAt))
      .limit(limit);
  },

  async recentOpenRepairs(db: DbClient, companyId: string, limit: number) {
    return db.select({
      id: repairsTable.id,
      ticketNumber: repairsTable.ticketNumber,
      customerId: repairsTable.customerId,
      customerName: customersTable.name,
      customerPhone: customersTable.phone,
      deviceType: repairsTable.deviceType,
      deviceBrand: repairsTable.deviceBrand,
      deviceModel: repairsTable.deviceModel,
      imei: repairsTable.imei,
      problemDescription: repairsTable.problemDescription,
      technicianNotes: repairsTable.technicianNotes,
      status: repairsTable.status,
      repairCost: repairsTable.repairCost,
      estimatedCost: repairsTable.estimatedCost,
      isPaid: repairsTable.isPaid,
      createdAt: repairsTable.createdAt,
      updatedAt: repairsTable.updatedAt,
    })
      .from(repairsTable)
      .leftJoin(customersTable, eq(repairsTable.customerId, customersTable.id))
      .where(and(sql`${repairsTable.status} NOT IN ('completed', 'delivered')`, eq(repairsTable.companyId, companyId)))
      .orderBy(desc(repairsTable.createdAt))
      .limit(limit);
  },

  async salesSummaryByDay(db: DbClient, companyId: string, from: Date, to: Date, branchId?: string) {
    return db.select({
      date: sql<string>`date_trunc('day', created_at)::date::text`,
      totalSales: sql<number>`count(*)::int`,
      totalRevenue: sql<number>`coalesce(sum(total::numeric), 0)`,
      totalProfit: sql<number>`coalesce(sum(total::numeric - subtotal::numeric + discount::numeric), 0)`,
    }).from(salesTable)
      .where(and(
        gte(salesTable.createdAt, from),
        lte(salesTable.createdAt, to),
        eq(salesTable.status, "completed"),
        eq(salesTable.companyId, companyId),
        ...(branchId ? [eq(salesTable.branchId, branchId)] : []),
      ))
      .groupBy(sql`date_trunc('day', created_at)::date`)
      .orderBy(sql`date_trunc('day', created_at)::date`);
  },

  async topProducts(db: DbClient, companyId: string, limit: number, from?: Date, to?: Date, branchId?: string) {
    const conditions = [eq(salesTable.status, "completed"), eq(salesTable.companyId, companyId)];
    if (from) conditions.push(gte(salesTable.createdAt, from));
    if (to) conditions.push(lte(salesTable.createdAt, to));
    if (branchId) conditions.push(eq(salesTable.branchId, branchId));

    return db
      .select({
        productId: saleItemsTable.productId,
        productName: saleItemsTable.productName,
        totalQuantity: sql<number>`sum(${saleItemsTable.quantity})::int`,
        totalRevenue: sql<number>`coalesce(sum(${saleItemsTable.subtotal}::numeric), 0)`,
        totalProfit: sql<number>`coalesce(sum(${saleItemsTable.subtotal}::numeric), 0)`,
      })
      .from(saleItemsTable)
      .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
      .where(and(...conditions))
      .groupBy(saleItemsTable.productId, saleItemsTable.productName)
      .orderBy(desc(sql`sum(${saleItemsTable.quantity})`))
      .limit(limit);
  },

  async repairsByStatus(db: DbClient, companyId: string) {
    return db.select({
      status: repairsTable.status,
      count: sql<number>`count(*)::int`,
    }).from(repairsTable).where(eq(repairsTable.companyId, companyId)).groupBy(repairsTable.status);
  },

  async repairsRevenue(db: DbClient, companyId: string) {
    const [revenueData] = await db.select({
      total: sql<number>`coalesce(sum(repair_cost::numeric), 0)`,
    }).from(repairsTable).where(and(sql`status IN ('completed', 'delivered')`, eq(repairsTable.companyId, companyId)));
    return revenueData;
  },

  async profitSalesRevenue(db: DbClient, dateConditions: SQL[]) {
    const [salesData] = await db.select({
      revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
    }).from(salesTable).where(and(...dateConditions));
    return salesData;
  },

  async profitCostOfGoods(db: DbClient, dateConditions: SQL[]) {
    const costData = await db.select({
      cost: sql<number>`coalesce(sum(${saleItemsTable.quantity} * ${productsTable.costPrice}::numeric), 0)`,
    }).from(saleItemsTable).innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
      .innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
      .where(and(...dateConditions));
    return costData[0];
  },

  async profitExpenses(db: DbClient, companyId: string, from: string, to: string) {
    const expenseData = await db.select({
      total: sql<number>`coalesce(sum(amount::numeric), 0)`,
    }).from(expensesTable).where(and(
      gte(expensesTable.date, from),
      lte(expensesTable.date, to),
      eq(expensesTable.companyId, companyId),
    ));
    return expenseData[0];
  },

  async profitRepairs(db: DbClient, companyId: string, from: Date, to: Date) {
    const repairData = await db.select({
      total: sql<number>`coalesce(sum(repair_cost::numeric), 0)`,
    }).from(repairsTable).where(and(
      gte(repairsTable.createdAt, from),
      lte(repairsTable.createdAt, to),
      sql`status IN ('completed', 'delivered')`,
      eq(repairsTable.companyId, companyId),
    ));
    return repairData[0];
  },
};
