import { sarToCostUnits } from "./money";

export interface RecipeCostLine {
  /** Recipe item quantity, in the recipe's chosen unit (decimal string). */
  quantity: string;
  /** How many base units (g / ml / pc) equal one of the recipe's unit. */
  unitToBaseFactor: string;
  /** Ingredient's moving-average cost per base unit (SAR, up to 4 decimals). */
  ingredientAverageCost: string;
}

/**
 * Sums a product's recipe cost in cost units (1 SAR = 10,000 units, see
 * money.ts). Pure function — no I/O — shared by the order-time cost
 * snapshot (Ordering module) and live cost/margin reporting (Inventory
 * module), so both stay consistent without a cross-module dependency.
 *
 * Same float-then-round approach as vatFromGross/vatFromNet: JS float
 * multiply, rounded to the nearest integer cost unit at the end.
 */
export function calculateRecipeCostUnits(lines: RecipeCostLine[]): number {
  let totalUnits = 0;
  for (const line of lines) {
    const quantityInBaseUnits = Number(line.quantity) * Number(line.unitToBaseFactor);
    const costPerBaseUnitUnits = sarToCostUnits(line.ingredientAverageCost);
    totalUnits += quantityInBaseUnits * costPerBaseUnitUnits;
  }
  return Math.round(totalUnits);
}
