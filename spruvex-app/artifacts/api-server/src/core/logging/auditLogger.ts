import { logger } from "./logger";
import type { TenantContext } from "../../shared/types/tenantContext";

// Structured, tenant-scoped audit trail. Emitted as a distinguishable log line for
// now (searchable via the "audit" logger name); swap the sink for a DB-backed
// audit_logs table once that table exists, without changing any call sites.
const auditLog = logger.child({ logger: "audit" });

export interface AuditEvent {
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export function recordAuditEvent(tenant: TenantContext, event: AuditEvent): void {
  auditLog.info(
    {
      companyId: tenant.companyId,
      userId: tenant.userId,
      branchId: tenant.branchId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      details: event.details,
    },
    `audit: ${event.action} ${event.entityType}`,
  );
}
