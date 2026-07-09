import { and, eq, gt } from "drizzle-orm";
import { customersTable, invoicesTable, productsTable, salesTable, stockMovementsTable } from "@workspace/db";
import { db } from "../../../core/database/connection";
import { AppError } from "../../../core/errors/AppError";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import type { TenantContext } from "../../../shared/types/tenantContext";
import { OfflineQueueRepository } from "../repositories/offlineQueueRepository";
import { SyncLogRepository } from "../repositories/syncLogRepository";
import { idempotencyService } from "./idempotencyService";
import { processOperation } from "./offlineQueueProcessor";
import type {
  AcceptedOperation,
  RejectedOperation,
  SyncChangeRecord,
  SyncPullResponse,
  SyncPushRequest,
  SyncPushResponse,
  SyncStatusResponse,
} from "../types/syncTypes";

const offlineQueueRepo = new OfflineQueueRepository();
const syncLogRepo = new SyncLogRepository();

function errorMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return "Unknown error";
}

// PUSH — each operation is reserved (idempotency), processed, and marked
// synced/failed independently: one bad operation is rejected without ever
// aborting or rolling back the rest of the batch. Note on atomicity:
// create_sale/adjust_stock each run inside their own transaction (owned by
// saleService/inventoryService); the offline_queue status update happens as
// a separate statement right after. That leaves a narrow window where a
// process crash between "operation succeeded" and "queue row marked synced"
// would leave the row stuck pending — an accepted trade-off for this pass
// rather than building a full outbox/saga pattern; a stuck pending row is
// simply retried, and processOperation's own idempotency/business guards
// (e.g. duplicate invoice-per-sale) prevent that retry from double-applying.
export async function pushOperations(tenant: TenantContext, request: SyncPushRequest): Promise<SyncPushResponse> {
  const startedAt = Date.now();
  const accepted: AcceptedOperation[] = [];
  const rejected: RejectedOperation[] = [];

  for (const operation of request.operations) {
    const base = {
      clientGeneratedId: operation.clientGeneratedId,
      entityType: operation.entityType,
      operationType: operation.operationType,
    };

    try {
      const decision = await idempotencyService.reserve(
        {
          companyId: tenant.companyId,
          branchId: request.branchId,
          deviceId: request.deviceId,
          userId: tenant.userId,
          clientGeneratedId: operation.clientGeneratedId,
          entityType: operation.entityType,
          operationType: operation.operationType,
          payload: operation.payload,
        },
        db,
      );

      if (decision.outcome === "already_synced") {
        accepted.push({ ...base, result: { alreadyProcessed: true } });
        continue;
      }
      if (decision.outcome === "in_progress") {
        rejected.push({ ...base, reason: "Operation is already being processed (concurrent duplicate push)" });
        continue;
      }

      try {
        const result = await processOperation(tenant, operation);
        await offlineQueueRepo.markSynced(tenant.companyId, decision.queueEntryId);
        accepted.push({ ...base, result });
      } catch (err) {
        await offlineQueueRepo.markFailed(tenant.companyId, decision.queueEntryId, errorMessage(err));
        rejected.push({ ...base, reason: errorMessage(err) });
      }
    } catch (err) {
      rejected.push({ ...base, reason: errorMessage(err) });
    }
  }

  const latencyMs = Date.now() - startedAt;
  await syncLogRepo.record({
    companyId: tenant.companyId,
    branchId: request.branchId,
    deviceId: request.deviceId,
    successCount: accepted.length,
    failedCount: rejected.length,
    latencyMs,
  });

  recordAuditEvent(tenant, {
    action: "sync_push",
    entityType: "sync_batch",
    details: { deviceId: request.deviceId, accepted: accepted.length, rejected: rejected.length },
  });

  return { accepted, rejected, serverTime: new Date().toISOString() };
}

// PULL — a change feed built from the tables that actually have a reliable
// timestamp to compare against lastSyncAt. Most tables in the real schema
// have no updated_at column (no schema changes this pass), so edits to
// products/customers/sales can't be distinguished from their creation —
// every row is reported as a "create" event except invoices, which does
// have both createdAt and updatedAt. branch_id filtering is applied
// wherever the entity actually carries a branch_id; none of the pullable
// entities do today (the same missing-branches-table gap flagged in every
// module this session), so pull currently returns the whole company's
// changes regardless of the branchId argument — documented here rather than
// silently ignored.
export async function pullChanges(companyId: string, _branchId: string | undefined, lastSyncAt: Date | null): Promise<SyncPullResponse> {
  const since = lastSyncAt ?? new Date(0);
  const changes: SyncChangeRecord[] = [];

  const products = await db.select().from(productsTable).where(and(eq(productsTable.companyId, companyId), gt(productsTable.createdAt, since)));
  for (const row of products) {
    changes.push({ entityType: "product", entityId: row.id, operation: "create", updatedAt: row.createdAt.toISOString(), payload: row });
  }

  const customers = await db.select().from(customersTable).where(and(eq(customersTable.companyId, companyId), gt(customersTable.createdAt, since)));
  for (const row of customers) {
    changes.push({ entityType: "customer", entityId: row.id, operation: "create", updatedAt: row.createdAt.toISOString(), payload: row });
  }

  const sales = await db.select().from(salesTable).where(and(eq(salesTable.companyId, companyId), gt(salesTable.createdAt, since)));
  for (const row of sales) {
    changes.push({ entityType: "sale", entityId: row.id, operation: "create", updatedAt: row.createdAt.toISOString(), payload: row });
  }

  const invoiceRows = await db.select().from(invoicesTable).where(and(eq(invoicesTable.companyId, companyId), gt(invoicesTable.updatedAt, since)));
  for (const row of invoiceRows) {
    const operation = row.updatedAt.getTime() === row.createdAt.getTime() ? "create" : "update";
    changes.push({ entityType: "invoice", entityId: row.id, operation, updatedAt: row.updatedAt.toISOString(), payload: row });
  }

  const movements = await db
    .select()
    .from(stockMovementsTable)
    .where(and(eq(stockMovementsTable.companyId, companyId), gt(stockMovementsTable.createdAt, since)));
  for (const row of movements) {
    changes.push({ entityType: "stock_movement", entityId: row.id, operation: "create", updatedAt: row.createdAt.toISOString(), payload: row });
  }

  changes.sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());

  return { changes, serverTime: new Date().toISOString() };
}

export async function getSyncStatus(companyId: string, deviceId: string): Promise<SyncStatusResponse> {
  const lastLog = await syncLogRepo.findLastForDevice(companyId, deviceId);
  const pendingCount = await offlineQueueRepo.countPending(companyId, deviceId);
  return {
    deviceId,
    lastSyncAt: lastLog?.syncedAt.toISOString() ?? null,
    pendingCount,
    lastSuccessCount: lastLog?.successCount ?? null,
    lastFailedCount: lastLog?.failedCount ?? null,
  };
}
