import { state } from "../store.js";
import { escapeHtml } from "../utils/html.js";

export function renderArtifactsView(root) {
  root.innerHTML = `
    <div class="panel grid">
      <h3>XBRL-like JSON</h3>
      ${state.xbrlLike ? `
        <div class="row">
          <button id="build-statements" class="btn primary">Create financial statements</button>
          <button id="download-json" class="btn">Download xbrl_like.json</button>
        </div>
        <div id="statement-preview"></div>
        <textarea rows="18" readonly>${escapeHtml(JSON.stringify(state.xbrlLike, null, 2))}</textarea>
      ` : `<p class="muted">No artifact generated yet.</p>`}
    </div>
  `;
  const button = root.querySelector("#download-json");
  if (button) button.addEventListener("click", downloadJson);
  const buildButton = root.querySelector("#build-statements");
  if (buildButton) buildButton.addEventListener("click", () => renderStatementPreview(root.querySelector("#statement-preview")));
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state.xbrlLike, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "xbrl_like.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderStatementPreview(container) {
  const grouped = groupFacts(state.xbrlLike?.facts ?? []);
  const sections = Object.entries(grouped).map(([key, rows]) => renderStatementSection(key, rows)).join("");
  container.innerHTML = sections || `<div class="status warn">No facts available to build statements.</div>`;
}

function groupFacts(facts) {
  const groups = {};
  for (const fact of facts) {
    const scope = fact.contextRef?.split("_")[0] || "unknown";
    const key = `${scope} / ${fact.statementType}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(fact);
  }
  return groups;
}

function renderStatementSection(title, rows) {
  const ordered = dedupeRows([...rows].sort((a, b) => (a.extractionOrder ?? 0) - (b.extractionOrder ?? 0)));
  const columnCount = Math.min(3, Math.max(1, ...ordered.map((fact) => (fact.allValues ?? []).length)));
  const columns = buildPeriodColumns(ordered, columnCount);
  return `
    <div class="panel">
      <h3>${escapeHtml(title)}</h3>
      <table>
        <thead>
          <tr>
            <th>\uacc4\uc815\uba85</th>
            ${columns.map((column) => `<th>${column}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${ordered.map((fact) => `
            <tr>
              <td>${escapeHtml(fact.label)}</td>
              ${columns.map((_, index) => `<td>${formatRawNumber((fact.allValues ?? [fact.value]).slice(0, 3)[index])}</td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function dedupeRows(rows) {
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    const key = `${row.contextRef}:${row.statementType}:${row.label}:${row.source?.page ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}

function fiscalColumnLabel(index) {
  if (index === 0) return "\ucd5c\uadfc \uc5f0\ub3c4";
  if (index === 1) return "\uc9c1\uc804 \uc5f0\ub3c4";
  return `${index + 1}\ubc88\uc9f8 \uc5f0\ub3c4`;
}

function buildPeriodColumns(rows, columnCount) {
  const labels = [];
  for (const row of rows) {
    for (const label of row.periodLabels ?? []) {
      if (!labels.includes(label)) labels.push(label);
      if (labels.length >= columnCount) return labels;
    }
  }
  return Array.from({ length: columnCount }, (_, index) => fiscalColumnLabel(index));
}

function formatRawNumber(value) {
  if (value == null || value === "") return "";
  const normalized = String(value).replace(/[(),]/g, "");
  const number = Number(normalized);
  if (Number.isNaN(number)) return escapeHtml(value);
  const formatted = number.toLocaleString("ko-KR");
  return String(value).startsWith("(") && String(value).endsWith(")") ? `(${formatted})` : formatted;
}
