import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as categoryService from "../services/categoryService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  res.json(await categoryService.listCategories(db, req.tenant!.companyId));
});

router.post("/", async (req, res) => {
  try {
    const category = await categoryService.createCategory(db, req.tenant!.companyId, req.body);
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to create category" });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const category = await categoryService.updateCategory(db, req.tenant!.companyId, req.params.id as string, req.body);
    if (!category) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(category);
  } catch (err) {
    if (err instanceof categoryService.SelfParentError) {
      res.status(400).json({ error: err.message });
      return;
    }
    throw err;
  }
});

router.delete("/:id", async (req, res) => {
  const result = await categoryService.deleteCategory(db, req.tenant!.companyId, req.params.id as string);
  if (result === "has-products") {
    res.status(409).json({ error: "This category still has products assigned to it" });
    return;
  }
  if (result === "has-children") {
    res.status(409).json({ error: "This category still has sub-categories" });
    return;
  }
  res.status(204).send();
});

export default router;
