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
