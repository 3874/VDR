import { mapConcept } from "../xbrl/concepts.js";
import { normalizeAmount } from "../xbrl/normalizer.js";
import { callLLMJsonWithFallback, chooseProvider } from "./llmClient.js";
import { buildTableEvidencePages } from "./tableEvidence.js";
import { normalizeAndValidateStructure, parseStructureResponse } from "./structureSchema.js";

export async function extractFactsWithLLMStructure({ document, candidate, pages, state, extractionOrderStart = 0 }) {
  const provider = chooseProvider(state);
  if (!provider) return { facts: [], usedLLM: false, message: "No API key available for structure extraction." };
  if (!pages.some((page) => Array.isArray(page.itemRows) && page.itemRows.length)) {
    return { facts: [], usedLLM: false, message: "No PDF.js item rows available for structure extraction." };
  }

  const payload = {
    filename: document.filename,
    statement_type: candidate.statementType,
    scope: candidate.scope,
    start_page: candidate.startPage,
    end_page: candidate.endPage,
    pages: buildTableEvidencePages(pages),
  };

  const prompt = buildPrompt(payload);
  const { content: raw, provider: usedProvider } = await callLLMJsonWithFallback(state, prompt, {
    purpose: "structure extraction",
    systemMessage: "Return only valid JSON. Never output extracted numeric values; output source cell references only.",
    maxOutputTokens: 16_384,
  });
  const structure = normalizeAndValidateStructure(parseStructureResponse(raw), pages);
  const facts = structureToFacts(document, candidate, pages, structure, extractionOrderStart);
  return {
    facts,
    usedLLM: facts.length > 0,
    message: facts.length
      ? `${usedProvider.name}/${usedProvider.model} structure extracted ${facts.length} verified rows${structure.warnings?.length ? ` with ${structure.warnings.length} validation warning(s)` : ""}.`
      : "LLM structure returned no verified rows.",
  };
}

function buildPrompt(payload) {
  return [
    "You are a financial statement table-structure extractor.",
    "Input is PDF.js layout evidence: pages, rows, cells, row_index, cell_index, x/y positions, row kind, and text.",
    "Each page may include column_bands. A numeric cell may include value_column when its x position aligns with a detected period column.",
    "Task: identify the rows belonging to the requested Korean financial statement and return only table structure.",
    "Never invent, calculate, normalize, translate, or rewrite numeric values.",
    "Do not output numeric values directly. Output cell references only.",
    "Use only supplied cells. If a displayed value is split across cells, include all cell_indices in visual reading order.",
    "Some account rows are visually wrapped across multiple PDF.js rows. If an account label appears on one row and its numeric values appear on the next row, treat them as one financial statement row when the numeric cells align with the period column_bands.",
    "If a label or note is on one row and values are on a following wrapped row, use the value row's source cell references in value_cells and keep one combined output row.",
    "Do not create separate output rows for wrapped continuation text or value-only rows.",
    "Keep original Korean account labels as shown. Put note numbers in notes, not in label.",
    payload.statement_type === "equity_changes"
      ? "For statement_type equity_changes, columns are equity component columns, not period columns. Dates and period labels are row labels, not column labels. Preserve every displayed equity component column label exactly as shown. If header text is split across rows, combine the split header text into one column label."
      : "For non-equity statements, columns are displayed period columns.",
    "Exclude title rows, unit rows, period headers, DART page footers, note narrative sections, and subtotal labels without values.",
    "If multiple statements are present in the page range, extract only the requested statement_type and ignore the others.",
    payload.statement_type === "cash_flow_statement"
      ? "For cash_flow_statement, extract only cash flow rows from operating activities through the ending cash/cash-equivalents row. Ignore financial statement notes even when note headings appear on the same page as the last cash flow rows."
      : "Ignore note-only rows and rows belonging to other statements.",
    "Return strict JSON only. No markdown or explanation.",
    "Required JSON schema:",
    JSON.stringify({
      unit: "KRW | thousand_KRW | million_KRW | other",
      columns: payload.statement_type === "equity_changes"
        ? [{ key: "share_capital", label: "자본금" }, { key: "retained_earnings", label: "이익잉여금" }, { key: "total_equity", label: "자본총계" }]
        : [{ key: "2025", label: "current period label" }],
      rows: [
        {
          order: 1,
          label: "account label exactly as shown",
          notes: ["16"],
          value_cells: {
            "2025": { page: 1, row_index: 10, cell_indices: [2] },
            "2024": { page: 1, row_index: 10, cell_indices: [3] },
          },
        },
      ],
    }),
    "Input JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

function structureToFacts(document, candidate, pages, structure, extractionOrderStart) {
  const pageMap = new Map(pages.map((page) => [page.pageNumber, page]));
  const columns = structure.columns;
  let extractionOrder = extractionOrderStart;
  const facts = [];

  for (const row of [...structure.rows].sort((a, b) => a.order - b.order)) {
    const rawValues = {};
    const evidence = {};
    for (const column of columns) {
      const ref = row.valueCells[column.key];
      const read = readCellReference(pageMap, ref);
      rawValues[column.key] = read.text;
      evidence[column.key] = read.evidence;
    }
    const allValues = columns.map((column) => rawValues[column.key] ?? "");
    if (!allValues.some((value) => value)) continue;
    const firstValue = allValues.find((value) => value) ?? "";
    facts.push({
      documentId: document.id,
      filename: document.filename,
      scope: candidate.scope,
      statementType: candidate.statementType,
      concept: mapConcept(row.label),
      label: row.label,
      period: columns[0]?.key ?? "",
      value: normalizeAmount(firstValue, structure.unit),
      unit: structure.unit,
      pageNumber: firstEvidencePage(evidence) ?? candidate.startPage,
      confidence: 0.88,
      rawLine: "",
      allValues,
      periodLabels: columns.map((column) => column.key),
      columnLabels: columns.map((column) => column.label || column.key),
      notes: row.notes,
      evidence,
      extractionOrder,
    });
    extractionOrder += 1;
  }

  return facts;
}

function readCellReference(pageMap, ref) {
  const pageNumber = Number(ref?.page);
  const rowIndex = Number(ref?.row_index);
  const cellIndices = Array.isArray(ref?.cell_indices) ? ref.cell_indices.map(Number) : [];
  const page = pageMap.get(pageNumber);
  const row = page?.itemRows?.find((item) => item.rowIndex === rowIndex);
  if (!row || !cellIndices.length) return { text: "", evidence: null };
  const cells = cellIndices
    .map((cellIndex) => row.cells.find((cell) => cell.cellIndex === cellIndex))
    .filter(Boolean);
  if (!cells.length) return { text: "", evidence: null };
  return {
    text: cells.map((cell) => cell.text).join("").trim(),
    evidence: {
      page: pageNumber,
      row_index: rowIndex,
      cell_indices: cells.map((cell) => cell.cellIndex),
      text: cells.map((cell) => cell.text).join("").trim(),
      bbox: cellsToBbox(cells),
    },
  };
}

function firstEvidencePage(evidence) {
  const first = Object.values(evidence ?? {}).find(Boolean);
  return first?.page ?? null;
}

function cellsToBbox(cells) {
  const x1 = Math.min(...cells.map((cell) => cell.x));
  const y1 = Math.min(...cells.map((cell) => cell.y));
  const x2 = Math.max(...cells.map((cell) => cell.x + (cell.width ?? 0)));
  const y2 = Math.max(...cells.map((cell) => cell.y + (cell.height ?? 0)));
  return [round(x1), round(y1), round(x2), round(y2)];
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
