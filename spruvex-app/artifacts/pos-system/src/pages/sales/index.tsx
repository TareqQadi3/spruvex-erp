import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Undo2 } from "lucide-react";
import { format } from "date-fns";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

interface Sale {
  id: string;
  customerId: string | null;
  customerName: string | null;
  total: string;
  paymentMethod: string;
  status: string;
  createdAt: string;
}

interface SaleItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  returnedQuantity: number;
  subtotal: string;
}

interface SaleDetails extends Sale {
  items: SaleItem[];
}

export default function SalesPage() {
  const { t } = useTranslation();
  const [returnSale, setReturnSale] = useState<Sale | null>(null);

  const { data: sales, isLoading } = useQuery<Sale[]>({
    queryKey: ["sales"],
    queryFn: () => api("/sales"),
  });

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
                <TableHead>{t("customers.payment_method")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
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
              ) : sales?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("sales.empty")}</TableCell>
                </TableRow>
              ) : (
                sales?.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="text-sm">{format(new Date(sale.createdAt), "MMM d, yyyy HH:mm")}</TableCell>
                    <TableCell>{sale.customerName || t("customers.walk_in")}</TableCell>
                    <TableCell className="text-end font-medium">{Number(sale.total).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className="capitalize">{sale.paymentMethod}</Badge></TableCell>
                    <TableCell><Badge variant={sale.status === "completed" ? "default" : "destructive"} className="capitalize">{sale.status}</Badge></TableCell>
                    <TableCell className="text-end">
                      <Button variant="ghost" size="sm" onClick={() => setReturnSale(sale)}>
                        <Undo2 className="me-2 h-3.5 w-3.5" />
                        {t("sales.return")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {returnSale && (
        <SaleReturnDialog sale={returnSale} onClose={() => setReturnSale(null)} />
      )}
    </div>
  );
}

function SaleReturnDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "store_credit">("cash");

  const { data: details, isLoading } = useQuery<SaleDetails>({
    queryKey: ["sales", sale.id],
    queryFn: () => api(`/sales/${sale.id}`),
  });

  const returnMutation = useMutation({
    mutationFn: (items: { saleItemId: string; quantity: number }[]) =>
      api(`/sales/${sale.id}/returns`, {
        method: "POST",
        body: JSON.stringify({ items, reason: reason || undefined, refundMethod }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success(t("sales.return_success"));
      onClose();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const items = Object.entries(quantities)
      .map(([saleItemId, qty]) => ({ saleItemId, quantity: Number(qty) }))
      .filter(i => i.quantity > 0);
    if (items.length === 0) {
      toast.error(t("sales.return_no_items"));
      return;
    }
    returnMutation.mutate(items);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("sales.return_title")}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {details?.items.map((item) => {
                const available = item.quantity - (item.returnedQuantity ?? 0);
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {t("sales.available_to_return", { count: available })}
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={available}
                      step={1}
                      className="w-20"
                      disabled={available <= 0}
                      value={quantities[item.id] ?? ""}
                      onChange={(e) => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))}
                    />
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <Label>{t("sales.refund_method")}</Label>
              <Select value={refundMethod} onValueChange={(v) => setRefundMethod(v as "cash" | "store_credit")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">{t("sales.refund_cash")}</SelectItem>
                  <SelectItem value="store_credit">{t("sales.refund_store_credit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>{t("sales.return_reason")}</Label>
              <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={returnMutation.isPending || isLoading} onClick={handleSubmit}>
            {returnMutation.isPending ? t("common.saving") : t("sales.return_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
