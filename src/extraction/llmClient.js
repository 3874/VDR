export function chooseProvider(state) {
  const configured = state.analysis.provider;
  if (configured === "openai" && state.apiKeys.openai) return openAiProvider(state);
  if (configured === "gemini" && state.apiKeys.gemini) return geminiProvider(state);
  if (state.apiKeys.openai) return openAiProvider(state);
  if (state.apiKeys.gemini) return geminiProvider(state);
  return null;
}

export async function callLLMJson(provider, prompt, options = {}) {
  if (provider.name === "openai") return callOpenAI(provider, prompt, options);
  if (provider.name === "gemini") return callGemini(provider, prompt, options);
  throw new Error(`Unsupported LLM provider: ${provider.name}`);
}

function openAiProvider(state) {
  return { name: "openai", apiKey: state.apiKeys.openai, model: state.analysis.openaiModel || "gpt-4o-mini" };
}

function geminiProvider(state) {
  return { name: "gemini", apiKey: state.apiKeys.gemini, model: state.analysis.geminiModel || "gemini-2.5-flash" };
}

async function callOpenAI(provider, prompt, options = {}) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      temperature: options.temperature ?? 0,
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
      generationConfig: { temperature: options.temperature ?? 0, responseMimeType: "application/json" },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) throw new Error(`${options.purpose || "Gemini request"} failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}
