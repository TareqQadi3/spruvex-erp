import { getEffectiveState } from "../../subscriptions/services/planLimitsService";
import { AppError } from "../../../core/errors/AppError";
import { aiRepository } from "../repositories/aiRepository";

// The cost-control lever for the ai_features add-on: a shared monthly budget
// (PlanLimits.maxAiRequestsPerMonth) across every AI feature — product
// assistant and business assistant both draw from the same counter, counted
// straight from ai_usage_logs (the same table every AI call already writes
// to for audit purposes), so there is no separate quota table to drift out
// of sync with what actually happened.
export interface AiQuotaStatus {
  used: number;
  limit: number;
  remaining: number;
}

function currentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export async function getAiQuotaStatus(companyId: string): Promise<AiQuotaStatus> {
  const state = await getEffectiveState(companyId);
  const limit = state.effectiveLimits.maxAiRequestsPerMonth;
  const { start, end } = currentMonthRange();
  const used = await aiRepository.countUsageInWindow(companyId, start, end);
  return { used, limit, remaining: Math.max(limit - used, 0) };
}

// Called before every AI provider call (see aiService.runFeature) — a
// request that would exceed the monthly budget is rejected BEFORE spending
// any tokens, not logged-then-refused-next-time.
export async function assertWithinAiQuota(companyId: string): Promise<void> {
  const { used, limit } = await getAiQuotaStatus(companyId);
  if (used >= limit) {
    throw AppError.forbidden(
      `Monthly AI request limit reached (${used}/${limit}). Upgrade your plan or wait for next month's reset.`,
    );
  }
}
