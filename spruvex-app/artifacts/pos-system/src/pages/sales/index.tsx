import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Undo2, CalendarClock, Printer, Wallet, Trash2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";
import { openServerPrint } from "@/utils/openServerPrint";
import { useGetSettings } from "@workspace/api-client-react";
import { StatusBadge } from "./components/StatusBadge";
import { SaleInstallmentDialog } from "./components/SaleInstallmentDialog";
import { SaleReturnDialog } from "./components/SaleReturnDialog";
import { RecordPaymentDialog } from "./components/RecordPaymentDialog";
import { ApproveDraftDialog } from "./components/ApproveDraftDialog";
import type { Sale } from "./components/types";

export default function SalesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [returnSale, setReturnSale] = useState<Sale | null>(null);
  const [installmentSale, setInstallmentSale] = useState<Sale | null>(null);
  const [paySale, setPaySale] = useState<Sale | null>(null);
  const [approveDraft, setApproveDraft] = useState<Sale | null>(null);

  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: () => api("/sales"),
  });

  const deleteDraftMutation = useMutation({
    mutationFn: (saleId: string) => api(`/sales/${saleId}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success(t("sales.draft_deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const { data: settings } = useGetSettings();
  const printType = settings?.invoiceType ?? "a4";
  const [printingSaleId, setPrintingSaleId] = useState<string | null>(null);

  const handlePrintInvoice = async (sale: Sale) => {
    setPrintingSaleId(sale.id);
    try {
      const invoice = await api<{ id: string }>(`/zatca/invoices/for-sale/${sale.id}`, { method: "POST" });
      await openServerPrint(`/invoicing/print/sales/${invoice.id}?printType=${printType}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPrintingSaleId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("sales.title")}</h1>
      </div>

      <Card>
        <CardHeader className="py-4">
          <p className="text-sm text-muted-foreground">{t("sales.subtitle")}</p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("customers.title")}</TableHead>
                <TableHead className="text-end">{t("common.amount")}</TableHead>
                <TableHead className="text-end">{t("sales.outstanding")}</TableHead>
                <TableHead>{t("customers.payment_method")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6, 7].map(j => <TableCell key={j}><Skeleton className="h-4 w-[80px]" /></TableCell>)}
                  </TableRow>
                ))
              ) : sales?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("sales.empty")}</TableCell>
                </TableRow>
              ) : (
                sales?.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">{format(new Date(sale.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell>{sale.customerName || t("customers.walk_in")}</TableCell>
                    <TableCell className="text-end font-medium">{Number(sale.total).toFixed(2)}</TableCell>
                    <TableCell className="text-end">
                      {Number(sale.outstanding) > 0.005 ? (
                        <span className="font-medium text-amber-600 dark:text-amber-400">{Number(sale.outstanding).toFixed(2)}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{sale.paymentMethod}</Badge></TableCell>
                    <TableCell><StatusBadge status={sale.status} t={t} /></TableCell>
                    <TableCell className="text-end">
                      <div className="flex items-center justify-end gap-0.5">
                        {sale.status === "draft" ? (
                          <>
                            <Button variant="ghost" size="sm" onClick={() => setApproveDraft(sale)}>
                              <CheckCircle2 className="me-2 h-3.5 w-3.5 text-green-600" />{t("sales.approve")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { if (window.confirm(t("sales.draft_delete_confirm"))) deleteDraftMutation.mutate(sale.id); }}>
                              <Trash2 className="me-2 h-3.5 w-3.5" />{t("common.delete")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" disabled={printingSaleId === sale.id} onClick={() => handlePrintInvoice(sale)}>
                              <Printer className="me-2 h-3.5 w-3.5" />{t("sales.print_invoice")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setInstallmentSale(sale)}>
                              <CalendarClock className="me-2 h-3.5 w-3.5" />{t("installments.sale_action")}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setReturnSale(sale)}>
                              <Undo2 className="me-2 h-3.5 w-3.5" />{t("sales.return")}
                            </Button>
                          </>
                        )}
                        {Number(sale.outstanding) > 0.005 && sale.status !== "draft" && (
                          <Button variant="ghost" size="sm" onClick={() => setPaySale(sale)}>
                            <Wallet className="me-2 h-3.5 w-3.5 text-amber-600" />{t("sales.record_payment")}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {returnSale && <SaleReturnDialog sale={returnSale} onClose={() => setReturnSale(null)} />}
      {installmentSale && <SaleInstallmentDialog sale={installmentSale} onClose={() => setInstallmentSale(null)} />}
      {paySale && <RecordPaymentDialog sale={paySale} onClose={() => setPaySale(null)} />}
      {approveDraft && <ApproveDraftDialog sale={approveDraft} onClose={() => setApproveDraft(null)} />}
    </div>
  );
}
