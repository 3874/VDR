import { compactText } from "./textNormalize.js";

const REPORT_PATTERNS = {
  annual_report: [
    "\uc0ac\uc5c5\ubcf4\uace0\uc11c",
    "\ubc18\uae30\ubcf4\uace0\uc11c",
    "\ubd84\uae30\ubcf4\uace0\uc11c",
    "annual report",
  ],
  audit_report: [
    "\ub3c5\ub9bd\ub41c\uac10\uc0ac\uc778\uc758\uac10\uc0ac\ubcf4\uace0\uc11c",
    "\ub3c5\ub9bd\ub41c\uac10\uc0ac\uc778\uc758\uac80\ud1a0\ubcf4\uace0\uc11c",
    "\uac10\uc0ac\ubcf4\uace0\uc11c",
    "independent auditor",
    "audit report",
  ],
};

const REQUIRED_SECTIONS = {
  annual_report: [
    "\ud68c\uc0ac\uc758\uac1c\uc694",
    "\uc0ac\uc5c5\uc758\ub0b4\uc6a9",
    "\uc7ac\ubb34\uc5d0\uad00\ud55c\uc0ac\ud56d",
    "\uc774\uc0ac\ud68c",
    "\uc8fc\uc8fc",
    "\uc784\uc6d0",
    "\uacc4\uc5f4\ud68c\uc0ac",
    "\uc0c1\uc138\ud45c",
  ],
  audit_report: [
    "\ub3c5\ub9bd\ub41c\uac10\uc0ac\uc778\uc758\uac10\uc0ac\ubcf4\uace0\uc11c",
    "\uac10\uc0ac\uc758\uacac",
    "\uc7ac\ubb34\uc0c1\ud0dc\ud45c",
    "\ud3ec\uad04\uc190\uc775\uacc4\uc0b0\uc11c",
    "\uc190\uc775\uacc4\uc0b0\uc11c",
    "\uc790\ubcf8\ubcc0\ub3d9\ud45c",
    "\ud604\uae08\ud750\ub984\ud45c",
    "\uc8fc\uc11d",
  ],
};

export function reviewDocumentStructure(document) {
  const type = classifyReport(document);
  const toc = findTableOfContents(document);
  const expected = REQUIRED_SECTIONS[type.type] ?? [];
  const excludedPages = new Set(toc.pageNumbers ?? []);
  const sectionChecks = expected.map((section) => findSection(document, section, excludedPages));
  const tocChecks = toc.entries.map((entry) => checkTocEntry(document, entry, excludedPages));
  const issues = buildIssues(type, toc, sectionChecks, tocChecks);

  return {
    documentId: document.id,
    filename: document.filename,
    reportType: type.type,
    confidence: type.confidence,
    typeReasons: type.reasons,
    toc,
    expectedSections: sectionChecks,
    tocChecks,
    issues,
  };
}

function classifyReport(document) {
  const firstPages = document.pages.slice(0, Math.min(12, document.pages.length));
  const text = compactText(firstPages.map((page) => page.text).join("\n"));
  const scores = Object.entries(REPORT_PATTERNS).map(([type, patterns]) => {
    const hits = patterns.filter((pattern) => text.includes(compactText(pattern)));
    return { type, hits, score: hits.length };
  });
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  if (!best || best.score === 0) {
    return { type: "unknown", confidence: 0, reasons: [] };
  }
  return {
    type: best.type,
    confidence: Math.min(0.95, 0.45 + best.score * 0.2),
    reasons: best.hits,
  };
}

function findTableOfContents(document) {
  const maxPages = Math.min(20, document.pages.length);
  const candidates = document.pages.slice(0, maxPages).map((page) => {
    const text = page.text;
    const compact = compactText(text);
    const titleHit = compact.includes("\ubaa9\ucc28") || compact.includes("contents");
    const pageRefCount = countPageReferenceLines(text);
    const score = (titleHit ? 50 : 0) + Math.min(50, pageRefCount * 5);
    return { page, score, titleHit, pageRefCount };
  });
  const best = candidates.sort((a, b) => b.score - a.score)[0];
  if (!best || best.score < 20) {
    return { exists: false, pageNumber: null, pageNumbers: [], entries: [], confidence: 0 };
  }
  const tocPages = collectTocPages(document, best.page.pageNumber);
  const entries = parseTocEntries(tocPages.map((page) => page.text).join("\n"));
  return {
    exists: true,
    pageNumber: best.page.pageNumber,
    pageNumbers: tocPages.map((page) => page.pageNumber),
    entries,
    confidence: Math.min(0.95, best.score / 100),
  };
}

function collectTocPages(document, startPage) {
  const pages = [];
  for (let pageNumber = startPage; pageNumber <= Math.min(document.pageCount, startPage + 2); pageNumber += 1) {
    const page = document.pages.find((item) => item.pageNumber === pageNumber);
    if (!page) continue;
    if (pageNumber !== startPage && countPageReferenceLines(page.text) < 3) break;
    pages.push(page);
  }
  return pages;
}

function parseTocEntries(text) {
  const entries = [];
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line || compactText(line) === "\ubaa9\ucc28") continue;
    const match = line.match(/^(.{2,100}?)(?:\.{2,}|\s{2,}|\s)\s*(\d{1,4})$/);
    if (!match) continue;
    const title = cleanTocTitle(match[1]);
    const page = Number(match[2]);
    if (!title || Number.isNaN(page)) continue;
    entries.push({ title, expectedPage: page });
  }
  return dedupeEntries(entries).slice(0, 120);
}

