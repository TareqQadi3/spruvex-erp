import { AI_PROVIDERS, type AiProviderName } from "@workspace/db";
import { AppError } from "../../../core/errors/AppError";
import { aiRepository } from "../repositories/aiRepository";
import { getProvider } from "../providers";
import type { AiProvider } from "../providers/types";
import { assertWithinAiQuota } from "./aiQuotaService";
import {
  getSalesProfitSummary,
  getCashflowSummary,
  getTopProducts,
  getLowStockProducts,
} from "../../bi/services/biService";
import {
  detectAnomalies,
  buildAlerts,
  buildReorderSuggestions,
  buildSummaryPrompt,
  type BusinessAlert,
  type AnomalyFinding,
  type ReorderSuggestion,
} from "./businessInsightsBuilder";

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
  await assertWithinAiQuota(companyId);
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

// --- Business assistant --------------------------------------------------
// The first real, end-to-end BI use case (Phase 10): a management summary
// grounded entirely in modules/bi's server-computed numbers. The model's job
// is prose ONLY — every figure in the response (revenue, profit, deltas,
// low-stock count, reorder quantities) is computed in code before the model
// ever sees a prompt, and the response includes that same `metrics` object
// alongside the generated text so a caller can verify the two never diverge.

export type BusinessSummaryPeriod = "daily" | "weekly" | "monthly";

const PERIOD_DAYS: Record<BusinessSummaryPeriod, number> = { daily: 1, weekly: 7, monthly: 30 };
const PERIOD_LABEL: Record<BusinessSummaryPeriod, string> = { daily: "today", weekly: "the last 7 days", monthly: "the last 30 days" };

export interface BusinessSummaryResult extends RunFeatureResult {
  period: BusinessSummaryPeriod;
  from: string;
  to: string;
  metrics: {
    current: Awaited<ReturnType<typeof getSalesProfitSummary>>;
    previous: Awaited<ReturnType<typeof getSalesProfitSummary>>;
    cashflow: Awaited<ReturnType<typeof getCashflowSummary>>;
    topProducts: Awaited<ReturnType<typeof getTopProducts>>;
    lowStock: Awaited<ReturnType<typeof getLowStockProducts>>;
  };
  anomalies: AnomalyFinding[];
  alerts: BusinessAlert[];
  reorderSuggestions: ReorderSuggestion[];
}

export async function businessSummary(
  companyId: string,
  userId: string,
  period: BusinessSummaryPeriod = "monthly",
  language: "ar" | "en" = "ar",
): Promise<BusinessSummaryResult> {
  const days = PERIOD_DAYS[period];
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const previousFrom = new Date(from.getTime() - days * 24 * 60 * 60 * 1000);

  const [current, previous, cashflow, topProducts, lowStock] = await Promise.all([
    getSalesProfitSummary(companyId, from, now),
    getSalesProfitSummary(companyId, previousFrom, from),
    getCashflowSummary(companyId, from, now),
    getTopProducts(companyId, from, now, 5),
    getLowStockProducts(companyId, 20),
  ]);

  const anomalies = detectAnomalies(current, previous);
  const alerts = buildAlerts(anomalies, lowStock, language);
  const reorderSuggestions = buildReorderSuggestions(lowStock);

  const prompt = buildSummaryPrompt({
    periodLabel: PERIOD_LABEL[period],
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
    current,
    previous,
    cashflow,
    topProducts,
    anomalies,
    lowStockCount: lowStock.length,
  });

  const languageLine =
    language === "ar"
      ? "Respond in Arabic. Answer ONLY with the requested content, no preamble."
      : "Respond in English. Answer ONLY with the requested content, no preamble.";
  const system =
    "You are SpruVex's business assistant for Saudi/Gulf retail merchants. " +
    "You will be given real, already-computed figures for this company only. " +
    "Use ONLY the numbers given below — never invent, estimate, guess, or round a figure that wasn't provided to you. " +
    "Write a concise management summary (4-6 sentences) covering the period's performance, the most " +
    "important change versus the previous period, and one concrete, actionable recommendation grounded strictly " +
    "in the data given. " +
    languageLine;

  const generated = await runFeature(companyId, userId, `business_summary_${period}`, system, prompt);

  return {
    ...generated,
    period,
    from: from.toISOString(),
    to: now.toISOString(),
    metrics: { current, previous, cashflow, topProducts, lowStock },
    anomalies,
    alerts,
    reorderSuggestions,
  };
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
