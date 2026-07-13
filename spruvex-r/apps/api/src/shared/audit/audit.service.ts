import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { actorOrNull, TenantContextService } from "../tenancy/tenant-context.service";

export interface AuditEntry {
  /** e.g. "order.voided", "role.permissions_changed", "shift.cash_out" */
  action: string;
  entityType?: string;
  entityId?: string;
  branchId?: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
  /**
   * Explicit tenant override for the one moment a tenant exists but is not in
   * the token yet: the provisioning step of onboarding. Everything else uses
   * the request context's tenant.
   */
  tenantId?: string;
}

/**
 * Writes to the append-only audit trail. The database revokes UPDATE/DELETE
 * on audit_logs from the app role, so entries cannot be tampered with.
 */
@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    const ctx = this.tenantContext.contextOrThrow;
    const tenantId = entry.tenantId ?? this.tenantContext.tenantIdOrThrow;
    await this.prisma.forTenant(tenantId).auditLog.create({
      data: {
        tenantId,
        branchId: entry.branchId ?? ctx.branchId,
        userId: actorOrNull(ctx.userId),
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        meta: entry.meta ?? {},
        ip: entry.ip,
      },
    });
  }
}
