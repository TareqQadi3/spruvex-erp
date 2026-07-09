import type { SupportTicket, SupportTicketMessage } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import { withTransaction } from "../../../core/database/transaction";
import { supportRepository } from "../repositories/supportRepository";
import type { ListAllTicketsFilters, ListNotificationsFilters, ListTicketsFilters } from "../repositories/supportRepository";

function generateTicketNumber(): string {
  const date = new Date();
  const prefix = `SUP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const suffix = Math.floor(1000 + Math.random() * 9000).toString();
  return `${prefix}-${suffix}`;
}

// --- Tenant-facing ---------------------------------------------------------

export async function createTicket(
  companyId: string,
  requesterId: string,
  input: { subject: string; description: string; priority: string; category?: string },
): Promise<SupportTicket> {
  return withTransaction(async (tx) => {
    const ticket = await supportRepository.insertTicket(
      {
        companyId,
        requesterId,
        ticketNumber: generateTicketNumber(),
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        category: input.category ?? null,
        channel: "web",
      },
      tx,
    );

    await supportRepository.insertStatusHistory(
      { companyId, ticketId: ticket.id, status: "open", changedBy: requesterId },
      tx,
    );

    return ticket;
  });
}

export async function listTicketsForCompany(companyId: string, filters: ListTicketsFilters) {
  const { rows, total } = await supportRepository.listTicketsForCompany(companyId, filters);
  return { data: rows, meta: { page: filters.page, pageSize: filters.pageSize, total } };
}

export async function getTicketForCompany(companyId: string, ticketId: string): Promise<SupportTicket> {
  const ticket = await supportRepository.findTicketByIdForCompany(companyId, ticketId);
  if (!ticket) throw AppError.notFound("Ticket not found");
  return ticket;
}

export async function listMessagesForCompany(companyId: string, ticketId: string): Promise<SupportTicketMessage[]> {
  await getTicketForCompany(companyId, ticketId);
  return supportRepository.listMessagesForTicket(ticketId, false);
}

export async function addCustomerMessage(
  companyId: string,
  requesterId: string,
  ticketId: string,
  body: string,
): Promise<SupportTicketMessage> {
  const ticket = await getTicketForCompany(companyId, ticketId);
  if (ticket.status === "closed") {
    throw AppError.validation("Cannot post a message to a closed ticket");
  }

  return supportRepository.insertMessage({
    companyId,
    ticketId,
    authorId: requesterId,
    authorType: "customer",
    body,
  });
}

export async function addAttachment(
  companyId: string,
  uploadedBy: string,
  ticketId: string,
  input: { url: string; fileName: string; mimeType?: string; sizeBytes?: number; messageId?: string },
) {
  await getTicketForCompany(companyId, ticketId);

  if (input.messageId) {
    const message = await supportRepository.findMessageById(input.messageId);
    if (!message || message.ticketId !== ticketId) {
      throw AppError.validation("messageId does not belong to this ticket");
    }
  }

  return supportRepository.insertAttachment({
    companyId,
    ticketId,
    messageId: input.messageId ?? null,
    url: input.url,
    fileName: input.fileName,
    mimeType: input.mimeType ?? null,
    sizeBytes: input.sizeBytes ?? null,
    uploadedBy,
  });
}

// Requester-only closure: only the requester decides a resolved ticket is
// truly done, and only once support has marked it "resolved".
export async function closeTicketByRequester(
  companyId: string,
  requesterId: string,
  ticketId: string,
): Promise<SupportTicket> {
  const ticket = await getTicketForCompany(companyId, ticketId);
  if (ticket.status !== "resolved") {
    throw AppError.validation("Only resolved tickets can be closed");
  }

  return withTransaction(async (tx) => {
    const updated = await supportRepository.updateTicket(
      ticketId,
      { status: "closed", closedAt: new Date() },
      tx,
    );
    if (!updated) throw AppError.notFound("Ticket not found");

    await supportRepository.insertStatusHistory(
      { companyId, ticketId, status: "closed", changedBy: requesterId, notes: "closed by requester" },
      tx,
    );

    return updated;
  });
}

// --- Tenant notifications ---------------------------------------------------

export async function listNotificationsForUser(userId: string, filters: ListNotificationsFilters) {
  const { rows, total } = await supportRepository.listNotificationsForUser(userId, filters);
  return { data: rows, meta: { page: filters.page, pageSize: filters.pageSize, total } };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await supportRepository.findNotificationForUser(userId, notificationId);
  if (!notification) throw AppError.notFound("Notification not found");
  return supportRepository.markNotificationRead(notificationId);
}

// --- Platform-admin ----------------------------------------------------------

export async function listAllTickets(filters: ListAllTicketsFilters) {
  const { rows, total } = await supportRepository.listAllTickets(filters);
  return { data: rows, meta: { page: filters.page, pageSize: filters.pageSize, total } };
}

export async function getTicketForAdmin(ticketId: string): Promise<SupportTicket> {
  const ticket = await supportRepository.findTicketById(ticketId);
  if (!ticket) throw AppError.notFound("Ticket not found");
  return ticket;
}

export async function listMessagesForAdmin(ticketId: string): Promise<SupportTicketMessage[]> {
  await getTicketForAdmin(ticketId);
  return supportRepository.listMessagesForTicket(ticketId, true);
}

// First non-internal admin reply on an "open" ticket auto-advances it to
// "in_progress" — any other status is left as the admin explicitly set it.
export async function addAdminMessage(
  adminUserId: string,
  ticketId: string,
  input: { body: string; isInternalNote: boolean },
): Promise<SupportTicketMessage> {
  const ticket = await getTicketForAdmin(ticketId);

  return withTransaction(async (tx) => {
    const message = await supportRepository.insertMessage(
      {
        companyId: ticket.companyId,
        ticketId,
        authorId: adminUserId,
        authorType: "admin",
        body: input.body,
        isInternalNote: input.isInternalNote,
      },
      tx,
    );

    if (!input.isInternalNote) {
      if (ticket.status === "open") {
        await supportRepository.updateTicket(ticketId, { status: "in_progress" }, tx);
        await supportRepository.insertStatusHistory(
          { companyId: ticket.companyId, ticketId, status: "in_progress", changedBy: adminUserId },
          tx,
        );
      }

      await supportRepository.insertNotification(
        {
          companyId: ticket.companyId,
          userId: ticket.requesterId,
          type: "support_ticket_reply",
          title: "رد جديد على تذكرتك",
          body: input.body,
          relatedEntityType: "support_ticket",
          relatedEntityId: ticketId,
        },
        tx,
      );
    }

    return message;
  });
}

export async function updateTicketStatus(
  adminUserId: string,
  ticketId: string,
  input: { status: string; notes?: string },
): Promise<SupportTicket> {
  const ticket = await getTicketForAdmin(ticketId);

  return withTransaction(async (tx) => {
    const fields: Partial<SupportTicket> = { status: input.status };
    if (input.status === "resolved") fields.resolvedAt = new Date();

    const updated = await supportRepository.updateTicket(ticketId, fields, tx);
    if (!updated) throw AppError.notFound("Ticket not found");

    await supportRepository.insertStatusHistory(
      { companyId: ticket.companyId, ticketId, status: input.status, changedBy: adminUserId, notes: input.notes ?? null },
      tx,
    );

    await supportRepository.insertNotification(
      {
        companyId: ticket.companyId,
        userId: ticket.requesterId,
        type: "support_ticket_status_changed",
        title: `تم تحديث حالة تذكرتك إلى: ${input.status}`,
        relatedEntityType: "support_ticket",
        relatedEntityId: ticketId,
      },
      tx,
    );

    return updated;
  });
}

export async function assignTicket(ticketId: string, assignedToId: string): Promise<SupportTicket> {
  await getTicketForAdmin(ticketId);

  const isAdmin = await supportRepository.isPlatformAdminUser(assignedToId);
  if (!isAdmin) throw AppError.validation("assignedToId must be an existing platform admin user");

  const updated = await supportRepository.updateTicket(ticketId, { assignedToId });
  if (!updated) throw AppError.notFound("Ticket not found");
  return updated;
}
