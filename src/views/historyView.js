import { renderApp } from "../router.js";
import { state } from "../store.js";
import { deleteHistoryRun, loadHistoryItems } from "../history/historyStore.js";
import { escapeHtml } from "../utils/html.js";

export function renderHistoryView(root) {
  const items = loadHistoryItems();
  root.innerHTML = `
    <div class="panel">
      <div class="row between">
        <div>
          <h3>History</h3>
          <p class="muted">Local History is free and stored only in this browser. Premium will add cloud sync, server retention, and team sharing.</p>
        </div>
        <span class="badge ${state.analysis.premiumMode ? "ok" : ""}">${state.analysis.premiumMode ? "Premium Ready" : "Local"}</span>
      </div>
      ${state.analysis.premiumMode ? renderCloudNotice() : ""}
      ${renderHistoryTable(items)}
    </div>
  `;

  root.querySelectorAll("[data-load-history]").forEach((button) => {
    button.addEventListener("click", () => loadRun(button.dataset.loadHistory));
  });
  root.querySelectorAll("[data-delete-history]").forEach((button) => {
    button.addEventListener("click", () => {
      deleteHistoryRun(button.dataset.deleteHistory);
      renderApp();
    });
  });
}

function renderCloudNotice() {
  return `
    <div class="status">
      Premium Mode is enabled. This MVP still saves locally; cloud sync will be connected through the server backend later.
    </div>
  `;
}

function renderHistoryTable(items) {
  if (!items.length) return `<p class="muted">No saved extraction runs yet.</p>`;
  return `
    <table>
      <thead>
        <tr>
          <th>Created</th>
          <th>File</th>
          <th>Size</th>
          <th>Report Type</th>
          <th>Facts</th>
          <th>Issues</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item) => `
          <tr>
            <td>${escapeHtml(formatDate(item.createdAt))}</td>
            <td>${escapeHtml(item.filename)}</td>
            <td>${escapeHtml(formatFilesize(item.files))}</td>
            <td>${escapeHtml((item.reportTypes ?? []).join(", ") || "unknown")}</td>
            <td>${item.facts?.length ?? 0}</td>
            <td>${item.issues?.length ?? 0}</td>
            <td>
              <div class="row">
                <button class="btn" data-load-history="${escapeHtml(item.id)}">Load</button>
                <button class="btn" data-delete-history="${escapeHtml(item.id)}">Delete</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function loadRun(id) {
  const item = loadHistoryItems().find((candidate) => candidate.id === id);
  if (!item) return;
  state.facts = item.facts ?? [];
  state.issues = item.issues ?? [];
  state.xbrlLike = item.xbrlLike ?? null;
  state.activeView = "artifacts";
  renderApp();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("ko-KR");
}

function formatFilesize(files) {
  const total = (files ?? []).reduce((sum, file) => sum + Number(file.size ?? 0), 0);
  if (!total) return "";
  if (total >= 1024 * 1024) return `${(total / 1024 / 1024).toFixed(1)} MB`;
  if (total >= 1024) return `${(total / 1024).toFixed(1)} KB`;
  return `${total} B`;
}
