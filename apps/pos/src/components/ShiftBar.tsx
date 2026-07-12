import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";

import { Alert, Badge, Button, Dialog, Input, Label, Spinner } from "@spruvex-r/ui";

import { ApiError } from "../lib/api";
import { posApi, type Shift } from "../lib/pos-api";

/** Shift status chip + open/close dialogs. */
export function ShiftBar({
  branchId,
  shift,
  onShiftChange,
}: {
  branchId: string;
  shift: Shift | null;
  onShiftChange: (shift: Shift | null) => void;
}) {
  const { t } = useTranslation();
  const [dialog, setDialog] = useState<"open" | "close" | null>(null);
  const [openingCash, setOpeningCash] = useState("0");
  const [actualCash, setActualCash] = useState("");
  const [closed, setClosed] = useState<Shift | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void posApi.currentShift(branchId).then(onShiftChange);
    // eslint-disable-next-line -- load once per branch
  }, [branchId]);

  async function submitOpen(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onShiftChange(await posApi.openShift(branchId, openingCash || "0"));
      setDialog(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function submitClose(event: FormEvent) {
    event.preventDefault();
    if (!shift) return;
    setBusy(true);
    setError(null);
    try {
      const result = await posApi.closeShift(shift.id, actualCash);
      setClosed(result);
      onShiftChange(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {shift ? (
        <div className="flex items-center gap-2">
          <Badge variant="success">{t("shift.active")}</Badge>
          <Button variant="outline" size="sm" onClick={() => { setClosed(null); setActualCash(""); setError(null); setDialog("close"); }}>
            {t("shift.close")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Badge variant="destructive">{t("shift.noShift")}</Badge>
          <Button size="sm" onClick={() => { setError(null); setDialog("open"); }}>
            {t("shift.open")}
          </Button>
        </div>
      )}

      <Dialog open={dialog === "open"} onClose={() => setDialog(null)} title={t("shift.openTitle")}>
        <form onSubmit={submitOpen} className="space-y-4">
          {error && <Alert variant="destructive">{error}</Alert>}
          <div className="space-y-2">
            <Label htmlFor="opening">{t("shift.openingCash")} (SAR)</Label>
            <Input
              id="opening"
              dir="ltr"
              inputMode="decimal"
              value={openingCash}
              onChange={(e) => setOpeningCash(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? <Spinner className="border-primary-foreground" /> : t("shift.confirm")}
          </Button>
        </form>
      </Dialog>

      <Dialog open={dialog === "close"} onClose={() => setDialog(null)} title={t("shift.closeTitle")}>
        {closed ? (
          <div className="space-y-3">
            <Alert>{t("shift.closed")}</Alert>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span>{t("shift.expected")}</span>
                <span dir="ltr">{closed.expectedCash}</span>
              </div>
              {closed.difference !== null && (
                <div className="flex justify-between font-bold">
                  <span>{t("shift.difference")}</span>
                  <span dir="ltr">{closed.difference}</span>
                </div>
              )}
            </div>
            <Button className="w-full" onClick={() => setDialog(null)}>
              {t("shift.confirm")}
            </Button>
          </div>
        ) : (
          <form onSubmit={submitClose} className="space-y-4">
            {error && <Alert variant="destructive">{error}</Alert>}
            <div className="space-y-2">
              <Label htmlFor="actual">{t("shift.actualCash")} (SAR)</Label>
              <Input
                id="actual"
                dir="ltr"
                inputMode="decimal"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? <Spinner className="border-primary-foreground" /> : t("shift.close")}
            </Button>
          </form>
        )}
      </Dialog>
    </>
  );
}
