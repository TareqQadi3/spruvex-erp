import { Router, type IRouter } from "express";
import { requireAuth } from "../../../core/middleware/auth.middleware";
import { enforceTenantIsolation } from "../../../core/middleware/tenant.middleware";
import { AppError } from "../../../core/errors/AppError";
import { buildSuccess } from "../../../shared/utils/responseEnvelope";
import { getEffectiveState } from "../services/planLimitsService";

const router: IRouter = Router();

router.use(requireAuth, enforceTenantIsolation);

// Queryable by a future frontend to decide what to show — deliberately never
// 403s (unlike requireModule, which gates a route outright). moduleCode is a
// route param known only at request time, so this can't be expressed as
// declarative requireModule() middleware; the handler resolves state and
// checks membership inline instead.
//
// enabled requires BOTH module membership AND a usable subscription status —
// an expired/suspended/cancelled company must report false even for modules
// in its plan, otherwise the frontend would keep showing gated features past
// expiry (module membership alone doesn't reflect billing state).
const USABLE_STATUSES = new Set(["trial", "active"]);

router.get("/modules/:moduleCode/status", async (req, res, next) => {
  try {
    if (!req.tenant) throw AppError.unauthorized();
    const state = await getEffectiveState(req.tenant.companyId);
    const enabled =
      USABLE_STATUSES.has(state.status) && state.effectiveModules.includes(req.params.moduleCode);
    res.status(200).json(buildSuccess({ enabled, status: state.status }));
  } catch (err) {
    next(err);
  }
});

export default router;
