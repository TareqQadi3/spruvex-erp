/**
 * ZATCA (Saudi Zakat, Tax and Customs Authority) Phase-1 "simplified e-invoice"
 * QR code generator.
 *
 * Phase 1 (mandatory since Dec 2021) requires every invoice to carry a QR code
 * encoding 5 fields as TLV (Tag-Length-Value), then Base64. This module produces
 * that Base64 string; render it as a QR image with any QR library/service.
 *
 * Phase 2 (Fatoora / integration phase) additionally requires cryptographic
 * stamping and per-taxpayer onboarding (CSID) against ZATCA's API — that is a
 * separate, larger compliance effort handled server-side per organization and
 * is intentionally NOT implemented here. See docs/zatca.md.
 */

function toTLV(tag: number, value: string): Uint8Array {
  const valueBytes = new TextEncoder().encode(value);
  const out = new Uint8Array(2 + valueBytes.length);
  out[0] = tag;
  out[1] = valueBytes.length;
  out.set(valueBytes, 2);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export interface ZatcaQrFields {
  sellerName: string;
  vatNumber: string;
  /** ISO 8601 timestamp, e.g. new Date().toISOString() */
  timestamp: string;
  /** invoice grand total including VAT */
  total: number;
  /** VAT amount */
  vatTotal: number;
}

/** Returns the Base64 TLV payload to encode into the invoice QR code. */
export function generateZatcaQrPayload(f: ZatcaQrFields): string {
  const parts = [
    toTLV(1, f.sellerName),
    toTLV(2, f.vatNumber),
    toTLV(3, f.timestamp),
    toTLV(4, f.total.toFixed(2)),
    toTLV(5, f.vatTotal.toFixed(2)),
  ];
  const totalLen = parts.reduce((n, p) => n + p.length, 0);
  const merged = new Uint8Array(totalLen);
  let offset = 0;
  for (const p of parts) { merged.set(p, offset); offset += p.length; }
  return bytesToBase64(merged);
}
