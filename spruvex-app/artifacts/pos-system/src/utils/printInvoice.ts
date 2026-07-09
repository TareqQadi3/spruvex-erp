export interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
}

export interface InvoiceSale {
  id: number;
  total: number | string;
  paymentMethod: string;
  createdAt: string | Date;
  customerName?: string | null;
}

export interface InvoiceSettings {
  shopName?: string;
  shopAddress?: string | null;
  shopPhone?: string | null;
  logoUrl?: string | null;
  invoiceHeaderText?: string | null;
  invoiceFooterText?: string | null;
  currency?: string;
  taxRate?: number | string;
  vatNumber?: string | null;
}

export async function printInvoice({
  sale,
  items,
  settings,
}: {
  sale: InvoiceSale;
  items: InvoiceItem[];
  settings?: InvoiceSettings;
}) {
  const currency = settings?.currency ?? "SAR";
  const fmt = (n: number) => `${currency} ${n.toFixed(2)}`;
  const total = Number(sale.total);
  const taxRate = Number(settings?.taxRate ?? 0);
  const subtotalBeforeTax = taxRate > 0 ? total / (1 + taxRate / 100) : total;
  const taxAmount = total - subtotalBeforeTax;
  const date = new Date(sale.createdAt);
  const invoiceNo = String(sale.id).padStart(6, "0");

  // ZATCA Phase-1 simplified e-invoice QR (only when a VAT number is configured)
  let qrDataUrl = "";
  if (settings?.vatNumber) {
    try {
      const { generateZatcaQrPayload } = await import("./zatcaQr");
      const QRCode = (await import("qrcode")).default;
      const payload = generateZatcaQrPayload({
        sellerName: settings.shopName ?? "",
        vatNumber: settings.vatNumber,
        timestamp: new Date(sale.createdAt).toISOString(),
        total,
        vatTotal: taxAmount,
      });
      qrDataUrl = await QRCode.toDataURL(payload, { width: 140, margin: 1 });
    } catch {
      qrDataUrl = "";
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Invoice #${invoiceNo}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', 'Helvetica', sans-serif;
      font-size: 13px;
      color: #111;
      background: #fff;
      padding: 30px;
      max-width: 640px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      padding-bottom: 18px;
      border-bottom: 2px solid #111;
      margin-bottom: 18px;
    }
    .logo {
      max-height: 70px;
      max-width: 220px;
      margin-bottom: 10px;
      display: block;
      margin-left: auto;
      margin-right: auto;
    }
    .shop-name { font-size: 22px; font-weight: 700; letter-spacing: 0.5px; }
    .shop-detail { color: #555; font-size: 12px; margin-top: 3px; }
    .invoice-header-text { font-size: 12px; color: #444; margin-top: 6px; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      margin: 18px 0;
      background: #f8f8f8;
      border-radius: 4px;
      padding: 12px;
    }
    .meta-item .label {
      font-size: 10px;
      color: #777;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 2px;
    }
    .meta-item .value { font-weight: 600; font-size: 13px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
    }
    thead tr {
      background: #111;
      color: #fff;
    }
    th {
      padding: 8px 10px;
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    th:last-child, td:last-child { text-align: right; }
    th:nth-child(3), td:nth-child(3) { text-align: center; }
    tbody tr { border-bottom: 1px solid #eee; }
    tbody tr:last-child { border-bottom: none; }
    td { padding: 8px 10px; font-size: 13px; }
    tbody tr:hover { background: #fafafa; }
    .totals-section {
      margin-top: 12px;
      border-top: 1px solid #ddd;
      padding-top: 10px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 13px;
    }
    .totals-row .label-col { color: #555; }
    .totals-row.grand-total {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 2px solid #111;
      font-size: 16px;
      font-weight: 700;
    }
    .payment-badge {
      display: inline-block;
      margin-top: 14px;
      padding: 5px 16px;
      border: 1.5px solid #111;
      border-radius: 20px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .footer {
      margin-top: 24px;
      padding-top: 12px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 11px;
      line-height: 1.6;
    }
    .text-center { text-align: center; }
    @media print {
      body { padding: 0; }
      @page { margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    ${settings?.logoUrl ? `<img src="${settings.logoUrl}" class="logo" alt="Company Logo">` : ""}
    <div class="shop-name">${settings?.shopName ?? "POS System"}</div>
    ${settings?.shopAddress ? `<div class="shop-detail">${settings.shopAddress}</div>` : ""}
    ${settings?.shopPhone ? `<div class="shop-detail">Tel: ${settings.shopPhone}</div>` : ""}
    ${settings?.invoiceHeaderText ? `<div class="invoice-header-text">${settings.invoiceHeaderText}</div>` : ""}
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="label">Invoice Number</div>
      <div class="value">#${invoiceNo}</div>
    </div>
    <div class="meta-item">
      <div class="label">Date &amp; Time</div>
      <div class="value">${date.toLocaleDateString("en-SA")} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
    <div class="meta-item">
      <div class="label">Customer</div>
      <div class="value">${sale.customerName ?? "Walk-in"}</div>
    </div>
    <div class="meta-item">
      <div class="label">Payment Method</div>
      <div class="value">${sale.paymentMethod.charAt(0).toUpperCase() + sale.paymentMethod.slice(1)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th>Item Description</th>
        <th style="width:8%">Qty</th>
        <th style="width:20%">Unit Price</th>
        <th style="width:20%">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${item.productName}</td>
        <td style="text-align:center">${item.quantity}</td>
        <td style="text-align:right">${fmt(Number(item.unitPrice))}</td>
        <td style="text-align:right">${fmt(Number(item.subtotal))}</td>
      </tr>`).join("")}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-row">
      <span class="label-col">Subtotal (excl. VAT)</span>
      <span>${fmt(subtotalBeforeTax)}</span>
    </div>
    ${taxRate > 0 ? `<div class="totals-row">
      <span class="label-col">VAT (${taxRate}%)</span>
      <span>${fmt(taxAmount)}</span>
    </div>` : ""}
    <div class="totals-row grand-total">
      <span>TOTAL</span>
      <span>${fmt(total)}</span>
    </div>
  </div>

  <div class="text-center">
    <span class="payment-badge">${sale.paymentMethod}</span>
  </div>

  ${qrDataUrl ? `<div class="text-center" style="margin-top:18px">
    <img src="${qrDataUrl}" alt="ZATCA QR" style="width:120px;height:120px" />
    ${settings?.vatNumber ? `<div style="font-size:10px;color:#777;margin-top:4px">VAT: ${settings.vatNumber}</div>` : ""}
  </div>` : ""}

  ${settings?.invoiceFooterText ? `<div class="footer">${settings.invoiceFooterText}</div>` : `<div class="footer">Thank you for your business!</div>`}

  <script>
    window.onload = function () {
      setTimeout(function () {
        window.print();
      }, 300);
    };
  </script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=750,height=700,scrollbars=yes");
  if (!win) {
    alert("Please allow popups to print invoices. Check your browser settings.");
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}
