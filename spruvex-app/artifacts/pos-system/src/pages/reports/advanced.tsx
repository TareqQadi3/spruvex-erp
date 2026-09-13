import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import {
  ArrowLeft, TrendingUp, TrendingDown, DollarSign, Lock, Package,
  Users, UserCog, Wallet, PackageX,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyState } from "@/components/EmptyState";
import { TOKEN_KEY } from "@/contexts/AuthContext";
import { useModuleEnabled } from "@/hooks/useModuleEnabled";

async function biFetch(path: string) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api/bi${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: "Request failed" } }));
    throw new Error(err.error?.message ?? "Request failed");
  }
  const body = await res.json();
  return body.data;
}

interface SalesProfitSummary { revenue: number; costOfGoods: number; grossProfit: number; expenses: number; netProfit: number; salesCount: number; }
interface TrendPoint { date: string; revenue: number; salesCount: number; profit: number; }
interface ProductPerformance { productId: string; productName: string; quantitySold: number; revenue: number; profit: number; }
interface LowStockProduct { productId: string; name: string; sku: string | null; stock: number; lowStockThreshold: number; }
interface CustomerPerformance { customerId: string; name: string; totalSpent: number; orderCount: number; }
interface BranchPerformance { branchId: string | null; branchName: string; revenue: number; salesCount: number; }
interface UserPerformance { userId: string | null; username: string; revenue: number; salesCount: number; }
interface ExpenseBreakdown { category: string; total: number; }
interface CashflowSummary { income: number; expenses: number; net: number; }

const PIE_COLORS = ["#3b82f6", "#22c55e", "#eab308", "#f97316", "#a855f7", "#ec4899", "#14b8a6", "#6b7280"];

