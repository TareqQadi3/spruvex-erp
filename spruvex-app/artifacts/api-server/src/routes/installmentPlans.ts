import { Router } from "express";
import { db, installmentPlansTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const plans = await db.select().from(installmentPlansTable)
    .where(eq(installmentPlansTable.companyId, req.user!.companyId))
    .orderBy(installmentPlansTable.months);
  res.json(plans);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { months, interestPercent } = req.body;
  if (!months) {
    res.status(400).json({ error: "months is required" });
    return;
  }
  const [plan] = await db.insert(installmentPlansTable).values({
    companyId: req.user!.companyId,
    months: Number(months),
    interestPercent: (interestPercent ?? 0).toString(),
  }).returning();
  res.status(201).json(plan);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const { months, interestPercent, isActive } = req.body;
  const [plan] = await db.update(installmentPlansTable).set({
    ...(months !== undefined ? { months: Number(months) } : {}),
    ...(interestPercent !== undefined ? { interestPercent: interestPercent.toString() } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  }).where(and(eq(installmentPlansTable.id, id), eq(installmentPlansTable.companyId, req.user!.companyId))).returning();
  if (!plan) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(plan);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  await db.delete(installmentPlansTable)
    .where(and(eq(installmentPlansTable.id, id), eq(installmentPlansTable.companyId, req.user!.companyId)));
  res.status(204).send();
});

export default router;
