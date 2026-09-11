import { db } from "@workspace/db";
import { gte, lte, eq } from "drizzle-orm";
import { salesTable } from "@workspace/db";
import { permissionResolver } from "../../rbac/services/permissionResolverService";
import { ensureUserRoleAssigned } from "../../rbac/services/userRoleSyncService";
import { reportRepository } from "../repositories/reportRepository";
import type { TenantContext } from "../../../shared/types/tenantContext";

// Owner/Manager-with-all-branches-permission see company-wide numbers;
// everyone else (including a Manager without it, per Phase 7 spec: "Manager
// يرى فرعه فقط") is silently pinned to their own current branch — a
// client-supplied branchId is never trusted to widen scope, only to narrow
// it further within what the caller is already allowed to see.
export async function resolveReportBranchFilter(tenant: TenantContext, requestedBranchId: string | undefined): Promise<string | undefined> {
  if (tenant.role === "admin") return requestedBranchId;
  await ensureUserRoleAssigned(tenant.companyId, tenant.userId, tenant.role);
  const permissions = await permissionResolver.resolve(tenant.companyId, tenant.userId);
  if (permissions.includes("reports.view_all_branches")) return requestedBranchId;
  return tenant.branchId;
}

export async function getInventoryValuation(companyId: string) {
  const rows = await reportRepository.inventoryValuation(db, companyId);
  const totalValue = rows.reduce((sum, r) => sum + Number(r.value), 0);
  return { totalValue, products: rows };
}

export async function getInventoryAlerts(companyId: string) {
  const alertDays = await reportRepository.getExpiryAlertDays(db, companyId);
  const lowStock = await reportRepository.lowStockProducts(db, companyId);

  const soon = new Date();
  soon.setDate(soon.getDate() + alertDays);
  const expiring = await reportRepository.expiringBatches(db, companyId, soon);

  const now = new Date();
  return {
    lowStock,
    expired: expiring.filter(e => e.expiryDate && e.expiryDate < now),
    expiringSoon: expiring.filter(e => e.expiryDate && e.expiryDate >= now),
    alertDays,
  };
}

export async function getDashboard(companyId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const {
    todaySalesData, openRepairsData, completedTodayData, lowStockResult, pendingData, todayExpensesData, activeCustomersData,
  } = await reportRepository.dashboardCounts(db, companyId, today, tomorrow);

  const recentSales = await reportRepository.recentSales(db, companyId, 5);
  const recentRepairs = await reportRepository.recentOpenRepairs(db, companyId, 5);

  return {
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
  };
}

export class MissingDateRangeError extends Error {}

export async function getSalesSummary(tenant: TenantContext, from: string | undefined, to: string | undefined, requestedBranchId: string | undefined) {
  if (!from || !to) throw new MissingDateRangeError("from and to are required");
  const branchFilter = await resolveReportBranchFilter(tenant, requestedBranchId);
  return reportRepository.salesSummaryByDay(db, tenant.companyId, new Date(from), new Date(to + "T23:59:59"), branchFilter);
}

export async function getTopProducts(tenant: TenantContext, limit: string | undefined, from: string | undefined, to: string | undefined, requestedBranchId: string | undefined) {
  const branchFilter = await resolveReportBranchFilter(tenant, requestedBranchId);
  return reportRepository.topProducts(
    db, tenant.companyId, Number(limit ?? "10"),
    from ? new Date(from) : undefined,
    to ? new Date(to + "T23:59:59") : undefined,
    branchFilter,
  );
}

export async function getRepairsSummary(companyId: string) {
  const rows = await reportRepository.repairsByStatus(db, companyId);
  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = row.count;
    total += row.count;
  }
  const revenueData = await reportRepository.repairsRevenue(db, companyId);
  return { total, byStatus, totalRevenue: revenueData.total, averageRepairTime: null };
}

export async function getProfit(tenant: TenantContext, from: string | undefined, to: string | undefined, requestedBranchId: string | undefined) {
  if (!from || !to) throw new MissingDateRangeError("from and to are required");

  const branchFilter = await resolveReportBranchFilter(tenant, requestedBranchId);
  const dateConditions = [
    gte(salesTable.createdAt, new Date(from)),
    lte(salesTable.createdAt, new Date(to + "T23:59:59")),
    eq(salesTable.status, "completed"),
    eq(salesTable.companyId, tenant.companyId),
    ...(branchFilter ? [eq(salesTable.branchId, branchFilter)] : []),
  ];

  const salesData = await reportRepository.profitSalesRevenue(db, dateConditions);
  const costData = await reportRepository.profitCostOfGoods(db, dateConditions);
  const expenseData = await reportRepository.profitExpenses(db, tenant.companyId, from, to);
  const repairData = await reportRepository.profitRepairs(db, tenant.companyId, new Date(from), new Date(to + "T23:59:59"));

  // pg returns numeric/sum() aggregates as strings, not JS numbers, despite
  // the `sql<number>` type annotations above (compile-time only, not a
  // runtime cast) — Number(...) here is load-bearing, not decorative.
  // Without it, `grossProfit + repairRevenue` silently does string
  // concatenation ("3150" + "0.00" -> "31500.00") whenever grossProfit
  // isn't already a real number, producing a wildly wrong netProfit.
  const revenue = Number(salesData.revenue);
  const costOfGoods = Number(costData?.cost ?? 0);
  const grossProfit = revenue - costOfGoods;
  const expenses = Number(expenseData?.total ?? 0);
  const repairRevenue = Number(repairData?.total ?? 0);
  const netProfit = grossProfit + repairRevenue - expenses;

  return { revenue, costOfGoods, grossProfit, expenses, repairRevenue, netProfit };
}
