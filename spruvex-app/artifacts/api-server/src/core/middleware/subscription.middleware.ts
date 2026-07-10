import type { NextFunction, Request, Response } from "express";
import type { PlanLimits } from "@workspace/db";
import { AppError } from "../errors/AppError";
import { getEffectiveState } from "../../modules/subscriptions/services/planLimitsService";
import type { EffectiveState } from "../../modules/subscriptions/types/subscriptions.types";

// Deliberate exception to "core has no module dependencies" (same rationale
// as permission.middleware importing modules/rbac): subscription/plan
// enforcement is fundamentally a subscriptions concern, and the request
// pipeline needs it directly.

declare global {
  namespace Express {
    interface Request {
      // Per-request cache for the resolved subscription/plan state —
      // populated on first requireModule()/requireWithinLimit() call, reused
      // by any subsequent one in the same request instead of re-querying the
      // DB each time (same pattern as req.permissions in permission.middleware).
      effectiveSubscriptionState?: EffectiveState;
    }
  }
}

const INACTIVE_STATUSES = new Set(["expired", "suspended", "cancelled"]);

async function getRequestEffectiveState(req: Request): Promise<EffectiveState> {
  if (req.effectiveSubscriptionState) return req.effectiveSubscriptionState;
  if (!req.tenant) throw AppError.unauthorized();

  const state = await getEffectiveState(req.tenant.companyId);
  req.effectiveSubscriptionState = state;
  return state;
}

export function requireModule(moduleCode: string) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenant) {
        next(AppError.unauthorized());
        return;
      }
      const state = await getRequestEffectiveState(req);
      if (INACTIVE_STATUSES.has(state.status)) {
        next(AppError.forbidden("Subscription inactive"));
        return;
      }
      if (!state.effectiveModules.includes(moduleCode)) {
        next(AppError.forbidden(`Feature not included in your plan: ${moduleCode}`));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Status-only gate (no module-membership check) for routes that should be
// blocked for a suspended/expired/cancelled tenant but aren't tied to a
// specific paid-addon module — e.g. purchase-document generation. Use
// requireModule instead when the route IS a specific catalog module (it
// already includes this same status check).
export function requireActiveSubscription() {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenant) {
        next(AppError.unauthorized());
        return;
      }
      const state = await getRequestEffectiveState(req);
      if (INACTIVE_STATUSES.has(state.status)) {
        next(AppError.forbidden("Subscription inactive"));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireWithinLimit(
  limitKey: keyof PlanLimits,
  countCurrent: (companyId: string) => Promise<number>,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.tenant) {
        next(AppError.unauthorized());
        return;
      }
      const state = await getRequestEffectiveState(req);
      if (INACTIVE_STATUSES.has(state.status)) {
        next(AppError.forbidden("Subscription inactive"));
        return;
      }

      const limit = state.effectiveLimits[limitKey];
      // "modules" is the only non-numeric PlanLimits key — requireWithinLimit
      // is only ever meaningful for the numeric quota keys, so this is
      // defensive typing, not a real runtime path.
      if (typeof limit !== "number") {
        next();
        return;
      }

      const current = await countCurrent(req.tenant.companyId);
      if (current >= limit) {
        next(AppError.forbidden(`Plan limit reached: ${String(limitKey)}`));
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
