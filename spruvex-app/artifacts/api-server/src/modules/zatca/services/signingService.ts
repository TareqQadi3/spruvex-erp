import { createHash, createHmac } from "node:crypto";
import { env } from "../../../config/env";

export interface SignInvoiceInput {
  xmlHash: string;
  previousInvoiceHash: string | null;
}

export interface SignInvoiceResult {
  previousInvoiceHash: string | null;
  invoiceHash: string;
  signatureValue: string;
  algorithm: string;
}

// Sentinel previousInvoiceHash for the very first invoice a company ever
// signs — there is no prior invoice to chain to.
const GENESIS_HASH = Buffer.alloc(32).toString("base64");

// STUB — read before touching this file. Real ZATCA Phase 2 compliance
// requires signing with an ECDSA private key bound to a CSID certificate
// issued by ZATCA after a CSR + OTP onboarding flow against their
// (sandbox/production) API. None of that exists in this environment: no
// certificate, no onboarding, no credentials. This function still computes a
// REAL, verifiable hash chain (invoiceHash genuinely depends on
// previousInvoiceHash + this invoice's xmlHash, so the chain-integrity logic
// is exercised honestly) but signatureValue is an HMAC keyed on the app's own
// JWT secret, not a ZATCA-recognized cryptographic stamp. Swap this
// function's body for real ECDSA signing once a certificate is provisioned —
// callers only depend on the shape of SignInvoiceResult, not how it's produced.
export function signInvoiceHash(input: SignInvoiceInput): SignInvoiceResult {
  const previousInvoiceHash = input.previousInvoiceHash ?? GENESIS_HASH;
  const invoiceHash = createHash("sha256").update(`${previousInvoiceHash}:${input.xmlHash}`).digest("hex");
  const signatureValue = createHmac("sha256", `zatca-signing-stub:${env.jwtSecret}`).update(invoiceHash).digest("base64");

  return {
    previousInvoiceHash: input.previousInvoiceHash,
    invoiceHash,
    signatureValue,
    algorithm: "HMAC-SHA256-STUB",
  };
}
