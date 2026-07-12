import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Badge, Button, Dialog, Input, Label, Spinner, cn } from "@spruvex-r/ui";

import { ApiError } from "../lib/api";
import { formatSar, toHalalas } from "../lib/cart";
import { posApi, type PaymentSummary } from "../lib/pos-api";
import { ReceiptView } from "./ReceiptView";

export function PaymentDialog({
  orderId,
  orderNumber,
  onClose,
  onCompleted,
}: {
  orderId: string;
  orderNumber: number;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [amount, setAmount] = useState("");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  const load = useCallback(async () => {
    const data = await posApi.paymentSummary(orderId);
    setSummary(data);
    setAmount(data.remaining);
  }, [orderId]);

  useEffect(() => {
    void load();
  }, [load]);

  const fullyPaid = summary !== null && toHalalas(summary.remaining) === 0;

  async function record() {
    if (!summary || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await posApi.recordPayment(orderId, {
        method,
        amount,
        ...(reference ? { reference } : {}),
      });
      setSummary(result);
      setAmount(result.remaining);
      setTendered("");
      setReference("");
      if (toHalalas(result.remaining) === 0) {
        onCompleted();
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  const changeDue =
    method === "cash" && tendered !== "" && amount !== ""
      ? toHalalas(tendered) - toHalalas(amount)
      : null;

  if (showReceipt) {
    return <ReceiptView orderId={orderId} onClose={onClose} />;
  }

  return (
    <Dialog open onClose={onClose} title={t("payment.title", { number: orderNumber })}>
      {!summary ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}

          <div className="grid grid-cols-3 gap-2 text-center">
            {(
              [
                ["total", summary.total],
                ["paid", summary.paid],
                ["remaining", summary.remaining],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-lg bg-muted p-2">
                <div className="text-xs text-muted-foreground">{t(`payment.${label}`)}</div>
                <div className="text-lg font-bold" dir="ltr">
                  {value}
                </div>
              </div>
            ))}
          </div>

          {summary.payments.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {summary.payments.map((payment) => (
                <Badge key={payment.id} variant="muted">
                  {t(`payment.${payment.method}`)} · <span dir="ltr">{payment.amount}</span>
                </Badge>
              ))}
            </div>
          )}

          {fullyPaid ? (
            <div className="space-y-3 text-center">
              <p className="text-lg font-bold text-primary">{t("payment.completed")}</p>
              <Button className="w-full" onClick={() => setShowReceipt(true)}>
                {t("payment.showReceipt")}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                {(["cash", "card"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={cn(
                      "flex-1 rounded-lg border-2 py-3 text-lg font-bold transition-colors",
                      method === m
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card",
                    )}
                    onClick={() => setMethod(m)}
                  >
                    {t(`payment.${m}`)}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="pay-amount">{t("payment.amount")} (SAR)</Label>
                <div className="flex gap-2">
                  <Input
                    id="pay-amount"
                    dir="ltr"
                    inputMode="decimal"
                    className="text-lg font-bold"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <Button variant="secondary" onClick={() => setAmount(summary.remaining)}>
                    {t("payment.exact")}
                  </Button>
                </div>
              </div>

              {method === "cash" && (
                <div className="space-y-2">
                  <Label htmlFor="tendered">{t("payment.tendered")}</Label>
                  <Input
                    id="tendered"
                    dir="ltr"
                    inputMode="decimal"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                  />
                  {changeDue !== null && changeDue >= 0 && (
                    <p className="text-sm font-bold text-primary">
                      {t("payment.change")}: <span dir="ltr">{formatSar(changeDue)}</span>
                    </p>
                  )}
                </div>
              )}

              {method === "card" && (
                <div className="space-y-2">
                  <Label htmlFor="reference">{t("payment.reference")}</Label>
                  <Input
                    id="reference"
                    dir="ltr"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </div>
              )}

              <Button size="lg" className="w-full text-lg" disabled={busy} onClick={record}>
                {busy ? <Spinner className="border-primary-foreground" /> : t("payment.pay")}
              </Button>
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
