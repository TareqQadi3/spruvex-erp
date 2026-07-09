import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildPaginated, buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { requirePlatformAdmin } from "../middleware/platformAdmin.middleware";
import {
  addonParamsSchema,
  changePlanSchema,
  changeStatusSchema,
  renewSubscriptionSchema,
  upsertAddonSchema,
} from "../validators/platform.validators";
import * as platformService from "../services/platformService";
import {
  assignTicketSchema,
  createAdminMessageSchema,
  listAllTicketsQuerySchema,
  updateStatusSchema,
} from "../../support/validators/support.validators";
import * as supportService from "../../support/services/supportService";

const router: IRouter = Router();

// Deliberately requireAuth + requirePlatformAdmin only — NOT
// enforceTenantIsolation. Every route below reads/writes across every
// company by design (see platformAdmin.middleware.ts).
router.use(requireAuth, requirePlatformAdmin);

router.get("/companies", async (_req, res, next) => {
  try {
    const companies = await platformService.listCompanies();
    res.status(200).json(buildSuccess(companies));
  } catch (err) {
    next(err);
  }
});

router.get("/companies/:id", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const company = await platformService.getCompany(companyId);
    res.status(200).json(buildSuccess(company));
  } catch (err) {
    next(err);
  }
});

router.patch("/companies/:id/plan", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const { plan } = changePlanSchema.parse(req.body);
    const company = await platformService.changePlan(companyId, plan);
    res.status(200).json(buildSuccess(company));
  } catch (err) {
    next(err);
  }
});

router.patch("/companies/:id/status", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const { status } = changeStatusSchema.parse(req.body);
    const company = await platformService.changeStatus(companyId, status);
    res.status(200).json(buildSuccess(company));
  } catch (err) {
    next(err);
  }
});

router.patch("/companies/:id/subscription/renew", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const { periodDays } = renewSubscriptionSchema.parse(req.body ?? {});
    const company = await platformService.renewSubscription(companyId, periodDays);
    res.status(200).json(buildSuccess(company));
  } catch (err) {
    next(err);
  }
});

router.put("/companies/:id/addons/:addonCode", async (req, res, next) => {
  try {
    const companyId = uuidParamSchema.parse(req.params.id);
    const { addonCode } = addonParamsSchema.parse(req.params);
    const input = upsertAddonSchema.parse(req.body);
    const addon = await platformService.upsertAddon(companyId, addonCode, input);
    res.status(200).json(buildSuccess(addon));
  } catch (err) {
    next(err);
  }
});

router.get("/support/tickets", async (req, res, next) => {
  try {
    const filters = listAllTicketsQuerySchema.parse(req.query);
    const result = await supportService.listAllTickets(filters);
    res.status(200).json(buildPaginated(result.data, result.meta));
  } catch (err) {
    next(err);
  }
});

router.get("/support/tickets/:id", async (req, res, next) => {
  try {
    const ticketId = uuidParamSchema.parse(req.params.id);
    const ticket = await supportService.getTicketForAdmin(ticketId);
    res.status(200).json(buildSuccess(ticket));
  } catch (err) {
    next(err);
  }
});

router.get("/support/tickets/:id/messages", async (req, res, next) => {
  try {
    const ticketId = uuidParamSchema.parse(req.params.id);
    const messages = await supportService.listMessagesForAdmin(ticketId);
    res.status(200).json(buildSuccess(messages));
  } catch (err) {
    next(err);
  }
});

router.post("/support/tickets/:id/messages", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const ticketId = uuidParamSchema.parse(req.params.id);
    const input = createAdminMessageSchema.parse(req.body);
    const message = await supportService.addAdminMessage(req.tenant.userId, ticketId, input);
    res.status(201).json(buildSuccess(message));
  } catch (err) {
    next(err);
  }
});

router.patch("/support/tickets/:id/status", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const ticketId = uuidParamSchema.parse(req.params.id);
    const input = updateStatusSchema.parse(req.body);
    const ticket = await supportService.updateTicketStatus(req.tenant.userId, ticketId, input);
    res.status(200).json(buildSuccess(ticket));
  } catch (err) {
    next(err);
  }
});

router.patch("/support/tickets/:id/assign", async (req, res, next) => {
  try {
    const ticketId = uuidParamSchema.parse(req.params.id);
    const { assignedToId } = assignTicketSchema.parse(req.body);
    const ticket = await supportService.assignTicket(ticketId, assignedToId);
    res.status(200).json(buildSuccess(ticket));
  } catch (err) {
    next(err);
  }
});

export default router;
