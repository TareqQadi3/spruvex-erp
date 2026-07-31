import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Check } from "lucide-react";
import { format } from "date-fns";
import type { Sale, InstallmentPlan, InstallmentSale, InstallmentPayment } from "./types";

export function SaleInstallmentDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [planId, setPlanId] = useState("");
  const [downPayment, setDownPayment] = useState("");

  const { data: existing, isLoading: isLoadingExisting } = useQuery<InstallmentSale[]>({
    queryKey: ["installment-sales", { saleId: sale.id }],
    queryFn: () => api(`/installment-sales?saleId=${sale.id}`),
  });
  const installmentSale = existing?.[0];

  const { data: plans } = useQuery<InstallmentPlan[]>({
    queryKey: ["installment-plans"],
    queryFn: () => api("/installment-plans"),
    enabled: !installmentSale,
  });

  const { data: details, isLoading: isLoadingDetails } = useQuery<InstallmentSale & { payments: InstallmentPayment[] }>({
    queryKey: ["installment-sales", installmentSale?.id],
    queryFn: () => api(`/installment-sales/${installmentSale!.id}`),
    enabled: !!installmentSale,
  });

  const createMutation = useMutation({
    mutationFn: () => api("/installment-sales", {
      method: "POST",
      body: JSON.stringify({ saleId: sale.id, customerId: sale.customerId, planId, principal: sale.total, downPayment: downPayment || 0 }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installment-sales"] });
      toast.success(t("installments.sale_create_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const payMutation = useMutation({
    mutationFn: (paymentId: string) => api(`/installment-sales/${installmentSale!.id}/payments/${paymentId}/pay`, { method: "POST" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["installment-sales"] });
      toast.success(t("installments.payment_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isLoading = isLoadingExisting || (!!installmentSale && isLoadingDetails);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{t("installments.sale_title")}</DialogTitle></DialogHeader>
        {isLoading ? (
          <div className="space-y-2">{[1, 2].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : installmentSale ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-muted-foreground">{t("installments.total_amount")}</div><div className="font-medium">{Number(installmentSale.totalAmount).toFixed(2)}</div></div>
              <div><div className="text-muted-foreground">{t("installments.monthly_amount")}</div><div className="font-medium">{Number(installmentSale.monthlyAmount).toFixed(2)}</div></div>
              <div><div className="text-muted-foreground">{t("common.status")}</div><Badge variant={installmentSale.status === "completed" ? "default" : "outline"} className="capitalize">{installmentSale.status}</Badge></div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {details?.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 border-b pb-2 last:border-0">
                  <div><div className="text-sm font-medium">{format(new Date(p.dueDate), "MMM d, yyyy")}</div><div className="text-xs text-muted-foreground">{Number(p.amount).toFixed(2)}</div></div>
                  {p.isPaid ? <Badge variant="default"><Check className="me-1 h-3 w-3" />{t("installments.paid")}</Badge> : <Button size="sm" variant="outline" disabled={payMutation.isPending} onClick={() => payMutation.mutate(p.id)}>{t("installments.record_payment")}</Button>}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>{t("installments.title")}</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder={t("installments.select_plan")} /></SelectTrigger>
                <SelectContent>
                  {plans?.filter(p => p.isActive).map(p => (
                    <SelectItem key={p.id} value={p.id}>{t("installments.months_label", { months: p.months })} · {t("installments.interest_label", { percent: p.interestPercent })}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("installments.down_payment")}</Label>
              <Input type="number" step="0.01" min={0} value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="0" />
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          {!isLoading && !installmentSale && (
            <Button disabled={createMutation.isPending || !planId} onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? t("common.saving") : t("installments.sale_create")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
