import { useGetCustomer } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { ArrowLeft, Phone, Mail, MapPin } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";

const STATUS_COLORS: Record<string, string> = {
  received: "bg-gray-500 text-white",
  under_inspection: "bg-yellow-500 text-black",
  waiting_parts: "bg-orange-500 text-white",
  in_repair: "bg-blue-500 text-white",
  completed: "bg-green-500 text-white",
  delivered: "bg-teal-500 text-white",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: customer, isLoading } = useGetCustomer(Number(id), { query: { enabled: !!id } as any });
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  if (!customer) return <div className="text-muted-foreground py-8 text-center">{t("customers.not_found")}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/customers">
          <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{customer.name}</h1>
          <p className="text-sm text-muted-foreground">{t("customers.since", { date: format(new Date(customer.createdAt), "MMM yyyy") })}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("customers.contact")}</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {customer.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" />{customer.phone}</div>}
            {customer.email && <div className="flex items-center gap-2 text-sm"><Mail className="h-4 w-4 text-muted-foreground" />{customer.email}</div>}
            {customer.address && <div className="flex items-center gap-2 text-sm"><MapPin className="h-4 w-4 text-muted-foreground" />{customer.address}</div>}
            {!customer.phone && !customer.email && <span className="text-sm text-muted-foreground">{t("customers.no_contact")}</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("customers.total_purchases")}</CardTitle></CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{customer.totalPurchases}</div>
            <p className="text-xs text-muted-foreground mt-1">{t("customers.completed_sales")}</p>
          </CardContent>
        </Card>
        <Card className={Number(customer.outstandingBalance) > 0 ? "border-destructive/50" : ""}>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">{t("customers.outstanding_balance")}</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${Number(customer.outstandingBalance) > 0 ? "text-destructive" : ""}`}>
              {Number(customer.outstandingBalance).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t("customers.purchase_history")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.amount")}</TableHead>
                  <TableHead>{t("customers.payment_method")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(customer as any).recentSales?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("customers.no_purchases")}</TableCell></TableRow>
                ) : (
                  (customer as any).recentSales?.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-sm">{format(new Date(sale.createdAt), "MMM d, yyyy")}</TableCell>
                      <TableCell className="font-medium">{Number(sale.total).toFixed(2)}</TableCell>
                      <TableCell><Badge variant="outline" className="capitalize">{sale.paymentMethod}</Badge></TableCell>
                      <TableCell><Badge variant={sale.status === "completed" ? "default" : "destructive"} className="capitalize">{sale.status}</Badge></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>{t("customers.repair_history")}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("repairs.ticket")}</TableHead>
                  <TableHead>{t("repairs.device")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead>{t("common.date")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(customer as any).recentRepairs?.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">{t("customers.no_repairs")}</TableCell></TableRow>
                ) : (
                  (customer as any).recentRepairs?.map((repair: any) => (
                    <TableRow key={repair.id}>
                      <TableCell className="font-mono text-xs">{repair.ticketNumber}</TableCell>
                      <TableCell>{repair.deviceModel || repair.deviceType}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`border-transparent text-xs ${STATUS_COLORS[repair.status] || "bg-gray-500 text-white"}`}>
                          {t(`repairs.status_${repair.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{format(new Date(repair.createdAt), "MMM d, yyyy")}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
