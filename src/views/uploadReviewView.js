import { renderApp } from "../router.js";
import { addLog, state } from "../store.js";
import { reviewDocumentStructure } from "../pdf/documentReview.js";
import { discoverStatementSpans } from "../pdf/pageDiscovery.js";
import { extractMetricsFromText } from "../pdf/textExtractor.js";
import { loadPdfFile, renderPdfPage } from "../pdf/pdfLoader.js";
import { refineStatementCandidatesWithLLM } from "../extraction/llmSegmenter.js";
import { extractFactsWithLLMStructure } from "../extraction/llmTableStructureExtractor.js";
import { buildXbrlLike, mapMetricsToFacts } from "../xbrl/mapper.js";
import { runStatementChecks } from "../validation/statementChecks.js";

export function renderUploadReviewView(root) {
  root.innerHTML = `
    <div class="panel grid">
      <label class="field">
        <span>Upload PDF</span>
        <input id="file-input" type="file" accept="application/pdf" multiple />
      </label>
      <div class="row">
        <button id="find-pages" class="btn primary" ${state.documents.length ? "" : "disabled"}>Find</button>
        <span class="muted">Find Financial Statement Pages</span>
      </div>
    </div>
    <div id="documents"></div>
  `;
  root.querySelector("#file-input").addEventListener("change", handleFiles);
  root.querySelector("#find-pages").addEventListener("click", findPages);
  renderDocuments(root.querySelector("#documents"));
  root.querySelector("#run-extraction")?.addEventListener("click", runExtraction);
}

async function handleFiles(event) {
  const files = [...event.target.files];
  state.documents = [];
  state.documentReviews = [];
  for (const file of files) {
    addLog(`Loading ${file.name}`);
    const document = await loadPdfFile(file);
    const review = reviewDocumentStructure(document);
    state.documents.push({ ...document, candidates: [] });
    state.documentReviews.push(review);
    addLog(`${file.name}: ${review.reportType}, TOC ${review.toc.exists ? "found" : "not found"}.`);
  }
  addLog(`Loaded ${state.documents.length} PDF file(s).`);
  renderApp();
}

async function findPages() {
  for (const document of state.documents) {
    const heuristicCandidates = discoverStatementSpans(document, 4);
    document.candidates = heuristicCandidates;
    addLog(`${document.filename}: heuristic found ${heuristicCandidates.length} statement spans.`);
    try {
      const review = state.documentReviews.find((item) => item.documentId === document.id);
      const refined = await refineStatementCandidatesWithLLM(document, heuristicCandidates, state, review);
      document.candidates = refined.candidates;
      addLog(`${document.filename}: ${refined.message || "LLM segment refinement skipped."}`);
    } catch (error) {
      document.candidates = heuristicCandidates;
      addLog(`${document.filename}: LLM segment refinement failed. Using heuristic spans. ${error.message}`, "error");
    }
  }
  renderApp();
}

function renderDocuments(container) {
  if (!state.documents.length) {
    container.innerHTML = `<div class="panel muted">No PDF loaded yet.</div>`;
    return;
  }
  container.innerHTML = state.documents
    .map((document, docIndex) => `
      <div class="panel">
        <h3>${document.filename} <span class="muted">(${document.pageCount} pages)</span></h3>
        ${renderDocumentReview(state.documentReviews.find((review) => review.documentId === document.id))}
        ${renderCandidateTable(document, docIndex)}
        <div class="grid three" id="preview-${docIndex}"></div>
      </div>
    `)
    .join("") + renderExtractionAction();
  for (const [docIndex, document] of state.documents.entries()) {
    bindCandidateTable(container, document, docIndex);
    renderPreviews(container.querySelector(`#preview-${docIndex}`), document);
  }
}

function renderExtractionAction() {
  if (!state.documents.length) return "";
  return `
    <div class="panel">
      <div class="row">
        <button id="run-extraction" class="btn primary" ${hasConfirmedPages() ? "" : "disabled"}>Run</button>
        <span class="muted">Run Financial Extraction</span>
      </div>
    </div>
  `;
}

function renderDocumentReview(review) {
  if (!review) return "";
  return `
    <div class="status ${review.issues.some((issue) => issue.severity === "high") ? "error" : review.issues.length ? "warn" : ""}">
      Type: <strong>${review.reportType}</strong>
      · confidence: ${Math.round(review.confidence * 100)}%
      · TOC: ${review.toc.exists ? `found on page ${review.toc.pageNumber}, ${review.toc.entries.length} entries` : "not found"}
    </div>
    <div class="grid two">
      <div>
        <h4>Required Sections</h4>
        ${renderSectionChecks(review.expectedSections)}
      </div>
      <div>
        <h4>TOC Checks</h4>
        ${renderTocChecks(review.tocChecks)}
      </div>
    </div>
    ${renderReviewIssues(review.issues)}
  `;
}

