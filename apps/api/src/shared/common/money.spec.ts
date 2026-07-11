import { halalasToSar, sarToHalalas, vatFromGross, vatFromNet } from "./money";

describe("money utils", () => {
  it("converts SAR strings to halalas exactly", () => {
    expect(sarToHalalas("15.50")).toBe(1550);
    expect(sarToHalalas("0.05")).toBe(5);
    expect(sarToHalalas("100")).toBe(10000);
    expect(sarToHalalas("3.7")).toBe(370);
    expect(sarToHalalas(19.99)).toBe(1999);
    expect(sarToHalalas("-2.25")).toBe(-225);
  });

  it("rejects malformed amounts", () => {
    expect(() => sarToHalalas("12.345")).toThrow();
    expect(() => sarToHalalas("abc")).toThrow();
    expect(() => sarToHalalas("")).toThrow();
  });

  it("formats halalas back to SAR", () => {
    expect(halalasToSar(1550)).toBe("15.50");
    expect(halalasToSar(5)).toBe("0.05");
    expect(halalasToSar(-225)).toBe("-2.25");
    expect(() => halalasToSar(1.5)).toThrow();
  });

  it("round-trips without drift", () => {
    for (const amount of ["0.01", "0.10", "1.15", "999999.99"]) {
      expect(halalasToSar(sarToHalalas(amount))).toBe(amount.includes(".") ? amount : `${amount}.00`);
    }
  });

  it("computes 15% VAT from gross (ZATCA-style inclusive pricing)", () => {
    // 115.00 SAR gross at 15% -> 15.00 SAR VAT
    expect(vatFromGross(11500, 15)).toBe(1500);
    // 10.00 SAR gross at 15% -> 1.3043... -> 1.30
    expect(vatFromGross(1000, 15)).toBe(130);
  });

  it("computes VAT from net with half-up rounding", () => {
    expect(vatFromNet(10000, 15)).toBe(1500);
    // 0.10 SAR * 15% = 1.5 halalas -> rounds to 2
    expect(vatFromNet(10, 15)).toBe(2);
  });

  it("rejects invalid VAT rates", () => {
    expect(() => vatFromNet(100, -1)).toThrow();
    expect(() => vatFromGross(100, 101)).toThrow();
  });
});