function StatCard({ label, value, icon, positive }: { label: string; value: string; icon: React.ReactNode; positive?: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${positive === false ? "text-destructive" : ""}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function fmt(n: number | undefined | null): string {
  return Number(n ?? 0).toFixed(2);
}

export default function AdvancedReportsPage() {
  const { t } = useTranslation();
  const { enabled: moduleEnabled, isLoading: moduleLoading } = useModuleEnabled("advanced_reports");
  const [rangeIdx, setRangeIdx] = useState(1);

  const DATE_RANGES = [
    { label: t("reports.last_7"), from: () => format(subDays(new Date(), 7), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
    { label: t("reports.last_30"), from: () => format(subDays(new Date(), 30), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
    { label: t("reports.this_month"), from: () => format(startOfMonth(new Date()), "yyyy-MM-dd"), to: () => format(endOfMonth(new Date()), "yyyy-MM-dd") },
  ];
  const range = DATE_RANGES[rangeIdx];
  const from = range.from();
  const to = range.to();
  const qs = `from=${from}&to=${to}`;

  const summaryQ = useQuery<SalesProfitSummary>({ queryKey: ["bi-summary", from, to], queryFn: () => biFetch(`/summary?${qs}`), enabled: moduleEnabled });
  const trendQ = useQuery<TrendPoint[]>({ queryKey: ["bi-trend", from, to], queryFn: () => biFetch(`/trend?${qs}`), enabled: moduleEnabled });
  const topProductsQ = useQuery<ProductPerformance[]>({ queryKey: ["bi-top-products", from, to], queryFn: () => biFetch(`/top-products?${qs}&limit=10`), enabled: moduleEnabled });
  const worstProductsQ = useQuery<ProductPerformance[]>({ queryKey: ["bi-worst-products", from, to], queryFn: () => biFetch(`/worst-products?${qs}&limit=10`), enabled: moduleEnabled });
  const lowStockQ = useQuery<LowStockProduct[]>({ queryKey: ["bi-low-stock"], queryFn: () => biFetch(`/low-stock?limit=10`), enabled: moduleEnabled });
  const topCustomersQ = useQuery<CustomerPerformance[]>({ queryKey: ["bi-top-customers", from, to], queryFn: () => biFetch(`/top-customers?${qs}&limit=10`), enabled: moduleEnabled });
  const branchQ = useQuery<BranchPerformance[]>({ queryKey: ["bi-branch", from, to], queryFn: () => biFetch(`/branch-performance?${qs}`), enabled: moduleEnabled });
  const userQ = useQuery<UserPerformance[]>({ queryKey: ["bi-user", from, to], queryFn: () => biFetch(`/user-performance?${qs}`), enabled: moduleEnabled });
  const expensesQ = useQuery<ExpenseBreakdown[]>({ queryKey: ["bi-expenses", from, to], queryFn: () => biFetch(`/expenses-breakdown?${qs}`), enabled: moduleEnabled });
  const cashflowQ = useQuery<CashflowSummary>({ queryKey: ["bi-cashflow", from, to], queryFn: () => biFetch(`/cashflow?${qs}`), enabled: moduleEnabled });

  if (!moduleLoading && !moduleEnabled) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("advancedReports.title")}</h1>
        </div>
        <Card>
          <CardContent className="py-12">
            <EmptyState icon={Lock} title={t("advancedReports.upgrade_title")} description={t("advancedReports.upgrade_desc")} />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/reports">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("advancedReports.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("advancedReports.subtitle")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {DATE_RANGES.map((r, i) => (
            <Button key={i} variant={rangeIdx === i ? "default" : "outline"} size="sm" onClick={() => setRangeIdx(i)}>
              {r.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {summaryQ.isLoading || moduleLoading ? (
          [1, 2, 3, 4, 5].map(i => <Card key={i}><CardContent className="pt-6"><Skeleton className="h-16 w-full" /></CardContent></Card>)
        ) : summaryQ.isError ? (
          <div className="col-span-full"><QueryErrorState message={t("common.error_load_data")} onRetry={() => summaryQ.refetch()} /></div>
        ) : summaryQ.data ? (
          <>
            <StatCard label={t("reports.revenue")} value={fmt(summaryQ.data.revenue)} icon={<DollarSign className="h-4 w-4 text-muted-foreground" />} />
            <StatCard label={t("reports.cost_of_goods")} value={fmt(summaryQ.data.costOfGoods)} icon={<TrendingDown className="h-4 w-4 text-muted-foreground" />} />
            <StatCard label={t("advancedReports.gross_profit")} value={fmt(summaryQ.data.grossProfit)} icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} />
            <StatCard label={t("advancedReports.expenses")} value={fmt(summaryQ.data.expenses)} icon={<Wallet className="h-4 w-4 text-muted-foreground" />} />
            <StatCard
              label={t("reports.net_profit")} value={fmt(summaryQ.data.netProfit)}
              icon={<TrendingUp className="h-4 w-4 text-muted-foreground" />} positive={summaryQ.data.netProfit >= 0}
            />
          </>
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle>{t("advancedReports.trend_title")}</CardTitle></CardHeader>
        <CardContent>
          {trendQ.isLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : trendQ.isError ? (
            <QueryErrorState message={t("common.error_load_data")} onRetry={() => trendQ.refetch()} />
          ) : trendQ.data && trendQ.data.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendQ.data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v) => format(new Date(v), "MMM d")} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  labelFormatter={(label) => format(new Date(label), "MMM d, yyyy")}
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }}
                />
                <Legend />
                <Line type="monotone" dataKey="revenue" name={t("reports.revenue")} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="profit" name={t("advancedReports.profit")} stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground">{t("advancedReports.no_data_period")}</div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("advancedReports.top_products")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.product")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.qty_sold")}</TableHead>
                  <TableHead className="text-end">{t("reports.revenue")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topProductsQ.isLoading ? (
                  [1, 2, 3].map(i => <TableRow key={i}>{[1, 2, 3, 4].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                ) : topProductsQ.isError ? (
                  <TableRow><TableCell colSpan={4}><QueryErrorState message={t("common.error_load_data")} onRetry={() => topProductsQ.refetch()} /></TableCell></TableRow>
                ) : topProductsQ.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={4}><EmptyState icon={Package} title={t("advancedReports.no_data_period")} /></TableCell></TableRow>
                ) : (
                  topProductsQ.data?.map(p => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-end"><Badge variant="secondary">{p.quantitySold}</Badge></TableCell>
                      <TableCell className="text-end">{fmt(p.revenue)}</TableCell>
                      <TableCell className="text-end">{fmt(p.profit)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("advancedReports.worst_products")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.product")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.qty_sold")}</TableHead>
                  <TableHead className="text-end">{t("reports.revenue")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.profit")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {worstProductsQ.isLoading ? (
                  [1, 2, 3].map(i => <TableRow key={i}>{[1, 2, 3, 4].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                ) : worstProductsQ.isError ? (
                  <TableRow><TableCell colSpan={4}><QueryErrorState message={t("common.error_load_data")} onRetry={() => worstProductsQ.refetch()} /></TableCell></TableRow>
                ) : worstProductsQ.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={4}><EmptyState icon={Package} title={t("advancedReports.no_data_period")} /></TableCell></TableRow>
                ) : (
                  worstProductsQ.data?.map(p => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.productName}</TableCell>
                      <TableCell className="text-end"><Badge variant="secondary">{p.quantitySold}</Badge></TableCell>
                      <TableCell className="text-end">{fmt(p.revenue)}</TableCell>
                      <TableCell className="text-end">{fmt(p.profit)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("advancedReports.low_stock_title")}</CardTitle>
            <CardDescription>{t("advancedReports.low_stock_desc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("reports.product")}</TableHead>
                  <TableHead>{t("advancedReports.sku")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.current_stock")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.threshold")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lowStockQ.isLoading ? (
                  [1, 2, 3].map(i => <TableRow key={i}>{[1, 2, 3, 4].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                ) : lowStockQ.isError ? (
                  <TableRow><TableCell colSpan={4}><QueryErrorState message={t("common.error_load_data")} onRetry={() => lowStockQ.refetch()} /></TableCell></TableRow>
                ) : lowStockQ.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={4}><EmptyState icon={PackageX} title={t("advancedReports.no_low_stock")} /></TableCell></TableRow>
                ) : (
                  lowStockQ.data?.map(p => (
                    <TableRow key={p.productId}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">{p.sku ?? "—"}</TableCell>
                      <TableCell className="text-end"><Badge variant="destructive">{p.stock}</Badge></TableCell>
                      <TableCell className="text-end text-muted-foreground">{p.lowStockThreshold}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("advancedReports.top_customers_title")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.name")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.orders")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.total_spent")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topCustomersQ.isLoading ? (
                  [1, 2, 3].map(i => <TableRow key={i}>{[1, 2, 3].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                ) : topCustomersQ.isError ? (
                  <TableRow><TableCell colSpan={3}><QueryErrorState message={t("common.error_load_data")} onRetry={() => topCustomersQ.refetch()} /></TableCell></TableRow>
                ) : topCustomersQ.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={3}><EmptyState icon={Users} title={t("advancedReports.no_customers")} /></TableCell></TableRow>
                ) : (
                  topCustomersQ.data?.map(c => (
                    <TableRow key={c.customerId}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-end"><Badge variant="secondary">{c.orderCount}</Badge></TableCell>
                      <TableCell className="text-end">{fmt(c.totalSpent)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("advancedReports.branch_performance_title")}</CardTitle></CardHeader>
          <CardContent>
            {branchQ.isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : branchQ.isError ? (
              <QueryErrorState message={t("common.error_load_data")} onRetry={() => branchQ.refetch()} />
            ) : branchQ.data && branchQ.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={branchQ.data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="branchName" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }} />
                  <Bar dataKey="revenue" name={t("reports.revenue")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">{t("advancedReports.no_branch_data")}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("advancedReports.user_performance_title")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("advancedReports.staff_member")}</TableHead>
                  <TableHead className="text-end">{t("advancedReports.sales_count")}</TableHead>
                  <TableHead className="text-end">{t("reports.revenue")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userQ.isLoading ? (
                  [1, 2, 3].map(i => <TableRow key={i}>{[1, 2, 3].map(j => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                ) : userQ.isError ? (
                  <TableRow><TableCell colSpan={3}><QueryErrorState message={t("common.error_load_data")} onRetry={() => userQ.refetch()} /></TableCell></TableRow>
                ) : userQ.data?.length === 0 ? (
                  <TableRow><TableCell colSpan={3}><EmptyState icon={UserCog} title={t("advancedReports.no_user_data")} /></TableCell></TableRow>
                ) : (
                  userQ.data?.map(u => (
                    <TableRow key={u.userId ?? u.username}>
                      <TableCell className="font-medium">{u.username}</TableCell>
                      <TableCell className="text-end"><Badge variant="secondary">{u.salesCount}</Badge></TableCell>
                      <TableCell className="text-end">{fmt(u.revenue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("advancedReports.expenses_breakdown_title")}</CardTitle></CardHeader>
          <CardContent>
            {expensesQ.isLoading ? (
              <Skeleton className="h-[220px] w-full" />
            ) : expensesQ.isError ? (
              <QueryErrorState message={t("common.error_load_data")} onRetry={() => expensesQ.refetch()} />
            ) : expensesQ.data && expensesQ.data.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={expensesQ.data} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="total" nameKey="category">
                    {expensesQ.data.map((_, index) => <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt(Number(v))} contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "6px" }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[220px] flex items-center justify-center text-muted-foreground">{t("advancedReports.no_expenses")}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("advancedReports.cashflow_title")}</CardTitle></CardHeader>
          <CardContent>
            {cashflowQ.isLoading ? (
              <Skeleton className="h-24 w-full" />
            ) : cashflowQ.isError ? (
              <QueryErrorState message={t("common.error_load_data")} onRetry={() => cashflowQ.refetch()} />
            ) : cashflowQ.data ? (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground">{t("advancedReports.cashflow_income")}</div>
                  <div className="text-lg font-bold text-green-600">{fmt(cashflowQ.data.income)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("advancedReports.cashflow_expenses")}</div>
                  <div className="text-lg font-bold text-destructive">{fmt(cashflowQ.data.expenses)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("advancedReports.cashflow_net")}</div>
                  <div className={`text-lg font-bold ${cashflowQ.data.net >= 0 ? "text-green-600" : "text-destructive"}`}>{fmt(cashflowQ.data.net)}</div>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
