/**
 * Global unit-of-measure catalog (Phase 7 — Inventory & Recipes).
 * Seeded into `units_of_measure` the same way PERMISSIONS seeds
 * `permissions`: a fixed, backend-owned catalog shared by API and frontends.
 *
 * Every ingredient tracks stock in the canonical BASE unit of its
 * measurement family (grams for mass, milliliters for volume, pieces for
 * count) — `toBaseFactor` says how many base units equal one of this unit.
 */
export const UNIT_TYPES = ["mass", "volume", "count"] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export interface UnitCatalogEntry {
  code: string;
  name: string;
  nameEn: string;
  type: UnitType;
  toBaseFactor: string;
}

export const UNIT_CATALOG: readonly UnitCatalogEntry[] = [
  { code: "g", name: "غرام", nameEn: "Gram", type: "mass", toBaseFactor: "1" },
  { code: "kg", name: "كيلوغرام", nameEn: "Kilogram", type: "mass", toBaseFactor: "1000" },
  { code: "ml", name: "مليلتر", nameEn: "Milliliter", type: "volume", toBaseFactor: "1" },
  { code: "l", name: "لتر", nameEn: "Liter", type: "volume", toBaseFactor: "1000" },
  { code: "pc", name: "قطعة", nameEn: "Piece", type: "count", toBaseFactor: "1" },
] as const;
