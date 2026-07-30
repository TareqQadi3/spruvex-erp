import { Router } from "express";
import { db, productAttributeDefinitionsTable, productAttributeValuesTable } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

// Company-wide attribute catalog (Color, Storage, RAM...) used to build the
// variant generator on the "Manage Variants" page. One row here can be
// reused across many parent products.
router.get("/", async (req: AuthedRequest, res) => {
  const companyId = req.user!.companyId;
  const definitions = await db.select().from(productAttributeDefinitionsTable)
    .where(eq(productAttributeDefinitionsTable.companyId, companyId))
    .orderBy(productAttributeDefinitionsTable.sortOrder);
  if (definitions.length === 0) {
    res.json([]);
    return;
  }
  const values = await db.select().from(productAttributeValuesTable)
    .where(inArray(productAttributeValuesTable.attributeDefinitionId, definitions.map(d => d.id)))
    .orderBy(productAttributeValuesTable.sortOrder);
  res.json(definitions.map(d => ({ ...d, values: values.filter(v => v.attributeDefinitionId === d.id) })));
});

router.post("/", async (req: AuthedRequest, res) => {
  const { name, nameEn } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [definition] = await db.insert(productAttributeDefinitionsTable)
    .values({ companyId: req.user!.companyId, name, nameEn }).returning();
  res.status(201).json({ ...definition, values: [] });
});

router.post("/:id/values", async (req: AuthedRequest, res) => {
  const attributeDefinitionId = req.params.id as string;
  const { value, valueEn } = req.body;
  if (!value) {
    res.status(400).json({ error: "value is required" });
    return;
  }
  const [own] = await db.select().from(productAttributeDefinitionsTable)
    .where(and(eq(productAttributeDefinitionsTable.id, attributeDefinitionId), eq(productAttributeDefinitionsTable.companyId, req.user!.companyId)));
  if (!own) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [created] = await db.insert(productAttributeValuesTable)
    .values({ attributeDefinitionId, value, valueEn }).returning();
  res.status(201).json(created);
});

export default router;
