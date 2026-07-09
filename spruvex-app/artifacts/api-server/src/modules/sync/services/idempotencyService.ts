import type { OfflineOperationType, OfflineQueueEntry } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import type { DbOrTx } from "../../../core/database/transaction";
import { OfflineQueueRepository } from "../repositories/offlineQueueRepository";

export interface ReserveParams {
  companyId: string;
  branchId?: string;
  deviceId: string;
  userId?: string;
  clientGeneratedId: string;
  entityType: string;
  operationType: OfflineOperationType;
  payload: Record<string, unknown>;
}

export type IdempotencyDecision =
  | { outcome: "process"; queueEntryId: string }
  | { outcome: "already_synced"; queueEntry: OfflineQueueEntry }
  | { outcome: "in_progress"; queueEntry: OfflineQueueEntry };

// clientGeneratedId is UNIQUE per company_id at the DB level (offline_queue's
// index) — this service is the thin decision layer on top of that
// constraint: a fresh id proceeds to processing; a replayed id that already
// succeeded is reported back as already-done (no reprocessing, no duplicate
// side effects); a replay while the first attempt is still mid-flight is
// rejected as in-progress rather than racing it; a replay of a previously
// FAILED attempt is allowed to retry.
export class IdempotencyService {
  constructor(private readonly repo: OfflineQueueRepository = new OfflineQueueRepository()) {}

  async reserve(params: ReserveParams, client: DbOrTx): Promise<IdempotencyDecision> {
    const inserted = await this.repo.insertIfNew(
      {
        companyId: params.companyId,
        branchId: params.branchId,
        deviceId: params.deviceId,
        userId: params.userId,
        clientGeneratedId: params.clientGeneratedId,
        entityType: params.entityType,
        operationType: params.operationType,
        payload: params.payload,
        syncStatus: "pending",
      },
      client,
    );

    if (inserted) {
      return { outcome: "process", queueEntryId: inserted.id };
    }

    const existing = await this.repo.findByClientGeneratedId(params.companyId, params.clientGeneratedId, client);
    if (!existing) throw AppError.internal("Idempotency reservation vanished unexpectedly");

    if (existing.syncStatus === "synced") {
      return { outcome: "already_synced", queueEntry: existing };
    }
    if (existing.syncStatus === "failed") {
      await this.repo.resetToPending(params.companyId, existing.id, client);
      return { outcome: "process", queueEntryId: existing.id };
    }
    return { outcome: "in_progress", queueEntry: existing };
  }
}

export const idempotencyService = new IdempotencyService();
