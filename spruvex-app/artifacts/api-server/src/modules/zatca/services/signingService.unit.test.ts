import { describe, it, expect } from "vitest";

// signingService reads env.jwtSecret at import time (config/env.ts), and
// env.ts requires PORT to be set or it throws — set both before importing so
// this test file works standalone (unit tests must not depend on a real .env).
process.env.JWT_SECRET ??= "unit-test-only-secret-not-for-real-use";
process.env.PORT ??= "5000";

const { signInvoiceHash } = await import("./signingService");

// T-08: the ZATCA invoice hash chain — the real, verifiable part of
// signingService (the signature value itself is an HMAC stub, see the
// module's header comment; the chain integrity is not).
describe("signInvoiceHash (zatca — invoice hash chain)", () => {
  const xmlHashA = "aaaa";
  const xmlHashB = "bbbb";

  it("is deterministic for identical inputs", () => {
    const a = signInvoiceHash({ xmlHash: xmlHashA, previousInvoiceHash: null });
    const b = signInvoiceHash({ xmlHash: xmlHashA, previousInvoiceHash: null });
    expect(a.invoiceHash).toBe(b.invoiceHash);
    expect(a.signatureValue).toBe(b.signatureValue);
  });

  it("changes when the invoice xmlHash changes", () => {
    const a = signInvoiceHash({ xmlHash: xmlHashA, previousInvoiceHash: null });
    const b = signInvoiceHash({ xmlHash: xmlHashB, previousInvoiceHash: null });
    expect(a.invoiceHash).not.toBe(b.invoiceHash);
  });

  it("the first invoice a company signs chains off a sentinel, and reports previousInvoiceHash null", () => {
    const result = signInvoiceHash({ xmlHash: xmlHashA, previousInvoiceHash: null });
    expect(result.previousInvoiceHash).toBeNull();
    expect(result.invoiceHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("a later invoice's hash depends on the previous invoice's hash", () => {
    const first = signInvoiceHash({ xmlHash: xmlHashA, previousInvoiceHash: null });
    const chained = signInvoiceHash({ xmlHash: xmlHashB, previousInvoiceHash: first.invoiceHash });
    const unchained = signInvoiceHash({ xmlHash: xmlHashB, previousInvoiceHash: null });
    expect(chained.invoiceHash).not.toBe(unchained.invoiceHash);
    expect(chained.previousInvoiceHash).toBe(first.invoiceHash);
  });

  it("re-hashing invoice A with invoice B's hash as predecessor yields a different hash", () => {
    const first = signInvoiceHash({ xmlHash: xmlHashA, previousInvoiceHash: null });
    const b = signInvoiceHash({ xmlHash: xmlHashB, previousInvoiceHash: null });
    const retriedA = signInvoiceHash({ xmlHash: xmlHashA, previousInvoiceHash: b.invoiceHash });
    expect(retriedA.invoiceHash).not.toBe(first.invoiceHash);
  });

  it("tags the signature with the stub algorithm label", () => {
    const result = signInvoiceHash({ xmlHash: xmlHashA, previousInvoiceHash: null });
    expect(result.algorithm).toBe("HMAC-SHA256-STUB");
  });
});
