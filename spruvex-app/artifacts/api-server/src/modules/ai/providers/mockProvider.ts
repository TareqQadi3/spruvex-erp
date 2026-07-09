import type { AiGenerateRequest, AiGenerateResult, AiProvider } from "./types";

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Deterministic, no-network provider: lets dev/tests run without a paid key
// and proves aiService is not hard-wired to one vendor.
export const mockProvider: AiProvider = {
  name: "mock",
  defaultModel: "mock-v1",
  requiresApiKey: false,

  async generate(req: AiGenerateRequest, config: { apiKey?: string; model?: string }): Promise<AiGenerateResult> {
    const model = config.model ?? this.defaultModel;
    const systemFirstLine = req.system.split("\n")[0].slice(0, 60);
    const promptExcerpt = req.prompt.slice(0, 200);

    const text = `[mock:${systemFirstLine}] Based on the request, here is a plausible response.\n\nInput excerpt: ${promptExcerpt}\n\n(This is deterministic mock output — no external AI call was made.)`;

    return {
      text,
      model,
      inputTokens: estimateTokens(req.system) + estimateTokens(req.prompt),
      outputTokens: estimateTokens(text),
    };
  },
};