function renderSectionChecks(sections) {
  if (!sections.length) return `<p class="muted">No required section rule for this document type yet.</p>`;
  return `
    <table>
      <thead><tr><th>Section</th><th>Status</th><th>Page</th></tr></thead>
      <tbody>
        ${sections.map((section) => `
          <tr>
            <td>${section.section}</td>
            <td>${section.found ? "found" : "missing"}</td>
            <td>${section.pageNumber ?? ""}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderTocChecks(checks) {
  if (!checks.length) return `<p class="muted">No parsed TOC entries.</p>`;
  return `
    <table>
      <thead><tr><th>TOC Entry</th><th>Expected</th><th>Found</th><th>Status</th></tr></thead>
      <tbody>
        ${checks.slice(0, 20).map((entry) => `
          <tr>
            <td>${entry.title}</td>
            <td>${entry.expectedPage}</td>
            <td>${entry.foundPage ?? ""}</td>
            <td>${entry.status}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
    ${checks.length > 20 ? `<p class="muted">Showing first 20 of ${checks.length} TOC checks.</p>` : ""}
  `;
}

function renderReviewIssues(issues) {
  if (!issues.length) return `<p class="muted">No document structure issues detected.</p>`;
  return `
    <ul class="issue-list">
      ${issues.map((issue) => `<li><strong>${issue.severity}</strong> ${issue.message}</li>`).join("")}
    </ul>
  `;
}

function renderCandidateTable(document, docIndex) {
  if (!document.candidates.length) return `<p class="muted">No statement spans found yet.</p>`;
  return `
    <table>
      <thead><tr><th>Use</th><th>Scope</th><th>Type</th><th>Start</th><th>End</th><th>Score</th></tr></thead>
      <tbody>
        ${document.candidates.map((candidate, idx) => `
          <tr>
            <td><input data-doc="${docIndex}" data-row="${idx}" data-field="include" type="checkbox" ${candidate.include ? "checked" : ""}></td>
            <td><select data-doc="${docIndex}" data-row="${idx}" data-field="scope">${option("consolidated", candidate.scope)}${option("separate", candidate.scope)}${option("unknown", candidate.scope)}</select></td>
            <td>${candidate.statementType}</td>
            <td><input data-doc="${docIndex}" data-row="${idx}" data-field="startPage" type="number" value="${candidate.startPage}"></td>
            <td><input data-doc="${docIndex}" data-row="${idx}" data-field="endPage" type="number" value="${candidate.endPage}"></td>
            <td>${candidate.score}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function option(value, selected) {
  return `<option value="${value}" ${value === selected ? "selected" : ""}>${value}</option>`;
}

function bindCandidateTable(container) {
  container.querySelectorAll("[data-row]").forEach((input) => {
    input.addEventListener("change", (event) => {
      const doc = state.documents[Number(event.target.dataset.doc)];
      const row = doc.candidates[Number(event.target.dataset.row)];
      const field = event.target.dataset.field;
      row[field] = field === "include" ? event.target.checked : field.endsWith("Page") ? Number(event.target.value) : event.target.value;
      renderApp();
    });
  });
}

function renderPreviews(container, document) {
  const selected = document.candidates.filter((candidate) => candidate.include).slice(0, 9);
  container.innerHTML = selected.map((candidate, idx) => `
    <div class="preview-card">
      <strong>${candidate.scope} ${candidate.statementType}</strong>
      <div class="field">
        <select data-preview="${idx}">
          ${range(candidate.startPage, candidate.endPage).map((page) => `<option value="${page}">page ${page}</option>`).join("")}
        </select>
      </div>
      <canvas></canvas>
    </div>
  `).join("");
  selected.forEach((candidate, idx) => {
    const card = container.querySelector(`[data-preview="${idx}"]`).closest(".preview-card");
    const select = card.querySelector("select");
    const canvas = card.querySelector("canvas");
    const draw = () => renderPdfPage(document, Number(select.value), canvas);
    select.addEventListener("change", draw);
    draw();
  });
}

async function runExtraction() {
  const allFacts = [];
  let extractionOrder = 0;
  for (const document of state.documents) {
    for (const candidate of document.candidates.filter((item) => item.include)) {
      const pages = range(candidate.startPage, candidate.endPage)
        .map((pageNumber) => document.pages.find((item) => item.pageNumber === pageNumber))
        .filter(Boolean);
      let facts = [];
      try {
        const structured = await extractFactsWithLLMStructure({
          document,
          candidate,
          pages,
          state,
          extractionOrderStart: extractionOrder,
        });
        facts = structured.facts;
        addLog(`${document.filename}: ${structured.message}`);
      } catch (error) {
        addLog(`${document.filename}: LLM structure extraction failed for ${candidate.statementType}. ${error.message}`, "error");
      }
      if (!facts.length) {
        facts = extractCandidateWithPdfText(document, candidate, pages, extractionOrder);
      }
      allFacts.push(...facts);
      extractionOrder += facts.length;
    }
  }
  state.facts = allFacts;
  state.xbrlLike = buildXbrlLike(allFacts);
  state.issues = runStatementChecks(allFacts);
  addLog(`Extraction finished. Facts: ${state.facts.length}, issues: ${state.issues.length}.`);
  state.activeView = "results";
  renderApp();
}

function extractCandidateWithPdfText(document, candidate, pages, extractionOrderStart) {
  const metrics = [];
  let extractionOrder = extractionOrderStart;
  for (const page of pages) {
    const pageMetrics = extractMetricsFromText(page.text ?? "", page.pageNumber, candidate.scope, candidate.statementType);
    for (const metric of pageMetrics) {
      metric.extractionOrder = extractionOrder;
      extractionOrder += 1;
    }
    metrics.push(...pageMetrics);
  }
  addLog(`${document.filename}: extracted ${metrics.length} rows from ${candidate.statementType} using PDF text.`);
  return mapMetricsToFacts(document, metrics);
}

function hasConfirmedPages() {
  return state.documents.some((document) => document.candidates?.some((candidate) => candidate.include));
}

function range(start, end) {
  return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
}
