import { qrContentToDataUrl } from "./qrImageService";
import type { PrintDocumentData, PrintLine, PrintType, TemplateConfig } from "../types/print.types";

const ACCENT_COLOR_RE = /^#[0-9a-fA-F]{6}$/;
const FALLBACK_ACCENT_COLOR = "#1a56db";

// This is the one place in the codebase that renders tenant-influenced free
// text (headerText/footerText/party names/notes) directly into an HTML
// document served straight to a browser tab. Every interpolated string field
// MUST go through this — no exceptions, no raw template literals with data.
function escapeHtml(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeAccentColor(color: string): string {
  return ACCENT_COLOR_RE.test(color) ? color : FALLBACK_ACCENT_COLOR;
}

function formatMoney(value: string, currency: string): string {
  const n = Number(value);
  const formatted = Number.isFinite(n) ? n.toFixed(2) : "0.00";
  return `${escapeHtml(currency)} ${formatted}`;
}

function formatDate(isoDate: string, language: "ar" | "en"): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return escapeHtml(isoDate);
  const locale = language === "ar" ? "ar-SA" : "en-SA";
  try {
    return `${date.toLocaleDateString(locale)} ${date.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return date.toISOString();
  }
}

interface Labels {
  documentNumber: string;
  date: string;
  buyer: string;
  seller: string;
  vat: string;
  relatedDocument: string;
  item: string;
  qty: string;
  unitPrice: string;
  discount: string;
  lineSubtotal: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  notCompliant: string;
  qrPending: string;
  notes: string;
  walkIn: string;
}

const LABELS: Record<"ar" | "en", Labels> = {
  ar: {
    documentNumber: "رقم المستند",
    date: "التاريخ",
    buyer: "العميل",
    seller: "البائع",
    vat: "الرقم الضريبي",
    relatedDocument: "المستند المرتبط",
    item: "الصنف",
    qty: "الكمية",
    unitPrice: "سعر الوحدة",
    discount: "الخصم",
    lineSubtotal: "الإجمالي",
    subtotal: "المجموع الفرعي",
    discountTotal: "إجمالي الخصم",
    taxTotal: "ضريبة القيمة المضافة",
    grandTotal: "الإجمالي الكلي",
    notCompliant: "مسودة — لم يتم اعتماد هذا المستند من هيئة الزكاة والضريبة بعد",
    qrPending: "لم يتم توليد رمز الاستجابة السريع بعد (الفاتورة غير موقّعة بعد)",
    notes: "ملاحظات",
    walkIn: "عميل نقدي",
  },
  en: {
    documentNumber: "Document Number",
    date: "Date",
    buyer: "Buyer",
    seller: "Seller",
    vat: "VAT Number",
    relatedDocument: "Related Document",
    item: "Item",
    qty: "Qty",
    unitPrice: "Unit Price",
    discount: "Discount",
    lineSubtotal: "Subtotal",
    subtotal: "Subtotal",
    discountTotal: "Total Discount",
    taxTotal: "VAT",
    grandTotal: "Grand Total",
    notCompliant: "Draft — not yet submitted to ZATCA",
    qrPending: "QR code not yet generated (invoice not signed yet)",
    notes: "Notes",
    walkIn: "Walk-in",
  },
};

const AUTO_PRINT_SCRIPT = `<script>window.onload=()=>setTimeout(()=>window.print(),300)</script>`;

async function buildQrSection(data: PrintDocumentData, config: TemplateConfig, sizePx: number): Promise<string> {
  const labels = LABELS[config.language];

  if (data.qrContent) {
    const dataUrl = await qrContentToDataUrl(data.qrContent, sizePx);
    return `<div class="qr-block"><img src="${dataUrl}" alt="QR" style="width:${sizePx}px;height:${sizePx}px" /></div>`;
  }

  if (data.documentKind === "sales") {
    return `<div class="qr-pending">${escapeHtml(labels.qrPending)}</div>`;
  }

  return "";
}

function renderComplianceBadge(data: PrintDocumentData, config: TemplateConfig): string {
  if (data.isZatcaCompliant || data.documentKind !== "sales") return "";
  const labels = LABELS[config.language];
  return `<div class="compliance-badge">${escapeHtml(labels.notCompliant)}</div>`;
}

function renderTitle(data: PrintDocumentData, config: TemplateConfig): string {
  return config.language === "ar" ? escapeHtml(data.documentTitleAr) : escapeHtml(data.documentTitleEn);
}

function baseStyles(accentColor: string): string {
  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', 'Tahoma', 'Arial', sans-serif; color: #111; background: #fff; }
    .accent { color: ${accentColor}; }
  `;
}

// --- A4 layout ---------------------------------------------------------------
// Ported (server-side) from artifacts/pos-system/src/utils/printInvoice.ts —
// same visual structure (header, meta-grid, items table, totals, QR, footer)
// but every field is driven by PrintDocumentData/TemplateConfig instead of
// hardcoded English-only strings, and it supports RTL/Arabic.

function renderA4(html: {
  data: PrintDocumentData;
  config: TemplateConfig;
  accentColor: string;
  qrSectionHtml: string;
  labels: Labels;
  isRtl: boolean;
}): string {
  const { data, config, accentColor, qrSectionHtml, labels, isRtl } = html;
  const textAlignStart = isRtl ? "right" : "left";
  const textAlignEnd = isRtl ? "left" : "right";

  const rowsHtml = data.lines
    .map(
      (line: PrintLine, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(line.name)}</td>
        <td style="text-align:center">${line.quantity}</td>
        <td style="text-align:${textAlignEnd}">${formatMoney(line.unitPrice, data.currency)}</td>
        <td style="text-align:${textAlignEnd}">${formatMoney(line.discount, data.currency)}</td>
        <td style="text-align:${textAlignEnd}">${formatMoney(line.subtotal, data.currency)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="${config.language}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.documentNumber)}</title>
  <style>
    ${baseStyles(accentColor)}
    body { font-size: 13px; padding: 30px; max-width: 720px; margin: 0 auto; }
    .header { text-align: center; padding-bottom: 18px; border-bottom: 2px solid ${accentColor}; margin-bottom: 18px; }
    .logo { max-height: 70px; max-width: 220px; margin: 0 auto 10px; display: block; }
    .doc-title { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .shop-detail { color: #555; font-size: 12px; margin-top: 3px; }
    .header-text { font-size: 12px; color: #444; margin-top: 6px; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin: 18px 0; background: #f8f8f8; border-radius: 4px; padding: 12px; }
    .meta-item .label { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
    .meta-item .value { font-weight: 600; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 16px 0; }
    thead tr { background: ${accentColor}; color: #fff; }
    th { padding: 8px 10px; text-align: ${textAlignStart}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px; }
    th:nth-child(3) { text-align: center; }
    tbody tr { border-bottom: 1px solid #eee; }
    td { padding: 8px 10px; font-size: 13px; text-align: ${textAlignStart}; }
    .totals-section { margin-top: 12px; border-top: 1px solid #ddd; padding-top: 10px; max-width: 320px; margin-inline-start: auto; }
    .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .totals-row .label-col { color: #555; }
    .totals-row.grand-total { margin-top: 8px; padding-top: 8px; border-top: 2px solid ${accentColor}; font-size: 16px; font-weight: 700; }
    .compliance-badge { display: inline-block; margin-top: 14px; padding: 4px 12px; border: 1px solid #999; border-radius: 4px; font-size: 11px; color: #777; }
    .qr-block { text-align: center; margin-top: 18px; }
    .qr-pending { text-align: center; margin-top: 18px; font-size: 11px; color: #999; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 11px; line-height: 1.6; }
    .text-center { text-align: center; }
    @media print {
      body { padding: 0; }
      @page { size: A4; margin: 10mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="doc-title accent">${renderTitle(data, config)}</div>
    <div class="shop-detail">${escapeHtml(data.seller.name)}</div>
    ${data.seller.vatNumber ? `<div class="shop-detail">${escapeHtml(labels.vat)}: ${escapeHtml(data.seller.vatNumber)}</div>` : ""}
    ${config.headerText ? `<div class="header-text">${escapeHtml(config.headerText)}</div>` : ""}
  </div>

  <div class="meta-grid">
    <div class="meta-item">
      <div class="label">${escapeHtml(labels.documentNumber)}</div>
      <div class="value">${escapeHtml(data.documentNumber)}</div>
    </div>
    <div class="meta-item">
      <div class="label">${escapeHtml(labels.date)}</div>
      <div class="value">${formatDate(data.issueDate, config.language)}</div>
    </div>
    ${
      config.showBuyerInfo
        ? `<div class="meta-item">
      <div class="label">${escapeHtml(labels.buyer)}</div>
      <div class="value">${data.buyer?.name ? escapeHtml(data.buyer.name) : escapeHtml(labels.walkIn)}</div>
    </div>`
        : ""
    }
    ${
      data.relatedDocumentNumber
        ? `<div class="meta-item">
      <div class="label">${escapeHtml(labels.relatedDocument)}</div>
      <div class="value">${escapeHtml(data.relatedDocumentNumber)}</div>
    </div>`
        : ""
    }
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:5%">#</th>
        <th>${escapeHtml(labels.item)}</th>
        <th style="width:8%">${escapeHtml(labels.qty)}</th>
        <th style="width:18%">${escapeHtml(labels.unitPrice)}</th>
        <th style="width:15%">${escapeHtml(labels.discount)}</th>
        <th style="width:18%">${escapeHtml(labels.lineSubtotal)}</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>

  <div class="totals-section">
    <div class="totals-row">
      <span class="label-col">${escapeHtml(labels.subtotal)}</span>
      <span>${formatMoney(data.subtotal, data.currency)}</span>
    </div>
    ${
      Number(data.discountAmount) > 0
        ? `<div class="totals-row">
      <span class="label-col">${escapeHtml(labels.discountTotal)}</span>
      <span>${formatMoney(data.discountAmount, data.currency)}</span>
    </div>`
        : ""
    }
    <div class="totals-row">
      <span class="label-col">${escapeHtml(labels.taxTotal)}</span>
      <span>${formatMoney(data.taxAmount, data.currency)}</span>
    </div>
    <div class="totals-row grand-total">
      <span>${escapeHtml(labels.grandTotal)}</span>
      <span>${formatMoney(data.totalAmount, data.currency)}</span>
    </div>
  </div>

  <div class="text-center">
    ${renderComplianceBadge(data, config)}
  </div>

  ${data.notes ? `<div class="footer"><strong>${escapeHtml(labels.notes)}:</strong> ${escapeHtml(data.notes)}</div>` : ""}

  ${qrSectionHtml}

  ${config.footerText ? `<div class="footer">${escapeHtml(config.footerText)}</div>` : ""}

  ${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

// --- Thermal layout (58mm / 80mm) --------------------------------------------

function renderThermal(html: {
  data: PrintDocumentData;
  config: TemplateConfig;
  accentColor: string;
  qrSectionHtml: string;
  labels: Labels;
  isRtl: boolean;
  widthMm: 58 | 80;
}): string {
  const { data, config, accentColor, qrSectionHtml, labels, isRtl, widthMm } = html;
  const pageMargin = widthMm === 58 ? "2mm" : "3mm";

  const rowsHtml = data.lines
    .map((line: PrintLine) => {
      const qtyPrice = `${line.quantity} x ${formatMoney(line.unitPrice, data.currency)}`;
      return `
      <div class="item-row">
        <div class="item-name">${escapeHtml(line.name)}</div>
        <div class="item-calc">
          <span>${qtyPrice}</span>
          <span>${formatMoney(line.subtotal, data.currency)}</span>
        </div>
      </div>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="${config.language}" dir="${isRtl ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(data.documentNumber)}</title>
  <style>
    ${baseStyles(accentColor)}
    body { width: ${widthMm}mm; font-family: 'Courier New', monospace; font-size: 11px; padding: 2mm; }
    .center { text-align: center; }
    .doc-title { font-size: 13px; font-weight: 700; margin-bottom: 2px; }
    .shop-detail { font-size: 10px; color: #333; }
    .header-text { font-size: 10px; margin-top: 2px; }
    hr { border: none; border-top: 1px dashed #000; margin: 6px 0; }
    .meta-line { display: flex; justify-content: space-between; font-size: 10px; margin: 1px 0; }
    .item-row { margin: 4px 0; }
    .item-name { font-size: 11px; word-break: break-word; }
    .item-calc { display: flex; justify-content: space-between; font-size: 10px; color: #333; }
    .totals-row { display: flex; justify-content: space-between; font-size: 11px; margin: 1px 0; }
    .grand-total { font-size: 13px; font-weight: 700; margin-top: 4px; }
    .compliance-badge { font-size: 9px; color: #555; margin-top: 4px; text-align: center; }
    .qr-block { text-align: center; margin-top: 8px; }
    .qr-pending { text-align: center; font-size: 9px; color: #777; margin-top: 8px; }
    .footer { text-align: center; font-size: 9px; margin-top: 8px; }
    @media print {
      @page { size: ${widthMm}mm auto; margin: ${pageMargin}; }
    }
  </style>
</head>
<body>
  <div class="center">
    <div class="doc-title accent">${renderTitle(data, config)}</div>
    <div class="shop-detail">${escapeHtml(data.seller.name)}</div>
    ${data.seller.vatNumber ? `<div class="shop-detail">${escapeHtml(labels.vat)}: ${escapeHtml(data.seller.vatNumber)}</div>` : ""}
    ${config.headerText ? `<div class="header-text">${escapeHtml(config.headerText)}</div>` : ""}
  </div>
  <hr />
  <div class="meta-line"><span>${escapeHtml(labels.documentNumber)}</span><span>${escapeHtml(data.documentNumber)}</span></div>
  <div class="meta-line"><span>${escapeHtml(labels.date)}</span><span>${formatDate(data.issueDate, config.language)}</span></div>
  ${
    config.showBuyerInfo && data.buyer?.name
      ? `<div class="meta-line"><span>${escapeHtml(labels.buyer)}</span><span>${escapeHtml(data.buyer.name)}</span></div>`
      : ""
  }
  ${
    data.relatedDocumentNumber
      ? `<div class="meta-line"><span>${escapeHtml(labels.relatedDocument)}</span><span>${escapeHtml(data.relatedDocumentNumber)}</span></div>`
      : ""
  }
  <hr />
  ${rowsHtml}
  <hr />
  <div class="totals-row"><span>${escapeHtml(labels.subtotal)}</span><span>${formatMoney(data.subtotal, data.currency)}</span></div>
  ${
    Number(data.discountAmount) > 0
      ? `<div class="totals-row"><span>${escapeHtml(labels.discountTotal)}</span><span>${formatMoney(data.discountAmount, data.currency)}</span></div>`
      : ""
  }
  <div class="totals-row"><span>${escapeHtml(labels.taxTotal)}</span><span>${formatMoney(data.taxAmount, data.currency)}</span></div>
  <div class="totals-row grand-total"><span>${escapeHtml(labels.grandTotal)}</span><span>${formatMoney(data.totalAmount, data.currency)}</span></div>
  ${renderComplianceBadge(data, config)}
  ${data.notes ? `<div class="footer">${escapeHtml(labels.notes)}: ${escapeHtml(data.notes)}</div>` : ""}
  ${qrSectionHtml}
  ${config.footerText ? `<div class="footer">${escapeHtml(config.footerText)}</div>` : ""}
  ${AUTO_PRINT_SCRIPT}
</body>
</html>`;
}

export async function renderInvoiceHtml(
  data: PrintDocumentData,
  printType: PrintType,
  config: TemplateConfig,
): Promise<string> {
  const accentColor = safeAccentColor(config.accentColor);
  const isRtl = config.language === "ar";
  const labels = LABELS[config.language];

  const qrSizePx = printType === "a4" ? 120 : 120;
  const qrSectionHtml = await buildQrSection(data, config, qrSizePx);

  if (printType === "a4") {
    return renderA4({ data, config, accentColor, qrSectionHtml, labels, isRtl });
  }

  const widthMm = printType === "thermal_58" ? 58 : 80;
  return renderThermal({ data, config, accentColor, qrSectionHtml, labels, isRtl, widthMm });
}
