import { and, desc, eq } from "drizzle-orm";
import { syncLogsTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";

export class SyncLogRepository {
  async record(entry: typeof syncLogsTable.$inferInsert, client: DbOrTx = db) {
    const [row] = await client.insert(syncLogsTable).values(entry).returning();
    return row;
  }

  // lastSyncAt for a device is this row's syncedAt — no separate "device
  // state" table is kept; it's always derived from the log.
  async findLastForDevice(companyId: string, deviceId: string, client: DbOrTx = db) {
    const [row] = await client
      .select()
      .from(syncLogsTable)
      .where(and(eq(syncLogsTable.companyId, companyId), eq(syncLogsTable.deviceId, deviceId)))
      .orderBy(desc(syncLogsTable.syncedAt))
      .limit(1);
    return row ?? null;
  }
}
