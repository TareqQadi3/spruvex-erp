import { describe, it, expect } from "vitest";
import { computeVatTotals } from "./vatReturnService";

describe("computeVatTotals", () => {
  it("sums output VAT from simplified/standard invoices", () => {
    const totals = computeVatTotals(
      [
        { invoiceType: "simplified", subtotal: "100.00", taxAmount: "15.00" },
        { invoiceType: "standard", subtotal: "200.00", taxAmount: "30.00" },
      ],
      [],
    );
    expect(totals.totalSalesExVat).toBeCloseTo(300);
    expect(totals.totalOutputVat).toBeCloseTo(45);
    expect(totals.netVatDue).toBeCloseTo(45);
  });

  it("subtracts credit notes from output VAT and revenue", () => {
    const totals = computeVatTotals(
      [
        { invoiceType: "simplified", subtotal: "100.00", taxAmount: "15.00" },
        { invoiceType: "credit_note", subtotal: "40.00", taxAmount: "6.00" },
      ],
      [],
    );
    expect(totals.totalSalesExVat).toBeCloseTo(60);
    expect(totals.totalOutputVat).toBeCloseTo(9);
  });

  it("adds debit notes to output VAT (not treated as a reduction)", () => {
    const totals = computeVatTotals(
      [{ invoiceType: "debit_note", subtotal: "50.00", taxAmount: "7.50" }],
      [],
    );
    expect(totals.totalSalesExVat).toBeCloseTo(50);
    expect(totals.totalOutputVat).toBeCloseTo(7.5);
  });

  it("sums input VAT from purchase invoices", () => {
    const totals = computeVatTotals(
      [],
      [{ sourceType: "purchase", subtotal: "500.00", taxAmount: "75.00" }],
    );
    expect(totals.totalPurchasesExVat).toBeCloseTo(500);
    expect(totals.totalInputVat).toBeCloseTo(75);
    expect(totals.netVatDue).toBeCloseTo(-75);
  });

  it("subtracts purchase returns from input VAT", () => {
    const totals = computeVatTotals(
      [],
      [
        { sourceType: "purchase", subtotal: "500.00", taxAmount: "75.00" },
        { sourceType: "purchase_return", subtotal: "100.00", taxAmount: "15.00" },
      ],
    );
    expect(totals.totalPurchasesExVat).toBeCloseTo(400);
    expect(totals.totalInputVat).toBeCloseTo(60);
  });

  it("computes net VAT due as output minus input across both sides", () => {
    const totals = computeVatTotals(
      [{ invoiceType: "simplified", subtotal: "1000.00", taxAmount: "150.00" }],
      [{ sourceType: "purchase", subtotal: "400.00", taxAmount: "60.00" }],
    );
    expect(totals.netVatDue).toBeCloseTo(90);
  });

  it("returns all zeros for an empty period", () => {
    const totals = computeVatTotals([], []);
    expect(totals).toEqual({
      totalSalesExVat: 0, totalOutputVat: 0, totalPurchasesExVat: 0, totalInputVat: 0, netVatDue: 0,
    });
  });
});
