// The shape returned by GET /api/platform/companies and /companies/:id —
// a company's identity/plan fields plus its latest subscription's billing
// state and its currently-active add-on codes, resolved from three tables
// (see platformService.toCompanySummary) since there's no cross-tenant view
// yet and a few sequential queries is fine for an admin-only, low-traffic
// surface.
export interface CompanySummary {
  id: string;
  name: string;
  plan: string;
  businessType: string | null;
  status: "active" | "suspended";
  trialEndsAt: Date | null;
  subscriptionStatus: string | null;
  currentPeriodEnd: Date | null;
  activeAddonCodes: string[];
}

// T-14 — aggregated-only, no per-company identity or sensitive detail
// (no names, no ids, no contact info): counts and breakdowns for a
// unified marketing dashboard (spruvex-s) that must never touch a
// product's own database directly, per the full-isolation rule between
// ERP and SpruVex R. Built on the same per-company resolution
// listCompanies() already uses (single source of truth for "latest
// subscription"), just aggregated instead of returned per-row.
export interface MarketingSummary {
  totalCompanies: number;
  companiesByStatus: Record<string, number>;
  companiesBySubscriptionStatus: Record<string, number>;
  companiesByPlan: Record<string, number>;
  companiesByBusinessType: Record<string, number>;
}
