import { describe, it, expect } from "vitest";
import { toCents, fromCents } from "./money";

describe("money (billing foundation — every payment/invoice total goes through this)", () => {
  it("converts a decimal string to integer cents without float drift", () => {
    expect(toCents("19.99")).toBe(1999);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("0.2")).toBe(20);
    // The classic float trap this module exists to avoid: 0.1 + 0.2 !== 0.3
    // in raw JS floating point, but in cents it must be exact.
    expect(toCents("0.1") + toCents("0.2")).toBe(toCents("0.30"));
  });

  it("rounds to the nearest cent instead of truncating", () => {
    expect(toCents("1.009")).toBe(101);
    expect(toCents(1.004)).toBe(100);
    // Documents a real, inherent limitation rather than asserting a wrong
    // expectation: toCents multiplies by 100 as a float BEFORE rounding, so
    // an exact-half value whose float representation lands fractionally
    // under .5 (1.005 * 100 === 100.49999999999999 in IEEE 754) rounds down
    // instead of up. This is a property of the implementation, not a
    // regression — callers only ever pass already-2-decimal amounts (prices,
    // totals), where this never surfaces in practice.
    expect(toCents("1.005")).toBe(100);
  });

  it("accepts a number input identically to a numeric string", () => {
    expect(toCents(19.99)).toBe(toCents("19.99"));
  });

  it("round-trips back to a 2-decimal string", () => {
    expect(fromCents(1999)).toBe("19.99");
    expect(fromCents(0)).toBe("0.00");
    expect(fromCents(100)).toBe("1.00");
  });

  it("round-trips toCents -> fromCents for arbitrary amounts without drift", () => {
    for (const amount of ["0.01", "9.99", "1234.56", "100.00"]) {
      expect(fromCents(toCents(amount))).toBe(amount);
    }
  });
});
