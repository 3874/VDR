const MAX_ROWS_PER_PAGE = 140;
const MAX_CELLS_PER_ROW = 18;

export function buildTableEvidencePages(pages, options = {}) {
  const maxRows = options.maxRows ?? MAX_ROWS_PER_PAGE;
  const maxCells = options.maxCells ?? MAX_CELLS_PER_ROW;
  const evidencePages = pages.map((page) => {
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
  const columnBands = detectColumnBands(evidencePages);
  return evidencePages.map((page) => ({
    ...page,
    column_bands: columnBands,
    rows: page.rows.map((row) => annotateRowCells(row, columnBands)),
  }));
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
  if (compact.includes("\ub2e8\uc704") || /20\d{2}|\uc81c\d+/.test(compact)) return "header";
  if (numericCellCount > 0) return "data";
  return "text";
}

function isStatementTitle(compact) {
  return /^(?:\uc5f0\uacb0|\uac1c\ubcc4|\ubcc4\ub3c4)?(?:\ud3ec\uad04)?(?:\uc7ac\ubb34\uc0c1\ud0dc\ud45c|\uc190\uc775\uacc4\uc0b0\uc11c|\ud604\uae08\ud750\ub984\ud45c|\uc790\ubcf8\ubcc0\ub3d9\ud45c)$/.test(compact);
}

function detectColumnBands(pages) {
  const headerCells = [];
  for (const page of pages) {
    for (const row of page.rows.slice(0, 30)) {
      for (const cell of row.cells) {
        const period = detectPeriodLabel(cell.text);
        if (period) headerCells.push({ ...period, x: cell.x, center: cell.x + cell.width / 2, width: cell.width });
      }
    }
  }
  const fromHeaders = buildBandsFromHeaderCells(headerCells);
  if (fromHeaders.length) return fromHeaders;
  return inferBandsFromNumericCells(pages);
}

function detectPeriodLabel(value) {
  const text = String(value ?? "").trim();
  const compact = text.replace(/\s+/g, "");
  const year = compact.match(/20\d{2}/)?.[0];
  if (year) return { key: year, label: text };
  if (compact.includes("\uc804\uc804\uae30")) return { key: "prior_2", label: text };
  if (compact.includes("\uc804\uae30") || /\uc81c\d+\(?\uc804\)?\uae30/.test(compact)) return { key: "prior", label: text };
  if (compact.includes("\ub2f9\uae30") || /\uc81c\d+\(?\ub2f9\)?\uae30/.test(compact)) return { key: "current", label: text };
  return null;
}

function buildBandsFromHeaderCells(cells) {
  const byKey = new Map();
  for (const cell of cells) {
    if (!byKey.has(cell.key)) byKey.set(cell.key, []);
    byKey.get(cell.key).push(cell);
  }
  const centers = [...byKey.entries()]
    .map(([key, values]) => ({
      key,
      label: values[0].label,
      center: average(values.map((cell) => cell.center)),
      width: Math.max(30, average(values.map((cell) => cell.width))),
    }))
    .sort((a, b) => a.center - b.center)
    .slice(-6);
  return centersToBands(centers);
}

function inferBandsFromNumericCells(pages) {
  const centers = [];
  for (const page of pages) {
    for (const row of page.rows) {
      if (row.kind !== "data") continue;
      for (const cell of row.cells) {
        if (isNumericCell(cell.text)) centers.push(cell.x + cell.width / 2);
      }
    }
  }
  const clusters = clusterCenters(centers).slice(-6).map((center, index) => ({
    key: `period_${index + 1}`,
    label: `period_${index + 1}`,
    center,
    width: 40,
  }));
  return centersToBands(clusters);
}

function centersToBands(centers) {
  if (!centers.length) return [];
  return centers.map((column, index) => {
    const previous = centers[index - 1];
    const next = centers[index + 1];
    const x1 = previous ? (previous.center + column.center) / 2 : column.center - Math.max(40, column.width * 1.5);
    const x2 = next ? (column.center + next.center) / 2 : column.center + Math.max(40, column.width * 1.5);
    return {
      key: column.key,
      label: column.label,
      x1: round(x1),
      x2: round(x2),
      center: round(column.center),
    };
  });
}

function annotateRowCells(row, columnBands) {
  return {
    ...row,
    cells: row.cells.map((cell) => {
      if (!isNumericCell(cell.text)) return cell;
      const center = cell.x + cell.width / 2;
      const band = columnBands.find((candidate) => center >= candidate.x1 && center <= candidate.x2);
      return band ? { ...cell, value_column: band.key } : cell;
    }),
  };
}

function isNumericCell(value) {
  const text = String(value ?? "").trim();
  return text === "-" || /^\(?\d+(?:\.\d+)?\)?$/.test(text) || /^\(?\d{1,3}(?:,\d{3})+(?:\.\d+)?\)?$/.test(text);
}

function clusterCenters(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const clusters = [];
  for (const value of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || Math.abs(average(last) - value) > 12) clusters.push([value]);
    else last.push(value);
  }
  return clusters.map(average);
}

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function cellKey(pageNumber, rowIndex, cellIndex) {
  return `${Number(pageNumber)}:${Number(rowIndex)}:${Number(cellIndex)}`;
}

function round(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}
