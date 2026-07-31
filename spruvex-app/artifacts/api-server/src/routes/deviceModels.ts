import { Router } from "express";
import { db, deviceModelsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

// Repair-intake device models, scoped to a brand from the shared brands
// catalog (same table product creation uses).
router.get("/", async (req: AuthedRequest, res) => {
  const brandId = req.query.brandId as string | undefined;
  const conditions = [eq(deviceModelsTable.companyId, req.user!.companyId)];
  if (brandId) conditions.push(eq(deviceModelsTable.brandId, brandId));
  const models = await db.select().from(deviceModelsTable)
    .where(and(...conditions))
    .orderBy(deviceModelsTable.name);
  res.json(models);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { brandId, name } = req.body;
  if (!brandId || !name) {
    res.status(400).json({ error: "brandId and name are required" });
    return;
  }
  const [model] = await db.insert(deviceModelsTable)
    .values({ companyId: req.user!.companyId, brandId, name })
    .onConflictDoNothing()
    .returning();
  if (!model) {
    const [existing] = await db.select().from(deviceModelsTable)
      .where(and(eq(deviceModelsTable.companyId, req.user!.companyId), eq(deviceModelsTable.brandId, brandId), eq(deviceModelsTable.name, name)));
    res.status(200).json(existing);
    return;
  }
  res.status(201).json(model);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  await db.delete(deviceModelsTable)
    .where(and(eq(deviceModelsTable.id, req.params.id as string), eq(deviceModelsTable.companyId, req.user!.companyId)));
  res.status(204).send();
});

export default router;
