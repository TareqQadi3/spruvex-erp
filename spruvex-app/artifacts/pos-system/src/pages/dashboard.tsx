import {
  useGetDashboardStats,
  useGetSettings,
  useGetSalesSummary,
  useGetTopProducts,
  useGetProfitReport,
  useGetActiveCashSession,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";
import { DollarSign, Wrench, AlertTriangle, CheckCircle, Users, Receipt, TrendingUp, Wallet, LockOpen } from "lucide-react";
import { useTranslation } from "@/i18n";
import { formatCurrency } from "@/lib/format";
import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Loading } from "@/components/Loading";

export default function Dashboard() {
  const { t, lang } = useTranslation();
  const fmt = (n: number | string, currency = "SAR") => formatCurrency(n, currency, lang);

  const statsQ = useGetDashboardStats();
  const settingsQ = useGetSettings();
  const isLoading = statsQ.isLoading || settingsQ.isLoading;
  const isError = statsQ.isError;
  const refetch = statsQ.refetch;

  const from = format(subDays(new Date(), 6), "yyyy-MM-dd");
  const to = format(new Date(), "yyyy-MM-dd");
  const salesSummaryQ = useGetSalesSummary({ from, to });
  const topProductsQ = useGetTopProducts({ from, to, limit: 5 });
  const profitQ = useGetProfitReport({ from, to });
  const cashQ = useGetActiveCashSession({ query: { retry: false } as any });

  const settings = settingsQ.data;
  const stats = statsQ.data;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-[100px]" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[120px]" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>
        <Card>
          <CardContent>
            <QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const currency = settings?.currency ?? "SAR";
  const dailySalesData = salesSummaryQ.data ?? [];
  const topProductsData = topProductsQ.data ?? [];
  const profit = profitQ.data;
  const netProfit = profit?.netProfit ?? Number(stats.todayRevenue) - Number(stats.todayExpenses);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.total_sales")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(stats.todayRevenue, currency)}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.sales_today", { count: stats.todaySales })}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.net_profit")}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${Number(netProfit) >= 0 ? "" : "text-destructive"}`}>{fmt(netProfit, currency)}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.invoices_count")}: {stats.todaySales}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.invoices_count")}</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todaySales}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.recent_sales")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.customers")}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCustomers}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.open_repairs")}: {stats.openRepairs}</p>
          </CardContent>
        </Card>

        <Card className={stats.lowStockCount > 0 ? "border-destructive/50 bg-destructive/10" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.low_stock")}</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.low_stock_items")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Sales by Day */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t("dashboard.sales_by_day")}</CardTitle>
          </CardHeader>
          <CardContent>
            {salesSummaryQ.isLoading ? (
              <Loading className="h-[280px]" />
            ) : salesSummaryQ.isError ? (
              <QueryErrorState message={t("common.error_load_data")} onRetry={() => salesSummaryQ.refetch()} />
            ) : dailySalesData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={dailySalesData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any) => [fmt(Number(value), currency), t("dashboard.total_sales")]}
                    labelFormatter={(label) => format(new Date(label), "MMM d, yyyy")}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                  />
                  <Bar dataKey="totalRevenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyState icon={TrendingUp} title={t("reports.no_sales_data")} />
            )}
          </CardContent>
        </Card>

        {/* Cash Movement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              {t("dashboard.cash_movement")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cashQ.isLoading ? (
              <Loading />
            ) : cashQ.isError ? (
              <QueryErrorState message={t("common.error_load_data")} onRetry={() => cashQ.refetch()} />
            ) : cashQ.data ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <LockOpen className="h-5 w-5 text-green-500" />
                  <Badge variant="secondary" className="bg-green-500/10 text-green-700">{t("dashboard.open_cash")}</Badge>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("accounting.opening_balance")}</span>
                    <span className="font-medium">{fmt(cashQ.data.openingBalance, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("accounting.session_sales_total")}</span>
                    <span className="font-medium">{fmt((cashQ.data as any).totalSales ?? 0, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="font-medium">{t("accounting.session_expected")}</span>
                    <span className="font-bold">{fmt((cashQ.data as any).expectedBalance ?? cashQ.data.openingBalance, currency)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <EmptyState icon={Wallet} title={t("dashboard.no_active_session_short")} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Products + Recent Activity */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.top_products")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topProductsQ.isLoading ? (
              <Loading />
            ) : topProductsQ.isError ? (
              <QueryErrorState message={t("common.error_load_data")} onRetry={() => topProductsQ.refetch()} />
            ) : topProductsData.length > 0 ? (
              <div className="space-y-3 p-4">
                {topProductsData.map((p, i) => (
                  <div key={p.productId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground font-mono text-sm">{i + 1}</span>
                      <span className="text-sm font-medium">{p.productName}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{p.totalQuantity}</Badge>
                      <span className="text-sm font-medium">{fmt(p.totalRevenue, currency)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState icon={TrendingUp} title={t("reports.no_products")} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recent_sales")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentSales?.slice(0, 5).map(sale => (
                <div key={sale.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{t("dashboard.sale_number", { id: sale.id })}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(sale.createdAt), "MMM d, h:mm a")}</span>
                  </div>
                  <div className="font-medium">{fmt(sale.total, currency)}</div>
                </div>
              ))}
              {(!stats.recentSales || stats.recentSales.length === 0) && (
                <EmptyState icon={Receipt} title={t("dashboard.no_recent_sales")} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Repairs summary row */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.open_repairs")}</CardTitle>
            <Wrench className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.openRepairs}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.pending_action")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.completed_repairs")}</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completedRepairsToday}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.repairs_today")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recent_repairs")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentRepairs?.slice(0, 3).map(repair => (
                <div key={repair.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{repair.deviceModel || repair.deviceType}</span>
                    <span className="text-xs text-muted-foreground">{repair.ticketNumber}</span>
                  </div>
                  <Badge variant="outline">{t(`repairs.status_${repair.status}`)}</Badge>
                </div>
              ))}
              {(!stats.recentRepairs || stats.recentRepairs.length === 0) && (
                <EmptyState icon={Wrench} title={t("dashboard.no_recent_repairs")} />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}