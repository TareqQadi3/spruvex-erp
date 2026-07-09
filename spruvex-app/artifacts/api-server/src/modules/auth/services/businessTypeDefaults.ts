import type { BusinessType } from "../types/auth.types";

// Maps a tenant's declared line of business (chosen at signup) to the module
// set and settings flags it starts with. Pure/static — no DB access — so the
// signup wizard and any future "what would this business type unlock" preview
// UI can both import it without a round-trip.
export interface BusinessTypeDefaults {
  enabledModules: string[];
  repairsModuleEnabled: boolean;
  ecommerceModuleEnabled: boolean;
}

const BUSINESS_TYPE_DEFAULTS: Record<BusinessType, BusinessTypeDefaults> = {
  retail: {
    enabledModules: ["pos", "inventory", "customers"],
    repairsModuleEnabled: false,
    ecommerceModuleEnabled: false,
  },
  electronics: {
    enabledModules: ["pos", "inventory", "customers", "repairs"],
    repairsModuleEnabled: true,
    ecommerceModuleEnabled: false,
  },
  repair: {
    enabledModules: ["pos", "inventory", "customers", "repairs"],
    repairsModuleEnabled: true,
    ecommerceModuleEnabled: false,
  },
  restaurant: {
    enabledModules: ["pos", "inventory", "customers", "restaurant"],
    repairsModuleEnabled: false,
    ecommerceModuleEnabled: false,
  },
  ecommerce: {
    enabledModules: ["pos", "inventory", "customers", "ecommerce"],
    repairsModuleEnabled: false,
    ecommerceModuleEnabled: true,
  },
};

export function resolveBusinessTypeDefaults(businessType: BusinessType): BusinessTypeDefaults {
  return BUSINESS_TYPE_DEFAULTS[businessType];
}
