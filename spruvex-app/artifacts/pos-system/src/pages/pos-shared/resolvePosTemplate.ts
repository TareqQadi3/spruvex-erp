export type PosTemplate = "list" | "grid" | "image" | "mobile";

/**
 * Single source of truth for POS template precedence: business-type default
 * (settings.posTemplate) < category override (categories.displayMode) <
 * product override (products.displayMode). Every override is optional —
 * whichever is set closest to the product wins.
 *
 * Used per-product (not just once per page) so a mixed catalog — e.g. a
 * grocery store that wants ready-made coffee cups browsed as a grid while
 * the rest of the store stays list-style — can mix templates by category or
 * product without any code change, just data.
 */
export function resolvePosTemplate(input: {
  companyDefault: PosTemplate;
  categoryOverride?: string | null;
  productOverride?: string | null;
}): PosTemplate {
  return (
    (input.productOverride as PosTemplate | undefined) ||
    (input.categoryOverride as PosTemplate | undefined) ||
    input.companyDefault
  );
}
