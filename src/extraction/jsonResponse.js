export function parseJsonResponse(raw) {
  const text = stripMarkdownJson(raw);
  try {
    return JSON.parse(text);
  } catch (directError) {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch (sliceError) {
        throw new Error(`LLM returned malformed JSON. ${sliceError.message}`);
      }
    }
    throw new Error(`LLM did not return valid JSON. ${directError.message}`);
  }
}

function stripMarkdownJson(value) {
  return String(value ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim();
}
