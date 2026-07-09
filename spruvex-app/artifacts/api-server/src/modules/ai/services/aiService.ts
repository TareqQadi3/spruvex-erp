import { AI_PROVIDERS, type AiProviderName } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import { aiRepository } from "../repositories/aiRepository";
import { getProvider } from "../providers";
import type { AiProvider } from "../providers/types";

export interface ResolvedAiConfig {
  provider: AiProvider;
  providerName: AiProviderName;
  apiKey?: string;
  model: string;
}

function isAiProviderName(value: string): value is AiProviderName {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

async function resolveConfig(companyId: string): Promise<ResolvedAiConfig> {
  const settings = await aiRepository.findSettings(companyId);

  if (settings && settings.isActive === false) {
    throw AppError.forbidden("AI features are disabled for this company");
  }

  const rawProviderName = settings?.provider ?? process.env.AI_PROVIDER ?? "anthropic";
  if (!isAiProviderName(rawProviderName)) {
    throw AppError.internal(`Unsupported AI provider configured: ${rawProviderName}`);
  }
  const providerName = rawProviderName;
  const provider = getProvider(providerName);

  const apiKey = settings?.apiKey ?? process.env.ANTHROPIC_API_KEY ?? undefined;
  if (provider.requiresApiKey && !apiKey) {
    throw AppError.validation("AI provider is not configured: missing API key");
  }

  const model = settings?.model ?? provider.defaultModel;

  return { provider, providerName, apiKey, model };
}

interface RunFeatureResult {
  text: string;
  model: string;
  provider: AiProviderName;
}

async function runFeature(
  companyId: string,
  userId: string,
  feature: string,
  system: string,
  prompt: string,
  maxTokens?: number,
): Promise<RunFeatureResult> {
  const config = await resolveConfig(companyId);

  try {
    const result = await config.provider.generate(
      { system, prompt, maxTokens },
      { apiKey: config.apiKey, model: config.model },
    );

    await aiRepository.insertUsageLog({
      companyId,
      userId,
      feature,
      provider: config.providerName,
      model: result.model,
      inputTokens: result.inputTokens ?? null,
      outputTokens: result.outputTokens ?? null,
      status: "success",
    });

    return { text: result.text, model: result.model, provider: config.providerName };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown AI provider error";
    await aiRepository.insertUsageLog({
      companyId,
      userId,
      feature,
      provider: config.providerName,
      model: config.model,
      inputTokens: null,
      outputTokens: null,
      status: "error",
      errorMessage: message.slice(0, 500),
    });
    throw err;
  }
}

// --- Product assistant -------------------------------------------------------

export type ProductAssistantAction =
  | "describe"
  | "improve_name"
  | "suggest_category"
  | "suggest_keywords"
  | "ecommerce_description";

export interface ProductAssistantInput {
  action: ProductAssistantAction;
  name: string;
  category?: string;
  brand?: string;
  description?: string;
  keywords?: string;
  language?: "ar" | "en";
}

const PRODUCT_FEATURE_BY_ACTION: Record<ProductAssistantAction, string> = {
  describe: "product_description",
  improve_name: "improve_name",
  suggest_category: "suggest_category",
  suggest_keywords: "suggest_keywords",
  ecommerce_description: "ecommerce_description",
};

function buildProductSystemPrompt(language: "ar" | "en", instruction: string): string {
  const languageLine =
    language === "ar"
      ? "Respond in Arabic. Answer ONLY with the requested content, no preamble, no explanations."
      : "Respond in English. Answer ONLY with the requested content, no preamble, no explanations.";
  return `You are SpruVex's retail product assistant for Saudi/Gulf merchants. ${instruction} ${languageLine}`;
}

function buildProductPrompt(input: ProductAssistantInput): string {
  const lines = [
    `Product name: ${input.name}`,
    input.category ? `Current category: ${input.category}` : undefined,
    input.brand ? `Brand: ${input.brand}` : undefined,
    input.description ? `Existing description: ${input.description}` : undefined,
    input.keywords ? `Existing keywords: ${input.keywords}` : undefined,
  ].filter((line): line is string => Boolean(line));
  return lines.join("\n");
}

export async function productAssistant(
  companyId: string,
  userId: string,
  input: ProductAssistantInput,
): Promise<RunFeatureResult> {
  const language = input.language ?? "ar";
  const feature = PRODUCT_FEATURE_BY_ACTION[input.action];
  const prompt = buildProductPrompt(input);

  const instructionByAction: Record<ProductAssistantAction, string> = {
    describe: "Write a clear, appealing product description in 2-3 sentences that helps the description sell the product.",
    improve_name:
      "Suggest exactly 3 improved product name options, one per line, with no numbering or extra text.",
    suggest_category:
      "Suggest the single best-fitting product category, then a one-line reason. Format: category name, then a short reason on the same or next line.",
    suggest_keywords: "Return 8 to 12 relevant search keywords for this product, comma-separated, no other text.",
    ecommerce_description:
      "Write a longer SEO-friendly e-commerce listing description: a few bullet-point highlights followed by a persuasive paragraph.",
  };

  const system = buildProductSystemPrompt(language, instructionByAction[input.action]);

  return runFeature(companyId, userId, feature, system, prompt);
}

// --- Business assistant (foundation) -----------------------------------------
// Only a 30-day sales summary exists today. Inventory alerts and top-products
// insights are future phases — deliberately not built here.

export async function businessSummary(
  companyId: string,
  userId: string,
  language: "ar" | "en" = "ar",
): Promise<RunFeatureResult> {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [current, previous] = await Promise.all([
    aiRepository.getSalesWindowAggregate(companyId, thirtyDaysAgo, now),
    aiRepository.getSalesWindowAggregate(companyId, sixtyDaysAgo, thirtyDaysAgo),
  ]);

  const prompt =
    `Sales last 30 days: ${current.count} invoices, total ${current.total.toFixed(2)} SAR. ` +
    `Previous 30 days: ${previous.count} invoices, total ${previous.total.toFixed(2)} SAR.`;

  const languageLine =
    language === "ar"
      ? "Respond in Arabic. Answer ONLY with the requested content, no preamble."
      : "Respond in English. Answer ONLY with the requested content, no preamble.";
  const system =
    "You are SpruVex's business assistant for Saudi/Gulf retail merchants. " +
    "Given the sales figures, write a short management summary in 3-4 sentences with one actionable suggestion. " +
    languageLine;

  return runFeature(companyId, userId, "business_summary", system, prompt);
}

// --- Settings -----------------------------------------------------------------

export interface AiSettingsView {
  provider: AiProviderName;
  model: string | null;
  isActive: boolean;
  hasApiKey: boolean;
}

export async function getSettings(companyId: string): Promise<AiSettingsView> {
  const settings = await aiRepository.findSettings(companyId);
  return {
    provider: (settings?.provider as AiProviderName) ?? "anthropic",
    model: settings?.model ?? null,
    isActive: settings?.isActive ?? true,
    hasApiKey: Boolean(settings?.apiKey),
  };
}

export interface UpdateSettingsInput {
  provider?: AiProviderName;
  model?: string | null;
  apiKey?: string | null;
  isActive?: boolean;
}

export async function updateSettings(companyId: string, input: UpdateSettingsInput): Promise<AiSettingsView> {
  const existing = await aiRepository.findSettings(companyId);

  if (existing) {
    const updated = await aiRepository.updateSettings(companyId, input);
    if (!updated) throw AppError.internal("Failed to update AI settings");
    return {
      provider: updated.provider as AiProviderName,
      model: updated.model,
      isActive: updated.isActive,
      hasApiKey: Boolean(updated.apiKey),
    };
  }

  const created = await aiRepository.insertSettings({
    companyId,
    provider: input.provider ?? "anthropic",
    model: input.model ?? null,
    apiKey: input.apiKey ?? null,
    isActive: input.isActive ?? true,
  });

  return {
    provider: created.provider as AiProviderName,
    model: created.model,
    isActive: created.isActive,
    hasApiKey: Boolean(created.apiKey),
  };
}
