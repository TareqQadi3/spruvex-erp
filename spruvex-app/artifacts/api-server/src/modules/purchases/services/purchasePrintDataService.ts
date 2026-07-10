import { AppError } from "../../../core/errors/AppError";
import { purchaseInvoiceRepository } from "../repositories/purchaseInvoiceRepository";

// Contract consumed by modules/invoicing's generic template/print renderer.
// Purchase documents are never ZATCA e-invoices (see this module's header
// note): isZatcaCompliant is always false and qrContent is always null.
export interface PurchasePrintLine {
  name: string;
  quantity: number;
  unitCost: string;
  subtotal: string;
}

export interface PurchasePrintData {
  documentKind: "purchase";
  documentType: "purchase_invoice" | "purchase_return";
  documentTitleAr: string;
  documentTitleEn: string;
  documentNumber: string;
  issueDate: string;
  currency: string;
  // The "seller" field name is kept for shape-compatibility with the sales
  // print contract, but for a purchase document the counterparty who
  // actually sold the goods is the supplier.
  seller: { name: string; vatNumber: string | null };
  buyer: { name: string; vatNumber: string | null } | null;
  lines: PurchasePrintLine[];
  subtotal: string;
  discountAmount: "0.00";
  taxAmount: string;
  totalAmount: string;
  qrContent: null;
  relatedDocumentNumber: string | null;
  isZatcaCompliant: false;
  notes: string | null;
}

export async function getPurchasePrintData(companyId: string, purchaseInvoiceId: string): Promise<PurchasePrintData> {
  const invoice = await purchaseInvoiceRepository.findById(companyId, purchaseInvoiceId);
  if (!invoice) throw AppError.notFound("Purchase invoice not found");

  const settings = await purchaseInvoiceRepository.findSettings(companyId);

  const isReturn = invoice.sourceType === "purchase_return";
  const documentType: PurchasePrintData["documentType"] = isReturn ? "purchase_return" : "purchase_invoice";

  let line: PurchasePrintLine;
  let relatedDocumentNumber: string | null = null;

  if (isReturn) {
    const purchaseReturn = await purchaseInvoiceRepository.findPurchaseReturnById(companyId, invoice.sourceId);
    if (!purchaseReturn) throw AppError.notFound("Purchase return not found");

    const product = await purchaseInvoiceRepository.findProductById(companyId, purchaseReturn.productId);
    line = {
      name: product?.name ?? "Product",
      quantity: purchaseReturn.quantity,
      unitCost: purchaseReturn.unitCost,
      subtotal: purchaseReturn.totalAmount,
    };

    const originalDocument = await purchaseInvoiceRepository.findExisting(companyId, "purchase", purchaseReturn.purchaseId);
    relatedDocumentNumber = originalDocument?.documentNumber ?? null;
  } else {
    const purchase = await purchaseInvoiceRepository.findPurchaseById(companyId, invoice.sourceId);
    if (!purchase) throw AppError.notFound("Purchase not found");

    const product = await purchaseInvoiceRepository.findProductById(companyId, purchase.productId);
    line = {
      name: product?.name ?? "Product",
      quantity: purchase.quantity,
      unitCost: purchase.quantity > 0 ? (Number(purchase.totalCost) / purchase.quantity).toFixed(2) : purchase.totalCost,
      subtotal: purchase.totalCost,
    };
  }

  return {
    documentKind: "purchase",
    documentType,
    documentTitleAr: isReturn ? "إشعار مرتجع مشتريات" : "فاتورة مشتريات",
    documentTitleEn: isReturn ? "Purchase Return Note" : "Purchase Invoice",
    documentNumber: invoice.documentNumber,
    issueDate: invoice.issueDate.toISOString(),
    currency: invoice.currency,
    seller: { name: invoice.supplierName, vatNumber: null },
    buyer: { name: settings?.shopName ?? "Company", vatNumber: settings?.vatNumber ?? null },
    lines: [line],
    subtotal: invoice.subtotal,
    discountAmount: "0.00",
    taxAmount: invoice.taxAmount,
    totalAmount: invoice.totalAmount,
    qrContent: null,
    relatedDocumentNumber,
    isZatcaCompliant: false,
    notes: invoice.notes,
  };
}
