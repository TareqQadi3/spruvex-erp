import { getSalesPrintData } from "../../zatca/services/zatcaService";
import { getPurchasePrintData } from "../../purchases/services/purchasePrintDataService";
import type { PrintDocumentData } from "../types/print.types";

export async function assembleSalesPrintData(companyId: string, invoiceId: string): Promise<PrintDocumentData> {
  const data = await getSalesPrintData(companyId, invoiceId);

  return {
    documentKind: "sales",
    documentType: data.documentType,
    documentTitleAr: data.documentTitleAr,
    documentTitleEn: data.documentTitleEn,
    documentNumber: data.documentNumber,
    issueDate: data.issueDate,
    currency: data.currency,
    seller: { name: data.seller.name, vatNumber: data.seller.vatNumber },
    buyer: data.buyer ? { name: data.buyer.name ?? "", vatNumber: data.buyer.vatNumber } : null,
    lines: data.lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      discount: line.discount,
      subtotal: line.subtotal,
    })),
    subtotal: data.subtotal,
    discountAmount: data.discountAmount,
    taxAmount: data.taxAmount,
    totalAmount: data.totalAmount,
    qrContent: data.qrContent,
    relatedDocumentNumber: data.relatedDocumentNumber,
    isZatcaCompliant: data.isZatcaCompliant,
  };
}

export async function assemblePurchasePrintData(
  companyId: string,
  purchaseInvoiceId: string,
): Promise<PrintDocumentData> {
  const data = await getPurchasePrintData(companyId, purchaseInvoiceId);

  return {
    documentKind: "purchase",
    documentType: data.documentType,
    documentTitleAr: data.documentTitleAr,
    documentTitleEn: data.documentTitleEn,
    documentNumber: data.documentNumber,
    issueDate: data.issueDate,
    currency: data.currency,
    seller: { name: data.seller.name, vatNumber: data.seller.vatNumber },
    buyer: data.buyer ? { name: data.buyer.name, vatNumber: data.buyer.vatNumber } : null,
    lines: data.lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unitPrice: line.unitCost,
      discount: "0.00",
      subtotal: line.subtotal,
    })),
    subtotal: data.subtotal,
    discountAmount: data.discountAmount,
    taxAmount: data.taxAmount,
    totalAmount: data.totalAmount,
    qrContent: data.qrContent,
    relatedDocumentNumber: data.relatedDocumentNumber,
    notes: data.notes,
    isZatcaCompliant: data.isZatcaCompliant,
  };
}
