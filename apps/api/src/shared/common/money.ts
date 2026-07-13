/**
 * Money utilities. Amounts are handled as integer halalas (1 SAR = 100 halalas)
 * to avoid floating point errors — floats are forbidden for money (plan §9.2).
 */

/** Converts a SAR amount expressed as string/number into integer halalas. */
export function sarToHalalas(sar: string | number): number {
  const normalized = typeof sar === "number" ? sar.toFixed(2) : sar.trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error(`Invalid SAR amount: ${sar}`);
  }
  const [whole, fraction = ""] = normalized.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const halalas =
    Math.abs(Number(whole)) * 100 + Number(fraction.padEnd(2, "0") || "0");
  return sign * halalas;
}

/** Formats integer halalas as a SAR decimal string, e.g. 1550 -> "15.50". */
export function halalasToSar(halalas: number): string {
  if (!Number.isInteger(halalas)) {
    throw new Error(`Halalas must be an integer: ${halalas}`);
  }
  const sign = halalas < 0 ? "-" : "";
  const abs = Math.abs(halalas);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Half-up rounding used for all VAT arithmetic. */
function roundHalfUp(value: number): number {
  return Math.floor(value + 0.5);
}

/** VAT portion contained in a gross (VAT-inclusive) amount. */
export function vatFromGross(grossHalalas: number, ratePercent: number): number {
  assertRate(ratePercent);
  return roundHalfUp((grossHalalas * ratePercent) / (100 + ratePercent));
}

/** VAT to add on top of a net (VAT-exclusive) amount. */
export function vatFromNet(netHalalas: number, ratePercent: number): number {
  assertRate(ratePercent);
  return roundHalfUp((netHalalas * ratePercent) / 100);
}

function assertRate(ratePercent: number) {
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new Error(`Invalid VAT rate: ${ratePercent}`);
  }
}

/**
 * Higher-precision variant for food-cost accounting (4 decimal places —
 * e.g. a fraction of a halala per gram of an ingredient). Selling prices
 * stay 2-decimal halalas; only ingredient/recipe cost math uses this.
 * 1 SAR = 10,000 cost units.
 */
export function sarToCostUnits(sar: string | number): number {
  const normalized = typeof sar === "number" ? sar.toFixed(4) : sar.trim();
  if (!/^-?\d+(\.\d{1,4})?$/.test(normalized)) {
    throw new Error(`Invalid SAR amount: ${sar}`);
  }
  const [whole, fraction = ""] = normalized.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const units = Math.abs(Number(whole)) * 10000 + Number(fraction.padEnd(4, "0") || "0");
  return sign * units;
}

/** Formats integer cost units as a SAR decimal string, e.g. 350 -> "0.0350". */
export function costUnitsToSar(units: number): string {
  if (!Number.isInteger(units)) {
    throw new Error(`Cost units must be an integer: ${units}`);
  }
  const sign = units < 0 ? "-" : "";
  const abs = Math.abs(units);
  return `${sign}${Math.floor(abs / 10000)}.${String(abs % 10000).padStart(4, "0")}`;
}
