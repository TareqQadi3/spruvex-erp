import { Router, type IRouter } from "express";
import { PERMISSIONS } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requirePermission } from "../../../core/middleware/permission.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { uuidParamSchema } from "../../../shared/validators/common.validators";
import { recordAuditEvent } from "../../../core/logging/auditLogger";
import { createTemplateSchema, updateTemplateSchema } from "../validators/invoicing.validators";
import * as templateService from "../services/templateService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requirePermission(PERMISSIONS.MANAGE_SETTINGS));

router.get("/", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const templates = await templateService.listTemplates(req.tenant.companyId);
    res.status(200).json(buildSuccess(templates));
  } catch (err) {
    next(err);
  }
});

router.post("/", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const input = createTemplateSchema.parse(req.body);
    const template = await templateService.createTemplate(req.tenant, input);
    recordAuditEvent(req.tenant, { action: "create", entityType: "invoice_template", entityId: template.id });
    res.status(201).json(buildSuccess(template));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const template = await templateService.getTemplate(req.tenant.companyId, id);
    res.status(200).json(buildSuccess(template));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    const input = updateTemplateSchema.parse(req.body);
    const template = await templateService.updateTemplate(req.tenant, id, input);
    recordAuditEvent(req.tenant, { action: "update", entityType: "invoice_template", entityId: template.id });
    res.status(200).json(buildSuccess(template));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const id = uuidParamSchema.parse(req.params.id);
    await templateService.deleteTemplate(req.tenant, id);
    recordAuditEvent(req.tenant, { action: "delete", entityType: "invoice_template", entityId: id });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
