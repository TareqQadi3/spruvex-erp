// The SaaS package catalog — business config that changes only via a deploy,
// not tenant data, so it lives as a code constant next to PERMISSIONS/
// DEFAULT_ROLES in roles.ts rather than a DB table (no parallel system).
// companies.plan / subscriptions.plan store one of these codes as plain text.
export const PLAN_CODES = ["erp_business", "restaurant", "sales_repair", "enterprise"] as const;
export type PlanCode = typeof PLAN_CODES[number];

export interface PlanLimits {
  maxUsers: number;
  maxBranches: number;
  maxProducts: number;
  maxCustomers: number;
  maxInvoicesPerMonth: number;
  storageQuotaMb: number;
  // Modules included in this plan by default — a company's actual effective
  // modules are this list unioned with companies.enabledModules (set from
  // businessType at signup, see businessTypeDefaults.ts) and any active
  // module-type add-ons. Never subtracted from on plan change, only added to.
  modules: string[];
}

// Placeholder figures — real limits are a pricing/business decision, not an
// architecture one; adjust freely without touching any enforcement code.
export const PLAN_CATALOG: Record<PlanCode, PlanLimits> = {
  erp_business: {
    maxUsers: 5, maxBranches: 2, maxProducts: 1000, maxCustomers: 2000,
    maxInvoicesPerMonth: 1000, storageQuotaMb: 500,
    modules: ["pos", "inventory", "customers"],
  },
  restaurant: {
    maxUsers: 8, maxBranches: 2, maxProducts: 500, maxCustomers: 2000,
    maxInvoicesPerMonth: 3000, storageQuotaMb: 500,
    modules: ["pos", "inventory", "customers", "restaurant"],
  },
  sales_repair: {
    maxUsers: 5, maxBranches: 2, maxProducts: 1000, maxCustomers: 2000,
    maxInvoicesPerMonth: 1000, storageQuotaMb: 500,
    modules: ["pos", "inventory", "customers", "repairs"],
  },
  enterprise: {
    maxUsers: 999_999, maxBranches: 999_999, maxProducts: 999_999, maxCustomers: 999_999,
    maxInvoicesPerMonth: 999_999, storageQuotaMb: 50_000,
    modules: ["pos", "inventory", "customers", "repairs", "restaurant", "ecommerce"],
  },
};

// Add-on catalog. "module" add-ons unlock a feature module outright;
// "quantity" add-ons boost one numeric plan limit by their `quantity` value
// (see company_addons.quantity in companyAddons.ts).
export const ADDON_CODES = [
  "ecommerce", "loyalty", "advanced_reports", "online_menu", "customer_ordering",
  "ai_features", "additional_users", "additional_branches",
] as const;
export type AddonCode = typeof ADDON_CODES[number];

export type AddonDefinition =
  | { type: "module"; grantsModule: string }
  | { type: "quantity"; boostsLimit: keyof PlanLimits };

export const ADDON_CATALOG: Record<AddonCode, AddonDefinition> = {
  ecommerce: { type: "module", grantsModule: "ecommerce" },
  loyalty: { type: "module", grantsModule: "loyalty" },
  advanced_reports: { type: "module", grantsModule: "advanced_reports" },
  online_menu: { type: "module", grantsModule: "online_menu" },
  customer_ordering: { type: "module", grantsModule: "customer_ordering" },
  ai_features: { type: "module", grantsModule: "ai_features" },
  additional_users: { type: "quantity", boostsLimit: "maxUsers" },
  additional_branches: { type: "quantity", boostsLimit: "maxBranches" },
};
