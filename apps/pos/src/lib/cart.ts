/** POS cart model. Money math in integer halalas — display only; the server recomputes authoritatively. */

export interface MenuModifier {
  id: string;
  name: string;
  nameEn: string | null;
  priceAdjustment: string;
  isActive: boolean;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  nameEn: string | null;
  isRequired: boolean;
  minSelect: number;
  maxSelect: number | null;
  modifiers: MenuModifier[];
}

export interface MenuProduct {
  id: string;
  categoryId: string;
  name: string;
  nameEn: string | null;
  imageUrl: string | null;
  basePrice: string;
  isActive: boolean;
  branchSettings: Array<{ branchId: string; priceOverride: string | null; isAvailable: boolean }>;
  modifierGroups: Array<{ modifierGroupId: string; group: MenuModifierGroup }>;
}

export interface CartLine {
  lineId: string;
  product: MenuProduct;
  quantity: number;
  modifiers: MenuModifier[];
  notes?: string;
}

export function toHalalas(decimal: string): number {
  const [whole, fraction = ""] = decimal.replace("-", "").split(".");
  const sign = decimal.startsWith("-") ? -1 : 1;
  return sign * (Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2) || "0"));
}

export function formatSar(halalas: number): string {
  const sign = halalas < 0 ? "-" : "";
  const abs = Math.abs(halalas);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

export function productPrice(product: MenuProduct, branchId: string): number {
  const setting = product.branchSettings.find((s) => s.branchId === branchId);
  return toHalalas((setting?.priceOverride ?? product.basePrice).toString());
}

export function lineTotal(line: CartLine, branchId: string): number {
  const adjustments = line.modifiers.reduce(
    (sum, modifier) => sum + toHalalas(modifier.priceAdjustment),
    0,
  );
  return (productPrice(line.product, branchId) + adjustments) * line.quantity;
}

export function cartTotal(lines: CartLine[], branchId: string): number {
  return lines.reduce((sum, line) => sum + lineTotal(line, branchId), 0);
}

export function isAvailableInBranch(product: MenuProduct, branchId: string): boolean {
  const setting = product.branchSettings.find((s) => s.branchId === branchId);
  return product.isActive && setting?.isAvailable !== false;
}
