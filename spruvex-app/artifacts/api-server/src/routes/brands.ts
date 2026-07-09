import { Router } from "express";
import { db, brandsTable, productsTable } from "@workspace/db";
import { eq, and, ilike } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const brands = await db.select().from(brandsTable)
    .where(eq(brandsTable.companyId, req.user!.companyId))
    .orderBy(brandsTable.name);
  res.json(brands);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { name, imageUrl } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [brand] = await db.insert(brandsTable)
    .values({ companyId: req.user!.companyId, name, imageUrl }).returning();
  res.status(201).json(brand);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const { name, imageUrl } = req.body;
  const [brand] = await db.update(brandsTable).set({
    ...(name !== undefined ? { name } : {}),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
  }).where(and(eq(brandsTable.id, id), eq(brandsTable.companyId, req.user!.companyId))).returning();
  if (!brand) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(brand);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const orgId = req.user!.companyId;

  const [brand] = await db.select().from(brandsTable)
    .where(and(eq(brandsTable.id, id), eq(brandsTable.companyId, orgId)));
  if (!brand) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // products.brand is free text (not an FK) — match by name the same way products are saved.
  const [productInUse] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.companyId, orgId), ilike(productsTable.brand, brand.name))).limit(1);
  if (productInUse) {
    res.status(409).json({ error: "This brand still has products assigned to it" });
    return;
  }

  await db.delete(brandsTable)
    .where(and(eq(brandsTable.id, id), eq(brandsTable.companyId, orgId)));
  res.status(204).send();
});

export default router;
