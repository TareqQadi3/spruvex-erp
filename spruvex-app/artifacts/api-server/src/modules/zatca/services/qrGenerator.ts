import type { ZatcaQrFields } from "../types/zatca.types";

function tlv(tag: number, value: string): Buffer {
  const valueBuffer = Buffer.from(value, "utf-8");
  if (valueBuffer.length > 255) {
    throw new Error(`TLV value for tag ${tag} exceeds 255 bytes`);
  }
  return Buffer.concat([Buffer.from([tag, valueBuffer.length]), valueBuffer]);
}

// ZATCA TLV (Tag-Length-Value) QR payload — the 6 fields this task specifies:
// seller name, VAT number, timestamp, invoice total, tax amount, and the
// invoice's signature hash (from signingService), concatenated and
// base64-encoded as a single binary blob.
export function generateZatcaQr(fields: ZatcaQrFields): string {
  const buffer = Buffer.concat([
    tlv(1, fields.sellerName),
    tlv(2, fields.vatNumber),
    tlv(3, fields.timestamp),
    tlv(4, fields.total),
    tlv(5, fields.taxAmount),
    tlv(6, fields.signatureHash),
  ]);
  return buffer.toString("base64");
}
