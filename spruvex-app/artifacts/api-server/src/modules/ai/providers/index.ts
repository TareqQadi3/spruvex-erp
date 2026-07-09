import type { AiProviderName } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import type { AiProvider } from "./types";
import { anthropicProvider } from "./anthropicProvider";
import { mockProvider } from "./mockProvider";

const PROVIDERS: Record<AiProviderName, AiProvider> = {
  anthropic: anthropicProvider,
  mock: mockProvider,
};

export function getProvider(name: AiProviderName): AiProvider {
  const provider = PROVIDERS[name];
  if (!provider) throw AppError.internal(`Unknown AI provider: ${name}`);
  return provider;
}

export * from "./types";
