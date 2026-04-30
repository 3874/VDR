import { callLLMJson, chooseProvider } from "./llmClient.js";
import { parseJsonResponse } from "./jsonResponse.js";

const ALLOWED_TYPES = new Set(["balance_sheet", "income_statement", "cash_flow_statement", "equity_changes"]);
const ALLOWED_SCOPES = new Set(["consolidated", "separate", "unknown"]);

export async function refineStatementCandidatesWithLLM(document, heuristicCandidates, state, documentReview = null) {
  const provider = chooseProvider(state);
  if (!provider || !heuristicCandidates.length) {
    return { candidates: heuristicCandidates, usedLLM: false, message: provider ? "" : "No API key available for LLM segment refinement." };
  }

  const broadPages = collectBroadPages(document, heuristicCandidates, state.analysis.maxPages, documentReview);
  if (!broadPages.length) {
    return { candidates: heuristicCandidates, usedLLM: false, message: "No broad pages available for LLM segment refinement." };
  }

  const payload = {
    filename: document.filename,
    page_count: document.pageCount,
    allowed_statement_types: [...ALLOWED_TYPES],
    broad_pages: broadPages.map((page) => ({
      page_number: page.pageNumber,
      text: truncatePageText(page.text),
    })),
    toc_statement_evidence: collectTocStatementEvidence(documentReview),
    heuristic_candidates: heuristicCandidates.map((candidate) => ({
      statement_type: candidate.statementType,
      scope: candidate.scope,
      start_page: candidate.startPage,
      end_page: candidate.endPage,
      score: candidate.score,
    })),
  };

  const raw = await callLLMJson(provider, buildPrompt(payload), { purpose: `${provider.name} segment refinement` });
  const refined = widenWithHeuristicRanges(normalizeSegments(parseJsonResponse(raw), document), heuristicCandidates);
  return {
    candidates: refined.length ? refined : heuristicCandidates,
    usedLLM: refined.length > 0,
    message: refined.length ? `LLM refined ${refined.length} statement segment(s).` : "LLM returned no usable segments.",
  };
}

function collectBroadPages(document, candidates, maxPagesSetting, documentReview = null) {
  const maxPages = Math.max(1, Number(maxPagesSetting || 80));
  const range = chooseBroadRange(document, candidates, documentReview);
  const pageNumbers = [];
  for (let pageNumber = range.start; pageNumber <= range.end && pageNumbers.length < maxPages; pageNumber += 1) {
    pageNumbers.push(pageNumber);
  }
  return pageNumbers
    .map((pageNumber) => document.pages.find((page) => page.pageNumber === pageNumber))
    .filter(Boolean);
}

function chooseBroadRange(document, candidates, documentReview) {
  const tocPages = collectStatementPagesFromToc(documentReview);
  const candidateStarts = candidates.map((candidate) => candidate.startPage);
  const candidateEnds = candidates.map((candidate) => candidate.endPage);
  const allStarts = [...candidateStarts, ...tocPages];
  const allEnds = [...candidateEnds, ...tocPages];
  if (!allStarts.length || !allEnds.length) return { start: 1, end: Math.min(document.pageCount, 20) };
  return {
    start: Math.max(1, Math.min(...allStarts) - 2),
    end: Math.min(document.pageCount, Math.max(...allEnds) + 2),
  };
}

function collectStatementPagesFromToc(documentReview) {
  return collectTocStatementEvidence(documentReview)
    .map((entry) => entry.found_page ?? entry.expected_page)
    .filter((pageNumber) => Number.isInteger(pageNumber));
}

function collectTocStatementEvidence(documentReview) {
  const checks = documentReview?.tocChecks ?? [];
  return checks
    .filter((entry) => isStatementLikeTitle(entry.title))
    .map((entry) => ({
      title: entry.title,
      expected_page: Number.isInteger(entry.expectedPage) ? entry.expectedPage : null,
      found_page: Number.isInteger(entry.foundPage) ? entry.foundPage : null,
      status: entry.status,
    }));
}

