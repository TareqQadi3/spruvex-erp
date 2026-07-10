// Thin pass-through layer over biRepository, mirroring modules/ai's
// repository/service split. No business logic lives here beyond delegating
// to the repository — date-range defaulting stays in the route handlers
// (or the caller, for the AI assistant module) per the "caller controls the
// window" rule.

import * as biRepository from "../repositories/biRepository";
import type {
  SalesProfitSummary,
  TrendPoint,
  ProductPerformance,
  LowStockProduct,
  CustomerPerformance,
  BranchPerformance,
  UserPerformance,
  ExpenseBreakdown,
  CashflowSummary,
} from "../repositories/biRepository";

export type {
  SalesProfitSummary,
  TrendPoint,
  ProductPerformance,
  LowStockProduct,
  CustomerPerformance,
  BranchPerformance,
  UserPerformance,
  ExpenseBreakdown,
  CashflowSummary,
};

export async function getSalesProfitSummary(companyId: string, from: Date, to: Date): Promise<SalesProfitSummary> {
  return biRepository.getSalesProfitSummary(companyId, from, to);
}

export async function getSalesTrend(companyId: string, from: Date, to: Date): Promise<TrendPoint[]> {
  return biRepository.getSalesTrend(companyId, from, to);
}

export async function getTopProducts(
  companyId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<ProductPerformance[]> {
  return biRepository.getTopProducts(companyId, from, to, limit);
}

export async function getWorstProducts(
  companyId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<ProductPerformance[]> {
  return biRepository.getWorstProducts(companyId, from, to, limit);
}

export async function getLowStockProducts(companyId: string, limit: number): Promise<LowStockProduct[]> {
  return biRepository.getLowStockProducts(companyId, limit);
}

export async function getTopCustomers(
  companyId: string,
  from: Date,
  to: Date,
  limit: number,
): Promise<CustomerPerformance[]> {
  return biRepository.getTopCustomers(companyId, from, to, limit);
}

export async function getBranchPerformance(companyId: string, from: Date, to: Date): Promise<BranchPerformance[]> {
  return biRepository.getBranchPerformance(companyId, from, to);
}

export async function getUserPerformance(companyId: string, from: Date, to: Date): Promise<UserPerformance[]> {
  return biRepository.getUserPerformance(companyId, from, to);
}

export async function getExpensesBreakdown(companyId: string, from: Date, to: Date): Promise<ExpenseBreakdown[]> {
  return biRepository.getExpensesBreakdown(companyId, from, to);
}

export async function getCashflowSummary(companyId: string, from: Date, to: Date): Promise<CashflowSummary> {
  return biRepository.getCashflowSummary(companyId, from, to);
}
