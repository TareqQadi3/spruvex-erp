import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Printer, Undo2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";
import { openServerPrint } from "@/utils/openServerPrint";
import { useGetSettings } from "@workspace/api-client-react";
import { QueryErrorState } from "@/components/QueryErrorState";
import { EmptyState } from "@/components/EmptyState";

interface SaleReturn {
  id: string;
  returnNumber: string;
  saleId: string;
  customerId: string | null;
  customerName: string | null;
  reason: string | null;
  refundMethod: string;
  refundAmount: string;
  exchangeAmount: string;
  netAmount: string;
  paymentMethod: string;
  saleTotal: string;
  createdAt: string;
}

export default function SalesReturnsPage({ variant = "returns" }: { variant?: "returns" | "credit-notes" }) {
  const { t } = useTranslation();
  const { data: settings } = useGetSettings();
  const printType = settings?.invoiceType ?? "a4";
  const [printingId, setPrintingId] = useState<string | null>(null);

  const { data: returns, isLoading, isError, refetch } = useQuery<SaleReturn[]>({
    queryKey: ["sale-returns"],
    queryFn: () => api("/sales/returns"),
  });

  const handlePrintCreditNote = async (ret: SaleReturn) => {
    setPrintingId(ret.id);
    try {
      const creditNote = await api<{ id: string }>("/zatca/invoices/from-return", {
        method: "POST",
        body: JSON.stringify({ saleReturnId: ret.id }),
      });
      await openServerPrint(`/invoicing/print/sales/${creditNote.id}?printType=${printType}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setPrintingId(null);
    }
  };

  const isCreditNotes = variant === "credit-notes";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          {t(isCreditNotes ? "sales_returns.credit_notes_title" : "sales_returns.title")}
        </h1>
      </div>

      <Card>
        <CardHeader className="py-4">
          <p className="text-sm text-muted-foreground">
            {t(isCreditNotes ? "sales_returns.credit_notes_subtitle" : "sales_returns.subtitle")}
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.date")}</TableHead>
                <TableHead>{t("sales_returns.number")}</TableHead>
                <TableHead>{t("customers.title")}</TableHead>
                <TableHead>{t("sales_returns.refund_method")}</TableHead>
                <TableHead className="text-end">{t("sales_returns.net_amount")}</TableHead>
                <TableHead className="text-end">{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [1, 2, 3].map(i => (
                  <TableRow key={i}>
                    {[1, 2, 3, 4, 5, 6].map(j => <TableCell key={j}><Skeleton className="h-4 w-[80px]" /></TableCell>)}
                  </TableRow>
                ))
              ) : isError ? (
                <TableRow><TableCell colSpan={6}><QueryErrorState message={t("common.error_load_data")} onRetry={() => refetch()} /></TableCell></TableRow>
              ) : returns?.length === 0 ? (
                <TableRow><TableCell colSpan={6}><EmptyState icon={Undo2} title={t("sales_returns.empty")} description={t("sales_returns.empty_desc")} /></TableCell></TableRow>
              ) : (
                returns?.map((ret) => (
                  <TableRow key={ret.id}>
                    <TableCell className="text-sm">{format(new Date(ret.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell className="text-sm font-medium">{ret.returnNumber}</TableCell>
                    <TableCell>{ret.customerName || t("customers.walk_in")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {t(ret.refundMethod === "store_credit" ? "sales.refund_store_credit" : "sales.refund_cash")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end font-medium">{Number(ret.netAmount).toFixed(2)}</TableCell>
                    <TableCell className="text-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={printingId === ret.id}
                        onClick={() => handlePrintCreditNote(ret)}
                      >
                        <Printer className="me-2 h-3.5 w-3.5" />
                        {t("sales_returns.print_credit_note")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
