interface ShareItem { productName: string; quantity: number; subtotal: number | string; }

interface ShareInvoiceArgs {
  invoiceNo: number;
  shopName?: string;
  customerName?: string | null;
  items: ShareItem[];
  total: number | string;
  currency?: string;
}

/** Builds a plain-text receipt summary used for email/WhatsApp sharing. */
export function buildInvoiceText({ invoiceNo, shopName, customerName, items, total, currency = "SAR" }: ShareInvoiceArgs): string {
  const lines = [
    shopName ? `*${shopName}*` : "",
    `Invoice #${String(invoiceNo).padStart(6, "0")}`,
    customerName ? `Customer: ${customerName}` : "",
    "------------------------",
    ...items.map(i => `${i.productName} x${i.quantity} = ${currency} ${Number(i.subtotal).toFixed(2)}`),
    "------------------------",
    `Total: ${currency} ${Number(total).toFixed(2)}`,
    "",
    "Thank you for your business!",
  ];
  return lines.filter(Boolean).join("\n");
}

/** Opens the device email client with the invoice prefilled (offline-friendly). */
export function emailInvoice(args: ShareInvoiceArgs & { to?: string }) {
  const subject = `Invoice #${String(args.invoiceNo).padStart(6, "0")}`;
  const body = buildInvoiceText(args);
  window.open(`mailto:${args.to ?? ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
}

/** Opens WhatsApp with the invoice prefilled via the wa.me deep link. */
export function whatsappInvoice(args: ShareInvoiceArgs & { phone?: string | null }) {
  const text = buildInvoiceText(args);
  const phone = (args.phone ?? "").replace(/[^\d]/g, "");
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, "_blank");
}
