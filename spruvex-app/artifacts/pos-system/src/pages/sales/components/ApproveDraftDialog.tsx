import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet } from "lucide-react";
import { usePaymentMethods } from "./usePaymentMethods";
import type { Sale } from "./types";

export function ApproveDraftDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: methods } = usePaymentMethods();
  const [methodId, setMethodId] = useState("");
  const [amount, setAmount] = useState(Number(sale.total).toFixed(2));
  const [onAccount, setOnAccount] = useState(false);
  const total = Number(sale.total);
  const amountNum = onAccount ? 0 : Math.max(parseFloat(amount) || 0, 0);

  const mutation = useMutation({
    mutationFn: () => {
      const method = methods?.find(m => m.id === Number(methodId));
      return api(`/sales/${sale.id}/approve`, {
        method: "POST",
        body: JSON.stringify(onAccount
          ? { paymentMethod: "on_account", amountPaid: 0 }
          : { paymentMethod: method?.name ?? "cash", paymentMethodId: method?.id, amountPaid: amountNum }),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sales"] }); toast.success(t("sales.draft_approved")); onClose(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (!onAccount && amountNum <= 0) { toast.error(t("sales.payment_invalid")); return; }
    mutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t("sales.approve_title")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("common.amount")}</span>
            <span className="font-semibold">{Number(sale.total).toFixed(2)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant={onAccount ? "outline" : "default"} className="flex-1" onClick={() => setOnAccount(false)}>
              <Wallet className="me-2 h-4 w-4" />{t("sales.approve_pay_now")}
            </Button>
            <Button variant={onAccount ? "default" : "outline"} className="flex-1" onClick={() => setOnAccount(true)}>
              {t("sales.approve_on_account")}
            </Button>
          </div>
          {!onAccount && (
            <>
              <div className="space-y-1.5">
                <Label>{t("common.amount")}</Label>
                <Input type="number" step="0.01" min={0} value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>{t("customers.payment_method")}</Label>
                <Select value={methodId} onValueChange={setMethodId}>
                  <SelectTrigger><SelectValue placeholder={t("pos.cash")} /></SelectTrigger>
                  <SelectContent>
                    {methods?.filter(m => m.isActive).map(m => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          {onAccount && (
            <p className="text-xs text-muted-foreground">
              {sale.customerId ? t("sales.approve_on_account_hint") : t("pos.customer_required_for_balance")}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={mutation.isPending || (onAccount && !sale.customerId)} onClick={handleSubmit}>
            {mutation.isPending ? t("common.saving") : t("sales.approve_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
