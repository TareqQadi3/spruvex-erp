import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { tenantScope, compositeKeyMatch } from "../../core/database/compositeKey";

// Business-module repositories extend this so tenant scoping is never
// hand-rolled per query — every concrete repository gets the same two
// predicate builders wired to its own table/columns.
export abstract class BaseRepository<TTable extends PgTable> {
  protected constructor(
    protected readonly table: TTable,
    protected readonly companyIdColumn: AnyPgColumn,
    protected readonly idColumn: AnyPgColumn,
  ) {}

  protected scopeToTenant(companyId: string) {
    return tenantScope(this.companyIdColumn, companyId);
  }

  protected scopeToRecord(companyId: string, id: string) {
    return compositeKeyMatch(this.companyIdColumn, this.idColumn, companyId, id);
  }
}
