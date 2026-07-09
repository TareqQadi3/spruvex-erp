import { Router } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const categories = await db.select().from(categoriesTable)
    .where(eq(categoriesTable.companyId, req.user!.companyId))
    .orderBy(categoriesTable.name);
  res.json(categories);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { name, description, parentId, imageUrl } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [category] = await db.insert(categoriesTable)
    .values({ companyId: req.user!.companyId, name, description, parentId: parentId ?? null, imageUrl }).returning();
  res.status(201).json(category);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const { name, description, parentId, imageUrl } = req.body;
  if (parentId === id) {
    res.status(400).json({ error: "A category cannot be its own parent" });
    return;
  }
  const [category] = await db.update(categoriesTable).set({
    name, description,
    ...(parentId !== undefined ? { parentId } : {}),
    ...(imageUrl !== undefined ? { imageUrl } : {}),
  })
    .where(and(eq(categoriesTable.id, id), eq(categoriesTable.companyId, req.user!.companyId)))
    .returning();
  if (!category) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(category);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const orgId = req.user!.companyId;

  const [productInUse] = await db.select({ id: productsTable.id }).from(productsTable)
    .where(and(eq(productsTable.categoryId, id), eq(productsTable.companyId, orgId))).limit(1);
  if (productInUse) {
    res.status(409).json({ error: "This category still has products assigned to it" });
    return;
  }
  const [childCategory] = await db.select({ id: categoriesTable.id }).from(categoriesTable)
    .where(and(eq(categoriesTable.parentId, id), eq(categoriesTable.companyId, orgId))).limit(1);
  if (childCategory) {
    res.status(409).json({ error: "This category still has sub-categories" });
    return;
  }

  await db.delete(categoriesTable)
    .where(and(eq(categoriesTable.id, id), eq(categoriesTable.companyId, orgId)));
  res.status(204).send();
});

export default router;
