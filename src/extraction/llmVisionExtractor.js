import { mapConcept } from "../xbrl/concepts.js";
import { normalizeAmount, normalizeUnitLabel } from "../xbrl/normalizer.js";
import { renderPagesToBase64 } from "../pdf/pageRenderer.js";
import { callLLMVisionWithFallback, chooseProvider } from "./llmClient.js";
import { parseJsonResponse } from "./jsonResponse.js";

const STATEMENT_LABELS = {
  balance_sheet: "balance sheet / statement of financial position",
  income_statement: "income statement / statement of comprehensive income",
  cash_flow_statement: "cash flow statement",
  equity_changes: "statement of changes in equity",
};

export async function extractFactsWithVision({ document, candidate, state, extractionOrderStart = 0 }) {
  const provider = chooseProvider(state);
  if (!provider) return { facts: [], usedLLM: false, message: "No API key available for vision extraction." };

  const pageNumbers = range(candidate.startPage, candidate.endPage);
  const images = await renderPagesToBase64(document, pageNumbers, 1.5);
  if (!images.length) return { facts: [], usedLLM: false, message: "Failed to render pages to images." };

  const prompt = buildVisionPrompt(document, candidate, pageNumbers);
  const { content: raw, provider: usedProvider } = await callLLMVisionWithFallback(state, prompt, images, {
    purpose: "vision extraction",
    systemMessage: buildSystemMessage(),
    maxOutputTokens: 16_384,
    temperature: 0,
  });

  const facts = parsedToFacts(document, candidate, parseJsonResponse(raw), extractionOrderStart);
  return {
    facts,
    usedLLM: facts.length > 0,
    message: facts.length
      ? `${usedProvider.name}/${usedProvider.model} vision extracted ${facts.length} rows from ${candidate.statementType}.`
      : "Vision extraction returned no usable rows.",
  };
}

function buildSystemMessage() {
  return [
    "You are an expert Korean financial statement extractor.",
    "You receive rendered PDF page images from Korean audit reports, annual reports, and corporate tax adjustment reports.",
    "Extract financial statement tables exactly as presented.",
    "Return only valid JSON. Do not return markdown, commentary, or explanations.",
  ].join(" ");
}

