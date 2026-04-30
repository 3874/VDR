import { findStatementTitles, hasAnyStatementTitle, hasStatementTitle, sliceStatementText, STATEMENT_TYPES } from "./statementSegments.js";
import { compactText, normalizeWhitespace } from "./textNormalize.js";

const STATEMENT_KEYWORDS = {
  balance_sheet: ["\uc7ac\ubb34\uc0c1\ud0dc\ud45c", "\ud3ec\uad04\uc7ac\ubb34\uc0c1\ud0dc\ud45c", "statement of financial position", "balance sheet"],
  income_statement: ["\uc190\uc775\uacc4\uc0b0\uc11c", "\ud3ec\uad04\uc190\uc775\uacc4\uc0b0\uc11c", "income statement", "statement of comprehensive income"],
  equity_changes: ["\uc790\ubcf8\ubcc0\ub3d9\ud45c", "statement of changes in equity", "changes in equity"],
  cash_flow_statement: ["\ud604\uae08\ud750\ub984\ud45c", "\ud3ec\uad04\ud604\uae08\ud750\ub984\ud45c", "cash flow statement", "cash flows"],
};

const ROW_KEYWORDS = {
  balance_sheet: ["\uc790\uc0b0", "\uc790\uc0b0\ucd1d\uacc4", "\ubd80\ucc44", "\ubd80\ucc44\ucd1d\uacc4", "\uc790\ubcf8", "\uc790\ubcf8\ucd1d\uacc4", "assets", "liabilities", "equity"],
  income_statement: ["\ub9e4\ucd9c\uc561", "\ub9e4\ucd9c\uc6d0\uac00", "\ub9e4\ucd9c\ucd1d\uc774\uc775", "\uc601\uc5c5\uc774\uc775", "\ub2f9\uae30\uc21c\uc774\uc775", "\uae30\ud0c0\ud3ec\uad04\uc190\uc775", "\ucd1d\ud3ec\uad04\uc190\uc775", "\ud3ec\uad04\uc190\uc775\uc758\uadc0\uc18d", "\uc8fc\ub2f9\uc774\uc775", "revenue", "sales", "gross profit", "operating income", "net income"],
  equity_changes: ["\uc790\ubcf8\uae08", "\uc790\ubcf8\uc789\uc5ec\uae08", "\uc790\ubcf8\uc870\uc815", "\uae30\ud0c0\uc790\ubcf8\uad6c\uc131\uc694\uc18c", "\uc774\uc775\uc789\uc5ec\uae08", "\ube44\uc9c0\ubc30\uc9c0\ubd84", "\uae30\ucd08\uc790\ubcf8", "\uae30\ub9d0\uc790\ubcf8", "\uc790\ubcf8\ucd1d\uacc4", "\ubc30\ub2f9\uae08\uc9c0\uae09", "\uc8fc\uc2dd\ubcf4\uc0c1\ube44\uc6a9", "\uc790\uae30\uc8fc\uc2dd", "share capital", "retained earnings", "total equity"],
  cash_flow_statement: ["\uc601\uc5c5\ud65c\ub3d9\ud604\uae08\ud750\ub984", "\uc601\uc5c5\ud65c\ub3d9\uc73c\ub85c\uc778\ud55c\ud604\uae08\ud750\ub984", "\ud22c\uc790\ud65c\ub3d9\ud604\uae08\ud750\ub984", "\ud22c\uc790\ud65c\ub3d9\uc73c\ub85c\uc778\ud55c\ud604\uae08\ud750\ub984", "\uc7ac\ubb34\ud65c\ub3d9\ud604\uae08\ud750\ub984", "\uc7ac\ubb34\ud65c\ub3d9\uc73c\ub85c\uc778\ud55c\ud604\uae08\ud750\ub984", "\uc601\uc5c5\uc5d0\uc11c\ucc3d\ucd9c\ub41c\ud604\uae08", "\uc774\uc790\uc218\ucde8", "\uc774\uc790\uc9c0\uae09", "\ubc95\uc778\uc138\ub0a9\ubd80", "\uae30\ub9d0\ud604\uae08", "\uae30\ucd08\ud604\uae08", "\ud604\uae08\ubc0f\ud604\uae08\uc131\uc790\uc0b0", "operating activities", "investing activities", "financing activities"],
};

