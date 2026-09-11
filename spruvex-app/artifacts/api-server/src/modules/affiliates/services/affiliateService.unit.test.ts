import { describe, it, expect } from "vitest";
import { computeCommission } from "./affiliateService";

describe("computeCommission", () => {
  it("computes a simple percentage", () => {
    expect(computeCommission(899, 10)).toBeCloseTo(89.9);
  });

  it("rounds to 2 decimal places", () => {
    expect(computeCommission(699, 7.5)).toBeCloseTo(52.43);
  });

  it("returns 0 for a 0% rate", () => {
    expect(computeCommission(899, 0)).toBe(0);
  });

  it("returns 0 for a 0 SAR subscription value", () => {
    expect(computeCommission(0, 10)).toBe(0);
  });

  it("handles a 100% rate", () => {
    expect(computeCommission(599, 100)).toBeCloseTo(599);
  });
});