function buildVisionPrompt(document, candidate, pageNumbers) {
  const statementLabel = STATEMENT_LABELS[candidate.statementType] || candidate.statementType;
  const scopeLabel = candidate.scope === "consolidated" ? "consolidated" : candidate.scope === "separate" ? "separate" : "unknown scope";

  return [
    "Extract ALL account rows from the target financial statement in the attached page images.",
    "",
    "Document:",
    `- Filename: ${document.filename}`,
    `- Pages: ${pageNumbers.join(", ")} of ${document.pageCount}`,
    `- Target statement_type: ${candidate.statementType} (${statementLabel})`,
    `- Scope: ${scopeLabel}`,
    "",
    "Rules:",
    "1. Extract every visible account row in the target statement table, including subtotals, totals, and indented sub-items.",
    "2. Preserve original Korean account labels exactly as shown. Do not translate, summarize, abbreviate, or rewrite labels.",
    "3. Extract numeric values exactly as printed. Preserve commas, parentheses, minus signs, dashes, and blank cells.",
    "4. Do not calculate, normalize, round, or infer missing numbers.",
    "5. Identify the unit shown in the statement header, such as KRW, won, thousand KRW, million KRW, or hundred million KRW.",
    candidate.statementType === "equity_changes"
      ? "6. This is a statement of changes in equity. Its columns are equity component columns, not year columns. Extract every displayed equity component column exactly as shown. Dates and period labels such as 2025.01.01, 2025.12.31, current period, prior period, beginning balance, and ending balance are ROW LABELS, not column labels."
      : "6. Identify all displayed period columns and use stable keys such as 2025, 2024, current, prior, or prior_2.",
    "7. If account labels include note references, put note numbers in notes and keep the label clean.",
    "8. Treat multi-page statements as one continuous table. Do not restart order on later pages.",
    "9. Exclude title rows, unit rows, period header rows, page footers, and note narrative sections.",
    "10. Preserve hierarchy using depth: 0 for top-level rows, 1 for indented rows, 2 for deeper rows.",
    "11. If a label wraps across lines or values appear on the next visual line, return one combined row.",
    candidate.statementType === "cash_flow_statement"
      ? "12. For cash_flow_statement, extract only the cash flow table rows from operating activities through the ending cash/cash-equivalents row. If financial statement notes appear on the same page before or after remaining cash flow rows, ignore note headings, note narrative, shareholder tables, accounting policy tables, and all note-only tables."
      : "12. Do not include rows from another statement or from notes even if they are visible on the same page.",
    candidate.statementType === "equity_changes"
      ? "13. For equity_changes, the first visible text column such as 구분 or 과목 is the row label column. Do not include it in columns. The columns array must start with the first numeric equity component column, for example 자본금, 자본잉여금, 자본조정, 기타자본구성요소, 기타포괄손익누계액, 이익잉여금, 비지배지분, 자본총계, or 총계. If the header is split across multiple lines, combine the split header text into one column label."
      : "13. For non-equity statements, use the displayed period headers as columns.",
    "",
    "Return this strict JSON shape only:",
    JSON.stringify({
      unit: "KRW | won | thousand_KRW | million_KRW | hundred_million_KRW",
      columns: candidate.statementType === "equity_changes"
        ? [
          { key: "share_capital", label: "자본금" },
          { key: "capital_surplus", label: "자본잉여금" },
          { key: "retained_earnings", label: "이익잉여금" },
          { key: "total_equity", label: "자본총계" },
        ]
        : [
          { key: "2025", label: "column label exactly as displayed" },
          { key: "2024", label: "column label exactly as displayed" },
        ],
      rows: [
        {
          order: 1,
          label: "original Korean account label",
          depth: 0,
          notes: ["5"],
          values: candidate.statementType === "equity_changes"
            ? {
              share_capital: "1,234,567",
              capital_surplus: "987,654",
              retained_earnings: "(456,789)",
              total_equity: "1,765,432",
            }
            : {
              "2025": "1,234,567",
              "2024": "(456,789)",
            },
        },
      ],
    }),
  ].join("\n");
}

function parsedToFacts(document, candidate, parsed, extractionOrderStart) {
  if (!parsed || !Array.isArray(parsed.rows)) return [];

  const unit = normalizeUnitLabel(parsed.unit);
  const columns = Array.isArray(parsed.columns) ? parsed.columns.filter((column) => column?.key) : [];
  const facts = [];
  let extractionOrder = extractionOrderStart;

  for (const row of parsed.rows) {
    const label = String(row.label ?? "").trim();
    if (!label) continue;

    const values = row.values ?? {};
    const allValues = columns.map((column) => String(values[column.key] ?? ""));
    if (!allValues.some((value) => value && value !== "-")) continue;

    const firstValue = allValues.find((value) => value !== "") ?? "";
    facts.push({
      documentId: document.id,
      filename: document.filename,
      scope: candidate.scope,
      statementType: candidate.statementType,
      concept: mapConcept(label),
      label,
      period: columns[0]?.key ?? "",
      value: normalizeAmount(firstValue, unit),
      unit,
      pageNumber: candidate.startPage,
      confidence: 0.92,
      rawLine: "",
      allValues,
      periodLabels: columns.map((column) => column.key),
      columnLabels: columns.map((column) => column.label || column.key),
      notes: Array.isArray(row.notes) ? row.notes.map(String).filter(Boolean) : [],
      evidence: { source: "vision", depth: Number(row.depth ?? 0) },
      extractionOrder,
    });
    extractionOrder += 1;
  }

  return facts;
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
}
