import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Button, Dialog, Input, Label, Spinner, cn } from "@spruvex-r/ui";

import { ApiError } from "../lib/api";
import { posApi } from "../lib/pos-api";

export function DiscountDialog({
  orderId,
  onClose,
  onApplied,
}: {
  orderId: string;
  onClose: () => void;
  onApplied: () => void;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<"percentage" | "fixed">("percentage");
  const [value, setValue] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await posApi.applyDiscount(orderId, { type, value, reason });
      onApplied();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={t("discount.title")}>
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="destructive">{error}</Alert>}
        <div className="flex gap-2">
          {(["percentage", "fixed"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={cn(
                "flex-1 rounded-lg border-2 py-2 font-medium transition-colors",
                type === option
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card",
              )}
              onClick={() => setType(option)}
            >
              {t(`discount.${option}`)}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="disc-value">{t("discount.value")}</Label>
          <Input
            id="disc-value"
            dir="ltr"
            inputMode="decimal"
            required
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="disc-reason">{t("discount.reason")}</Label>
          <Input
            id="disc-reason"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy}>
          {busy ? <Spinner className="border-primary-foreground" /> : t("discount.apply")}
        </Button>
      </form>
    </Dialog>
  );
}
