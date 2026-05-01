import { renderApp } from "../router.js";
import { saveAnalysisSettings, state } from "../store.js";
import { MODEL_LIMITS } from "../extraction/llmModels.js";

export function renderAnalysisSettingsView(root) {
  const availableProviders = getAvailableProviders();
  if (!state.analysis.provider || !availableProviders.includes(state.analysis.provider)) {
    state.analysis.provider = availableProviders[0];
  }

  root.innerHTML = `
    <div class="panel grid">
      <label class="field">
        <span>AI Provider</span>
        <select id="provider">
          ${availableProviders.map((provider) => `<option value="${provider}" ${provider === state.analysis.provider ? "selected" : ""}>${provider.toUpperCase()}</option>`).join("")}
        </select>
      </label>

      <label class="field">
        <span>Model Selection</span>
        <select id="model-select">
          ${renderModelOptions(state.analysis.provider)}
        </select>
      </label>

      <label class="field">
        <span>Max Analysis Pages</span>
        <p class="field-help">Controls the maximum number of pages to analyze in a single run.</p>
        <input id="max-pages" type="number" min="1" max="500" value="${state.analysis.maxPages}" />
      </label>

      <div class="settings-actions">
        <button id="save-settings" class="btn primary">Apply Professional Settings</button>
      </div>
    </div>
  `;

  const providerSelect = root.querySelector("#provider");
  const modelSelect = root.querySelector("#model-select");

  providerSelect.addEventListener("change", (event) => {
    modelSelect.innerHTML = renderModelOptions(event.target.value);
  });

  root.querySelector("#save-settings").addEventListener("click", () => {
    const selectedProvider = providerSelect.value;
    const selectedModel = modelSelect.value;
    const settings = {
      provider: selectedProvider,
      maxPages: Number(root.querySelector("#max-pages").value || 100),
    };

    if (selectedProvider === "openai") settings.openaiModel = selectedModel;
    else settings.geminiModel = selectedModel;

    saveAnalysisSettings(settings);
    renderApp();
  });
}

function getAvailableProviders() {
  const providers = [];
  if (state.apiKeys.gemini) providers.push("gemini");
  if (state.apiKeys.openai) providers.push("openai");
  return providers.length ? providers : ["gemini", "openai"];
}

function renderModelOptions(provider) {
  const currentModel = provider === "openai" ? state.analysis.openaiModel : state.analysis.geminiModel;
  return Object.entries(MODEL_LIMITS)
    .filter(([, model]) => model.provider === provider)
    .map(([id, model]) => {
      const selected = id === currentModel ? "selected" : "";
      const suffix = model.tier === "quality" ? " [quality]" : "";
      return `<option value="${id}" ${selected}>${model.label}${suffix}</option>`;
    })
    .join("");
}
