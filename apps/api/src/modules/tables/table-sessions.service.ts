import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AuditService } from "../../shared/audit/audit.service";
import { PrismaService } from "../../shared/prisma/prisma.service";
import { TenantContextService } from "../../shared/tenancy/tenant-context.service";

/**
 * Table sessions — the foundation the ordering engine (Phase 4+) builds on.
 * A session represents customers seated at a table; consecutive orders from
 * the same table join the open session and close as one bill.
 */
@Injectable()
export class TableSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly audit: AuditService,
  ) {}

  /** Opens a session and marks the table occupied. One open session per table. */
  async open(tableId: string, notes?: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const table = await this.tableOrThrow(tableId);
    if (table.status === "disabled") {
      throw new ConflictException("Table is disabled");
    }

    const existing = await this.prisma.scoped.tableSession.findFirst({
      where: { tableId, closedAt: null },
    });
    if (existing) {
      throw new ConflictException("Table already has an open session");
    }

    const [session] = await Promise.all([
      this.prisma.scoped.tableSession.create({
        data: {
          tenantId: this.tenantContext.tenantIdOrThrow,
          branchId: table.branchId,
          tableId,
          openedBy: ctx.userId,
          notes,
        },
      }),
      this.prisma.scoped.table.update({
        where: { id: tableId },
        data: { status: "occupied", updatedBy: ctx.userId },
      }),
    ]);

    await this.audit.log({
      action: "table_session.opened",
      entityType: "table_session",
      entityId: session.id,
      branchId: table.branchId,
      meta: { tableNumber: table.number },
    });
    return session;
  }

  /** Closes the open session and frees the table. */
  async close(tableId: string) {
    const ctx = this.tenantContext.contextOrThrow;
    const table = await this.tableOrThrow(tableId);

    const session = await this.prisma.scoped.tableSession.findFirst({
      where: { tableId, closedAt: null },
    });
    if (!session) {
      throw new NotFoundException("No open session for this table");
    }

    const [closed] = await Promise.all([
      this.prisma.scoped.tableSession.update({
        where: { id: session.id },
        data: { closedAt: new Date(), closedBy: ctx.userId },
      }),
      this.prisma.scoped.table.update({
        where: { id: tableId },
        data: { status: "available", updatedBy: ctx.userId },
      }),
    ]);

    await this.audit.log({
      action: "table_session.closed",
      entityType: "table_session",
      entityId: session.id,
      branchId: table.branchId,
      meta: { tableNumber: table.number },
    });
    return closed;
  }

  private async tableOrThrow(tableId: string) {
    const table = await this.prisma.scoped.table.findFirst({
      where: { id: tableId, deletedAt: null },
    });
    if (!table) {
      throw new NotFoundException("Table not found");
    }
    return table;
  }
}
