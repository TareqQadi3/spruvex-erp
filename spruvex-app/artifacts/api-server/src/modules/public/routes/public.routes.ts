import { Router, type IRouter } from "express";
import { ADDON_CATALOG, PLAN_CATALOG } from "@workspace/db";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";

// Unauthenticated, read-only marketing data — no requireAuth on this router.
// Single source of truth is the same PLAN_CATALOG/ADDON_CATALOG code
// constants the backend uses for enforcement, so spruvex-site never hardcodes
// pricing/limits and can't drift from what the app actually enforces.
const router: IRouter = Router();

router.get("/plans", (_req, res) => {
  const plans = Object.entries(PLAN_CATALOG).map(([code, plan]) => ({ code, ...plan }));
  const addons = Object.entries(ADDON_CATALOG).map(([code, addon]) => ({ code, ...addon }));
  res.status(200).json(buildSuccess({ plans, addons }));
});

export default router;