function isStatementLikeTitle(title) {
  const compact = String(title ?? "").replace(/\s+/g, "");
  return (
    compact.includes("\uc7ac\ubb34\uc0c1\ud0dc\ud45c") ||
    compact.includes("\uc190\uc775\uacc4\uc0b0\uc11c") ||
    compact.includes("\ud604\uae08\ud750\ub984\ud45c") ||
    compact.includes("\uc790\ubcf8\ubcc0\ub3d9\ud45c")
  );
}

function buildPrompt(payload) {
  return [
    "You are reviewing text extracted from Korean audit reports and annual reports.",
    "Your task is ONLY to split the supplied broad page range into financial statement segments.",
    "Do not extract account rows or amounts. Do not calculate anything.",
    "Return only strict JSON. No markdown.",
    "Only use these statement_type values: balance_sheet, income_statement, cash_flow_statement, equity_changes.",
    "The supplied pages may contain multiple statements, continuation rows, section headings, and notes. Split only the four target financial statements.",
    "A section heading such as '2-3. 연결 자본변동표' is not necessarily the actual start if previous statement rows appear below it. Use the actual statement title or first continuation row as the segment boundary.",
    "If a statement continues from a previous supplied page, use the first supplied continuation page as start_page.",
    "Use anchors copied from the supplied text when possible.",
    "Schema:",
    JSON.stringify({
      segments: [
        {
          statement_type: "balance_sheet",
          scope: "consolidated | separate | unknown",
          start_page: 1,
          end_page: 2,
          start_anchor: "statement title or first row",
          end_anchor: "next statement title or last row",
          confidence: 0.9,
          reason: "short reason",
        },
      ],
    }),
    "Input:",
    JSON.stringify(payload),
  ].join("\n");
}

function normalizeSegments(parsed, document) {
  const segments = Array.isArray(parsed?.segments) ? parsed.segments : [];
  return dedupeSegments(segments
    .map((segment) => normalizeSegment(segment, document))
    .filter(Boolean))
    .sort((a, b) => a.startPage - b.startPage || b.score - a.score);
}

function normalizeSegment(segment, document) {
  const statementType = String(segment.statement_type ?? "");
  if (!ALLOWED_TYPES.has(statementType)) return null;
  const startPage = clampPage(Number(segment.start_page), document);
  const endPage = clampPage(Number(segment.end_page), document);
  if (!startPage || !endPage) return null;
  const scope = ALLOWED_SCOPES.has(segment.scope) ? segment.scope : "unknown";
  const confidence = Number(segment.confidence);
  return {
    include: true,
    scope,
    statementType,
    startPage: Math.min(startPage, endPage),
    endPage: Math.max(startPage, endPage),
    score: Math.round((Number.isFinite(confidence) ? confidence : 0.7) * 100),
    reasons: ["llm_segmenter", segment.reason || "", segment.start_anchor || "", segment.end_anchor || ""].filter(Boolean),
  };
}

function clampPage(value, document) {
  if (!Number.isInteger(value)) return null;
  return Math.min(document.pageCount, Math.max(1, value));
}

function dedupeSegments(segments) {
  const seen = new Set();
  return segments.filter((segment) => {
    const key = `${segment.scope}:${segment.statementType}:${segment.startPage}:${segment.endPage}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function widenWithHeuristicRanges(refined, heuristicCandidates) {
  return refined.map((segment) => {
    const overlaps = heuristicCandidates.filter((candidate) =>
      candidate.statementType === segment.statementType &&
      rangesOverlap(candidate.startPage, candidate.endPage, segment.startPage, segment.endPage)
    );
    if (!overlaps.length) return segment;
    return {
      ...segment,
      startPage: Math.min(segment.startPage, ...overlaps.map((candidate) => candidate.startPage)),
      endPage: Math.max(segment.endPage, ...overlaps.map((candidate) => candidate.endPage)),
      reasons: [...segment.reasons, "widened_with_heuristic_range"],
    };
  });
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

function truncatePageText(text) {
  const value = String(text ?? "");
  return value.length > 12000 ? `${value.slice(0, 12000)}\n[TRUNCATED]` : value;
}