function checkTocEntry(document, entry, excludedPages = new Set()) {
  const titleKey = compactText(entry.title);
  const likely = findPageNearExpected(document, entry, excludedPages);
  const exact = likely ?? findPageByCompactText(document, titleKey, excludedPages);
  const loose = exact ?? findPageByLooseTokens(document, entry.title, excludedPages);
  return {
    ...entry,
    found: Boolean(loose),
    foundPage: loose?.pageNumber ?? null,
    status: loose ? pageMatchStatus(entry.expectedPage, loose.pageNumber) : "missing",
  };
}

function findSection(document, section, excludedPages = new Set()) {
  const page = findPageByCompactText(document, compactText(section), excludedPages);
  return {
    section,
    found: Boolean(page),
    pageNumber: page?.pageNumber ?? null,
  };
}

function findPageByCompactText(document, needle, excludedPages = new Set()) {
  if (!needle) return null;
  return document.pages.find((page) => isValidSectionPage(page, needle, excludedPages)) ?? null;
}

function findPageByLooseTokens(document, title, excludedPages = new Set()) {
  const tokens = compactText(title)
    .split(/[.()/\-\d]+/)
    .filter((token) => token.length >= 2)
    .slice(0, 4);
  if (!tokens.length) return null;
  return document.pages.find((page) => {
    const compact = compactText(page.text);
    return isValidSectionPage(page, tokens.join(""), excludedPages) && tokens.every((token) => compact.includes(token));
  }) ?? null;
}

function findPageNearExpected(document, entry, excludedPages = new Set()) {
  const titleKey = compactText(entry.title);
  if (!titleKey || !Number.isInteger(entry.expectedPage)) return null;
  const offsets = [0, 1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
  for (const offset of offsets) {
    const pageNumber = entry.expectedPage + offset;
    const page = document.pages.find((item) => item.pageNumber === pageNumber);
    if (page && isValidSectionPage(page, titleKey, excludedPages)) return page;
  }
  return null;
}

function isValidSectionPage(page, needle, excludedPages = new Set()) {
  if (!page || excludedPages.has(page.pageNumber)) return false;
  if (isFinancialStatementTitle(needle)) return hasStandaloneFinancialStatementTitle(page.text, needle);
  const compact = compactText(page.text);
  if (!compact.includes(needle)) return false;
  if (isLikelyReferencePage(compact, needle)) return false;
  return true;
}

function isLikelyReferencePage(compact, needle) {
  if (isFinancialStatementTitle(needle)) {
    const index = compact.indexOf(needle);
    if (index > 1200) return true;
    const before = compact.slice(Math.max(0, index - 80), index);
    if (before.includes("\uacf5\uc815\ud45c\uc2dc") || before.includes("\uc8fc\uc11d") || before.includes("\uac10\uc0ac\uc758\uacac")) return true;
  }
  return false;
}

function isFinancialStatementTitle(value) {
  return [
    "\uc7ac\ubb34\uc0c1\ud0dc\ud45c",
    "\ud3ec\uad04\uc190\uc775\uacc4\uc0b0\uc11c",
    "\uc190\uc775\uacc4\uc0b0\uc11c",
    "\uc790\ubcf8\ubcc0\ub3d9\ud45c",
    "\ud604\uae08\ud750\ub984\ud45c",
  ].includes(value);
}

function hasStandaloneFinancialStatementTitle(text, needle) {
  return String(text ?? "").split(/\n+/).some((line) => {
    const compact = compactText(line).replace(/^\d+(?:-\d+)?\./, "");
    if (compact.includes("\uc8fc\uc11d") || compact.length > 40) return false;
    return compact === needle ||
      compact === `\uc5f0\uacb0${needle}` ||
      compact === `\uac1c\ubcc4${needle}` ||
      compact === `\ubcc4\ub3c4${needle}` ||
      compact === `\ud3ec\uad04${needle}` ||
      compact === `\uc5f0\uacb0\ud3ec\uad04${needle}`;
  });
}

function pageMatchStatus(expectedPage, foundPage) {
  if (expectedPage === foundPage) return "matched";
  if (Math.abs(expectedPage - foundPage) <= 2) return "near";
  return "page_mismatch";
}

function buildIssues(type, toc, sectionChecks, tocChecks) {
  const issues = [];
  if (type.type === "unknown") {
    issues.push({ severity: "high", message: "Document type could not be identified as audit report or annual report." });
  }
  if (!toc.exists) {
    issues.push({ severity: "medium", message: "No table of contents was detected in the first 20 pages." });
  } else if (!toc.entries.length) {
    issues.push({ severity: "medium", message: "A table of contents page was detected, but structured entries could not be parsed." });
  }
  for (const section of sectionChecks.filter((item) => !item.found)) {
    issues.push({ severity: "medium", message: `Expected section not found: ${section.section}` });
  }
  for (const entry of tocChecks.filter((item) => item.status === "missing" || item.status === "page_mismatch").slice(0, 20)) {
    issues.push({ severity: "low", message: `TOC entry check failed: ${entry.title}` });
  }
  return issues;
}

function countPageReferenceLines(text) {
  return text.split(/\n+/).filter((line) => /\d{1,4}\s*$/.test(line.trim()) && line.trim().length > 3).length;
}

function cleanTocTitle(title) {
  return title
    .replace(/^[IVXLCDM\u2160-\u217f\d]+[.)\s-]*/i, "")
    .replace(/^[\u2460-\u2473\u2776-\u277f]\s*/, "")
    .replace(/[-–—.\s]+$/g, "")
    .trim();
}

function dedupeEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${compactText(entry.title)}:${entry.expectedPage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

