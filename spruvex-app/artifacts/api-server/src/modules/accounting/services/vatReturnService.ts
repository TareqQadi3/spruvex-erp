import { db, type VatReturn } from "@workspace/db";
import { vatReturnRepository } from "../repositories/vatReturnRepository";

export class InvalidPeriodError extends Error {}

export interface GenerateVatReturnInput {
  periodStart: string;
  periodEnd: string;
}

export async function listVatReturns(companyId: string): Promise<VatReturn[]> {
  return vatReturnRepository.list(db, companyId);
}

export interface VatTotals {
  totalSalesExVat: number;
  totalOutputVat: number;
  totalPurchasesExVat: number;
  totalInputVat: number;
  netVatDue: number;
}

export interface OutputInvoiceRow {
  invoiceType: string;
  subtotal: string;
  taxAmount: string;
}

export interface PurchaseInvoiceRow {
  sourceType: string;
  subtotal: string;
  taxAmount: string;
}

// Pure aggregation, deliberately separated from the DB fetch below so it's
// unit-testable without a database — the project's own T-08 notes flagged
// tax calculations elsewhere as untestable for exactly this reason (inlined
// in DB-calling services with no isolable helper); new tax logic shouldn't
// repeat that gap.
export function computeVatTotals(outputInvoices: OutputInvoiceRow[], purchaseInvoices: PurchaseInvoiceRow[]): VatTotals {
  let totalSalesExVat = 0;
  let totalOutputVat = 0;
  for (const inv of outputInvoices) {
    const sign = inv.invoiceType === "credit_note" ? -1 : 1;
    totalSalesExVat += sign * Number(inv.subtotal);
    totalOutputVat += sign * Number(inv.taxAmount);
  }

  let totalPurchasesExVat = 0;
  let totalInputVat = 0;
  for (const pi of purchaseInvoices) {
    const sign = pi.sourceType === "purchase_return" ? -1 : 1;
    totalPurchasesExVat += sign * Number(pi.subtotal);
    totalInputVat += sign * Number(pi.taxAmount);
  }

  return {
    totalSalesExVat,
    totalOutputVat,
    totalPurchasesExVat,
    totalInputVat,
    netVatDue: totalOutputVat - totalInputVat,
  };
}

export async function generateVatReturn(companyId: string, input: GenerateVatReturnInput): Promise<VatReturn> {
  if (!input.periodStart || !input.periodEnd) throw new InvalidPeriodError("periodStart and periodEnd are required");
  if (new Date(input.periodStart) > new Date(input.periodEnd)) throw new InvalidPeriodError("periodStart must not be after periodEnd");

  const outputInvoices = await vatReturnRepository.outputVatInvoices(db, companyId, input.periodStart, input.periodEnd);
  const purchaseInvoices = await vatReturnRepository.inputVatPurchaseInvoices(db, companyId, input.periodStart, input.periodEnd);
  const totals = computeVatTotals(outputInvoices, purchaseInvoices);

  return vatReturnRepository.insert(db, {
    companyId,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    totalSalesExVat: totals.totalSalesExVat.toFixed(2),
    totalOutputVat: totals.totalOutputVat.toFixed(2),
    totalPurchasesExVat: totals.totalPurchasesExVat.toFixed(2),
    totalInputVat: totals.totalInputVat.toFixed(2),
    netVatDue: totals.netVatDue.toFixed(2),
    status: "draft",
  });
}

export async function finalizeVatReturn(companyId: string, id: string, userId: string): Promise<VatReturn | undefined> {
  return vatReturnRepository.finalize(db, companyId, id, {
    status: "finalized",
    finalizedAt: new Date(),
    finalizedBy: userId,
  });
}

export async function getVatReturn(companyId: string, id: string): Promise<VatReturn | undefined> {
  return vatReturnRepository.findById(db, companyId, id);
}

const CSV_HEADERS = [
  "Period Start", "Period End", "Total Sales (Excl. VAT)", "Total Output VAT",
  "Total Purchases (Excl. VAT)", "Total Input VAT", "Net VAT Due", "Status",
];

// Matches the standard VAT return field set (sales/output VAT, purchases/
// input VAT, net due) for manual filing through ZATCA's portal — not a
// submission itself, see the schema's own comment on why no live ZATCA
// filing API exists to integrate with.
export function toCsv(vatReturn: VatReturn): string {
  const row = [
    vatReturn.periodStart, vatReturn.periodEnd,
    vatReturn.totalSalesExVat, vatReturn.totalOutputVat,
    vatReturn.totalPurchasesExVat, vatReturn.totalInputVat,
    vatReturn.netVatDue, vatReturn.status,
  ];
  return [CSV_HEADERS.join(","), row.join(",")].join("\n");
}
