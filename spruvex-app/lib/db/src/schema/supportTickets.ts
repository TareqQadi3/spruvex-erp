import { pgTable, uuid, text, timestamp, integer, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Platform-level support: a tenant (company) opens a ticket with the SpruVex
// team, not a tenant's own end-customer helpdesk. requesterId is the tenant
// user who opened it; assignedToId is a platform-admin user (users.isPlatformAdmin)
// handling it — same cross-tenant admin model as modules/platform.
export const SUPPORT_TICKET_STATUSES = ["open", "pending", "in_progress", "resolved", "closed"] as const;
export type SupportTicketStatus = typeof SUPPORT_TICKET_STATUSES[number];

export const SUPPORT_TICKET_PRIORITIES = ["low", "medium", "high", "critical"] as const;
export type SupportTicketPriority = typeof SUPPORT_TICKET_PRIORITIES[number];

// "web" is the only channel actually wired up right now — whatsapp/chatbot
// are schema-only foundation for a later integration, not yet implemented.
export const SUPPORT_TICKET_CHANNELS = ["web", "whatsapp", "chatbot"] as const;
export type SupportTicketChannel = typeof SUPPORT_TICKET_CHANNELS[number];

export const supportTicketsTable = pgTable("support_tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  requesterId: uuid("requester_id").notNull(),
  ticketNumber: text("ticket_number").notNull(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  category: text("category"),
  channel: text("channel").notNull().default("web"),
  assignedToId: uuid("assigned_to_id"),
  resolvedAt: timestamp("resolved_at"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("support_tickets_company_ticket_idx").on(table.companyId, table.ticketNumber),
]);

export const insertSupportTicketSchema = createInsertSchema(supportTicketsTable).omit({ id: true, ticketNumber: true, createdAt: true, updatedAt: true });
export type InsertSupportTicket = z.infer<typeof insertSupportTicketSchema>;
export type SupportTicket = typeof supportTicketsTable.$inferSelect;

// Conversation log. authorType distinguishes who wrote it since authorId
// alone doesn't say whether that user was acting as the requester or as
// platform support staff; "system" is reserved for future chatbot replies.
export const supportTicketMessagesTable = pgTable("support_ticket_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  ticketId: uuid("ticket_id").notNull(),
  authorId: uuid("author_id").notNull(),
  authorType: text("author_type").notNull().default("customer"), // customer | admin | system
  body: text("body").notNull(),
  // Visible to platform admins only, never returned to the tenant — for
  // internal handoff notes between support staff.
  isInternalNote: boolean("is_internal_note").notNull().default(false),
  channel: text("channel").notNull().default("web"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupportTicketMessageSchema = createInsertSchema(supportTicketMessagesTable).omit({ id: true, createdAt: true });
export type InsertSupportTicketMessage = z.infer<typeof insertSupportTicketMessageSchema>;
export type SupportTicketMessage = typeof supportTicketMessagesTable.$inferSelect;

// Metadata only, same convention as productImages.url — actual file storage
// backend is out of scope here; url is wherever the file was already
// uploaded to. messageId is null when the attachment belongs to the ticket
// itself rather than one specific reply.
export const supportTicketAttachmentsTable = pgTable("support_ticket_attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  ticketId: uuid("ticket_id").notNull(),
  messageId: uuid("message_id"),
  url: text("url").notNull(),
  fileName: text("file_name").notNull(),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  uploadedBy: uuid("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSupportTicketAttachmentSchema = createInsertSchema(supportTicketAttachmentsTable).omit({ id: true, createdAt: true });
export type InsertSupportTicketAttachment = z.infer<typeof insertSupportTicketAttachmentSchema>;
export type SupportTicketAttachment = typeof supportTicketAttachmentsTable.$inferSelect;

// Audit trail of status transitions — same shape as repair_status_history.
export const supportTicketStatusHistoryTable = pgTable("support_ticket_status_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id").notNull(),
  ticketId: uuid("ticket_id").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  changedBy: uuid("changed_by"),
  changedAt: timestamp("changed_at").defaultNow().notNull(),
});

export const insertSupportTicketStatusHistorySchema = createInsertSchema(supportTicketStatusHistoryTable).omit({ id: true, changedAt: true });
export type InsertSupportTicketStatusHistory = z.infer<typeof insertSupportTicketStatusHistorySchema>;
export type SupportTicketStatusHistory = typeof supportTicketStatusHistoryTable.$inferSelect;
