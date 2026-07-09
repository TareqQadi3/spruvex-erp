import { and, eq, lt } from "drizzle-orm";
import { offlineQueueTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export class OfflineQueueRepository {
  async findByClientGeneratedId(companyId: string, clientGeneratedId: string, client: DbOrTx = db) {
    const [row] = await client
      .select()
      .from(offlineQueueTable)
      .where(
        withTenantScope(offlineQueueTable.companyId, companyId, eq(offlineQueueTable.clientGeneratedId, clientGeneratedId)),
      )
      .limit(1);
    return row ?? null;
  }

  // Inserts only if no row exists yet for (company_id, client_generated_id) —
  // the UNIQUE index is what actually enforces this atomically under
  // concurrent pushes; this is a thin wrapper. Returns the inserted row, or
  // undefined if a row already existed (see idempotencyService for what to
  // do next in that case).
  async insertIfNew(entry: typeof offlineQueueTable.$inferInsert, client: DbOrTx = db) {
    const [row] = await client.insert(offlineQueueTable).values(entry).onConflictDoNothing().returning();
    return row;
  }

  async markSynced(companyId: string, id: string, client: DbOrTx = db) {
    const [row] = await client
      .update(offlineQueueTable)
      .set({ syncStatus: "synced", errorMessage: null, syncedAt: new Date() })
      .where(and(eq(offlineQueueTable.companyId, companyId), eq(offlineQueueTable.id, id)))
      .returning();
    return row ?? null;
  }

  async markFailed(companyId: string, id: string, errorMessage: string, client: DbOrTx = db) {
    const [row] = await client
      .update(offlineQueueTable)
      .set({ syncStatus: "failed", errorMessage })
      .where(and(eq(offlineQueueTable.companyId, companyId), eq(offlineQueueTable.id, id)))
      .returning();
    return row ?? null;
  }

  // Resets a previously-failed entry back to pending so it can be retried —
  // used when a client replays a clientGeneratedId whose last attempt failed.
  async resetToPending(companyId: string, id: string, client: DbOrTx = db) {
    const [row] = await client
      .update(offlineQueueTable)
      .set({ syncStatus: "pending", errorMessage: null, syncedAt: null })
      .where(and(eq(offlineQueueTable.companyId, companyId), eq(offlineQueueTable.id, id)))
      .returning();
    return row ?? null;
  }

  // Worker-only: scans across every tenant (no company_id filter — this is
  // trusted internal infra, not a tenant-facing endpoint). Only entries that
  // failed more than `olderThanMs` ago are returned, so a fresh failure isn't
  // immediately retried in a tight loop.
  async findFailedAcrossTenants(olderThanMs: number, client: DbOrTx = db) {
    const cutoff = new Date(Date.now() - olderThanMs);
    return client
      .select()
      .from(offlineQueueTable)
      .where(and(eq(offlineQueueTable.syncStatus, "failed"), lt(offlineQueueTable.createdAt, cutoff)));
  }

  async countPending(companyId: string, deviceId: string, client: DbOrTx = db): Promise<number> {
    const rows = await client
      .select({ id: offlineQueueTable.id })
      .from(offlineQueueTable)
      .where(
        and(
          eq(offlineQueueTable.companyId, companyId),
          eq(offlineQueueTable.deviceId, deviceId),
          eq(offlineQueueTable.syncStatus, "pending"),
        ),
      );
    return rows.length;
  }
}
