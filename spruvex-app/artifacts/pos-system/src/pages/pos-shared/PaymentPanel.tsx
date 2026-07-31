import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Banknote, CreditCard, Plus, X, Wallet, PauseCircle, UserCheck, Globe, Link as LinkIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useTranslation } from "@/i18n";
import type { CheckoutPayload, PaymentMethodOption } from "./types";

const FALLBACK_METHODS: PaymentMethodOption[] = [
  { id: -1, name: "cash", percentFee: "0", fixedFee: "0", showFeeToCustomer: false, isActive: true },
  { id: -2, name: "card", percentFee: "0", fixedFee: "0", showFeeToCustomer: false, isActive: true },
];

interface GatewayOption {
  id: string;
  provider: string;
  mode: string;
  isActive: boolean;
  hasCredentials: boolean;
}

const GATEWAY_LABELS: Record<string, string> = { tabby: "Tabby", tamara: "Tamara", moyasar: "Moyasar", mock: "Mock" };

interface SplitLine { methodId: number | null; amount: string }

type PayMode = "single" | "split" | "on_account" | "gateway";

/**
 * Payment panel shared by every POS template. Supports single-method checkout
 * (with tendered-amount + change), split payments across any number of the
 * tenant's configured methods, full on-account (credit) sales, and suspending
 * the current cart to hold it for later. Walk-in customers can't run a balance
 * — on-account and under-paid checkout require a selected customer.
 */
