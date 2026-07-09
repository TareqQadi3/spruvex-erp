import { useGetDashboardStats, useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { DollarSign, Wrench, AlertTriangle, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";
import { formatCurrency } from "@/lib/format";

export default function Dashboard() {
  const { data: stats, isLoading } = useGetDashboardStats();
  const { data: settings } = useGetSettings();
  const { t, lang } = useTranslation();
  const fmt = (n: number | string) => formatCurrency(n, settings?.currency ?? "SAR", lang);

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

  if (!stats) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.title")}</h1>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.today_revenue")}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(stats.todayRevenue)}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.sales_today", { count: stats.todaySales })}</p>
          </CardContent>
        </Card>

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

        <Card className={stats.lowStockCount > 0 ? "border-destructive/50 bg-destructive/10" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("dashboard.low_stock")}</CardTitle>
            <AlertTriangle className={`h-4 w-4 ${stats.lowStockCount > 0 ? "text-destructive" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.lowStockCount}</div>
            <p className="text-xs text-muted-foreground">{t("dashboard.below_threshold")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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
                  <div className="font-medium">{fmt(sale.total)}</div>
                </div>
              ))}
              {(!stats.recentSales || stats.recentSales.length === 0) && (
                <div className="text-sm text-muted-foreground">{t("dashboard.no_recent_sales")}</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.recent_repairs")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentRepairs?.slice(0, 5).map(repair => (
                <div key={repair.id} className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{repair.deviceModel || repair.deviceType}</span>
                    <span className="text-xs text-muted-foreground">{repair.ticketNumber}</span>
                  </div>
                  <Badge variant="outline">{t(`repairs.status_${repair.status}`)}</Badge>
                </div>
              ))}
              {(!stats.recentRepairs || stats.recentRepairs.length === 0) && (
                <div className="text-sm text-muted-foreground">{t("dashboard.no_recent_repairs")}</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
