import { Router } from "express";
import { db, PERMISSIONS } from "@workspace/db";
import { requirePermission, type AuthedRequest } from "../../../lib/auth-middleware";
import { getTrialBalance } from "../services/reportingService";

const router = Router();

router.get("/", requirePermission(PERMISSIONS.VIEW_REPORTS), async (req: AuthedRequest, res) => {
  const asOf = req.query.asOf as string | undefined;
  const result = await getTrialBalance(db, req.user!.companyId, asOf);
  res.json(result);
});

export default router;
