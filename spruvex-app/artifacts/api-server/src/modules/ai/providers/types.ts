// Provider-agnostic AI generation contract. Every backend (real vendor or
// mock) implements this shape so aiService never branches on provider name.

export interface AiGenerateRequest {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AiGenerateResult {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface AiProvider {
  readonly name: string;
  readonly defaultModel: string;
  readonly requiresApiKey: boolean;
  generate(req: AiGenerateRequest, config: { apiKey?: string; model?: string }): Promise<AiGenerateResult>;
}
