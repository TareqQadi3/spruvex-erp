import { Router } from "express";
import { db, importMappingTemplatesTable, importJobsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";
import { IMPORT_ENTITY_CONFIGS, suggestMapping } from "../modules/importExport/entityConfigs";
import { validateRows, executeImport, type DuplicateStrategy } from "../modules/importExport/importService";
import { logAudit } from "../modules/auditLog/auditLogService";

const router = Router();

// The Excel/CSV file itself is parsed client-side (pos-system already ships
// the `xlsx` package for this) — the server only ever sees JSON rows. This
// keeps the backend simple (no multipart/file-storage handling) and matches
// the existing pattern for product images (client sends a data URL, not a
// multipart upload).
router.get("/entity-configs", (_req, res) => {
  res.json(IMPORT_ENTITY_CONFIGS);
});

router.post("/suggest-mapping", (req: AuthedRequest, res) => {
  const { entityType, columns } = req.body;
  if (!entityType || !Array.isArray(columns)) {
    res.status(400).json({ error: "entityType and columns are required" });
    return;
  }
  res.json(suggestMapping(entityType, columns));
});

router.post("/validate", async (req: AuthedRequest, res) => {
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
    const results = await validateRows(req.user!.companyId, entityType, mapping, rows);
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

router.post("/execute", async (req: AuthedRequest, res) => {
  const { entityType, mapping, rows, duplicateStrategy, fileName } = req.body;
  if (!entityType || !mapping || !Array.isArray(rows)) {
    res.status(400).json({ error: "entityType, mapping and rows are required" });
    return;
  }
  const strategy: DuplicateStrategy = ["skip", "update", "create_new"].includes(duplicateStrategy) ? duplicateStrategy : "skip";
  try {
    const result = await executeImport(req.user!.companyId, req.user!.id, entityType, fileName, mapping, rows, strategy);
    await logAudit({
      companyId: req.user!.companyId, userId: req.user!.id, action: "import",
      entityType, metadata: { fileName, created: result.created, updated: result.updated, skipped: result.skipped, failed: result.failed.length },
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Import failed" });
  }
});

router.get("/mapping-templates", async (req: AuthedRequest, res) => {
  const entityType = req.query.entityType as string | undefined;
  const conditions = [eq(importMappingTemplatesTable.companyId, req.user!.companyId)];
  if (entityType) conditions.push(eq(importMappingTemplatesTable.entityType, entityType));
  const templates = await db.select().from(importMappingTemplatesTable).where(and(...conditions));
  res.json(templates);
});

router.post("/mapping-templates", async (req: AuthedRequest, res) => {
  const { entityType, name, mapping } = req.body;
  if (!entityType || !name || !mapping) {
    res.status(400).json({ error: "entityType, name and mapping are required" });
    return;
  }
  const [template] = await db.insert(importMappingTemplatesTable)
    .values({ companyId: req.user!.companyId, entityType, name, mapping }).returning();
  res.status(201).json(template);
});

router.get("/jobs", async (req: AuthedRequest, res) => {
  const jobs = await db.select().from(importJobsTable)
    .where(eq(importJobsTable.companyId, req.user!.companyId))
    .orderBy(desc(importJobsTable.createdAt))
    .limit(20);
  res.json(jobs);
});

export default router;
