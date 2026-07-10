import { AppError } from "../../../core/errors/AppError";
import type { EcommerceProvider } from "./types";
import { mockProvider } from "./mockProvider";
import { sallaProvider } from "./sallaProvider";
import { zidProvider } from "./zidProvider";
import { shopifyProvider } from "./shopifyProvider";

export const ECOMMERCE_PLATFORMS = ["salla", "zid", "shopify", "mock"] as const;
export type EcommercePlatformName = typeof ECOMMERCE_PLATFORMS[number];

const PROVIDERS: Record<EcommercePlatformName, EcommerceProvider> = {
  salla: sallaProvider,
  zid: zidProvider,
  shopify: shopifyProvider,
  mock: mockProvider,
};

export function getEcommerceProvider(name: string): EcommerceProvider {
  const provider = PROVIDERS[name as EcommercePlatformName];
  if (!provider) throw AppError.validation(`Unknown e-commerce provider: ${name}`);
  return provider;
}

export * from "./types";
