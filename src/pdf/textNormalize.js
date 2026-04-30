export function compactText(text) {
  return String(text ?? "").replace(/\s+/g, "").toLowerCase();
}

export function normalizeWhitespace(text) {
  return String(text ?? "").replace(/\s+/g, " ").toLowerCase();
}
