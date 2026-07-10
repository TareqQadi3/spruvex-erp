import type {
  CashflowSummary,
  LowStockProduct,
  ProductPerformance,
  SalesProfitSummary,
} from "../../bi/services/biService";

// Every number here comes straight from modules/bi's SQL aggregations — this
// file only does arithmetic ON already-real numbers (percent deltas, reorder
// heuristics) and picks real frontend routes for deep links. It never
// fabricates a figure, and nothing it produces is sent to an AI provider
// except what the caller explicitly chooses to put in a prompt (see
// aiService.businessSummary) — this module has no knowledge of AI providers
// at all.

export type AlertType = "low_stock" | "revenue_drop" | "revenue_spike" | "expense_spike";
export type AlertSeverity = "info" | "warning" | "critical";

export interface BusinessAlert {
  type: AlertType;
  severity: AlertSeverity;
  messageAr: string;
  messageEn: string;
  link: string;
}

export interface AnomalyFinding {
  metric: "revenue" | "expenses" | "salesCount";
  currentValue: number;
  previousValue: number;
  changePercent: number;
  direction: "up" | "down";
}

export interface ReorderSuggestion {
  productId: string;
  productName: string;
  currentStock: number;
  lowStockThreshold: number;
  suggestedQuantity: number;
}

const ANOMALY_THRESHOLD_PERCENT = 20;

function percentChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null; // undefined % change from a zero base — skip rather than report "Infinity%"
  return ((current - previous) / previous) * 100;
}

// Pure comparison of two already-computed periods — no query, no model call.
export function detectAnomalies(current: SalesProfitSummary, previous: SalesProfitSummary): AnomalyFinding[] {
  const findings: AnomalyFinding[] = [];
  const metrics: Array<{ key: AnomalyFinding["metric"]; current: number; previous: number }> = [
    { key: "revenue", current: current.revenue, previous: previous.revenue },
    { key: "expenses", current: current.expenses, previous: previous.expenses },
    { key: "salesCount", current: current.salesCount, previous: previous.salesCount },
  ];
  for (const m of metrics) {
    const change = percentChange(m.current, m.previous);
    if (change === null || Math.abs(change) < ANOMALY_THRESHOLD_PERCENT) continue;
    findings.push({
      metric: m.key,
      currentValue: m.current,
      previousValue: m.previous,
      changePercent: Math.round(change * 10) / 10,
      direction: change >= 0 ? "up" : "down",
    });
  }
  return findings;
}

// suggestedQuantity is a simple, transparent heuristic (top up to double the
// reorder threshold, or the threshold itself if that's larger) — not a
// demand-forecasting model. Good enough to turn "8 products are low" into a
// concrete number a purchaser can act on without pretending to be smarter
// than the data supports.
export function buildReorderSuggestions(lowStock: LowStockProduct[]): ReorderSuggestion[] {
  return lowStock.map((p) => ({
    productId: p.productId,
    productName: p.name,
    currentStock: p.stock,
    lowStockThreshold: p.lowStockThreshold,
    suggestedQuantity: Math.max(p.lowStockThreshold * 2 - p.stock, p.lowStockThreshold, 1),
  }));
}

export function buildAlerts(
  anomalies: AnomalyFinding[],
  lowStock: LowStockProduct[],
  language: "ar" | "en",
): BusinessAlert[] {
  const alerts: BusinessAlert[] = [];

  if (lowStock.length > 0) {
    alerts.push({
      type: "low_stock",
      severity: lowStock.length >= 5 ? "critical" : "warning",
      messageAr: `${lowStock.length} منتج${lowStock.length > 1 ? "ات" : ""} وصل${lowStock.length > 1 ? "ت" : ""} إلى حد إعادة الطلب أو أقل.`,
      messageEn: `${lowStock.length} product${lowStock.length > 1 ? "s are" : " is"} at or below the reorder threshold.`,
      link: "/inventory",
    });
  }

  const revenueAnomaly = anomalies.find((a) => a.metric === "revenue");
  if (revenueAnomaly) {
    const type: AlertType = revenueAnomaly.direction === "down" ? "revenue_drop" : "revenue_spike";
    alerts.push({
      type,
      severity: revenueAnomaly.direction === "down" ? "warning" : "info",
      messageAr:
        revenueAnomaly.direction === "down"
          ? `انخفضت الإيرادات ${Math.abs(revenueAnomaly.changePercent)}% مقارنة بالفترة السابقة.`
          : `ارتفعت الإيرادات ${Math.abs(revenueAnomaly.changePercent)}% مقارنة بالفترة السابقة.`,
      messageEn:
        revenueAnomaly.direction === "down"
          ? `Revenue dropped ${Math.abs(revenueAnomaly.changePercent)}% compared to the previous period.`
          : `Revenue rose ${Math.abs(revenueAnomaly.changePercent)}% compared to the previous period.`,
      link: "/reports",
    });
  }

  const expenseAnomaly = anomalies.find((a) => a.metric === "expenses" && a.direction === "up");
  if (expenseAnomaly) {
    alerts.push({
      type: "expense_spike",
      severity: "warning",
      messageAr: `ارتفعت المصروفات ${Math.abs(expenseAnomaly.changePercent)}% مقارنة بالفترة السابقة.`,
      messageEn: `Expenses rose ${Math.abs(expenseAnomaly.changePercent)}% compared to the previous period.`,
      link: "/accounting",
    });
  }

  // language is accepted (not just for future use) so a caller can filter to
  // one locale's messages only if it ever needs to — both are always
  // computed since the cost is negligible and the API returns both today.
  void language;
  return alerts;
}

// Builds the ONLY text handed to the AI provider — deliberately narrow:
// aggregate numbers and product names only, never customer names, phone
// numbers, emails, or any other PII, even though the BI layer has that data
// available for the API response's own `metrics` object.
export function buildSummaryPrompt(params: {
  periodLabel: string;
  from: string;
  to: string;
  current: SalesProfitSummary;
  previous: SalesProfitSummary;
  cashflow: CashflowSummary;
  topProducts: ProductPerformance[];
  anomalies: AnomalyFinding[];
  lowStockCount: number;
}): string {
  const lines = [
    `Period: ${params.periodLabel} (${params.from} to ${params.to})`,
    `Revenue: ${params.current.revenue.toFixed(2)} SAR from ${params.current.salesCount} sales`,
    `Gross profit: ${params.current.grossProfit.toFixed(2)} SAR`,
    `Expenses: ${params.current.expenses.toFixed(2)} SAR`,
    `Net profit: ${params.current.netProfit.toFixed(2)} SAR`,
    `Cash collected: ${params.cashflow.income.toFixed(2)} SAR, cash out: ${params.cashflow.expenses.toFixed(2)} SAR`,
    `Previous period revenue for comparison: ${params.previous.revenue.toFixed(2)} SAR from ${params.previous.salesCount} sales`,
  ];
  if (params.topProducts.length > 0) {
    lines.push(
      `Top products by quantity sold: ${params.topProducts
        .slice(0, 5)
        .map((p) => `${p.productName} (${p.quantitySold} units, ${p.revenue.toFixed(2)} SAR)`)
        .join("; ")}`,
    );
  }
  if (params.anomalies.length > 0) {
    lines.push(
      `Notable changes vs previous period: ${params.anomalies
        .map((a) => `${a.metric} ${a.direction} ${Math.abs(a.changePercent)}%`)
        .join("; ")}`,
    );
  }
  if (params.lowStockCount > 0) {
    lines.push(`${params.lowStockCount} product(s) are at or below their reorder threshold.`);
  }
  return lines.join("\n");
}
