import { and, eq, gte, lte, desc, count, type SQL } from "drizzle-orm";
import { db, auditLogsTable, usersTable } from "@workspace/db";
import { logger } from "../../core/logging/logger";

export interface LogAuditInput {
  companyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}

// Fire-and-forget by design (callers await it, but a failure here must never
// break the real operation it's recording — a lost audit row is far cheaper
// than a failed sale/import/login). Errors are logged, never thrown.
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    await db.insert(auditLogsTable).values({
      companyId: input.companyId,
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId != null ? String(input.entityId) : null,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      metadata: input.metadata ?? null,
    });
  } catch (err) {
    logger.error({ err, action: input.action, entityType: input.entityType }, "Failed to write audit log entry");
  }
}

export interface ListAuditLogsFilters {
  userId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export async function listAuditLogs(companyId: string, filters: ListAuditLogsFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 50));

  const conditions: SQL[] = [eq(auditLogsTable.companyId, companyId)];
  if (filters.userId) conditions.push(eq(auditLogsTable.userId, filters.userId));
  if (filters.action) conditions.push(eq(auditLogsTable.action, filters.action));
  if (filters.entityType) conditions.push(eq(auditLogsTable.entityType, filters.entityType));
  if (filters.from) conditions.push(gte(auditLogsTable.createdAt, new Date(filters.from)));
  if (filters.to) conditions.push(lte(auditLogsTable.createdAt, new Date(filters.to)));

  const where = and(...conditions);

  const [rows, [{ total }]] = await Promise.all([
    db.select({
      id: auditLogsTable.id,
      userId: auditLogsTable.userId,
      username: usersTable.username,
      action: auditLogsTable.action,
      entityType: auditLogsTable.entityType,
      entityId: auditLogsTable.entityId,
      oldValue: auditLogsTable.oldValue,
      newValue: auditLogsTable.newValue,
      metadata: auditLogsTable.metadata,
      createdAt: auditLogsTable.createdAt,
    })
      .from(auditLogsTable)
      .leftJoin(usersTable, eq(auditLogsTable.userId, usersTable.id))
      .where(where)
      .orderBy(desc(auditLogsTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ total: count() }).from(auditLogsTable).where(where),
  ]);

  return { rows, total, page, pageSize };
}
