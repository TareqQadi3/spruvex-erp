import { and, desc, eq, sql } from "drizzle-orm";
import {
  notificationsTable,
  supportTicketAttachmentsTable,
  supportTicketMessagesTable,
  supportTicketStatusHistoryTable,
  supportTicketsTable,
  usersTable,
  type InsertNotification,
  type InsertSupportTicketAttachment,
  type InsertSupportTicketMessage,
  type InsertSupportTicketStatusHistory,
  type Notification,
  type SupportTicket,
  type SupportTicketAttachment,
  type SupportTicketMessage,
} from "@workspace/db";
import { db } from "../../../core/database/connection";
import type { DbOrTx } from "../../../core/database/transaction";
import { withTenantScope } from "../../../core/database/compositeKey";

export interface ListTicketsFilters {
  status?: string;
  priority?: string;
  page: number;
  pageSize: number;
}

export interface ListAllTicketsFilters extends ListTicketsFilters {
  companyId?: string;
  assignedToId?: string;
}

export interface ListNotificationsFilters {
  unreadOnly?: boolean;
  page: number;
  pageSize: number;
}

type NewSupportTicket = typeof supportTicketsTable.$inferInsert;

export class SupportRepository {
  async insertTicket(input: NewSupportTicket, client: DbOrTx = db): Promise<SupportTicket> {
    const [row] = await client.insert(supportTicketsTable).values(input).returning();
    return row;
  }

  async insertStatusHistory(
    input: InsertSupportTicketStatusHistory,
    client: DbOrTx = db,
  ): Promise<void> {
    await client.insert(supportTicketStatusHistoryTable).values(input);
  }

  async findTicketById(ticketId: string, client: DbOrTx = db): Promise<SupportTicket | null> {
    const [row] = await client
      .select()
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.id, ticketId))
      .limit(1);
    return row ?? null;
  }

  async findTicketByIdForCompany(
    companyId: string,
    ticketId: string,
    client: DbOrTx = db,
  ): Promise<SupportTicket | null> {
    const [row] = await client
      .select()
      .from(supportTicketsTable)
      .where(withTenantScope(supportTicketsTable.companyId, companyId, eq(supportTicketsTable.id, ticketId)))
      .limit(1);
    return row ?? null;
  }

  async listTicketsForCompany(
    companyId: string,
    filters: ListTicketsFilters,
    client: DbOrTx = db,
  ): Promise<{ rows: SupportTicket[]; total: number }> {
    const conditions = withTenantScope(
      supportTicketsTable.companyId,
      companyId,
      filters.status ? eq(supportTicketsTable.status, filters.status) : undefined,
      filters.priority ? eq(supportTicketsTable.priority, filters.priority) : undefined,
    );

    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ count }]] = await Promise.all([
      client
        .select()
        .from(supportTicketsTable)
        .where(conditions)
        .orderBy(desc(supportTicketsTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
      client.select({ count: sql<number>`count(*)::int` }).from(supportTicketsTable).where(conditions),
    ]);

    return { rows, total: count };
  }

  // Cross-company — used by the platform-admin listing only.
  async listAllTickets(
    filters: ListAllTicketsFilters,
    client: DbOrTx = db,
  ): Promise<{ rows: SupportTicket[]; total: number }> {
    const conditions = and(
      filters.status ? eq(supportTicketsTable.status, filters.status) : undefined,
      filters.priority ? eq(supportTicketsTable.priority, filters.priority) : undefined,
      filters.companyId ? eq(supportTicketsTable.companyId, filters.companyId) : undefined,
      filters.assignedToId ? eq(supportTicketsTable.assignedToId, filters.assignedToId) : undefined,
    );

    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ count }]] = await Promise.all([
      client
        .select()
        .from(supportTicketsTable)
        .where(conditions)
        .orderBy(desc(supportTicketsTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
      client.select({ count: sql<number>`count(*)::int` }).from(supportTicketsTable).where(conditions),
    ]);

    return { rows, total: count };
  }

  async updateTicket(
    ticketId: string,
    fields: Partial<SupportTicket>,
    client: DbOrTx = db,
  ): Promise<SupportTicket | null> {
    const [row] = await client
      .update(supportTicketsTable)
      .set(fields)
      .where(eq(supportTicketsTable.id, ticketId))
      .returning();
    return row ?? null;
  }

  async insertMessage(input: InsertSupportTicketMessage, client: DbOrTx = db): Promise<SupportTicketMessage> {
    const [row] = await client.insert(supportTicketMessagesTable).values(input).returning();
    return row;
  }

  async findMessageById(messageId: string, client: DbOrTx = db): Promise<SupportTicketMessage | null> {
    const [row] = await client
      .select()
      .from(supportTicketMessagesTable)
      .where(eq(supportTicketMessagesTable.id, messageId))
      .limit(1);
    return row ?? null;
  }

  async listMessagesForTicket(
    ticketId: string,
    includeInternalNotes: boolean,
    client: DbOrTx = db,
  ): Promise<SupportTicketMessage[]> {
    const conditions = includeInternalNotes
      ? eq(supportTicketMessagesTable.ticketId, ticketId)
      : and(eq(supportTicketMessagesTable.ticketId, ticketId), eq(supportTicketMessagesTable.isInternalNote, false));

    return client
      .select()
      .from(supportTicketMessagesTable)
      .where(conditions)
      .orderBy(supportTicketMessagesTable.createdAt);
  }

  async insertAttachment(
    input: InsertSupportTicketAttachment,
    client: DbOrTx = db,
  ): Promise<SupportTicketAttachment> {
    const [row] = await client.insert(supportTicketAttachmentsTable).values(input).returning();
    return row;
  }

  async insertNotification(input: InsertNotification, client: DbOrTx = db): Promise<Notification> {
    const [row] = await client.insert(notificationsTable).values(input).returning();
    return row;
  }

  async listNotificationsForUser(
    userId: string,
    filters: ListNotificationsFilters,
    client: DbOrTx = db,
  ): Promise<{ rows: Notification[]; total: number }> {
    const conditions = and(
      eq(notificationsTable.userId, userId),
      filters.unreadOnly ? eq(notificationsTable.isRead, false) : undefined,
    );

    const offset = (filters.page - 1) * filters.pageSize;

    const [rows, [{ count }]] = await Promise.all([
      client
        .select()
        .from(notificationsTable)
        .where(conditions)
        .orderBy(desc(notificationsTable.createdAt))
        .limit(filters.pageSize)
        .offset(offset),
      client.select({ count: sql<number>`count(*)::int` }).from(notificationsTable).where(conditions),
    ]);

    return { rows, total: count };
  }

  async findNotificationForUser(
    userId: string,
    notificationId: string,
    client: DbOrTx = db,
  ): Promise<Notification | null> {
    const [row] = await client
      .select()
      .from(notificationsTable)
      .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.id, notificationId)))
      .limit(1);
    return row ?? null;
  }

  async markNotificationRead(notificationId: string, client: DbOrTx = db): Promise<Notification | null> {
    const [row] = await client
      .update(notificationsTable)
      .set({ isRead: true })
      .where(eq(notificationsTable.id, notificationId))
      .returning();
    return row ?? null;
  }

  // Same isPlatformAdmin check as platformAdmin.middleware — used to validate
  // an assignedToId targets an actual platform-admin user before assigning.
  async isPlatformAdminUser(userId: string, client: DbOrTx = db): Promise<boolean> {
    const [user] = await client
      .select({ isPlatformAdmin: usersTable.isPlatformAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    return Boolean(user?.isPlatformAdmin);
  }
}

export const supportRepository = new SupportRepository();
