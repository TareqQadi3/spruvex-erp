import { createHash } from "node:crypto";
import type { UblXmlContext } from "../types/zatca.types";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// A representative UBL 2.1 structure covering the elements ZATCA mandates
// (supplier/customer party VAT, tax total, monetary totals, invoice lines).
// Not byte-for-byte certified against ZATCA's official XSD/hash-placement
// rules — that requires the full schema package and a provisioned CSID
// certificate, neither available in this environment (see signingService.ts).
// Also emits a <cac:BillingReference> for credit/debit notes when the
// original invoice they correct is known (see UblXmlContext).
export function generateUblXml(context: UblXmlContext): { xml: string; hash: string } {
  const lines = context.lines
    .map(
      (line, index) => `
  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity>${line.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${context.currency}">${line.subtotal}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${escapeXml(line.productName)}</cbc:Name>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${context.currency}">${line.unitPrice}</cbc:PriceAmount>
    </cac:Price>
    <cac:AllowanceCharge>
      <cbc:ChargeIndicator>false</cbc:ChargeIndicator>
      <cbc:Amount currencyID="${context.currency}">${line.discount}</cbc:Amount>
    </cac:AllowanceCharge>
  </cac:InvoiceLine>`,
    )
    .join("");

  const buyerParty = context.buyerName
    ? `
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(context.buyerVatNumber ?? "")}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(context.buyerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingCustomerParty>`
    : "";

  const billingReference =
    (context.invoiceType === "credit_note" || context.invoiceType === "debit_note") &&
    context.relatedInvoiceNumber &&
    context.relatedInvoiceZatcaUuid
      ? `
  <cac:BillingReference>
    <cac:InvoiceDocumentReference>
      <cbc:ID>${escapeXml(context.relatedInvoiceNumber)}</cbc:ID>
      <cbc:UUID>${context.relatedInvoiceZatcaUuid}</cbc:UUID>
    </cac:InvoiceDocumentReference>
  </cac:BillingReference>`
      : "";

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:ProfileID>reporting:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(context.invoiceNumber)}</cbc:ID>
  <cbc:UUID>${context.zatcaUuid}</cbc:UUID>
  <cbc:IssueDate>${context.issueDate.toISOString().slice(0, 10)}</cbc:IssueDate>
  <cbc:IssueTime>${context.issueDate.toISOString().slice(11, 19)}</cbc:IssueTime>
  <cbc:InvoiceTypeCode>${context.invoiceType}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>${context.currency}</cbc:DocumentCurrencyCode>${billingReference}
  <cbc:TaxCurrencyCode>${context.currency}</cbc:TaxCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${escapeXml(context.sellerVatNumber ?? "")}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${escapeXml(context.sellerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>${buyerParty}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${context.currency}">${context.taxAmount}</cbc:TaxAmount>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${context.currency}">${context.subtotal}</cbc:LineExtensionAmount>
    <cbc:AllowanceTotalAmount currencyID="${context.currency}">${context.discountAmount}</cbc:AllowanceTotalAmount>
    <cbc:TaxInclusiveAmount currencyID="${context.currency}">${context.totalAmount}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${context.currency}">${context.totalAmount}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>${lines}
</Invoice>`;

  const hash = createHash("sha256").update(xml, "utf-8").digest("hex");
  return { xml, hash };
}
