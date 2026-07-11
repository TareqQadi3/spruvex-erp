import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";
import { TenantContextService } from "../tenancy/tenant-context.service";

export interface AuditEntry {
  /** e.g. "order.voided", "role.permissions_changed", "shift.cash_out" */
  action: string;
  entityType?: string;
  entityId?: string;
  branchId?: string;
  meta?: Prisma.InputJsonValue;
  ip?: string;
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
    await this.prisma.scoped.auditLog.create({
      data: {
        tenantId: ctx.tenantId,
        branchId: entry.branchId ?? ctx.branchId,
        userId: ctx.userId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        meta: entry.meta ?? {},
        ip: entry.ip,
      },
    });
  }
}
