import { eq } from "drizzle-orm";
import { db, settingsTable } from "@workspace/db";
import { getSalesPrintData } from "../../zatca/services/zatcaService";
import { getPurchasePrintData } from "../../purchases/services/purchasePrintDataService";
import type { PrintDocumentData } from "../types/print.types";

// PrintParty supports address/phone but the ZATCA/purchase print-data
// contracts only ever carry name/vatNumber (a company's address/phone
// aren't ZATCA-relevant) — sourced here from Settings instead, the same
// place the printed logo/header/footer come from.
async function getSellerContactInfo(companyId: string): Promise<{ address: string | null; phone: string | null }> {
  const [settings] = await db.select({ shopAddress: settingsTable.shopAddress, shopPhone: settingsTable.shopPhone })
    .from(settingsTable).where(eq(settingsTable.companyId, companyId));
  return { address: settings?.shopAddress ?? null, phone: settings?.shopPhone ?? null };
}

export async function assembleSalesPrintData(companyId: string, invoiceId: string): Promise<PrintDocumentData> {
  const [data, contact] = await Promise.all([getSalesPrintData(companyId, invoiceId), getSellerContactInfo(companyId)]);

  return {
    documentKind: "sales",
    documentType: data.documentType,
    documentTitleAr: data.documentTitleAr,
    documentTitleEn: data.documentTitleEn,
    documentNumber: data.documentNumber,
    issueDate: data.issueDate,
    currency: data.currency,
    seller: { name: data.seller.name, vatNumber: data.seller.vatNumber, address: contact.address, phone: contact.phone },
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
  // Purchase documents put the shop as the BUYER (the supplier is the
  // seller) — the shop's own address/phone belong on the buyer side here,
  // mirroring how sales documents put them on the seller side.
  const [data, contact] = await Promise.all([getPurchasePrintData(companyId, purchaseInvoiceId), getSellerContactInfo(companyId)]);

  return {
    documentKind: "purchase",
    documentType: data.documentType,
    documentTitleAr: data.documentTitleAr,
    documentTitleEn: data.documentTitleEn,
    documentNumber: data.documentNumber,
    issueDate: data.issueDate,
    currency: data.currency,
    seller: { name: data.seller.name, vatNumber: data.seller.vatNumber },
    buyer: data.buyer ? { name: data.buyer.name, vatNumber: data.buyer.vatNumber, address: contact.address, phone: contact.phone } : null,
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
