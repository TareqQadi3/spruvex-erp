import { Router } from "express";
import { db, salesTable, repairsTable, productsTable, customersTable, expensesTable, saleItemsTable } from "@workspace/db";
import { eq, sql, and, gte, lte, desc } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

router.get("/dashboard", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todaySalesData] = await db.select({
    count: sql<number>`count(*)::int`,
    revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
  }).from(salesTable).where(and(gte(salesTable.createdAt, today), lte(salesTable.createdAt, tomorrow), eq(salesTable.status, "completed"), eq(salesTable.companyId, orgId)));

  const [openRepairsData] = await db.select({ count: sql<number>`count(*)::int` }).from(repairsTable)
    .where(and(sql`status NOT IN ('completed', 'delivered')`, eq(repairsTable.companyId, orgId)));

  const [completedTodayData] = await db.select({ count: sql<number>`count(*)::int` }).from(repairsTable)
    .where(and(eq(repairsTable.status, "completed"), gte(repairsTable.updatedAt, today), eq(repairsTable.companyId, orgId)));

  const lowStockResult = await db.select({ count: sql<number>`count(*)::int` }).from(productsTable)
    .where(and(lte(productsTable.stock, productsTable.lowStockThreshold), eq(productsTable.companyId, orgId)));

  const [pendingData] = await db.select({ count: sql<number>`count(*)::int` }).from(repairsTable)
    .where(and(eq(repairsTable.status, "received"), eq(repairsTable.companyId, orgId)));

  const [todayExpensesData] = await db.select({ total: sql<number>`coalesce(sum(amount::numeric), 0)` }).from(expensesTable)
    .where(and(gte(expensesTable.date, today.toISOString().split("T")[0]), eq(expensesTable.companyId, orgId)));

  const [activeCustomersData] = await db.select({ count: sql<number>`count(distinct customer_id)::int` }).from(salesTable)
    .where(and(gte(salesTable.createdAt, new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)), eq(salesTable.companyId, orgId)));

  const recentSales = await db
    .select({
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
    .where(eq(salesTable.companyId, orgId))
    .orderBy(desc(salesTable.createdAt))
    .limit(5);

  const recentRepairs = await db
    .select({
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
    .where(and(sql`${repairsTable.status} NOT IN ('completed', 'delivered')`, eq(repairsTable.companyId, orgId)))
    .orderBy(desc(repairsTable.createdAt))
    .limit(5);

  res.json({
    todaySales: todaySalesData.count,
    todayRevenue: todaySalesData.revenue,
    openRepairs: openRepairsData.count,
    lowStockCount: lowStockResult[0]?.count ?? 0,
    pendingRepairs: pendingData.count,
    completedRepairsToday: completedTodayData.count,
    todayExpenses: todayExpensesData.total,
    activeCustomers: activeCustomersData.count,
    recentSales,
    recentRepairs,
  });
});

router.get("/sales-summary", async (req: AuthedRequest, res) => {
  const { from, to } = req.query;
  if (!from || !to) {
    res.status(400).json({ error: "from and to are required" });
    return;
  }

  const rows = await db.select({
    date: sql<string>`date_trunc('day', created_at)::date::text`,
    totalSales: sql<number>`count(*)::int`,
    totalRevenue: sql<number>`coalesce(sum(total::numeric), 0)`,
    totalProfit: sql<number>`coalesce(sum(total::numeric - subtotal::numeric + discount::numeric), 0)`,
  }).from(salesTable)
    .where(and(
      gte(salesTable.createdAt, new Date(from as string)),
      lte(salesTable.createdAt, new Date(to as string + "T23:59:59")),
      eq(salesTable.status, "completed"),
      eq(salesTable.companyId, req.user!.companyId),
    ))
    .groupBy(sql`date_trunc('day', created_at)::date`)
    .orderBy(sql`date_trunc('day', created_at)::date`);
  res.json(rows);
});

router.get("/top-products", async (req: AuthedRequest, res) => {
  const { limit = "10", from, to } = req.query;
  const conditions = [eq(salesTable.status, "completed"), eq(salesTable.companyId, req.user!.companyId)];
  if (from) conditions.push(gte(salesTable.createdAt, new Date(from as string)));
  if (to) conditions.push(lte(salesTable.createdAt, new Date(to as string + "T23:59:59")));

  const rows = await db
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
    .limit(Number(limit));
  res.json(rows);
});

router.get("/repairs-summary", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const rows = await db.select({
    status: repairsTable.status,
    count: sql<number>`count(*)::int`,
  }).from(repairsTable).where(eq(repairsTable.companyId, orgId)).groupBy(repairsTable.status);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = row.count;
    total += row.count;
  }

  const [revenueData] = await db.select({
    total: sql<number>`coalesce(sum(repair_cost::numeric), 0)`,
  }).from(repairsTable).where(and(sql`status IN ('completed', 'delivered')`, eq(repairsTable.companyId, orgId)));

  res.json({ total, byStatus, totalRevenue: revenueData.total, averageRepairTime: null });
});

router.get("/profit", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const { from, to } = req.query;
  if (!from || !to) {
    res.status(400).json({ error: "from and to are required" });
    return;
  }

  const dateConditions = [
    gte(salesTable.createdAt, new Date(from as string)),
    lte(salesTable.createdAt, new Date(to as string + "T23:59:59")),
    eq(salesTable.status, "completed"),
    eq(salesTable.companyId, orgId),
  ];

  const [salesData] = await db.select({
    revenue: sql<number>`coalesce(sum(total::numeric), 0)`,
  }).from(salesTable).where(and(...dateConditions));

  const costData = await db.select({
    cost: sql<number>`coalesce(sum(${saleItemsTable.quantity} * ${productsTable.costPrice}::numeric), 0)`,
  }).from(saleItemsTable).innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .innerJoin(productsTable, eq(saleItemsTable.productId, productsTable.id))
    .where(and(...dateConditions));

  const expenseData = await db.select({
    total: sql<number>`coalesce(sum(amount::numeric), 0)`,
  }).from(expensesTable).where(and(
    gte(expensesTable.date, from as string),
    lte(expensesTable.date, to as string),
    eq(expensesTable.companyId, orgId),
  ));

  const repairData = await db.select({
    total: sql<number>`coalesce(sum(repair_cost::numeric), 0)`,
  }).from(repairsTable).where(and(
    gte(repairsTable.createdAt, new Date(from as string)),
    lte(repairsTable.createdAt, new Date(to as string + "T23:59:59")),
    sql`status IN ('completed', 'delivered')`,
    eq(repairsTable.companyId, orgId),
  ));

  const revenue = salesData.revenue;
  const costOfGoods = costData[0]?.cost ?? 0;
  const grossProfit = revenue - costOfGoods;
  const expenses = expenseData[0]?.total ?? 0;
  const repairRevenue = repairData[0]?.total ?? 0;
  const netProfit = grossProfit + repairRevenue - expenses;

  res.json({ revenue, costOfGoods, grossProfit, expenses, repairRevenue, netProfit });
});

export default router;
