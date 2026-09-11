import { Router, type IRouter, type Response } from "express";
import { ZodError } from "zod/v4";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { AppError } from "../../../core/errors/AppError";
import * as templateService from "../../invoicing/services/templateService";

// Invoice-template management surfaced on this path (rather than
// modules/invoicing's own /api/invoicing/templates mount) so the Invoice
// Builder UI (pos-system) can use it under the same conventions as every
// other live POS endpoint. Wraps the modular templateService (the single
// source of truth for template CRUD + the Settings fallback) — nothing here
// duplicates business logic, it only converts request/response conventions:
// AppError / ZodError -> the flat { error } envelope this UI's client reads.
const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription(), requirePermission(PERMISSIONS.MANAGE_SETTINGS));

function handleError(res: Response, err: unknown) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({ error: err.issues[0]?.message ?? "Invalid input" });
    return;
  }
  throw err;
}

router.get("/", async (req, res) => {
  try {
    const templates = await templateService.listTemplates(req.tenant!.companyId);
    res.json(templates);
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/", async (req, res) => {
  try {
    const template = await templateService.createTemplate(req.tenant!, req.body);
    res.status(201).json(template);
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const template = await templateService.getTemplate(req.tenant!.companyId, req.params.id as string);
    res.json(template);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const template = await templateService.updateTemplate(req.tenant!, req.params.id as string, req.body);
    res.json(template);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    await templateService.deleteTemplate(req.tenant!, req.params.id as string);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
