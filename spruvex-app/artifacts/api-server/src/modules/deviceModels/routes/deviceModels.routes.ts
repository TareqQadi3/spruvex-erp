import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as deviceModelService from "../services/deviceModelService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  const brandId = req.query.brandId as string | undefined;
  res.json(await deviceModelService.listDeviceModels(db, req.tenant!.companyId, brandId));
});

router.post("/", async (req, res) => {
  try {
    const { model, created } = await deviceModelService.createDeviceModel(db, req.tenant!.companyId, req.body);
    res.status(created ? 201 : 200).json(model);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create device model" });
  }
});

router.delete("/:id", async (req, res) => {
  await deviceModelService.deleteDeviceModel(db, req.tenant!.companyId, req.params.id as string);
  res.status(204).send();
});

export default router;
