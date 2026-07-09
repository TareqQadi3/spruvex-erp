// Shared input-validation helpers. Several routes used to pass req.body values straight
// into `.toString()`/arithmetic — a non-numeric string would silently become "NaN" in the
// database instead of failing the request. These throw a ValidationError the caller can
// catch and turn into a 400, instead of trusting the client.
export class ValidationError extends Error {}

export function parseRequiredNumber(value: unknown, field: string): number {
  const n = Number(value);
  if (value === undefined || value === null || value === "" || Number.isNaN(n)) {
    throw new ValidationError(`${field} must be a number`);
  }
  return n;
}

export function parseOptionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (Number.isNaN(n)) throw new ValidationError(`${field} must be a number`);
  return n;
}

// Postgres unique_violation error code — used to turn a duplicate-key insert/update
// into a clean 409 instead of a generic 500. Drizzle wraps the underlying pg error
// (which has `.code`) inside its own error object exposed via `.cause`, so both
// shapes need checking.
export function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  if ((err as { code?: string }).code === "23505") return true;
  const cause = (err as { cause?: unknown }).cause;
  return typeof cause === "object" && cause !== null && (cause as { code?: string }).code === "23505";
}
