export function parseJsonResponse(raw) {
  const text = stripMarkdownJson(raw);
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(text.slice(start, end + 1));
    throw new Error("LLM did not return valid JSON.");
  }
}

function stripMarkdownJson(value) {
  return String(value ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}
