import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as productAttributeService from "../services/productAttributeService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  res.json(await productAttributeService.listDefinitionsWithValues(db, req.tenant!.companyId));
});

router.post("/", async (req, res) => {
  try {
    const definition = await productAttributeService.createDefinition(db, req.tenant!.companyId, req.body);
    res.status(201).json(definition);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create attribute" });
  }
});

router.post("/:id/values", async (req, res) => {
  try {
    const created = await productAttributeService.createValue(db, req.tenant!.companyId, req.params.id as string, req.body);
    res.status(201).json(created);
  } catch (err) {
    if (err instanceof productAttributeService.NotFoundError) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create attribute value" });
  }
});

export default router;
