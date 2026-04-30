const MAX_ROWS_PER_PAGE = 140;
const MAX_CELLS_PER_ROW = 18;

export function buildTableEvidencePages(pages, options = {}) {
  const maxRows = options.maxRows ?? MAX_ROWS_PER_PAGE;
  const maxCells = options.maxCells ?? MAX_CELLS_PER_ROW;
  return pages.map((page) => {
    const rows = (page.itemRows ?? [])
      .map((row) => normalizeEvidenceRow(row, maxCells))
      .filter((row) => row.text || row.cells.length)
      .slice(0, maxRows);
    return {
      page_number: page.pageNumber,
      row_count: rows.length,
      numeric_row_count: rows.filter((row) => row.kind === "data").length,
      rows,
    };
  });
}

export function buildCellLookup(pages) {
  const lookup = new Map();
  for (const page of pages) {
    for (const row of page.itemRows ?? []) {
      for (const cell of row.cells ?? []) {
        lookup.set(cellKey(page.pageNumber, row.rowIndex, cell.cellIndex), cell);
      }
    }
  }
  return lookup;
}

export function cellReferenceExists(lookup, ref) {
  const page = Number(ref?.page);
  const rowIndex = Number(ref?.row_index);
  const cellIndices = Array.isArray(ref?.cell_indices) ? ref.cell_indices.map(Number) : [];
  return Number.isFinite(page) && Number.isFinite(rowIndex) && cellIndices.length > 0 && cellIndices.every((cellIndex) => lookup.has(cellKey(page, rowIndex, cellIndex)));
}

function normalizeEvidenceRow(row, maxCells) {
  const cells = (row.cells ?? []).slice(0, maxCells).map((cell) => ({
    cell_index: cell.cellIndex,
    x: round(cell.x),
    y: round(cell.y),
    width: round(cell.width),
    height: round(cell.height),
    text: String(cell.text ?? "").trim(),
  }));
  const text = cells.map((cell) => cell.text).filter(Boolean).join(" ");
  const numericCellCount = cells.filter((cell) => isNumericCell(cell.text)).length;
  return {
    row_index: row.rowIndex,
    y: round(row.y),
    kind: classifyRow(text, numericCellCount),
    numeric_cell_count: numericCellCount,
    text,
    cells,
  };
}

function classifyRow(text, numericCellCount) {
  const compact = String(text ?? "").replace(/\s+/g, "");
  if (isStatementTitle(compact)) return "title";
  if (compact.includes("단위") || /20\d{2}|제\d+/.test(compact)) return "header";
  if (numericCellCount > 0) return "data";
  return "text";
}

function isStatementTitle(compact) {
  return /^(?:연결|개별|별도)?(?:포괄)?(?:재무상태표|손익계산서|현금흐름표|자본변동표)$/.test(compact);
}

function isNumericCell(value) {
  const text = String(value ?? "").trim();
  return text === "-" || text === "0" || /^\(?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?$/.test(text);
}

function cellKey(pageNumber, rowIndex, cellIndex) {
  return `${Number(pageNumber)}:${Number(rowIndex)}:${Number(cellIndex)}`;
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
