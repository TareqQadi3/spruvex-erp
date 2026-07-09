import { logger } from "../logging/logger";
import { recordAuditEvent } from "../logging/auditLogger";
import type { TenantContext } from "../../shared/types/tenantContext";
import { OfflineQueueRepository } from "../../modules/sync/repositories/offlineQueueRepository";
import { processOperation } from "../../modules/sync/services/offlineQueueProcessor";
import { InvoiceRepository } from "../../modules/zatca/repositories/invoiceRepository";

const offlineQueueRepo = new OfflineQueueRepository();
const invoiceRepo = new InvoiceRepository();

const SYNC_RETRY_MIN_AGE_MS = 60_000; // don't retry a failure less than 1 minute old
const ZATCA_RETRY_MIN_AGE_MS = 5 * 60_000;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unknown error";
}

// Reprocesses every offline_queue entry across all tenants that's been
// sitting in "failed" for at least a minute, reusing the exact same
// dispatcher (offlineQueueProcessor) the live /sync/push endpoint uses — no
// separate retry logic to keep in sync with the real one.
export async function runSyncRetryJob(): Promise<{ retried: number; succeeded: number }> {
  const failedEntries = await offlineQueueRepo.findFailedAcrossTenants(SYNC_RETRY_MIN_AGE_MS);
  let succeeded = 0;

  for (const entry of failedEntries) {
    if (!entry.userId) {
      logger.warn({ entryId: entry.id }, "Skipping retry: offline_queue entry has no userId to attribute it to");
      continue;
    }

    // role is a display/logging field only — real authorization is resolved
    // fresh from the DB by userId inside each service (see
    // permissionResolverService), so this placeholder doesn't bypass anything.
    const tenant: TenantContext = {
      userId: entry.userId,
      companyId: entry.companyId,
      branchId: entry.branchId ?? undefined,
      role: "worker-retry",
    };

    try {
      await processOperation(tenant, {
        clientGeneratedId: entry.clientGeneratedId,
        entityType: entry.entityType,
        operationType: entry.operationType,
        payload: entry.payload as Record<string, unknown>,
      });
      await offlineQueueRepo.markSynced(entry.companyId, entry.id);
      succeeded += 1;
    } catch (err) {
      await offlineQueueRepo.markFailed(entry.companyId, entry.id, errorMessage(err));
      logger.warn({ entryId: entry.id, err: errorMessage(err) }, "Offline operation retry failed again");
    }
  }

  return { retried: failedEntries.length, succeeded };
}

// Detects invoices stuck at "submitted" beyond the threshold and raises them
// for operator attention — it does NOT call submitToZATCA again. That
// function's state machine only allows signed -> submitted; a stuck
// "submitted" invoice needs a "check the actual ZATCA outcome and finalize
// it" capability that doesn't exist today (adding one is a business-logic
// change, out of scope here). Auto-retrying with the existing function would
// just throw an invalid-transition error every time. This job is therefore
// detect-and-alert until that capability is built, not silent-and-automatic.
export async function runZatcaRetryJob(): Promise<{ stuckCount: number }> {
  const stuckInvoices = await invoiceRepo.findInvoicesStuckSubmitted(ZATCA_RETRY_MIN_AGE_MS);

  for (const invoice of stuckInvoices) {
    logger.error(
      { invoiceId: invoice.id, companyId: invoice.companyId, invoiceNumber: invoice.invoiceNumber },
      "Invoice stuck at 'submitted' beyond threshold — needs manual review, no automatic resubmission path exists",
    );
    recordAuditEvent(
      { userId: "worker", companyId: invoice.companyId, role: "worker-retry" } satisfies TenantContext,
      { action: "zatca_stuck_submission_detected", entityType: "invoice", entityId: invoice.id },
    );
  }

  return { stuckCount: stuckInvoices.length };
}
