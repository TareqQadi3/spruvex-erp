import type { PurchaseInvoice } from "@workspace/db";
import { withTransaction } from "../../../core/database/transaction";
import { AppError } from "../../../core/errors/AppError";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import { fromCents, toCents } from "../../../shared/utils/money";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { purchaseInvoiceRepository } from "../repositories/purchaseInvoiceRepository";

// KSA standard VAT rate — used if the company has no settings row yet, same
// fallback convention as modules/zatca/services/zatcaService.
const DEFAULT_TAX_RATE = 15;

function formatDocumentNumber(prefix: "PINV" | "PDN", sequence: number): string {
  return `${prefix}-${String(sequence).padStart(6, "0")}`;
}

// createOrGetPurchaseInvoiceFromPurchase — derives a printable purchase
// invoice from an existing purchases row. purchases.totalCost is treated as
// tax-inclusive (same convention as sales), so tax is backed out of it
// rather than added on top. Idempotent: a second call for the same purchase
// returns the already-created document unchanged.
export async function createOrGetPurchaseInvoiceFromPurchase(
  tenant: TenantContext,
  purchaseId: string,
): Promise<PurchaseInvoice> {
  return withTransaction(async (tx) => {
    await purchaseInvoiceRepository.lockCompanyForNumbering(tenant.companyId, tx);

    const existing = await purchaseInvoiceRepository.findExisting(tenant.companyId, "purchase", purchaseId, tx);
    if (existing) return existing;

    const purchase = await purchaseInvoiceRepository.findPurchaseById(tenant.companyId, purchaseId, tx);
    if (!purchase) throw AppError.notFound("Purchase not found");

    const settings = await purchaseInvoiceRepository.findSettings(tenant.companyId, tx);
    const taxRate = settings ? Number(settings.taxRate) : DEFAULT_TAX_RATE;

    const totalCents = toCents(purchase.totalCost);
    const taxCents = Math.round(totalCents - totalCents / (1 + taxRate / 100));
    const subtotalCents = totalCents - taxCents;

    const sequence = (await purchaseInvoiceRepository.countForCompany(tenant.companyId, "purchase", tx)) + 1;

    const invoice = await purchaseInvoiceRepository.create(
      {
        companyId: tenant.companyId,
        sourceType: "purchase",
        sourceId: purchase.id,
        documentNumber: formatDocumentNumber("PINV", sequence),
        supplierId: purchase.supplierId,
        supplierName: purchase.supplierName,
        currency: settings?.currency ?? "SAR",
        subtotal: fromCents(subtotalCents),
        taxAmount: fromCents(taxCents),
        totalAmount: fromCents(totalCents),
        notes: null,
      },
      tx,
    );

    recordAuditEvent(tenant, {
      action: "create_purchase_invoice",
      entityType: "purchase_invoice",
      entityId: invoice.id,
      details: { purchaseId: purchase.id, documentNumber: invoice.documentNumber },
    });

    return invoice;
  });
}

// createOrGetPurchaseInvoiceFromReturn — same shape, sourced from a
// purchase_returns row instead (independent PDN- numbering sequence).
export async function createOrGetPurchaseInvoiceFromReturn(
  tenant: TenantContext,
  purchaseReturnId: string,
): Promise<PurchaseInvoice> {
  return withTransaction(async (tx) => {
    await purchaseInvoiceRepository.lockCompanyForNumbering(tenant.companyId, tx);

    const existing = await purchaseInvoiceRepository.findExisting(tenant.companyId, "purchase_return", purchaseReturnId, tx);
    if (existing) return existing;

    const purchaseReturn = await purchaseInvoiceRepository.findPurchaseReturnById(tenant.companyId, purchaseReturnId, tx);
    if (!purchaseReturn) throw AppError.notFound("Purchase return not found");

    const settings = await purchaseInvoiceRepository.findSettings(tenant.companyId, tx);
    const taxRate = settings ? Number(settings.taxRate) : DEFAULT_TAX_RATE;

    const totalCents = toCents(purchaseReturn.totalAmount);
    const taxCents = Math.round(totalCents - totalCents / (1 + taxRate / 100));
    const subtotalCents = totalCents - taxCents;

    const sequence = (await purchaseInvoiceRepository.countForCompany(tenant.companyId, "purchase_return", tx)) + 1;

    const invoice = await purchaseInvoiceRepository.create(
      {
        companyId: tenant.companyId,
        sourceType: "purchase_return",
        sourceId: purchaseReturn.id,
        documentNumber: formatDocumentNumber("PDN", sequence),
        supplierId: purchaseReturn.supplierId,
        supplierName: purchaseReturn.supplierName,
        currency: settings?.currency ?? "SAR",
        subtotal: fromCents(subtotalCents),
        taxAmount: fromCents(taxCents),
        totalAmount: fromCents(totalCents),
        notes: purchaseReturn.reason,
      },
      tx,
    );

    recordAuditEvent(tenant, {
      action: "create_purchase_return_document",
      entityType: "purchase_invoice",
      entityId: invoice.id,
      details: { purchaseReturnId: purchaseReturn.id, documentNumber: invoice.documentNumber },
    });

    return invoice;
  });
}

export async function getPurchaseInvoiceDetail(companyId: string, id: string): Promise<PurchaseInvoice> {
  const invoice = await purchaseInvoiceRepository.findById(companyId, id);
  if (!invoice) throw AppError.notFound("Purchase invoice not found");
  return invoice;
}
