const pdfjsLib = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/+esm");
pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.mjs";

export async function loadPdfFile(file) {
  if (!file) throw new Error("No file was provided.");
  if (!isPdfFile(file)) throw new Error(`${file.name || "Selected file"} is not a PDF.`);
  let arrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (error) {
    throw new Error(`Could not read ${file.name}. ${error.message}`);
  }
  return loadPdfArrayBuffer(arrayBuffer, file.name, file);
}

async function loadPdfArrayBuffer(arrayBuffer, filename, file = null) {
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  } catch (error) {
    throw new Error(`Could not open PDF ${filename}. ${error.message}`);
  }
  const pages = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    let page;
    let textContent;
    try {
      page = await pdf.getPage(pageNumber);
      textContent = await page.getTextContent();
    } catch (error) {
      throw new Error(`Could not read page ${pageNumber} of ${filename}. ${error.message}`);
    }
    const itemRows = buildItemRows(textContent.items);
    const text = rowsToText(itemRows);
    pages.push({ pageNumber, text, items: textContent.items, itemRows });
  }
  return {
    id: crypto.randomUUID(),
    filename,
    file,
    pdf,
    pageCount: pdf.numPages,
    pages,
  };
}

function isPdfFile(file) {
  const name = String(file?.name ?? "").toLowerCase();
  return file?.type === "application/pdf" || name.endsWith(".pdf");
}

function buildItemRows(items) {
  const rows = [];
  for (const item of items) {
    const text = String(item.str ?? "").trim();
    if (!text) continue;
    const x = item.transform?.[4] ?? 0;
    const y = item.transform?.[5] ?? 0;
    const width = item.width ?? 0;
    const height = item.height ?? 0;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 3);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x, y, width, height, text });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row, rowIndex) => ({
      rowIndex,
      y: row.y,
      cells: row.cells.sort((a, b) => a.x - b.x).map((cell, cellIndex) => ({ cellIndex, ...cell })),
    }));
}

function rowsToText(rows) {
  return rows
    .map((row) => row.cells.map((cell) => cell.text).join(" "))
    .join("\n");
}

export async function renderPdfPage(document, pageNumber, canvas, scale = 0.7) {
  if (!document?.pdf) throw new Error("PDF document is not loaded.");
  if (!canvas) throw new Error("Canvas is not available for page rendering.");
  const page = await document.pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas rendering context is not available.");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
}
