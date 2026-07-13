/** Seeded SaaS plan catalog (Phase 8). Prices are monthly, in halalas (1 SAR = 100 halalas). */
export interface PlanCatalogEntry {
  key: string;
  name: string;
  nameEn: string;
  maxBranches: number;
  maxUsers: number;
  /** null = unlimited. */
  maxOrdersPerMonth: number | null;
  priceMonthlyHalalas: number;
  priceYearlyHalalas: number | null;
  features: Record<string, boolean>;
  sortOrder: number;
}

export const TRIAL_PERIOD_DAYS = 14;

export const PLAN_CATALOG: readonly PlanCatalogEntry[] = [
  {
    key: "basic",
    name: "أساسي",
    nameEn: "Basic",
    maxBranches: 1,
    maxUsers: 5,
    maxOrdersPerMonth: 500,
    priceMonthlyHalalas: 19_900,
    priceYearlyHalalas: 199_000,
    features: { inventory: false, multiKds: false },
    sortOrder: 0,
  },
  {
    key: "pro",
    name: "احترافي",
    nameEn: "Pro",
    maxBranches: 3,
    maxUsers: 15,
    maxOrdersPerMonth: 3_000,
    priceMonthlyHalalas: 39_900,
    priceYearlyHalalas: 399_000,
    features: { inventory: true, multiKds: false },
    sortOrder: 1,
  },
  {
    key: "growth",
    name: "نمو",
    nameEn: "Growth",
    maxBranches: 10,
    maxUsers: 50,
    maxOrdersPerMonth: null,
    priceMonthlyHalalas: 79_900,
    priceYearlyHalalas: 799_000,
    features: { inventory: true, multiKds: true },
    sortOrder: 2,
  },
] as const;

export const DEFAULT_PLAN_KEY = "basic";
