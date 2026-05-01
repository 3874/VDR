/**
 * pageRenderer.js
 * Renders PDF pages to Base64-encoded PNG images for Vision LLM input.
 */

/**
 * Render a single PDF page to a Base64 PNG string.
 * @param {object} document - The loaded PDF document object (from pdfLoader).
 * @param {number} pageNumber - 1-indexed page number.
 * @param {number} scale - Render scale factor (default 1.5 for quality/cost balance).
 * @returns {Promise<{base64: string, mimeType: string, width: number, height: number}>}
 */
async function renderPageToBase64(document, pageNumber, scale = 1.5) {
  const page = await document.pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });

  const canvas = globalThis.document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext("2d");
  await page.render({ canvasContext: context, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/png");
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");

  canvas.width = 0;
  canvas.height = 0;

  return {
    base64,
    mimeType: "image/png",
    width: viewport.width,
    height: viewport.height,
  };
}

/**
 * Render multiple PDF pages to Base64 PNG images.
 * @param {object} document - The loaded PDF document object.
 * @param {number[]} pageNumbers - Array of 1-indexed page numbers.
 * @param {number} scale - Render scale factor.
 * @returns {Promise<Array<{pageNumber: number, base64: string, mimeType: string, width: number, height: number}>>}
 */
export async function renderPagesToBase64(document, pageNumbers, scale = 1.5) {
  const results = [];
  for (const pageNumber of pageNumbers) {
    const rendered = await renderPageToBase64(document, pageNumber, scale);
    results.push({ pageNumber, ...rendered });
  }
  return results;
}
