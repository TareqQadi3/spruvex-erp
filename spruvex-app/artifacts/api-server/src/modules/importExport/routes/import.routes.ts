import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import { IMPORT_ENTITY_CONFIGS, suggestMapping } from "../entityConfigs";
import { validateRows, executeImport, type DuplicateStrategy } from "../importService";
import { logAudit } from "../../auditLog/auditLogService";
import * as importMappingService from "../importMappingService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

// The Excel/CSV file itself is parsed client-side (pos-system already ships
// the `xlsx` package for this) — the server only ever sees JSON rows. This
// keeps the backend simple (no multipart/file-storage handling) and matches
// the existing pattern for product images (client sends a data URL, not a
// multipart upload).
router.get("/entity-configs", (_req, res) => {
  res.json(IMPORT_ENTITY_CONFIGS);
});

router.post("/suggest-mapping", (req, res) => {
  const { entityType, columns } = req.body;
  if (!entityType || !Array.isArray(columns)) {
    res.status(400).json({ error: "entityType and columns are required" });
    return;
  }
  res.json(suggestMapping(entityType, columns));
});

router.post("/validate", async (req, res) => {
  const { entityType, mapping, rows } = req.body;
  if (!entityType || !mapping || !Array.isArray(rows)) {
    res.status(400).json({ error: "entityType, mapping and rows are required" });
    return;
  }
  if (!IMPORT_ENTITY_CONFIGS[entityType]) {
    res.status(400).json({ error: `Unknown entity type: ${entityType}` });
    return;
  }
  try {
    const results = await validateRows(req.tenant!.companyId, entityType, mapping, rows);
    res.json({
      total: results.length,
      validCount: results.filter(r => r.errors.length === 0).length,
      invalidCount: results.filter(r => r.errors.length > 0).length,
      duplicateCount: results.filter(r => r.duplicate).length,
      rows: results,
    });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Validation failed" });
  }
});

router.post("/execute", async (req, res) => {
  const { entityType, mapping, rows, duplicateStrategy, fileName } = req.body;
  if (!entityType || !mapping || !Array.isArray(rows)) {
    res.status(400).json({ error: "entityType, mapping and rows are required" });
    return;
  }
  const strategy: DuplicateStrategy = ["skip", "update", "create_new"].includes(duplicateStrategy) ? duplicateStrategy : "skip";
  try {
    const result = await executeImport(req.tenant!.companyId, req.tenant!.userId, entityType, fileName, mapping, rows, strategy);
    await logAudit({
      companyId: req.tenant!.companyId, userId: req.tenant!.userId, action: "import",
      entityType, metadata: { fileName, created: result.created, updated: result.updated, skipped: result.skipped, failed: result.failed.length },
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

router.get("/mapping-templates", async (req, res) => {
  const entityType = req.query.entityType as string | undefined;
  res.json(await importMappingService.listMappingTemplates(db, req.tenant!.companyId, entityType));
});

router.post("/mapping-templates", async (req, res) => {
  try {
    const template = await importMappingService.createMappingTemplate(db, req.tenant!.companyId, req.body);
    res.status(201).json(template);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create mapping template" });
  }
});

router.get("/jobs", async (req, res) => {
  res.json(await importMappingService.listRecentJobs(db, req.tenant!.companyId));
});

export default router;
