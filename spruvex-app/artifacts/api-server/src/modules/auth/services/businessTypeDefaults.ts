import type { BusinessType } from "../types/auth.types";

// Every value the POS engine will ever render for (pos-system/src/pages/pos/
// templates). Adding a new one is: add the string here, add a template
// component to the registry, done — no other file needs to know it exists.
export type PosTemplate = "list" | "grid" | "image" | "mobile";

// Maps a tenant's declared line of business (chosen at signup) to the module
// set, settings flags, and POS screen layout it starts with. Pure/static — no
// DB access — so the signup wizard and any future "what would this business
// type unlock" preview UI can both import it without a round-trip.
export interface BusinessTypeDefaults {
  enabledModules: string[];
  repairsModuleEnabled: boolean;
  ecommerceModuleEnabled: boolean;
  posTemplate: PosTemplate;
}

const BUSINESS_TYPE_DEFAULTS: Record<BusinessType, BusinessTypeDefaults> = {
  // Grocery / supermarket / warehouse / spare-parts style — search + barcode
  // + fast list entry.
  retail: {
    enabledModules: ["pos", "inventory", "customers"],
    repairsModuleEnabled: false,
    ecommerceModuleEnabled: false,
    posTemplate: "list",
  },
  // Phones/electronics — variant picker (color/storage/model/warranty) +
  // linked accessories.
  electronics: {
    enabledModules: ["pos", "inventory", "customers", "repairs"],
    repairsModuleEnabled: true,
    ecommerceModuleEnabled: false,
    posTemplate: "mobile",
  },
  repair: {
    enabledModules: ["pos", "inventory", "customers", "repairs"],
    repairsModuleEnabled: true,
    ecommerceModuleEnabled: false,
    posTemplate: "list",
  },
  // Restaurant/cafe/dessert shop — sectioned grid of product buttons with
  // images and add-ons.
  restaurant: {
    enabledModules: ["pos", "inventory", "customers", "restaurant"],
    repairsModuleEnabled: false,
    ecommerceModuleEnabled: false,
    posTemplate: "grid",
  },
  // Online-store connectors (Salla/Zid/Shopify) — in-store POS still exists,
  // defaults to list; merchants selling clothes/shoes/perfume can switch to
  // "image" from Settings without any code change.
  ecommerce: {
    enabledModules: ["pos", "inventory", "customers", "ecommerce"],
    repairsModuleEnabled: false,
    ecommerceModuleEnabled: true,
    posTemplate: "list",
  },
};

export function resolveBusinessTypeDefaults(businessType: BusinessType): BusinessTypeDefaults {
  return BUSINESS_TYPE_DEFAULTS[businessType];
}
