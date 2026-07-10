import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import {
  aiSettingsTable,
  aiUsageLogsTable,
  salesTable,
  type AiSettings,
  type AiUsageLog,
  type InsertAiUsageLog,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export interface ListUsageLogsFilters {
  page: number;
  pageSize: number;
}

export interface SalesWindowAggregate {
  count: number;
  total: number;
}

export class AiRepository {
  async findSettings(companyId: string, client: DbOrTx = db): Promise<AiSettings | null> {
    const [row] = await client
      .select()
      .from(aiSettingsTable)
      .where(eq(aiSettingsTable.companyId, companyId))
      .limit(1);
    return row ?? null;
  }

  async insertSettings(
    input: { companyId: string; provider?: string; model?: string | null; apiKey?: string | null; isActive?: boolean },
    client: DbOrTx = db,
  ): Promise<AiSettings> {
    const [row] = await client.insert(aiSettingsTable).values(input).returning();
    return row;
  }

  async updateSettings(
    companyId: string,
    fields: Partial<Pick<AiSettings, "provider" | "model" | "apiKey" | "isActive">>,
    client: DbOrTx = db,
  ): Promise<AiSettings | null> {
    const [row] = await client
      .update(aiSettingsTable)
      .set({ ...fields, updatedAt: new Date() })
      .where(eq(aiSettingsTable.companyId, companyId))
      .returning();
    return row ?? null;
  }

  async insertUsageLog(input: InsertAiUsageLog, client: DbOrTx = db): Promise<AiUsageLog> {
    const [row] = await client.insert(aiUsageLogsTable).values(input).returning();
    return row;
  }

  async listUsageLogs(
    companyId: string,
    filters: ListUsageLogsFilters,
    client: DbOrTx = db,
  ): Promise<{ rows: AiUsageLog[]; total: number }> {
    const conditions = withTenantScope(aiUsageLogsTable.companyId, companyId);
    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ count }]] = await Promise.all([
      client
        .select()
        .from(aiUsageLogsTable)
        .where(conditions)
        .orderBy(desc(aiUsageLogsTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
      client.select({ count: sql<number>`count(*)::int` }).from(aiUsageLogsTable).where(conditions),
    ]);

    return { rows, total: count };
  }

  // Quota counter — every AI feature (product assistant, business assistant)
  // shares this one count, straight from the audit trail every call already
  // writes to. Counts both success AND error rows deliberately: a failed
  // provider call still consumed a request attempt against the plan's
  // allowance from the tenant's perspective (and, for a real paid provider,
  // may still have consumed tokens even on a non-2xx response).
  async countUsageInWindow(companyId: string, since: Date, until: Date, client: DbOrTx = db): Promise<number> {
    const [row] = await client
      .select({ count: sql<number>`count(*)::int` })
      .from(aiUsageLogsTable)
      .where(
        withTenantScope(
          aiUsageLogsTable.companyId,
          companyId,
          and(gte(aiUsageLogsTable.createdAt, since), lt(aiUsageLogsTable.createdAt, until)),
        ),
      );
    return row?.count ?? 0;
  }

  // Aggregates for the business-summary assistant: invoice count + total sales
  // for [since, until) — used once for the trailing 30 days and once for the
  // 30 days before that, to give the model a comparison baseline.
  async getSalesWindowAggregate(
    companyId: string,
    since: Date,
    until: Date,
    client: DbOrTx = db,
  ): Promise<SalesWindowAggregate> {
    const [row] = await client
      .select({
        count: sql<number>`count(*)::int`,
        total: sql<string>`coalesce(sum(${salesTable.total}), 0)`,
      })
      .from(salesTable)
      .where(
        withTenantScope(
          salesTable.companyId,
          companyId,
          and(gte(salesTable.createdAt, since), lt(salesTable.createdAt, until)),
        ),
      );

    return { count: row?.count ?? 0, total: Number(row?.total ?? 0) };
  }
}

export const aiRepository = new AiRepository();
