import { Router } from "express";
import { db, warehousesTable, warehouseSectionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

router.get("/sections", async (req: AuthedRequest, res) => {
  const orgId = req.user!.companyId;
  const warehouseId = req.query.warehouseId as string | undefined;
  const conditions = [eq(warehouseSectionsTable.companyId, orgId)];
  if (warehouseId) conditions.push(eq(warehouseSectionsTable.warehouseId, warehouseId));
  const sections = await db.select().from(warehouseSectionsTable)
    .where(and(...conditions))
    .orderBy(warehouseSectionsTable.name);
  res.json(sections);
});

router.post("/sections", async (req: AuthedRequest, res) => {
  const { warehouseId, name } = req.body;
  if (!warehouseId || !name) {
    res.status(400).json({ error: "warehouseId and name are required" });
    return;
  }
  const [section] = await db.insert(warehouseSectionsTable).values({
    companyId: req.user!.companyId,
    warehouseId,
    name,
  }).returning();
  res.status(201).json(section);
});

router.delete("/sections/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  await db.delete(warehouseSectionsTable)
    .where(and(eq(warehouseSectionsTable.id, id), eq(warehouseSectionsTable.companyId, req.user!.companyId)));
  res.status(204).send();
});

router.get("/", async (req: AuthedRequest, res) => {
  const warehouses = await db.select().from(warehousesTable)
    .where(eq(warehousesTable.companyId, req.user!.companyId))
    .orderBy(warehousesTable.name);
  res.json(warehouses);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { name, isRepairStock, isDefault } = req.body;
  const companyId = req.user!.companyId;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  if (isDefault === true) {
    const [warehouse] = await db.transaction(async (tx) => {
      await tx.update(warehousesTable)
        .set({ isDefault: false })
        .where(and(eq(warehousesTable.companyId, companyId), eq(warehousesTable.isDefault, true)));
      return tx.insert(warehousesTable).values({
        companyId,
        name,
        isRepairStock: isRepairStock ?? false,
        isDefault: true,
      }).returning();
    });
    res.status(201).json(warehouse);
    return;
  }
  const [warehouse] = await db.insert(warehousesTable).values({
    companyId,
    name,
    isRepairStock: isRepairStock ?? false,
  }).returning();
  res.status(201).json(warehouse);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const companyId = req.user!.companyId;
  const { name, isRepairStock, isDefault } = req.body;

  // Exactly one default per company — clear the existing default first in
  // the same transaction so a failed update never leaves zero or two.
  if (isDefault === true) {
    const [warehouse] = await db.transaction(async (tx) => {
      await tx.update(warehousesTable)
        .set({ isDefault: false })
        .where(and(eq(warehousesTable.companyId, companyId), eq(warehousesTable.isDefault, true)));
      return tx.update(warehousesTable).set({
        ...(name !== undefined ? { name } : {}),
        ...(isRepairStock !== undefined ? { isRepairStock } : {}),
        isDefault: true,
      }).where(and(eq(warehousesTable.id, id), eq(warehousesTable.companyId, companyId))).returning();
    });
    if (!warehouse) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(warehouse);
    return;
  }

  const [warehouse] = await db.update(warehousesTable).set({
    ...(name !== undefined ? { name } : {}),
    ...(isRepairStock !== undefined ? { isRepairStock } : {}),
    ...(isDefault === false ? { isDefault: false } : {}),
  }).where(and(eq(warehousesTable.id, id), eq(warehousesTable.companyId, companyId))).returning();
  if (!warehouse) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(warehouse);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  await db.delete(warehousesTable)
    .where(and(eq(warehousesTable.id, id), eq(warehousesTable.companyId, req.user!.companyId)));
  res.status(204).send();
});

export default router;