export function PaymentPanel({
  subtotalBeforeTax,
  taxAmount,
  taxRate,
  total,
  isProcessing,
  cartEmpty,
  selectedCustomerId,
  paymentMethods,
  fmt,
  onCheckout,
  onSuspend,
}: {
  subtotalBeforeTax: number;
  taxAmount: number;
  taxRate: number;
  total: number;
  isProcessing: boolean;
  cartEmpty: boolean;
  selectedCustomerId: string | null;
  paymentMethods: PaymentMethodOption[];
  fmt: (n: number) => string;
  onCheckout: (payload: CheckoutPayload) => void;
  onSuspend: () => void;
}) {
  const { t } = useTranslation();
  const methods = paymentMethods.length > 0 ? paymentMethods : FALLBACK_METHODS;
  const [mode, setMode] = useState<PayMode>("single");
  const [selectedMethodId, setSelectedMethodId] = useState<number | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<string | null>(null);
  const [tendered, setTendered] = useState("");
  const [splitLines, setSplitLines] = useState<SplitLine[]>([]);

  const { data: gateways = [] } = useQuery<GatewayOption[]>({
    queryKey: ["payment-gateways"],
    queryFn: () => api<{ data: GatewayOption[] }>("/payments/gateways").then(r => r.data),
    staleTime: 60_000,
  });
  const activeGateways = gateways.filter(g => g.isActive && g.hasCredentials);

  const activeMethods = methods.filter(m => m.isActive);
  const selectedMethod = activeMethods.find(m => m.id === selectedMethodId) ?? activeMethods[0] ?? null;
  const hasCustomer = !!selectedCustomerId;

  const ensureSplitLines = () => {
    if (splitLines.length === 0) setSplitLines([{ methodId: selectedMethod?.id ?? null, amount: total.toFixed(2) }]);
  };

  const setModeSafe = (next: PayMode) => {
    setMode(next);
    if (next === "split") ensureSplitLines();
    if (next === "single") setTendered("");
  };

  const tenderedNum = Math.max(parseFloat(tendered) || 0, 0);
  const change = mode === "single" && tenderedNum >= total ? Math.max(tenderedNum - total, 0) : 0;
  const paid = mode === "single" ? Math.min(tenderedNum, total) : total;

  const splitTotal = splitLines.reduce((s, l) => s + (Math.max(parseFloat(l.amount) || 0, 0)), 0);
  const splitRemaining = Math.max(total - splitTotal, 0);

  const buildSplitPayload = (): CheckoutPayload | null => {
    const lines = splitLines
      .filter(l => (Math.max(parseFloat(l.amount) || 0, 0)) > 0)
      .map(l => {
        const m = activeMethods.find(x => x.id === l.methodId) ?? selectedMethod;
        return { methodName: m?.name ?? "cash", paymentMethodId: m && m.id > 0 ? m.id : undefined, amount: Math.max(parseFloat(l.amount) || 0, 0) };
      });
    if (lines.length === 0) return null;
    const totalPaid = lines.reduce((s, l) => s + l.amount, 0);
    if (totalPaid < total - 0.005 && !hasCustomer) return null;
    return { kind: "split", paymentMethod: "mixed", amountPaid: totalPaid, payments: lines };
  };

  const handlePay = () => {
    if (isProcessing || cartEmpty) return;
    if (mode === "single") {
      if (!selectedMethod) return;
      const amountPaid = Math.min(tenderedNum > 0 ? tenderedNum : total, total);
      if (amountPaid < total - 0.005 && !hasCustomer) return;
      onCheckout({
        kind: "single",
        paymentMethod: selectedMethod.name,
        paymentMethodId: selectedMethod.id > 0 ? selectedMethod.id : undefined,
        amountPaid,
        tendered: tenderedNum > 0 ? tenderedNum : total,
      });
    } else if (mode === "split") {
      const payload = buildSplitPayload();
      if (payload) onCheckout(payload);
    } else if (mode === "gateway") {
      if (!hasCustomer || !selectedGateway) return;
      const gw = gateways.find(g => g.provider === selectedGateway);
      if (!gw) return;
      onCheckout({
        kind: "gateway",
        paymentMethod: GATEWAY_LABELS[gw.provider] ?? gw.provider,
        amountPaid: 0,
        gatewayProvider: gw.provider,
      });
    } else {
      if (!hasCustomer) return;
      onCheckout({ kind: "on_account", paymentMethod: "on_account", amountPaid: 0 });
    }
  };

  const needsCustomer = mode === "on_account"
    || mode === "gateway"
    || (mode === "single" && tenderedNum > 0 && tenderedNum < total - 0.005)
    || (mode === "split" && splitTotal > 0 && splitRemaining > 0.005);

  return (
    <div className="p-4 bg-card border-t space-y-3">
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">{t("pos.subtotal")}</span>
          <span>{fmt(subtotalBeforeTax)}</span>
        </div>
        {taxRate > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">{t("pos.tax", { rate: taxRate })}</span>
            <span>{fmt(taxAmount)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between text-xl font-bold">
          <span>{t("pos.total")}</span>
          <span className="text-primary">{fmt(total)}</span>
        </div>
      </div>

      {isProcessing ? (
        <div className="h-14 rounded-lg bg-muted flex items-center justify-center gap-3">
          <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-sm font-medium">{t("pos.processing")}</span>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-1 rounded-lg bg-muted p-1">
            {(["single", "split", "on_account", "gateway"] as const).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setModeSafe(m)}
                className={cn(
                  "px-2 py-1.5 rounded-md text-xs font-medium transition-colors",
                  mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {m === "single" ? t("pos.pay_full") : m === "split" ? t("pos.pay_split") : m === "on_account" ? t("pos.on_account") : t("pos.online_payment")}
              </button>
            ))}
          </div>

          {mode === "single" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {activeMethods.map(m => {
                  const active = selectedMethod?.id === m.id;
                  const Icon = m.name.toLowerCase().includes("cash") ? Banknote : CreditCard;
                  return (
                    <Button
                      key={m.id}
                      size="lg"
                      variant={active ? "default" : "outline"}
                      className={cn("h-12", active && m.name.toLowerCase().includes("cash") && "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600")}
                      onClick={() => setSelectedMethodId(m.id)}
                    >
                      <Icon className="me-2 h-4 w-4" />
                      {m.name === "cash" || m.name === "card" ? t(`pos.${m.name}`) : m.name}
                    </Button>
                  );
                })}
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t("pos.amount_received")}</span>
                  <span className="text-muted-foreground">{t("pos.total_due", { amount: fmt(total) })}</span>
                </div>
                <Input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  placeholder={fmt(total)}
                  value={tendered}
                  onChange={e => setTendered(e.target.value)}
                  className="h-11 text-base font-semibold text-end"
                />
              </div>
              {tenderedNum > 0 && tenderedNum < total - 0.005 && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <Wallet className="h-3 w-3" />
                  {hasCustomer
                    ? t("pos.partial_hint", { amount: fmt(total - tenderedNum) })
                    : t("pos.customer_required_for_balance")}
                </div>
              )}
              {change > 0 && (
                <div className="flex justify-between text-sm font-medium">
                  <span className="text-muted-foreground">{t("pos.change")}</span>
                  <span className="text-emerald-600 font-bold">{fmt(change)}</span>
                </div>
              )}
              <Button
                size="lg"
                className="h-12 w-full"
                disabled={cartEmpty || (tenderedNum > 0 && tenderedNum < total - 0.005 && !hasCustomer)}
                onClick={handlePay}
              >
                <Banknote className="me-2 h-5 w-5" />
                {t("pos.pay")} — {fmt(paid)}
              </Button>
            </>
          )}

          {mode === "split" && (
            <div className="space-y-2">
              <div className="space-y-2">
                {splitLines.map((line, idx) => {
                  const lineAmt = Math.max(parseFloat(line.amount) || 0, 0);
                  return (
                    <div key={idx} className="flex items-center gap-2">
                      <Select
                        value={line.methodId ? String(line.methodId) : selectedMethod ? String(selectedMethod.id) : undefined}
                        onValueChange={v => {
                          const next = [...splitLines];
                          next[idx] = { ...next[idx], methodId: Number(v) };
                          setSplitLines(next);
                        }}
                      >
                        <SelectTrigger className="h-9 flex-1 text-sm">
                          <SelectValue placeholder={t("pos.select_method")} />
                        </SelectTrigger>
                        <SelectContent>
                          {activeMethods.map(m => (
                            <SelectItem key={m.id} value={String(m.id)}>
                              {m.name === "cash" || m.name === "card" ? t(`pos.${m.name}`) : m.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={line.amount}
                        onChange={e => {
                          const next = [...splitLines];
                          next[idx] = { ...next[idx], amount: e.target.value };
                          setSplitLines(next);
                        }}
                        className="h-9 w-28 text-sm text-end"
                      />
                      <Button
                        variant="ghost" size="icon"
                        className="h-9 w-9 shrink-0 text-destructive"
                        onClick={() => setSplitLines(prev => prev.filter((_, i) => i !== idx))}
                        disabled={splitLines.length <= 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{t("pos.split_remaining")}</span>
                <span className={cn("font-medium", splitRemaining > 0.005 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600")}>
                  {fmt(splitRemaining)}
                </span>
              </div>
              {splitRemaining > 0.005 && (
                <div className="text-[11px] text-amber-600 dark:text-amber-400">
                  {hasCustomer ? t("pos.partial_hint", { amount: fmt(splitRemaining) }) : t("pos.customer_required_for_balance")}
                </div>
              )}
              <Button
                size="lg"
                className="h-12 w-full"
                disabled={cartEmpty || !buildSplitPayload() || (splitRemaining > 0.005 && !hasCustomer)}
                onClick={() => {
                  const payload = buildSplitPayload();
                  if (payload) onCheckout(payload);
                }}
              >
                <Plus className="me-2 h-5 w-5" />
                {t("pos.pay")} — {fmt(splitTotal)}
              </Button>
              <Button variant="outline" size="sm" className="w-full h-9" onClick={() => setSplitLines(prev => [...prev, { methodId: null, amount: splitRemaining > 0.005 ? splitRemaining.toFixed(2) : "" }])}>
                <Plus className="me-1 h-3.5 w-3.5" /> {t("pos.add_payment")}
              </Button>
            </div>
          )}

          {mode === "on_account" && (
            <div className="space-y-2">
              <div className={cn(
                "rounded-lg border p-3 text-sm flex items-start gap-2",
                hasCustomer ? "border-emerald-500/40 bg-emerald-500/5" : "border-destructive/40 bg-destructive/5",
              )}>
                <UserCheck className={cn("h-4 w-4 mt-0.5 shrink-0", hasCustomer ? "text-emerald-600" : "text-destructive")} />
                <div>
                  <div className="font-medium">{t("pos.on_account_title")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hasCustomer ? t("pos.on_account_ready") : t("pos.customer_required_for_balance")}
                  </div>
                </div>
              </div>
              <Button size="lg" className="h-12 w-full" disabled={cartEmpty || !hasCustomer} onClick={handlePay}>
                <Wallet className="me-2 h-5 w-5" />
                {t("pos.charge_to_account")} — {fmt(total)}
              </Button>
            </div>
          )}

          {mode === "gateway" && (
            <div className="space-y-2">
              <div className={cn(
                "rounded-lg border p-3 text-sm flex items-start gap-2",
                hasCustomer ? "border-blue-500/40 bg-blue-500/5" : "border-destructive/40 bg-destructive/5",
              )}>
                <Globe className={cn("h-4 w-4 mt-0.5 shrink-0", hasCustomer ? "text-blue-600" : "text-destructive")} />
                <div>
                  <div className="font-medium">{t("pos.gateway_title")}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {hasCustomer ? t("pos.gateway_ready") : t("pos.customer_required_for_balance")}
                  </div>
                </div>
              </div>
              {activeGateways.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-2">{t("pos.gateway_none")}</p>
              ) : (
                <div className="space-y-2">
                  {activeGateways.map(gw => {
                    const active = selectedGateway === gw.provider;
                    return (
                      <Button
                        key={gw.id}
                        size="lg"
                        variant={active ? "default" : "outline"}
                        className={cn("h-11 w-full justify-start")}
                        onClick={() => setSelectedGateway(gw.provider)}
                      >
                        <LinkIcon className="me-2 h-4 w-4" />
                        {GATEWAY_LABELS[gw.provider] ?? gw.provider}
                        {gw.mode === "test" && (
                          <span className="ms-auto text-[10px] text-muted-foreground border rounded px-1.5 py-0.5">test</span>
                        )}
                      </Button>
                    );
                  })}
                </div>
              )}
              <Button size="lg" className="h-12 w-full" disabled={cartEmpty || !hasCustomer || !selectedGateway} onClick={handlePay}>
                <Globe className="me-2 h-5 w-5" />
                {t("pos.pay")} — {fmt(total)}
              </Button>
            </div>
          )}

          {needsCustomer && (
            <div className="text-[11px] text-destructive text-center">{t("pos.customer_required_for_balance")}</div>
          )}

          <Button variant="ghost" size="sm" className="w-full h-9 text-muted-foreground" disabled={cartEmpty || isProcessing} onClick={onSuspend}>
            <PauseCircle className="me-1 h-4 w-4" /> {t("pos.suspend")}
          </Button>
        </>
      )}
    </div>
  );
}