export function discoverStatementSpans(document, maxSpanPages = 3) {
  const contexts = buildScopeContext(document.pages);
  const candidates = [];
  for (const page of document.pages) {
    for (const statementType of STATEMENT_TYPES) {
      let scored = scoreStatementPage(page.text, statementType);
      if (scored.score <= 0 && hasTitle(page.text, statementType)) {
        const combined = combineSpanText(document.pages, page.pageNumber, maxSpanPages);
        scored = scoreStatementPage(combined, statementType);
      }
      if (scored.score <= 0) continue;
      const scope = inferScope(page.text, contexts.get(page.pageNumber));
      candidates.push({
        include: true,
        scope,
        statementType,
        startPage: page.pageNumber,
        endPage: inferSpanEnd(document.pages, page.pageNumber, statementType, maxSpanPages),
        score: scored.score,
        reasons: scored.reasons,
      });
    }
  }
  return dedupeCandidates(candidates).sort((a, b) => a.startPage - b.startPage || b.score - a.score);
}

function scoreStatementPage(text, statementType) {
  const segment = sliceStatementText(text, statementType);
  const normalized = normalize(segment);
  const compact = compactText(segment);
  const titleHits = findStatementTitleHits(text, statementType);
  if (!titleHits.length) return { score: 0, reasons: [] };
  const rowHits = ROW_KEYWORDS[statementType].filter((keyword) => includesKeyword(normalized, compact, keyword)).length;
  const numericCount = (normalized.match(/\(?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?/g) ?? []).length;
  if (rowHits < 1 || numericCount < 6) return { score: 0, reasons: [] };
  let score = titleHits.length * 50 + Math.min(40, rowHits * 8) + Math.min(30, numericCount);
  const reasons = [...titleHits.slice(0, 3), `statement_rows:${rowHits}`, `numeric_table:${numericCount}`];
  if (isProbableToc(normalized)) {
    score -= 180;
    reasons.push("toc_penalty");
  }
  return { score: Math.max(score, 0), reasons };
}

function buildScopeContext(pages) {
  const context = new Map();
  let current = null;
  for (const page of pages) {
    const detected = detectSectionScope(normalize(page.text));
    if (detected) current = detected;
    if (current) context.set(page.pageNumber, current);
  }
  return context;
}

function inferScope(text, contextScope) {
  const normalized = normalize(text);
  if (/\uc5f0\uacb0\s*(\ud3ec\uad04\uc7ac\ubb34\uc0c1\ud0dc\ud45c|\uc7ac\ubb34\uc0c1\ud0dc\ud45c|\ud3ec\uad04\uc190\uc775\uacc4\uc0b0\uc11c|\uc190\uc775\uacc4\uc0b0\uc11c|\uc790\ubcf8\ubcc0\ub3d9\ud45c|\ud3ec\uad04\ud604\uae08\ud750\ub984\ud45c|\ud604\uae08\ud750\ub984\ud45c)/.test(normalized)) return "consolidated";
  if (/(\uac1c\ubcc4|\ubcc4\ub3c4)\s*(\ud3ec\uad04\uc7ac\ubb34\uc0c1\ud0dc\ud45c|\uc7ac\ubb34\uc0c1\ud0dc\ud45c|\ud3ec\uad04\uc190\uc775\uacc4\uc0b0\uc11c|\uc190\uc775\uacc4\uc0b0\uc11c|\uc790\ubcf8\ubcc0\ub3d9\ud45c|\ud3ec\uad04\ud604\uae08\ud750\ub984\ud45c|\ud604\uae08\ud750\ub984\ud45c)/.test(normalized)) return "separate";
  return detectSectionScope(normalized) ?? contextScope ?? (normalized.includes("consolidated") ? "consolidated" : "unknown");
}

function detectSectionScope(text) {
  const matches = [];
  collect(matches, text, /\d+(?:-\d+)?\.\s*\uc5f0\uacb0\s*\uc7ac\ubb34\uc81c\ud45c/g, "consolidated");
  collect(matches, text, /\uc5f0\uacb0\s*\uc7ac\ubb34\uc81c\ud45c\s*\uc8fc\uc11d/g, "consolidated");
  collect(matches, text, /\d+(?:-\d+)?\.\s*(\uac1c\ubcc4|\ubcc4\ub3c4)\s*\uc7ac\ubb34\uc81c\ud45c/g, "separate");
  collect(matches, text, /\d+\.\s*\uc7ac\ubb34\uc81c\ud45c(?!\s*\uc8fc\uc11d)/g, "separate");
  collect(matches, text, /(\uac1c\ubcc4|\ubcc4\ub3c4)\s*\uc7ac\ubb34\uc81c\ud45c\s*\uc8fc\uc11d/g, "separate");
  if (!matches.length) return null;
  return matches.sort((a, b) => b.index - a.index)[0].scope;
}

function collect(matches, text, regex, scope) {
  for (const match of text.matchAll(regex)) matches.push({ index: match.index ?? 0, scope });
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  const output = [];
  for (const candidate of candidates) {
    const key = `${candidate.scope}:${candidate.statementType}:${candidate.startPage}:${candidate.endPage}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(candidate);
  }
  return output;
}

function hasTitle(text, statementType) {
  return hasStatementTitle(text, statementType);
}

function combineSpanText(pages, startPage, maxSpanPages) {
  const end = startPage + maxSpanPages - 1;
  return pages.filter((page) => page.pageNumber >= startPage && page.pageNumber <= end).map((page) => page.text).join("\n");
}

function inferSpanEnd(pages, startPage, statementType, maxSpanPages) {
  const byPage = new Map(pages.map((page) => [page.pageNumber, page]));
  const lastPageNumber = Math.max(...pages.map((page) => page.pageNumber));
  const max = Math.min(lastPageNumber, startPage + maxSpanPages - 1);
  for (let pageNumber = startPage + 1; pageNumber <= max; pageNumber += 1) {
    const text = byPage.get(pageNumber)?.text ?? "";
    if (isNonStatementSectionStart(text)) return Math.max(startPage, pageNumber - 1);
    const hasAnyTitle = hasAnyStatementTitle(text);
    if (hasAnyTitle) {
      if (hasContinuationBeforeNextStatement(text, statementType)) return pageNumber;
      return Math.max(startPage, pageNumber - 1);
    }
  }
  return max;
}

function hasContinuationBeforeNextStatement(text, statementType) {
  const segment = sliceStatementText(text, statementType);
  if (!segment.trim()) return false;
  const normalized = normalize(segment);
  const compact = compactText(segment);
  const rowHits = ROW_KEYWORDS[statementType].filter((keyword) => includesKeyword(normalized, compact, keyword)).length;
  const numericCount = (normalized.match(/\(?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?/g) ?? []).length;
  const valueLineCount = countValueLines(segment);
  return (rowHits >= 1 && numericCount >= 2) || valueLineCount >= 2;
}

function isNonStatementSectionStart(text) {
  const lines = String(text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!lines.length) return false;

  const head = normalize(lines.join(" "));
  const compactHead = compactText(lines.join(""));
  return (
    /^\d+(?:-\d+)?\.\s*(\uc5f0\uacb0\s*)?\uc7ac\ubb34\uc81c\ud45c\s*\uc8fc\uc11d/.test(head) ||
    /^(\uc5f0\uacb0\s*)?\uc7ac\ubb34\uc81c\ud45c\s*\uc8fc\uc11d/.test(head) ||
    /^\uc8fc\uc11d\b/.test(head) ||
    compactHead.startsWith("\uc8fc\uc11d") ||
    compactHead.startsWith("\uc7ac\ubb34\uc81c\ud45c\uc8fc\uc11d") ||
    compactHead.startsWith("\uc5f0\uacb0\uc7ac\ubb34\uc81c\ud45c\uc8fc\uc11d") ||
    compactHead.startsWith("\uc678\ubd80\uac10\uc0ac\uc2e4\uc2dc\ub0b4\uc6a9")
  );
}

function countValueLines(text) {
  return String(text ?? "")
    .split(/\n+/)
    .filter((line) => (line.match(/\(?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?|(?<!\d)0(?!\d)|-/g) ?? []).length >= 2)
    .length;
}

function findStatementTitleHits(text, statementType) {
  const titles = findStatementTitles(String(text ?? "").split(/\n+/)).filter((title) => title.statementType === statementType);
  return titles.length ? STATEMENT_KEYWORDS[statementType].slice(0, 1) : [];
}

function isProbableToc(text) {
  return text.includes("\ubaa9\ucc28") || text.includes("table of contents") || (text.match(/\.\.\./g) ?? []).length > 20;
}

function normalize(text) {
  return normalizeWhitespace(text);
}

function includesKeyword(normalized, compact, keyword) {
  const normalizedKeyword = keyword.toLowerCase();
  return normalized.includes(normalizedKeyword) || compact.includes(compactText(normalizedKeyword));
}
