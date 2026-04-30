import { sliceStatementText } from "./statementSegments.js";

const COMMA_NUMBER_PATTERN = /\(?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?/g;

export function extractMetricsFromText(text, pageNumber, scope, statementType) {
  const scopedText = sliceStatementText(text, statementType);
  const { unit, scale } = detectUnit(scopedText);
  const period = detectPeriod(scopedText, statementType);
  const pagePeriodLabels = detectPeriodLabels(scopedText);
  const metrics = [];

  for (const line of scopedText.split(/\n+/)) {
    const parsed = parseStatementLine(line);
    if (!parsed) continue;
    const { label, values } = parsed;
    if (!validLabel(label)) continue;
    metrics.push({
      label,
      value: selectCurrentPeriodValue(values),
      allValues: values,
      unit,
      scale,
      period,
      scope,
      statementType,
      pageNumber,
      confidence: 0.55,
      rawLine: line,
      periodLabels: pagePeriodLabels.slice(0, values.length),
    });
  }

  return dedupeMetrics(metrics);
}

function parseStatementLine(line) {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  const values = [];
  let cursor = tokens.length - 1;

  while (cursor >= 0 && isValueToken(tokens[cursor])) {
    values.unshift(tokens[cursor]);
    cursor -= 1;
  }

  if (!values.length) return null;
  const label = cleanAccountLabel(
    tokens
      .slice(0, cursor + 1)
      .join(" ")
      .trim()
      .replace(/^[\s:\u00b7\u318d-]+|[\s:\u00b7\u318d-]+$/g, ""),
  );
  if (!label) return null;
  return { label, values: values.slice(0, 3) };
}

function cleanAccountLabel(label) {
  return label
    .replace(/^[IVXLCDM\u2160-\u217f]+[.)\s]+/i, "")
    .replace(/^[\u2460-\u2473\u2776-\u277f]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+\d+(?:\s*,\s*\d+)*$/g, "")
    .trim();
}

function isValueToken(token) {
  const cleaned = token.trim();
  return (
    cleaned === "-" ||
    cleaned === "0" ||
    /^\(?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?$/.test(cleaned)
  );
}

function detectPeriodLabels(text) {
  const years = [...text.matchAll(/20\d{2}/g)].map((match) => match[0]);
  const unique = [...new Set(years)].map(Number).sort((a, b) => b - a);
  return unique.slice(0, 6).map(String);
}

function selectCurrentPeriodValue(values) {
  return values[0] ?? null;
}

function detectUnit(text) {
  const compact = text.replace(/\s+/g, "").toLowerCase();
  if (compact.includes("\ub2e8\uc704:\ucc9c\uc6d0") || compact.includes("\ub2e8\uc704\uff1a\ucc9c\uc6d0")) {
    return { unit: "\ucc9c\uc6d0", scale: 1000 };
  }
  if (compact.includes("\ub2e8\uc704:\ubc31\ub9cc\uc6d0")) {
    return { unit: "\ubc31\ub9cc\uc6d0", scale: 1_000_000 };
  }
  if (compact.includes("\ub2e8\uc704:\uc5b5\uc6d0")) {
    return { unit: "\uc5b5\uc6d0", scale: 100_000_000 };
  }
  return { unit: "KRW", scale: 1 };
}

function detectPeriod(text, statementType) {
  if (statementType === "balance_sheet") {
    const match = text.match(/(20\d{2})[.\-/]\s*(?:12|0?12)[.\-/]\s*(?:31|0?31)/);
    if (match) return `${match[1]}.12.31`;
  }
  const range = text.match(/(20\d{2})[.\-/]\s*01[.\-/]\s*01[\s\S]*?(20\d{2})[.\-/]\s*12[.\-/]\s*31/);
  if (range) return `FY${range[2]}`;
  const fiscal = text.match(/\uc81c\s*\d+(?:\([^)]+\))?\s*\uae30/);
  if (fiscal) return fiscal[0].replace(/\s+/g, "");
  return "";
}

function validLabel(label) {
  const compact = label.replace(/[\s\u3000]+/g, "");
  if (compact.length < 2 || compact.length > 80) return false;
  if (compact.includes("\uc804\uc790\uacf5\uc2dc\uc2dc\uc2a4\ud15c") || label.toLowerCase().includes("dart.fss.or.kr")) return false;
  if (isNonAccountLabel(compact)) return false;
  if (COMMA_NUMBER_PATTERN.test(label)) {
    COMMA_NUMBER_PATTERN.lastIndex = 0;
    return false;
  }
  COMMA_NUMBER_PATTERN.lastIndex = 0;
  return /[\uac00-\ud7a3a-zA-Z]/.test(label);
}

function isNonAccountLabel(compact) {
  const exactBans = new Set([
    "\uc790\uc0b0",
    "\ubd80\ucc44",
    "\uc790\ubcf8",
    "\uad6c\ubd84",
    "\uacc4\uc815\uacfc\ubaa9",
    "\uacfc\ubaa9",
  ]);
  if (exactBans.has(compact)) return true;
  const bannedFragments = [
    "\uc7ac\ubb34\uc0c1\ud0dc\ud45c",
    "\uc190\uc775\uacc4\uc0b0\uc11c",
    "\ud3ec\uad04\uc190\uc775\uacc4\uc0b0\uc11c",
    "\uc790\ubcf8\ubcc0\ub3d9\ud45c",
    "\ud604\uae08\ud750\ub984\ud45c",
    "\ub2e8\uc704",
    "\ud604\uc7ac",
    "\uae30\uac04",
    "\ubaa9\ucc28",
    "\uc8fc\uc11d",
    "\uc678\ubd80\uac10\uc0ac",
    "dart.fss.or.kr",
    "page",
  ];
  if (bannedFragments.some((fragment) => compact.toLowerCase().includes(fragment))) return true;
  if (/^\uc81c\d+(?:\([^)]+\))?\uae30/.test(compact)) return true;
  if (/^20\d{2}[.\-/]/.test(compact)) return true;
  return false;
}

function dedupeMetrics(metrics) {
  const seen = new Set();
  const output = [];
  for (const metric of metrics) {
    const key = `${metric.scope}:${metric.statementType}:${metric.pageNumber}:${metric.label}:${metric.value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(metric);
  }
  return output;
}
