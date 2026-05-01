export const MODEL_LIMITS = {
  "gemini-2.5-flash-lite": {
    provider: "gemini",
    tier: "speed",
    label: "Gemini 2.5 Flash-Lite (Default Efficiency)",
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    source: "Google Gemini models documentation",
  },
  "gemini-2.5-pro": {
    provider: "gemini",
    tier: "quality",
    label: "Gemini 2.5 Pro (High Accuracy)",
    inputTokenLimit: 1_048_576,
    outputTokenLimit: 65_536,
    source: "Google Gemini models documentation",
  },
  "gemini-1.5-pro": {
    provider: "gemini",
    tier: "quality",
    label: "Gemini 1.5 Pro (Legacy High Accuracy)",
    inputTokenLimit: 2_097_152,
    outputTokenLimit: 8_192,
    source: "Google Gemini models documentation",
  },
  "gpt-5.4-mini": {
    provider: "openai",
    tier: "speed",
    label: "GPT-5.4 Mini (Default Reasoning)",
    inputTokenLimit: 400_000,
    outputTokenLimit: 128_000,
    source: "OpenAI GPT-5 documentation",
  },
  "gpt-4o": {
    provider: "openai",
    tier: "quality",
    label: "GPT-4o (Superior Reasoning)",
    inputTokenLimit: 128_000,
    outputTokenLimit: 16_384,
    source: "OpenAI model documentation",
  },
  "o1-preview": {
    provider: "openai",
    tier: "quality",
    label: "o1-preview (Advanced Reasoning for Tables)",
    inputTokenLimit: 128_000,
    outputTokenLimit: 32_768,
    source: "OpenAI model documentation",
  },
  "o1-mini": {
    provider: "openai",
    tier: "speed",
    label: "o1-mini (Fast Reasoning)",
    inputTokenLimit: 128_000,
    outputTokenLimit: 65_536,
    source: "OpenAI model documentation",
  },
};

function getModelLimit(model, providerName) {
  const exact = MODEL_LIMITS[model];
  if (exact) return exact;
  return providerName === "gemini"
    ? { provider: "gemini", inputTokenLimit: 1_048_576, outputTokenLimit: 65_536, source: "Gemini default fallback limit" }
    : { provider: "openai", inputTokenLimit: 128_000, outputTokenLimit: 16_384, source: "OpenAI default fallback limit" };
}

function estimatePromptTokens(prompt) {
  return Math.ceil(String(prompt ?? "").length / 4);
}

export function assertWithinTokenLimit(provider, prompt, options = {}) {
  const limits = getModelLimit(provider.model, provider.name);
  const estimatedInputTokens = estimatePromptTokens(prompt) + Math.ceil(Number(options.extraInputTokens ?? 0));
  const requestedOutputTokens = options.maxOutputTokens ?? Math.min(8_192, limits.outputTokenLimit);
  if (estimatedInputTokens > limits.inputTokenLimit) {
    throw new Error(`${provider.model} input is too large: estimated ${estimatedInputTokens.toLocaleString()} tokens, limit ${limits.inputTokenLimit.toLocaleString()} tokens.`);
  }
  if (requestedOutputTokens > limits.outputTokenLimit) {
    throw new Error(`${provider.model} output request is too large: requested ${requestedOutputTokens.toLocaleString()} tokens, limit ${limits.outputTokenLimit.toLocaleString()} tokens.`);
  }
  return { ...limits, estimatedInputTokens, requestedOutputTokens };
}
