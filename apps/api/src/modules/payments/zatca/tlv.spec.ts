import { buildZatcaQrPayload, decodeZatcaQrPayload } from "./tlv";

describe("ZATCA Phase 1 TLV QR payload", () => {
  const input = {
    sellerName: "مطعم البيك الشعبي",
    vatNumber: "300000000000003",
    timestamp: "2026-07-12T14:30:00.000Z",
    total: "115.00",
    vatAmount: "15.00",
  };

  it("round-trips all five mandatory tags (UTF-8 Arabic safe)", () => {
    const payload = buildZatcaQrPayload(input);
    // Valid Base64
    expect(Buffer.from(payload, "base64").toString("base64")).toBe(payload);

    const tags = decodeZatcaQrPayload(payload);
    expect(tags.get(1)).toBe(input.sellerName);
    expect(tags.get(2)).toBe(input.vatNumber);
    expect(tags.get(3)).toBe(input.timestamp);
    expect(tags.get(4)).toBe(input.total);
    expect(tags.get(5)).toBe(input.vatAmount);
  });

  it("encodes lengths in BYTES, not characters (Arabic is multi-byte)", () => {
    const payload = buildZatcaQrPayload(input);
    const bytes = Buffer.from(payload, "base64");
    // First record: tag=1, length = utf8 byte length of the Arabic name.
    expect(bytes[0]).toBe(1);
    expect(bytes[1]).toBe(Buffer.byteLength(input.sellerName, "utf8"));
  });

  it("rejects oversized values", () => {
    expect(() =>
      buildZatcaQrPayload({ ...input, sellerName: "x".repeat(300) }),
    ).toThrow(/255/);
  });
});
