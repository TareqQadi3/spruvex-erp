import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";
import { openServerPrint } from "@/utils/openServerPrint";
import { useGetSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import type { Sale, SaleDetails } from "./types";

export function SaleReturnDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: settings } = useGetSettings();
  const printType = settings?.invoiceType ?? "a4";
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [refundMethod, setRefundMethod] = useState<"cash" | "store_credit">("cash");

  const { data: details, isLoading } = useQuery<SaleDetails>({
    queryKey: ["sales", sale.id],
    queryFn: () => api(`/sales/${sale.id}`),
  });

  const returnMutation = useMutation({
    mutationFn: (items: { saleItemId: string; quantity: number }[]) =>
      api<{ id: string }>(`/sales/${sale.id}/returns`, { method: "POST", body: JSON.stringify({ items, reason: reason || undefined, refundMethod }) }),
    onSuccess: async (ret) => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      toast.success(t("sales.return_success"));
      onClose();
      try {
        const creditNote = await api<{ id: string }>("/zatca/invoices/from-return", { method: "POST", body: JSON.stringify({ saleReturnId: ret.id }) });
        await openServerPrint(`/invoicing/print/sales/${creditNote.id}?printType=${printType}`);
      } catch (err) {
        toast.info(err instanceof Error ? err.message : t("sales.credit_note_skipped"));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    const items = Object.entries(quantities).map(([saleItemId, qty]) => ({ saleItemId, quantity: Number(qty) })).filter(i => i.quantity > 0);
    if (items.length === 0) { toast.error(t("sales.return_no_items")); return; }
    returnMutation.mutate(items);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("sales.return_title")}</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {details?.items.map((item) => {
                const available = item.quantity - (item.returnedQuantity ?? 0);
                return (
                  <div key={item.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">{t("sales.available_to_return", { count: available })}</div>
                    </div>
                    <Input type="number" min={0} max={available} step={1} className="w-20" disabled={available <= 0}
                      value={quantities[item.id] ?? ""} onChange={(e) => setQuantities(prev => ({ ...prev, [item.id]: e.target.value }))} />
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
