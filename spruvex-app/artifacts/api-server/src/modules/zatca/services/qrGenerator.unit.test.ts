import { describe, it, expect } from "vitest";
import { generateZatcaQr } from "./qrGenerator";
import type { ZatcaQrFields } from "../types/zatca.types";

// T-08: the ZATCA QR payload — the TLV structure a scanner decodes. Fully
// pure: concatenates six Tag-Length-Value blocks and base64s them.

function decodeTlvs(b64: string): Array<{ tag: number; value: Buffer }> {
  const buffer = Buffer.from(b64, "base64");
  const out: Array<{ tag: number; value: Buffer }> = [];
  let offset = 0;
  while (offset < buffer.length) {
    const tag = buffer.readUInt8(offset);
    const length = buffer.readUInt8(offset + 1);
    out.push({ tag, value: buffer.subarray(offset + 2, offset + 2 + length) });
    offset += 2 + length;
  }
  return out;
}

function makeFields(overrides: Partial<ZatcaQrFields> = {}): ZatcaQrFields {
  return {
    sellerName: "Test Shop",
    vatNumber: "310000000000003",
    timestamp: new Date("2026-01-01T10:00:00Z").toISOString(),
    total: "115.00",
    taxAmount: "15.00",
    signatureHash: "abcdef1234567890abcdef1234567890",
    ...overrides,
  };
}

describe("generateZatcaQr (zatca — TLV payload)", () => {
  it("returns a base64 string that decodes back to the six TLV blocks in order", () => {
    const fields = makeFields();
    const tlvs = decodeTlvs(generateZatcaQr(fields));
    expect(tlvs.map((t) => t.tag)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("encodes each ZATCA field under its mandated tag", () => {
    const fields = makeFields();
    const tlvs = decodeTlvs(generateZatcaQr(fields));
    expect(tlvs[0].value.toString("utf-8")).toBe(fields.sellerName);
    expect(tlvs[1].value.toString("utf-8")).toBe(fields.vatNumber);
    expect(tlvs[2].value.toString("utf-8")).toBe(fields.timestamp);
    expect(tlvs[3].value.toString("utf-8")).toBe(fields.total);
    expect(tlvs[4].value.toString("utf-8")).toBe(fields.taxAmount);
    expect(tlvs[5].value.toString("utf-8")).toBe(fields.signatureHash);
  });

  it("encodes optional/empty fields as zero-length values rather than omitting the tag", () => {
    const tlvs = decodeTlvs(generateZatcaQr(makeFields({ vatNumber: "", sellerName: "" })));
    expect(tlvs).toHaveLength(6);
    expect(tlvs[0].value).toHaveLength(0);
    expect(tlvs[1].value).toHaveLength(0);
  });

  it("handles multi-byte UTF-8 values (Arabic seller names) with byte-accurate lengths", () => {
    const sellerName = "متجر سبروفكس";
    const tlvs = decodeTlvs(generateZatcaQr(makeFields({ sellerName })));
    expect(tlvs[0].value.toString("utf-8")).toBe(sellerName);
    expect(tlvs[0].value.length).toBe(Buffer.byteLength(sellerName, "utf-8"));
  });

  it("rejects a value that exceeds the 255-byte TLV limit", () => {
    expect(() => generateZatcaQr(makeFields({ sellerName: "x".repeat(256) }))).toThrow(/exceeds 255 bytes/);
  });
});
