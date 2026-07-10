import type { PaymentProviderName } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import type { PaymentProvider } from "./types";
import { mockProvider } from "./mockProvider";
import { tabbyProvider } from "./tabbyProvider";
import { tamaraProvider } from "./tamaraProvider";
import { moyasarProvider } from "./moyasarProvider";

const PROVIDERS: Record<PaymentProviderName, PaymentProvider> = {
  tabby: tabbyProvider,
  tamara: tamaraProvider,
  moyasar: moyasarProvider,
  mock: mockProvider,
};

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  const provider = PROVIDERS[name];
  if (!provider) throw AppError.validation(`Unknown payment provider: ${name}`);
  return provider;
}

export * from "./types";
