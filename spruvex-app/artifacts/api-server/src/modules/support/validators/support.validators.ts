import { z } from "zod";
import { SUPPORT_TICKET_PRIORITIES, SUPPORT_TICKET_STATUSES } from "@workspace/db";
import { paginationQuerySchema } from "../../../shared/validators/common.validators";

export const createTicketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().min(1),
  priority: z.enum(SUPPORT_TICKET_PRIORITIES).default("medium"),
  category: z.string().optional(),
});

export const listTicketsQuerySchema = paginationQuerySchema.extend({
  status: z.enum(SUPPORT_TICKET_STATUSES).optional(),
  priority: z.enum(SUPPORT_TICKET_PRIORITIES).optional(),
});

export const listAllTicketsQuerySchema = listTicketsQuerySchema.extend({
  companyId: z.string().uuid().optional(),
  assignedToId: z.string().uuid().optional(),
});

export const createMessageSchema = z.object({
  body: z.string().min(1),
});

export const createAdminMessageSchema = z.object({
  body: z.string().min(1),
  isInternalNote: z.boolean().default(false),
});

export const createAttachmentSchema = z.object({
  url: z.string().min(1),
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().min(0).optional(),
  messageId: z.string().uuid().optional(),
});

export const updateStatusSchema = z.object({
  status: z.enum(SUPPORT_TICKET_STATUSES),
  notes: z.string().optional(),
});

export const assignTicketSchema = z.object({
  assignedToId: z.string().uuid(),
});

export const listNotificationsQuerySchema = paginationQuerySchema.extend({
  unreadOnly: z.coerce.boolean().optional(),
});
