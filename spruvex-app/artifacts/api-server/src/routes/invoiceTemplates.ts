import { Router, type Response } from "express";
import { ZodError } from "zod/v4";
import { PERMISSIONS } from "@workspace/db";
import { requirePermission, type AuthedRequest } from "../lib/auth-middleware";
import { AppError } from "../core/errors/AppError";
import * as templateService from "../modules/invoicing/services/templateService";
import type { TenantContext } from "../shared/types/tenantContext";

// Invoice-template management surfaced on the legacy stack so the Invoice
// Builder UI (pos-system) can use the exact same auth/subscription/permission
// middleware as every other live POS endpoint. Wraps the modular
// templateService (the single source of truth for template CRUD + the
// Settings fallback) — nothing here duplicates business logic, it only
// converts request/response conventions: req.user -> TenantContext, AppError /
// ZodError -> the flat { error } envelope this stack's clients read.
const router = Router();

router.use(requirePermission(PERMISSIONS.MANAGE_SETTINGS));

function tenantOf(req: AuthedRequest): TenantContext {
  return {
    userId: req.user!.id,
    companyId: req.user!.companyId,
    role: req.user!.role,
    branchId: req.user!.branchId,
  };
}

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

router.get("/", async (req: AuthedRequest, res) => {
  try {
    const templates = await templateService.listTemplates(req.user!.companyId);
    res.json(templates);
  } catch (err) {
    handleError(res, err);
  }
});

router.post("/", async (req: AuthedRequest, res) => {
  try {
    const template = await templateService.createTemplate(tenantOf(req), req.body);
    res.status(201).json(template);
  } catch (err) {
    handleError(res, err);
  }
});

router.get("/:id", async (req: AuthedRequest, res) => {
  try {
    const template = await templateService.getTemplate(req.user!.companyId, req.params.id as string);
    res.json(template);
  } catch (err) {
    handleError(res, err);
  }
});

router.patch("/:id", async (req: AuthedRequest, res) => {
  try {
    const template = await templateService.updateTemplate(tenantOf(req), req.params.id as string, req.body);
    res.json(template);
  } catch (err) {
    handleError(res, err);
  }
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  try {
    await templateService.deleteTemplate(tenantOf(req), req.params.id as string);
    res.status(204).send();
  } catch (err) {
    handleError(res, err);
  }
});

export default router;
