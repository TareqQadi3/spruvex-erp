// All money math happens in integer cents — numeric columns come back from
// Postgres as strings, and comparing/summing them as JS floats risks the
// classic 0.1 + 0.2 rounding drift, which is unacceptable for payment totals.

export function toCents(value: number | string): number {
  return Math.round(Number(value) * 100);
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}
