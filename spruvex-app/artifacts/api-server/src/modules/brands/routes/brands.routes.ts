import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as brandService from "../services/brandService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  res.json(await brandService.listBrands(db, req.tenant!.companyId));
});

router.post("/", async (req, res) => {
  try {
    const brand = await brandService.createBrand(db, req.tenant!.companyId, req.body);
    res.status(201).json(brand);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create brand" });
  }
});

router.put("/:id", async (req, res) => {
  const brand = await brandService.updateBrand(db, req.tenant!.companyId, req.params.id as string, req.body);
  if (!brand) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(brand);
});

router.delete("/:id", async (req, res) => {
  const result = await brandService.deleteBrand(db, req.tenant!.companyId, req.params.id as string);
  if (result === "not-found") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (result === "in-use") {
    res.status(409).json({ error: "This brand still has products assigned to it" });
    return;
  }
  res.status(204).send();
});

export default router;
