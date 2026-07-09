import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { TOKEN_KEY } from "@/contexts/AuthContext";

interface PaymentMethod {
  id: number;
  name: string;
  percentFee: string;
  fixedFee: string;
  showFeeToCustomer: boolean;
  isActive: boolean;
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.status === 204 ? null : res.json();
}

export default function PaymentMethodsSettingsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [dialogMethod, setDialogMethod] = useState<PaymentMethod | "new" | null>(null);

  const { data: methods, isLoading } = useQuery<PaymentMethod[]>({
    queryKey: ["payment-methods"],
    queryFn: () => authFetch("/payment-methods"),
  });

  const saveMutation = useMutation({
    mutationFn: (vars: { id?: number; name: string; percentFee: number; fixedFee: number; showFeeToCustomer: boolean }) =>
      vars.id
        ? authFetch(`/payment-methods/${vars.id}`, { method: "PUT", body: JSON.stringify(vars) })
        : authFetch("/payment-methods", { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-methods"] });
      setDialogMethod(null);
      toast.success(t("paymentMethods.save_success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => authFetch(`/payment-methods/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-methods"] }),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (vars: { id: number; isActive: boolean }) =>
      authFetch(`/payment-methods/${vars.id}`, { method: "PUT", body: JSON.stringify({ isActive: vars.isActive }) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payment-methods"] }),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings">
            <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t("paymentMethods.title")}</h1>
        </div>
        <Button onClick={() => setDialogMethod("new")}>
          <Plus className="me-2 h-4 w-4" />
          {t("paymentMethods.add")}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("paymentMethods.list_title")}</CardTitle>
          <CardDescription>{t("paymentMethods.list_desc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
          {methods?.map(m => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <div className="font-medium text-sm">{m.name}</div>
                <div className="text-xs text-muted-foreground">
                  {t("paymentMethods.fee_summary", { percent: m.percentFee, fixed: m.fixedFee })}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={m.isActive}
                  onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: m.id, isActive: checked })}
                />
                <Button variant="ghost" size="icon" onClick={() => setDialogMethod(m)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(m.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {dialogMethod && (
        <MethodDialog
          method={dialogMethod === "new" ? null : dialogMethod}
          onClose={() => setDialogMethod(null)}
          onSave={(vars) => saveMutation.mutate(vars)}
          isPending={saveMutation.isPending}
        />
      )}
    </div>
  );
}

function MethodDialog({
  method, onClose, onSave, isPending,
}: {
  method: PaymentMethod | null;
  onClose: () => void;
  onSave: (vars: { id?: number; name: string; percentFee: number; fixedFee: number; showFeeToCustomer: boolean }) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState(method?.name ?? "");
  const [percentFee, setPercentFee] = useState(method?.percentFee ?? "0");
  const [fixedFee, setFixedFee] = useState(method?.fixedFee ?? "0");
  const [showFeeToCustomer, setShowFeeToCustomer] = useState(method?.showFeeToCustomer ?? true);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{method ? t("paymentMethods.edit") : t("paymentMethods.add")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>{t("paymentMethods.name")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("paymentMethods.name_placeholder")} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>{t("paymentMethods.percent_fee")}</Label>
              <Input type="number" step="0.01" value={percentFee} onChange={(e) => setPercentFee(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("paymentMethods.fixed_fee")}</Label>
              <Input type="number" step="0.01" value={fixedFee} onChange={(e) => setFixedFee(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label className="text-sm">{t("paymentMethods.show_fee_to_customer")}</Label>
            <Switch checked={showFeeToCustomer} onCheckedChange={setShowFeeToCustomer} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.cancel")}</Button>
          <Button
            disabled={isPending || !name.trim()}
            onClick={() => onSave({
              id: method?.id,
              name: name.trim(),
              percentFee: Number(percentFee) || 0,
              fixedFee: Number(fixedFee) || 0,
              showFeeToCustomer,
            })}
          >
            {isPending ? t("common.saving") : t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
