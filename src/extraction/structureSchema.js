import { buildCellLookup, cellReferenceExists } from "./tableEvidence.js";
import { parseJsonResponse } from "./jsonResponse.js";
import { normalizeUnitLabel } from "../xbrl/normalizer.js";

export function parseStructureResponse(raw) {
  return parseJsonResponse(raw);
}

export function normalizeAndValidateStructure(parsed, pages) {
  const structure = {
    unit: normalizeUnitLabel(parsed?.unit),
    columns: normalizeColumns(parsed?.columns),
    rows: [],
    warnings: [],
  };
  const lookup = buildCellLookup(pages);
  const rows = Array.isArray(parsed?.rows) ? parsed.rows : [];

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    if (!row) {
      structure.warnings.push("Dropped row without label or value_cells.");
      continue;
    }
    const validCells = {};
    for (const [columnKey, ref] of Object.entries(row.valueCells)) {
      if (cellReferenceExists(lookup, ref)) {
        validCells[columnKey] = {
          page: Number(ref.page),
          row_index: Number(ref.row_index),
          cell_indices: ref.cell_indices.map(Number),
        };
      } else {
        structure.warnings.push(`Dropped invalid cell reference for ${row.label} / ${columnKey}.`);
      }
    }
    if (!Object.keys(validCells).length) continue;
    structure.rows.push({ ...row, valueCells: validCells });
  }

  if (!structure.columns.length) structure.columns = inferColumnsFromRows(structure.rows);
  structure.columns = structure.columns.filter((column) => structure.rows.some((row) => row.valueCells[column.key]));
  return structure;
}

function normalizeColumns(columns) {
  if (!Array.isArray(columns)) return [];
  return columns
    .map((column) => {
      const key = String(column?.key ?? "").trim();
      if (!key) return null;
      return { key, label: String(column?.label ?? key).trim() };
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeRow(row) {
  const label = cleanLabel(row?.label);
  if (!label || !row?.value_cells || typeof row.value_cells !== "object") return null;
  return {
    order: Number.isFinite(Number(row.order)) ? Number(row.order) : 0,
    label,
    notes: Array.isArray(row.notes) ? row.notes.map(String).map((note) => note.trim()).filter(Boolean) : [],
    valueCells: row.value_cells,
  };
}

function inferColumnsFromRows(rows) {
  const keys = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row.valueCells ?? {})) keys.add(key);
  }
  return [...keys].map((key) => ({ key, label: key }));
}

function cleanLabel(label) {
  return String(label ?? "")
    .replace(/^[IVXLCDM\u2160-\u217f]+[.)\s]+/i, "")
    .replace(/^[\u2460-\u2473\u2776-\u277f]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

