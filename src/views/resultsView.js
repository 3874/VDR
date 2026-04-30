import { state } from "../store.js";

export function renderResultsView(root) {
  root.innerHTML = `
    <div class="panel">
      <h3>Document Structure Review</h3>
      ${renderDocumentReviews()}
    </div>
    <div class="panel">
      <h3>Financial Extraction</h3>
      <p class="muted">Financial statement extraction and arithmetic checks are secondary. Use them after the report type and table-of-contents structure are acceptable.</p>
      ${renderFactsSummary()}
    </div>
  `;
}

function renderDocumentReviews() {
  if (!state.documentReviews.length) return `<p class="muted">No document review has been run yet.</p>`;
  return state.documentReviews.map((review) => `
    <section class="review-block">
      <h4>${review.filename}</h4>
      <table>
        <tbody>
          <tr><th>Report type</th><td>${review.reportType}</td></tr>
          <tr><th>Type confidence</th><td>${Math.round(review.confidence * 100)}%</td></tr>
          <tr><th>TOC</th><td>${review.toc.exists ? `page ${review.toc.pageNumber}, ${review.toc.entries.length} parsed entries` : "not found"}</td></tr>
          <tr><th>Issues</th><td>${review.issues.length}</td></tr>
        </tbody>
      </table>
      ${renderIssues(review.issues)}
      ${renderTocFailures(review.tocChecks)}
    </section>
  `).join("");
}

function renderIssues(issues) {
  if (!issues.length) return `<p class="muted">No document structure issues detected.</p>`;
  return `
    <table>
      <thead><tr><th>Severity</th><th>Message</th></tr></thead>
      <tbody>
        ${issues.map((issue) => `<tr><td>${issue.severity}</td><td>${issue.message}</td></tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderTocFailures(checks) {
  const failed = checks.filter((entry) => entry.status === "missing" || entry.status === "page_mismatch");
  if (!failed.length) return "";
  return `
    <h4>TOC Problems</h4>
    <table>
      <thead><tr><th>Entry</th><th>Expected</th><th>Found</th><th>Status</th></tr></thead>
      <tbody>
        ${failed.slice(0, 50).map((entry) => `
          <tr>
            <td>${entry.title}</td>
            <td>${entry.expectedPage}</td>
            <td>${entry.foundPage ?? ""}</td>
            <td>${entry.status}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderFactsSummary() {
  if (!state.facts.length) return `<p class="muted">No financial facts extracted yet.</p>`;
  return `<p>${state.facts.length} financial facts extracted.</p>`;
}
