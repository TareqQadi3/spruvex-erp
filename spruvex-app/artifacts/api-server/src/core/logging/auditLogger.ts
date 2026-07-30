import { logger } from "./logger";
import type { TenantContext } from "../../shared/types/tenantContext";
// Deliberate exception to "core has no module dependencies" (same pattern as
// core/middleware/permission.middleware.ts) — this is the one place every
// modular-router audit event (transferStock, adjustStock, ecommerce,
// payments, zatca, purchase invoices, sync, invoicing templates, pos sale)
// funnels through, so persisting to the Phase 6 audit_logs table here means
// every existing call site gets a real audit-log row with zero changes,
// exactly as this file's own prior comment intended.
import { logAudit } from "../../modules/auditLog/auditLogService";

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

  void logAudit({
    companyId: tenant.companyId,
    userId: tenant.userId,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId,
    newValue: event.details,
  });
}
