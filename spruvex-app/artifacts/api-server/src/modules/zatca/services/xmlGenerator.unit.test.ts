import { describe, it, expect } from "vitest";
import { generateUblXml } from "./xmlGenerator";
import type { UblXmlContext } from "../types/zatca.types";

// T-08: the UBL XML generator — the frozen document whose hash gets signed
// and embedded in the QR. Pure: deterministic string + sha256 output.

function makeContext(overrides: Partial<UblXmlContext> = {}): UblXmlContext {
  return {
    invoiceId: "invoice-1",
    invoiceNumber: "INV-000001",
    invoiceType: "simplified",
    zatcaUuid: "9f9f9f9f-9f9f-9f9f-9f9f-9f9f9f9f9f9f",
    issueDate: new Date("2026-01-01T10:00:00Z"),
    currency: "SAR",
    sellerName: "Test Shop",
    sellerVatNumber: "310000000000003",
    buyerName: null,
    buyerVatNumber: null,
    subtotal: "100.00",
    discountAmount: "0.00",
    taxAmount: "15.00",
    totalAmount: "115.00",
    lines: [
      { productName: "Widget", quantity: 2, unitPrice: "25.00", discount: "0.00", subtotal: "50.00" },
      { productName: "Gadget", quantity: 1, unitPrice: "50.00", discount: "0.00", subtotal: "50.00" },
    ],
    relatedInvoiceNumber: null,
    relatedInvoiceZatcaUuid: null,
    ...overrides,
  };
}

describe("generateUblXml (zatca — UBL document + content hash)", () => {
  it("is deterministic: identical context yields identical xml and hash", () => {
    const a = generateUblXml(makeContext());
    const b = generateUblXml(makeContext());
    expect(a.xml).toBe(b.xml);
    expect(a.hash).toBe(b.hash);
  });

  it("changes the hash when any content changes", () => {
    const base = generateUblXml(makeContext());
    const edited = generateUblXml(makeContext({ totalAmount: "116.00" }));
    expect(edited.hash).not.toBe(base.hash);
  });

  it("carries invoice identity, parties, and monetary totals", () => {
    const ctx = makeContext({ buyerName: "ACME Corp", buyerVatNumber: "399999999900003" });
    const { xml } = generateUblXml(ctx);
    expect(xml).toContain("<cbc:ID>INV-000001</cbc:ID>");
    expect(xml).toContain(`<cbc:UUID>${ctx.zatcaUuid}</cbc:UUID>`);
    expect(xml).toContain("<cbc:InvoiceTypeCode>simplified</cbc:InvoiceTypeCode>");
    expect(xml).toContain("<cbc:DocumentCurrencyCode>SAR</cbc:DocumentCurrencyCode>");
    expect(xml).toContain("<cbc:CompanyID>310000000000003</cbc:CompanyID>");
    expect(xml).toContain("<cbc:RegistrationName>Test Shop</cbc:RegistrationName>");
    expect(xml).toContain("<cbc:RegistrationName>ACME Corp</cbc:RegistrationName>");
    expect(xml).toContain("<cbc:TaxAmount currencyID=\"SAR\">15.00</cbc:TaxAmount>");
    expect(xml).toContain("<cbc:LineExtensionAmount currencyID=\"SAR\">100.00</cbc:LineExtensionAmount>");
    expect(xml).toContain("<cbc:TaxInclusiveAmount currencyID=\"SAR\">115.00</cbc:TaxInclusiveAmount>");
    expect(xml).toContain("<cbc:PayableAmount currencyID=\"SAR\">115.00</cbc:PayableAmount>");
    expect(xml).toContain("<cbc:IssueDate>2026-01-01</cbc:IssueDate>");
  });

  it("escapes XML-special characters in seller and buyer names", () => {
    const ctx = makeContext({ sellerName: 'AT&T <"Service">', buyerName: "A&B" });
    const { xml } = generateUblXml(ctx);
    expect(xml).toContain("AT&amp;T &lt;&quot;Service&quot;&gt;");
    expect(xml).toContain("A&amp;B");
    expect(xml).not.toContain("AT&T");
  });

  it("numbers invoice lines from 1 and embeds quantity, unit price, discount, and line total", () => {
    const { xml } = generateUblXml(makeContext());
    expect(xml).toContain("<cbc:ID>1</cbc:ID>");
    expect(xml).toContain("<cbc:ID>2</cbc:ID>");
    expect(xml).toContain("<cbc:InvoicedQuantity>2</cbc:InvoicedQuantity>");
    expect(xml).toContain("<cbc:PriceAmount currencyID=\"SAR\">25.00</cbc:PriceAmount>");
    expect(xml).toContain("<cbc:Amount currencyID=\"SAR\">0.00</cbc:Amount>");
    expect(xml).toContain("<cbc:LineExtensionAmount currencyID=\"SAR\">50.00</cbc:LineExtensionAmount>");
  });

  it("emits a BillingReference for a credit note only when both the related invoice number and UUID are known", () => {
    const full = generateUblXml(
      makeContext({ invoiceType: "credit_note", relatedInvoiceNumber: "INV-000000", relatedInvoiceZatcaUuid: "aaaa-bbbb" }),
    );
    expect(full.xml).toContain("<cac:BillingReference>");
    expect(full.xml).toContain("<cbc:ID>INV-000000</cbc:ID>");
    expect(full.xml).toContain("<cbc:UUID>aaaa-bbbb</cbc:UUID>");

    const missingUuid = generateUblXml(
      makeContext({ invoiceType: "credit_note", relatedInvoiceNumber: "INV-000000", relatedInvoiceZatcaUuid: null }),
    );
    expect(missingUuid.xml).not.toContain("<cac:BillingReference>");
  });

  it("omits the buyer party block when no buyer name is present", () => {
    const { xml } = generateUblXml(makeContext({ buyerName: null }));
    expect(xml).not.toContain("<cac:AccountingCustomerParty>");
  });
});
