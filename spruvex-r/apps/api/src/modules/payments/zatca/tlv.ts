/**
 * ZATCA e-invoicing Phase 1 — simplified invoice QR code.
 *
 * The QR content is a Base64 string of TLV (Tag-Length-Value) records,
 * UTF-8 encoded, with the five mandatory tags:
 *   1  Seller name
 *   2  Seller VAT registration number
 *   3  Invoice timestamp (ISO 8601)
 *   4  Invoice total (with VAT)
 *   5  VAT amount
 */

export interface ZatcaQrInput {
  sellerName: string;
  vatNumber: string;
  /** ISO 8601 timestamp of issuance. */
  timestamp: string;
  /** Invoice total including VAT, as a decimal string (e.g. "115.00"). */
  total: string;
  /** VAT amount, as a decimal string (e.g. "15.00"). */
  vatAmount: string;
}

function tlv(tag: number, value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  if (bytes.length > 255) {
    throw new Error(`TLV value for tag ${tag} exceeds 255 bytes`);
  }
  return Buffer.concat([Buffer.from([tag, bytes.length]), bytes]);
}

/** Builds the Base64 TLV payload embedded in the receipt QR. */
export function buildZatcaQrPayload(input: ZatcaQrInput): string {
  return Buffer.concat([
    tlv(1, input.sellerName),
    tlv(2, input.vatNumber),
    tlv(3, input.timestamp),
    tlv(4, input.total),
    tlv(5, input.vatAmount),
  ]).toString("base64");
}

/** Decodes a TLV payload back into tag/value pairs (used by tests/tools). */
export function decodeZatcaQrPayload(payload: string): Map<number, string> {
  const bytes = Buffer.from(payload, "base64");
  const tags = new Map<number, string>();
  let offset = 0;
  while (offset + 2 <= bytes.length) {
    const tag = bytes[offset];
    const length = bytes[offset + 1];
    const value = bytes.subarray(offset + 2, offset + 2 + length);
    tags.set(tag, value.toString("utf8"));
    offset += 2 + length;
  }
  return tags;
}
