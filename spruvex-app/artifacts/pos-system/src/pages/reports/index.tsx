import { useState } from "react";
import { useGetSalesSummary, useGetTopProducts, useGetRepairsSummary, useGetProfitReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { TrendingUp, TrendingDown, DollarSign, Wrench } from "lucide-react";
import { useTranslation } from "@/i18n";

const REPAIR_STATUS_COLORS: Record<string, string> = {
  received: "#6b7280",
  under_inspection: "#eab308",
  waiting_parts: "#f97316",
  in_repair: "#3b82f6",
  completed: "#22c55e",
  delivered: "#14b8a6",
};

function StatCard({ label, value, icon, sub, positive }: { label: string; value: string; icon: React.ReactNode; sub?: string; positive?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${positive === false ? "text-destructive" : ""}`}>{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function ReportsPage() {
  const [rangeIdx, setRangeIdx] = useState(0);
  const { t } = useTranslation();

  const DATE_RANGES = [
    { label: t("reports.last_7"), from: () => format(subDays(new Date(), 7), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
    { label: t("reports.last_30"), from: () => format(subDays(new Date(), 30), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
    { label: t("reports.this_month"), from: () => format(startOfMonth(new Date()), "yyyy-MM-dd"), to: () => format(endOfMonth(new Date()), "yyyy-MM-dd") },
  ];

  const range = DATE_RANGES[rangeIdx];
  const from = range.from();
  const to = range.to();

  const { data: salesSummary, isLoading: loadingSales } = useGetSalesSummary({ from, to });
  const { data: topProducts, isLoading: loadingProducts } = useGetTopProducts({ from, to, limit: 10 });
  const { data: repairsSummary, isLoading: loadingRepairs } = useGetRepairsSummary();
  const { data: profitReport, isLoading: loadingProfit } = useGetProfitReport({ from, to });

  const totalSales = salesSummary?.reduce((s, d) => s + Number(d.totalSales), 0) ?? 0;

  const repairPieData = repairsSummary
    ? Object.entries(repairsSummary.byStatus || {}).map(([status, count]) => ({
        name: t(`repairs.status_${status}`),
        value: count,
        color: REPAIR_STATUS_COLORS[status] || "#6b7280",
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold tracking-tight">{t("reports.title")}</h1>
        <div className="flex gap-2">
          {DATE_RANGES.map((r, i) => (
            <Button key={i} variant={rangeIdx === i ? "default" : "outline"} size="sm" onClick={() => setRangeIdx(i)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {loadingProfit ? (
          [1, 2, 3, 4].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)
        ) : profitReport ? (
          <>
            <StatCard label={t("reports.revenue")} value={Number(profitReport.revenue).toFixed(2)} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} sub={t("reports.sales_count", { count: totalSales })} />
            <StatCard label={t("reports.cost_of_goods")} value={Number(profitReport.costOfGoods).toFixed(2)} icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} />
            <StatCard label={t("reports.repair_revenue")} value={Number(profitReport.repairRevenue).toFixed(2)} icon={<Wrench className="h-4 w-4 text-muted-foreground" />} />
            <StatCard
              label={t("reports.net_profit")}
              value={Number(profitReport.netProfit).toFixed(2)}
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />}
              positive={Number(profitReport.netProfit) >= 0}
              sub={t("reports.after_expenses", { amount: Number(profitReport.expenses).toFixed(2) })}
            />
          </>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle>{t("reports.daily_sales")}</CardTitle></CardHeader>
          <CardContent>
            {loadingSales ? (
              <Skeleton className="h-[300px] w-full" />
            ) : salesSummary && salesSummary.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={salesSummary} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: any) => [Number(value).toFixed(2), t("reports.revenue")]}
                    labelFormatter={(label) => format(new Date(label), "MMM d, yyyy")}
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                  />
                  <Bar dataKey="totalRevenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">{t("reports.no_sales_data")}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("reports.top_products")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.rank")}</TableHead>
                  <TableHead>{t("reports.product")}</TableHead>
                  <TableHead className="text-end">{t("reports.qty")}</TableHead>
                  <TableHead className="text-end">{t("reports.revenue")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProducts ? (
                  [1, 2, 3, 4, 5].map(i => (
                    <TableRow key={i}>
                      {[1, 2, 3, 4].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}
                    </TableRow>
                  ))
                ) : topProducts?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("reports.no_products")}</TableCell></TableRow>
                ) : (
                  topProducts?.map((p, i) => (
                    <TableRow key={p.productId}>
                      <TableCell className="text-muted-foreground font-mono">{i + 1}</TableCell>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-end"><Badge variant="secondary">{p.totalQuantity}</Badge></TableCell>
                      <TableCell className="text-end">{Number(p.totalRevenue).toFixed(2)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("reports.repairs_by_status")}</CardTitle></CardHeader>
          <CardContent>
            {loadingRepairs ? (
              <Skeleton className="h-[200px] w-full" />
            ) : repairPieData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={repairPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                      {repairPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [v, t("reports.total_repairs")]} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
                <div className="text-center mt-2">
                  <div className="text-2xl font-bold">{repairsSummary?.total ?? 0}</div>
                  <div className="text-xs text-muted-foreground">{t("reports.total_repairs")}</div>
                </div>
              </>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">{t("reports.no_repairs")}</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
