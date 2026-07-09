import { Router } from "express";
import { db, paymentMethodsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import type { AuthedRequest } from "../lib/auth-middleware";

const router = Router();

router.get("/", async (req: AuthedRequest, res) => {
  const methods = await db.select().from(paymentMethodsTable)
    .where(eq(paymentMethodsTable.companyId, req.user!.companyId))
    .orderBy(paymentMethodsTable.name);
  res.json(methods);
});

router.post("/", async (req: AuthedRequest, res) => {
  const { name, percentFee, fixedFee, showFeeToCustomer } = req.body;
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const [method] = await db.insert(paymentMethodsTable).values({
    companyId: req.user!.companyId,
    name,
    percentFee: (percentFee ?? 0).toString(),
    fixedFee: (fixedFee ?? 0).toString(),
    showFeeToCustomer: showFeeToCustomer ?? true,
  }).returning();
  res.status(201).json(method);
});

router.put("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  const { name, percentFee, fixedFee, showFeeToCustomer, isActive } = req.body;
  const [updated] = await db.update(paymentMethodsTable).set({
    ...(name !== undefined ? { name } : {}),
    ...(percentFee !== undefined ? { percentFee: percentFee.toString() } : {}),
    ...(fixedFee !== undefined ? { fixedFee: fixedFee.toString() } : {}),
    ...(showFeeToCustomer !== undefined ? { showFeeToCustomer } : {}),
    ...(isActive !== undefined ? { isActive } : {}),
  }).where(and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.companyId, req.user!.companyId))).returning();
  if (!updated) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(updated);
});

router.delete("/:id", async (req: AuthedRequest, res) => {
  const id = req.params.id as string;
  await db.delete(paymentMethodsTable)
    .where(and(eq(paymentMethodsTable.id, id), eq(paymentMethodsTable.companyId, req.user!.companyId)));
  res.status(204).send();
});

export default router;
