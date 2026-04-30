import { renderApp } from "../router.js";
import { saveApiKeys, state } from "../store.js";

export function renderApiKeysView(root) {
  root.innerHTML = `
    <div class="panel grid">
      <label class="field">
        <span>OpenAI API Key</span>
        <input id="openai-key" type="password" value="${escapeHtml(state.apiKeys.openai ?? "")}" autocomplete="off" />
      </label>
      <label class="field">
        <span>Google API Key</span>
        <input id="gemini-key" type="password" value="${escapeHtml(state.apiKeys.gemini ?? "")}" autocomplete="off" />
      </label>
      <div class="row">
        <button id="save-keys" class="btn primary">Save keys to localStorage</button>
        <button id="clear-keys" class="btn">Clear keys</button>
      </div>
      <p class="muted">Keys are stored only in this browser. Serverless mode exposes keys to browser runtime.</p>
    </div>
  `;
  root.querySelector("#save-keys").addEventListener("click", () => {
    saveApiKeys({
      openai: root.querySelector("#openai-key").value.trim(),
      gemini: root.querySelector("#gemini-key").value.trim(),
    });
    renderApp();
  });
  root.querySelector("#clear-keys").addEventListener("click", () => {
    saveApiKeys({ openai: "", gemini: "" });
    renderApp();
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}
