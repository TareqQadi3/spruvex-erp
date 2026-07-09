import { and, eq, type SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { AppError } from "../errors/AppError";

// Application-layer mirror of the database's composite (company_id, id) foreign
// key strategy: every read/write must be scoped by company_id, and every id
// lookup should use (company_id, id) together — the DB composite FKs are the
// backstop, this is the first line of defense in query construction.

export function tenantScope(companyIdColumn: AnyPgColumn, companyId: string): SQL {
  return eq(companyIdColumn, companyId);
}

export function compositeKeyMatch(
  companyIdColumn: AnyPgColumn,
  idColumn: AnyPgColumn,
  companyId: string,
  id: string,
): SQL {
  return and(eq(companyIdColumn, companyId), eq(idColumn, id)) as SQL;
}

export function withTenantScope(
  companyIdColumn: AnyPgColumn,
  companyId: string,
  ...conditions: Array<SQL | undefined>
): SQL {
  return and(eq(companyIdColumn, companyId), ...conditions.filter((c): c is SQL => Boolean(c))) as SQL;
}

// Defense-in-depth check for rows already fetched by id alone (e.g. a join result) —
// confirms the row's own company_id matches the request's tenant before it's used.
export function assertTenantMatch(resourceCompanyId: string | null | undefined, contextCompanyId: string): void {
  if (!resourceCompanyId || resourceCompanyId !== contextCompanyId) {
    throw AppError.tenantMismatch();
  }
}
