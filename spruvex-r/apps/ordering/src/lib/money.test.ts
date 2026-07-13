import { describe, expect, it } from "vitest";

import { addMoney, formatMoney, multiplyMoney, toHalalas } from "./money";

describe("money display helpers", () => {
  it("converts SAR decimal strings to halalas", () => {
    expect(toHalalas("15.50")).toBe(1550);
    expect(toHalalas("0.05")).toBe(5);
    expect(toHalalas("100")).toBe(10000);
    expect(toHalalas("-2.25")).toBe(-225);
  });

  it("formats money with currency", () => {
    expect(formatMoney("15.5", "SAR")).toBe("15.50 SAR");
    expect(formatMoney("0", "SAR")).toBe("0.00 SAR");
  });

  it("adds money without floating point drift", () => {
    expect(addMoney("0.10", "0.20")).toBe("0.30");
    expect(addMoney("10.05", "5.00")).toBe("15.05");
  });

  it("multiplies money by an integer quantity", () => {
    expect(multiplyMoney("32.50", 2)).toBe("65.00");
    expect(multiplyMoney("5.00", 1)).toBe("5.00");
  });
});
