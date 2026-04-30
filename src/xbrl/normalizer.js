function parseNumber(value) {
  if (value == null) return null;
  if (typeof value === "number") return value;
  let text = String(value).trim();
  if (!text || text === "-") return null;
  const negative = text.startsWith("(") && text.endsWith(")");
  text = text.replace(/[(),]/g, "").replace(/[^0-9.-]/g, "");
  if (!text || text === "-") return null;
  const number = text.includes(".") ? Number.parseFloat(text) : Number.parseInt(text, 10);
  return negative ? -number : number;
}

export function normalizeAmount(value, unit = "KRW", scale = 1) {
  const parsed = parseNumber(value);
  if (parsed == null || Number.isNaN(parsed)) return null;
  const multipliers = new Map([
    ["KRW", 1],
    ["\uc6d0", 1],
    ["\ucc9c\uc6d0", 1000],
    ["\ubc31\ub9cc\uc6d0", 1_000_000],
    ["\uc5b5\uc6d0", 100_000_000],
  ]);
  return parsed * (multipliers.get(unit) ?? scale ?? 1);
}
