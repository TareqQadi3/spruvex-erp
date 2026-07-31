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
import { usePaymentMethods } from "./usePaymentMethods";
import type { Sale } from "./types";

export function RecordPaymentDialog({ sale, onClose }: { sale: Sale; onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: methods } = usePaymentMethods();
  const [amount, setAmount] = useState(Number(sale.outstanding).toFixed(2));
  const [methodId, setMethodId] = useState("");
  const outstanding = Number(sale.outstanding);
  const amountNum = Math.max(parseFloat(amount) || 0, 0);

  const mutation = useMutation({
    mutationFn: () => {
      const method = methods?.find(m => m.id === Number(methodId));
      return api(`/sales/${sale.id}/payments`, {
        method: "POST",
        body: JSON.stringify({ payments: [{ methodName: method?.name ?? "cash", paymentMethodId: method?.id, amount: amountNum }] }),
      });
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["sales"] }); toast.success(t("sales.payment_recorded")); onClose(); },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleSubmit = () => {
    if (amountNum <= 0) { toast.error(t("sales.payment_invalid")); return; }
    if (amountNum > outstanding + 0.005) { toast.error(t("sales.payment_exceeds")); return; }
    mutation.mutate();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{t("sales.payment_title")}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("sales.outstanding")}</span>
            <span className="font-semibold text-amber-600 dark:text-amber-400">{Number(sale.outstanding).toFixed(2)}</span>
          </div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button disabled={mutation.isPending || amountNum <= 0} onClick={handleSubmit}>
            {mutation.isPending ? t("common.saving") : t("sales.payment_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
