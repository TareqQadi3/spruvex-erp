import type { MenuModifier, MenuProduct } from "./types";
import { addMoney, multiplyMoney } from "./money";

export interface CartLine {
  lineId: string;
  product: MenuProduct;
  quantity: number;
  modifiers: MenuModifier[];
  notes?: string;
}

export function lineUnitPrice(line: CartLine): string {
  return line.modifiers.reduce(
    (sum, modifier) => addMoney(sum, modifier.priceAdjustment),
    line.product.price,
  );
}

export function lineTotal(line: CartLine): string {
  return multiplyMoney(lineUnitPrice(line), line.quantity);
}

export function cartTotal(lines: CartLine[]): string {
  return lines.reduce((sum, line) => addMoney(sum, lineTotal(line)), "0");
}

export function cartItemCount(lines: CartLine[]): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
