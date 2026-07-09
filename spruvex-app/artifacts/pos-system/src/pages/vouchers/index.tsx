import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, ArrowUpCircle, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { api } from "@/lib/api";

interface Voucher {
  id: number;
  voucherNumber: string;
  type: "receipt" | "payment";
  amount: string;
  party: string | null;
  description: string | null;
  paymentMethod: string;
  date: string;
}

export default function VouchersPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogType, setDialogType] = useState<"receipt" | "payment" | null>(null);

  const { data: vouchers, isLoading } = useQuery<Voucher[]>({
    queryKey: ["vouchers"],
    queryFn: () => api("/vouchers"),
  });

  const createMutation = useMutation({
    mutationFn: (vars: { type: string; amount: number; party: string; description: string; date: string }) =>
      api("/vouchers", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vouchers"] });
      setDialogType(null);
      toast.success(t("vouchers.save_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/vouchers/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vouchers"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("vouchers.title")}</h1>
        <div className="flex gap-2">
          <Button onClick={() => setDialogType("receipt")} variant="default">
            <ArrowDownCircle className="me-2 h-4 w-4" />
            {t("vouchers.add_receipt")}
          </Button>
          <Button onClick={() => setDialogType("payment")} variant="outline">
            <ArrowUpCircle className="me-2 h-4 w-4" />
            {t("vouchers.add_payment")}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        {vouchers?.length === 0 && <p className="text-muted-foreground text-sm">{t("vouchers.empty")}</p>}
        {vouchers?.map(v => (
          <Card key={v.id}>
            <CardContent className="p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {v.type === "receipt"
                  ? <ArrowDownCircle className="h-8 w-8 text-green-600" />
                  : <ArrowUpCircle className="h-8 w-8 text-destructive" />}
                <div>
                  <div className="font-medium text-sm">{v.party || v.voucherNumber}</div>
                  <div className="text-xs text-muted-foreground">{v.voucherNumber} · {v.date}</div>
                  {v.description && <div className="text-xs text-muted-foreground">{v.description}</div>}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className={v.type === "receipt" ? "text-green-600 font-semibold" : "text-destructive font-semibold"}>
                  {v.type === "receipt" ? "+" : "-"}{v.amount}
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteMutation.mutate(v.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {dialogType && (
        <VoucherDialog
          type={dialogType}
          onClose={() => setDialogType(null)}
          onSave={(vars) => createMutation.mutate(vars)}
          isPending={createMutation.isPending}
        />
      )}
    </div>
  );
}

function VoucherDialog({
  type, onClose, onSave, isPending,
}: {
  type: "receipt" | "payment";
  onClose: () => void;
  onSave: (vars: { type: string; amount: number; party: string; description: string; date: string }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [party, setParty] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{type === "receipt" ? t("vouchers.add_receipt") : t("vouchers.add_payment")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("vouchers.amount")}</Label>
            <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("vouchers.party")}</Label>
            <Input value={party} onChange={(e) => setParty(e.target.value)} placeholder={t("vouchers.party_placeholder")} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("vouchers.date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("vouchers.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            disabled={isPending || !amount}
            onClick={() => onSave({ type, amount: Number(amount), party, description, date })}
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
