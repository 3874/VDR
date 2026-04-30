import { renderApp } from "../router.js";
import { saveAnalysisSettings, state } from "../store.js";

export function renderAnalysisSettingsView(root) {
  const availableProviders = [];
  if (state.apiKeys.openai) availableProviders.push("openai");
  if (state.apiKeys.gemini) availableProviders.push("gemini");
  if (!availableProviders.length) availableProviders.push("openai", "gemini");
  if (state.apiKeys.openai && state.apiKeys.gemini && !state.analysis.provider) state.analysis.provider = "openai";
  root.innerHTML = `
    <div class="panel grid">
      <label class="field">
        <span>Provider</span>
        <select id="provider">
          ${availableProviders.map((provider) => `<option value="${provider}" ${provider === state.analysis.provider ? "selected" : ""}>${provider}</option>`).join("")}
        </select>
      </label>
      <label class="field">
        <span>OpenAI model</span>
        <input id="openai-model" value="${state.analysis.openaiModel}" />
      </label>
      <label class="field">
        <span>Gemini model</span>
        <input id="gemini-model" value="${state.analysis.geminiModel}" />
      </label>
      <label class="field">
        <span>Max pages</span>
        <input id="max-pages" type="number" min="1" max="300" value="${state.analysis.maxPages}" />
      </label>
      <button id="save-settings" class="btn primary">Save settings</button>
    </div>
  `;
  root.querySelector("#save-settings").addEventListener("click", () => {
    saveAnalysisSettings({
      provider: root.querySelector("#provider").value,
      openaiModel: root.querySelector("#openai-model").value.trim(),
      geminiModel: root.querySelector("#gemini-model").value.trim(),
      maxPages: Number(root.querySelector("#max-pages").value || 80),
    });
    renderApp();
  });
}
