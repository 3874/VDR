import { assertWithinTokenLimit } from "./llmModels.js";

export function chooseProvider(state) {
  return chooseProviders(state)[0] ?? null;
}

function chooseProviders(state) {
  const preferred = state.analysis.provider || "gemini";
  const order = preferred === "openai" ? ["openai", "gemini"] : ["gemini", "openai"];
  return order
    .map((name) => name === "openai" ? openAiProvider(state) : geminiProvider(state))
    .filter((provider) => provider.apiKey);
}

async function callLLMJson(provider, prompt, options = {}) {
  provider.tokenCheck = assertWithinTokenLimit(provider, prompt, options);
  if (provider.name === "openai") return callOpenAI(provider, prompt, options);
  if (provider.name === "gemini") return callGemini(provider, prompt, options);
  throw new Error(`Unsupported LLM provider: ${provider.name}`);
}

export async function callLLMJsonWithFallback(state, prompt, options = {}) {
  const providers = chooseProviders(state);
  if (!providers.length) throw new Error("No API key available for LLM request.");
  const errors = [];
  for (const provider of providers) {
    try {
      const content = await callLLMJson(provider, prompt, options);
      return { content, provider };
    } catch (error) {
      errors.push(`${provider.name}/${provider.model}: ${error.message}`);
    }
  }
  throw new Error(`All LLM providers failed. ${errors.join(" | ")}`);
}

/**
 * Call LLM Vision API with images + text prompt.
 * @param {object} provider - { name, apiKey, model }
 * @param {string} prompt - Text prompt
 * @param {Array<{base64: string, mimeType: string}>} images - Base64-encoded images
 * @param {object} options - { temperature, maxOutputTokens, purpose, systemMessage }
 * @returns {Promise<string>} Raw JSON string response
 */
async function callLLMVision(provider, prompt, images, options = {}) {
  provider.tokenCheck = assertWithinTokenLimit(provider, prompt, {
    ...options,
    extraInputTokens: estimateImageTokens(images),
  });
  if (provider.name === "openai") return callOpenAIVision(provider, prompt, images, options);
  if (provider.name === "gemini") return callGeminiVision(provider, prompt, images, options);
  throw new Error(`Unsupported LLM provider for vision: ${provider.name}`);
}

/**
 * Call Vision API with automatic fallback across providers.
 */
export async function callLLMVisionWithFallback(state, prompt, images, options = {}) {
  const providers = chooseProviders(state);
  if (!providers.length) throw new Error("No API key available for Vision LLM request.");
  const errors = [];
  for (const provider of providers) {
    try {
      const content = await callLLMVision(provider, prompt, images, options);
      return { content, provider };
    } catch (error) {
      errors.push(`${provider.name}/${provider.model}: ${error.message}`);
    }
  }
  throw new Error(`All Vision LLM providers failed. ${errors.join(" | ")}`);
}

function openAiProvider(state) {
  return { name: "openai", apiKey: state.apiKeys.openai, model: state.analysis.openaiModel || "gpt-5.4-mini" };
}

function geminiProvider(state) {
  return { name: "gemini", apiKey: state.apiKeys.gemini, model: state.analysis.geminiModel || "gemini-2.5-flash-lite" };
}

async function callOpenAI(provider, prompt, options = {}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      temperature: options.temperature ?? 0,
      max_tokens: provider.tokenCheck.requestedOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: options.systemMessage || "Return only valid JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${options.purpose || "OpenAI request"} failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(provider, prompt, options = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: options.temperature ?? 0, responseMimeType: "application/json", maxOutputTokens: provider.tokenCheck.requestedOutputTokens },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) throw new Error(`${options.purpose || "Gemini request"} failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

async function callOpenAIVision(provider, prompt, images, options = {}) {
  const userContent = [
    ...images.map((img) => ({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${img.base64}`, detail: "high" },
    })),
    { type: "text", text: prompt },
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      temperature: options.temperature ?? 0,
      max_tokens: provider.tokenCheck.requestedOutputTokens,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: options.systemMessage || "You are an expert Korean financial statement extractor. Return only valid JSON." },
        { role: "user", content: userContent },
      ],
    }),
  });
  if (!response.ok) throw new Error(`${options.purpose || "OpenAI Vision"} failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGeminiVision(provider, prompt, images, options = {}) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;

  const parts = [
    ...images.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 },
    })),
    { text: prompt },
  ];

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: options.temperature ?? 0, responseMimeType: "application/json", maxOutputTokens: provider.tokenCheck.requestedOutputTokens },
      contents: [{ parts }],
    }),
  });
  if (!response.ok) throw new Error(`${options.purpose || "Gemini Vision"} failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

function estimateImageTokens(images) {
  return (images ?? []).reduce((sum, image) => {
    if (Number.isFinite(image.width) && Number.isFinite(image.height)) {
      return sum + Math.ceil((image.width * image.height) / 750);
    }
    return sum + Math.ceil(String(image.base64 ?? "").length / 1024);
  }, 0);
}
