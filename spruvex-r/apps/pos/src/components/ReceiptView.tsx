import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Dialog, Spinner } from "@spruvex-r/ui";

import { posApi, type ReceiptData } from "../lib/pos-api";
import { printHtml } from "../lib/print";

function receiptHtml(receipt: ReceiptData, t: (key: string, opts?: Record<string, unknown>) => string): string {
  const p = receipt.payload;
  const lines = p.order.lines
    .map(
      (line) => `
      <div class="item">
        <div class="row"><span>${line.quantity}× ${line.name}</span><span dir="ltr">${line.lineTotal}</span></div>
        ${line.modifiers.map((m) => `<div class="mods">+ ${m.name} <span dir="ltr">(${m.priceAdjustment})</span></div>`).join("")}
      </div>`,
    )
    .join("");
  const payments = p.payments
    .map((payment) => `<div class="row muted"><span>${t(`payment.${payment.method}`)}</span><span dir="ltr">${payment.amount}</span></div>`)
    .join("");

  return `
    <h1>${p.restaurant.name}</h1>
    <p class="center muted">${p.branch.name}${p.branch.address ? ` — ${p.branch.address}` : ""}</p>
    ${p.restaurant.vatNumber ? `<p class="center muted">${t("receipt.vatNumber")}: <span dir="ltr">${p.restaurant.vatNumber}</span></p>` : ""}
    <div class="line"></div>
    <div class="row"><span>${t("receipt.title", { number: receipt.receiptNumber })}</span><span dir="ltr">#${p.order.orderNumber}</span></div>
    <p class="muted" dir="ltr">${new Date(receipt.issuedAt).toLocaleString()}</p>
    ${p.order.table ? `<p class="muted">${p.order.table}</p>` : ""}
    <div class="line"></div>
    ${lines}
    <div class="line"></div>
    <div class="row"><span>${t("receipt.subtotal")}</span><span dir="ltr">${p.totals.subtotal}</span></div>
    ${Number(p.totals.discount) > 0 ? `<div class="row"><span>${t("receipt.discount")}</span><span dir="ltr">-${p.totals.discount}</span></div>` : ""}
    <div class="row"><span>${t("receipt.vat", { rate: p.totals.vatRate })}</span><span dir="ltr">${p.totals.vatAmount}</span></div>
    <div class="row big"><span>${t("receipt.total")}</span><span dir="ltr">${p.totals.total} ${p.restaurant.currency}</span></div>
    <div class="line"></div>
    ${payments}
    <div class="line"></div>
    <p class="center">${t("receipt.thanks")}</p>`;
}

export function ReceiptView({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);

  useEffect(() => {
    void posApi.receipt(orderId).then(setReceipt);
  }, [orderId]);

  return (
    <Dialog
      open
      onClose={onClose}
      title={receipt ? t("receipt.title", { number: receipt.receiptNumber }) : undefined}
    >
      {!receipt ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div
            className="mx-auto max-w-xs rounded-lg border bg-white p-4 text-sm text-black"
            dangerouslySetInnerHTML={{ __html: receiptHtml(receipt, t) }}
          />
          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() =>
                printHtml(
                  t("receipt.title", { number: receipt.receiptNumber }),
                  receiptHtml(receipt, t),
                )
              }
            >
              {t("receipt.print")}
            </Button>
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t("receipt.newOrder")}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}
