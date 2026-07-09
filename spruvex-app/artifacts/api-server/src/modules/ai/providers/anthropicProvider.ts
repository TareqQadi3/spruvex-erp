import { AppError } from "../../../core/errors/AppError";
import type { AiGenerateRequest, AiGenerateResult, AiProvider } from "./types";

const ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export const anthropicProvider: AiProvider = {
  name: "anthropic",
  defaultModel: "claude-haiku-4-5-20251001",
  requiresApiKey: true,

  async generate(req: AiGenerateRequest, config: { apiKey?: string; model?: string }): Promise<AiGenerateResult> {
    const model = config.model ?? this.defaultModel;

    const response = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey ?? "",
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: req.maxTokens ?? 1024,
        system: req.system,
        messages: [{ role: "user", content: req.prompt }],
      }),
    });

    if (!response.ok) {
      // Never include headers/request body in the error — only a short,
      // non-sensitive detail from the response so no key material can leak.
      let detail = `HTTP ${response.status}`;
      try {
        const body = (await response.json()) as { error?: { message?: string } };
        if (body?.error?.message) detail = body.error.message;
      } catch {
        // response wasn't JSON — keep the status-only detail
      }
      throw AppError.internal(`AI provider error: ${detail}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    return {
      text: data.content?.[0]?.text ?? "",
      model,
      inputTokens: data.usage?.input_tokens,
      outputTokens: data.usage?.output_tokens,
    };
  },
};
