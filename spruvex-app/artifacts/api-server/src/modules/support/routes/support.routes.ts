import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildPaginated, buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import {
  createAttachmentSchema,
  createMessageSchema,
  createTicketSchema,
  listNotificationsQuerySchema,
  listTicketsQuerySchema,
} from "../validators/support.validators";
import * as supportService from "../services/supportService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

router.post("/tickets", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = createTicketSchema.parse(req.body);
    const ticket = await supportService.createTicket(req.tenant.companyId, req.tenant.userId, input);
    res.status(201).json(buildSuccess(ticket));
  } catch (err) {
    next(err);
  }
});

router.get("/tickets", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const filters = listTicketsQuerySchema.parse(req.query);
    const result = await supportService.listTicketsForCompany(req.tenant.companyId, filters);
    res.status(200).json(buildPaginated(result.data, result.meta));
  } catch (err) {
    next(err);
  }
});

router.get("/tickets/:id", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const ticketId = uuidParamSchema.parse(req.params.id);
    const ticket = await supportService.getTicketForCompany(req.tenant.companyId, ticketId);
    res.status(200).json(buildSuccess(ticket));
  } catch (err) {
    next(err);
  }
});

router.get("/tickets/:id/messages", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const ticketId = uuidParamSchema.parse(req.params.id);
    const messages = await supportService.listMessagesForCompany(req.tenant.companyId, ticketId);
    res.status(200).json(buildSuccess(messages));
  } catch (err) {
    next(err);
  }
});

router.post("/tickets/:id/messages", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const ticketId = uuidParamSchema.parse(req.params.id);
    const { body } = createMessageSchema.parse(req.body);
    const message = await supportService.addCustomerMessage(req.tenant.companyId, req.tenant.userId, ticketId, body);
    res.status(201).json(buildSuccess(message));
  } catch (err) {
    next(err);
  }
});

router.post("/tickets/:id/attachments", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const ticketId = uuidParamSchema.parse(req.params.id);
    const input = createAttachmentSchema.parse(req.body);
    const attachment = await supportService.addAttachment(req.tenant.companyId, req.tenant.userId, ticketId, input);
    res.status(201).json(buildSuccess(attachment));
  } catch (err) {
    next(err);
  }
});

router.patch("/tickets/:id/close", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const ticketId = uuidParamSchema.parse(req.params.id);
    const ticket = await supportService.closeTicketByRequester(req.tenant.companyId, req.tenant.userId, ticketId);
    res.status(200).json(buildSuccess(ticket));
  } catch (err) {
    next(err);
  }
});

router.get("/notifications", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const filters = listNotificationsQuerySchema.parse(req.query);
    const result = await supportService.listNotificationsForUser(req.tenant.userId, filters);
    res.status(200).json(buildPaginated(result.data, result.meta));
  } catch (err) {
    next(err);
  }
});

router.patch("/notifications/:id/read", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const notificationId = uuidParamSchema.parse(req.params.id);
    const notification = await supportService.markNotificationRead(req.tenant.userId, notificationId);
    res.status(200).json(buildSuccess(notification));
  } catch (err) {
    next(err);
  }
});

export default router;
