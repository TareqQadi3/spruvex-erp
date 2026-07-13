import { calculateRecipeCostUnits } from "./food-cost";
import { costUnitsToSar, sarToCostUnits } from "./money";

describe("cost-unit money helpers (4-decimal precision for ingredient costing)", () => {
  it("round-trips SAR <-> cost units", () => {
    expect(sarToCostUnits("0.0350")).toBe(350);
    expect(sarToCostUnits("1.5")).toBe(15000);
    expect(sarToCostUnits(2)).toBe(20000);
    expect(costUnitsToSar(350)).toBe("0.0350");
    expect(costUnitsToSar(20000)).toBe("2.0000");
  });

  it("rejects amounts with more than 4 decimal places", () => {
    expect(() => sarToCostUnits("0.03501")).toThrow();
  });
});

describe("calculateRecipeCostUnits", () => {
  it("sums a burger recipe: bread + 150g meat + cheese slice", () => {
    // bread: 1 pc @ 0.75 SAR/pc
    // meat: 150 g, ingredient priced per gram (0.0350 SAR/g)
    // cheese: 1 slice, unit "slice" = 20g of a per-gram-priced cheese (0.0400 SAR/g)
    const lines = [
      { quantity: "1", unitToBaseFactor: "1", ingredientAverageCost: "0.7500" },
      { quantity: "150", unitToBaseFactor: "1", ingredientAverageCost: "0.0350" },
      { quantity: "1", unitToBaseFactor: "20", ingredientAverageCost: "0.0400" },
    ];
    // 0.75 + (150*0.035=5.25) + (20*0.04=0.80) = 6.80 SAR
    expect(calculateRecipeCostUnits(lines)).toBe(68000);
    expect(costUnitsToSar(calculateRecipeCostUnits(lines))).toBe("6.8000");
  });

  it("converts recipe units to the ingredient's base unit (kg -> g)", () => {
    // 0.5 kg of an ingredient priced at 0.0200 SAR/gram; kg -> g factor 1000
    const lines = [
      { quantity: "0.5", unitToBaseFactor: "1000", ingredientAverageCost: "0.0200" },
    ];
    // 0.5 * 1000 = 500g * 0.02 = 10.00 SAR
    expect(calculateRecipeCostUnits(lines)).toBe(100000);
  });

  it("returns 0 for an empty recipe", () => {
    expect(calculateRecipeCostUnits([])).toBe(0);
  });
});
