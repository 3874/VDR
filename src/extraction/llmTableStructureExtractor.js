import { mapConcept } from "../xbrl/concepts.js";
import { normalizeAmount } from "../xbrl/normalizer.js";
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

  const raw = provider.name === "openai"
    ? await callOpenAI(provider, buildPrompt(payload))
    : await callGemini(provider, buildPrompt(payload));
  const structure = normalizeAndValidateStructure(parseStructureResponse(raw), pages);
  const facts = structureToFacts(document, candidate, pages, structure, extractionOrderStart);
  return {
    facts,
    usedLLM: facts.length > 0,
    message: facts.length
      ? `LLM structure extracted ${facts.length} verified rows${structure.warnings?.length ? ` with ${structure.warnings.length} validation warning(s)` : ""}.`
      : "LLM structure returned no verified rows.",
  };
}

function buildPrompt(payload) {
  return [
    "You are a financial statement table-structure extractor.",
    "Input is PDF.js layout evidence: pages, rows, cells, row_index, cell_index, x/y positions, row kind, and text.",
    "Task: identify the rows belonging to the requested Korean financial statement and return only table structure.",
    "Never invent, calculate, normalize, translate, or rewrite numeric values.",
    "Do not output numeric values directly. Output cell references only.",
    "Use only supplied cells. If a displayed value is split across cells, include all cell_indices in visual reading order.",
    "Keep original Korean account labels as shown. Put note numbers in notes, not in label.",
    "Exclude title rows, unit rows, period headers, DART page footers, note narrative sections, and subtotal labels without values.",
    "If multiple statements are present in the page range, extract only the requested statement_type and ignore the others.",
    "Return strict JSON only. No markdown or explanation.",
    "Required JSON schema:",
    JSON.stringify({
      unit: "KRW | thousand_KRW | million_KRW | other",
      columns: [{ key: "2025", label: "current period label" }],
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

function chooseProvider(state) {
  const configured = state.analysis.provider;
  if (configured === "openai" && state.apiKeys.openai) return { name: "openai", apiKey: state.apiKeys.openai, model: state.analysis.openaiModel || "gpt-4o-mini" };
  if (configured === "gemini" && state.apiKeys.gemini) return { name: "gemini", apiKey: state.apiKeys.gemini, model: state.analysis.geminiModel || "gemini-2.5-flash" };
  if (state.apiKeys.openai) return { name: "openai", apiKey: state.apiKeys.openai, model: state.analysis.openaiModel || "gpt-4o-mini" };
  if (state.apiKeys.gemini) return { name: "gemini", apiKey: state.apiKeys.gemini, model: state.analysis.geminiModel || "gemini-2.5-flash" };
  return null;
}

async function callOpenAI(provider, prompt) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${provider.apiKey}` },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "Return only valid JSON. Never output extracted numeric values; output source cell references only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!response.ok) throw new Error(`OpenAI structure extraction failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(provider, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(provider.model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      generationConfig: { temperature: 0, responseMimeType: "application/json" },
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });
  if (!response.ok) throw new Error(`Gemini structure extraction failed: ${response.status} ${await response.text()}`);
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
