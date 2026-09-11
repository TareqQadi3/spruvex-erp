import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { requireActiveSubscription } from "../../../core/middleware/subscription.middleware";
import * as cashSessionService from "../services/cashSessionService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation, requireActiveSubscription());

router.get("/", async (req, res) => {
  res.json(await cashSessionService.listCashSessions(db, req.tenant!.companyId));
});

router.get("/active", async (req, res) => {
  const session = await cashSessionService.getActiveCashSession(db, req.tenant!.companyId);
  if (!session) {
    res.status(404).json({ error: "No active session" });
    return;
  }
  res.json(session);
});

router.get("/:id", async (req, res) => {
  const result = await cashSessionService.getCashSessionDetail(db, req.tenant!.companyId, req.params.id as string);
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result);
});

router.post("/", async (req, res) => {
  try {
    const session = await cashSessionService.openCashSession(db, req.tenant!.companyId, req.body);
    res.status(201).json(session);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : "Failed to open cash session" });
  }
});

router.post("/:id/close", async (req, res) => {
  const result = await cashSessionService.closeCashSession(db, req.tenant!.companyId, req.params.id as string, req.body);
  if (!result) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(result);
});

export default router;
