import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as installmentPlanService from "../services/installmentPlanService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  res.json(await installmentPlanService.listInstallmentPlans(db, req.tenant!.companyId));
});

router.post("/", async (req, res) => {
  try {
    const plan = await installmentPlanService.createInstallmentPlan(db, req.tenant!.companyId, req.body);
    res.status(201).json(plan);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create installment plan" });
  }
});

router.put("/:id", async (req, res) => {
  const plan = await installmentPlanService.updateInstallmentPlan(db, req.tenant!.companyId, req.params.id as string, req.body);
  if (!plan) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(plan);
});

router.delete("/:id", async (req, res) => {
  await installmentPlanService.deleteInstallmentPlan(db, req.tenant!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;
