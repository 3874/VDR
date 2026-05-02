export const state = {
  activeView: "upload",
  apiKeys: loadApiKeys(),
  analysis: loadAnalysisSettings(),
  documents: [],
  documentReviews: [],
  facts: [],
  issues: [],
  xbrlLike: null,
  logs: [],
};

export function setActiveView(view) {
  state.activeView = view;
}

export function saveApiKeys(keys) {
  state.apiKeys = { ...state.apiKeys, ...keys };
  localStorage.setItem("quant_vdr_api_keys", JSON.stringify(state.apiKeys));
}

export function saveAnalysisSettings(settings) {
  state.analysis = { ...state.analysis, ...settings };
  localStorage.setItem("quant_vdr_analysis", JSON.stringify(state.analysis));
}

export function addLog(message, type = "info") {
  state.logs.unshift({ message, type, time: new Date().toLocaleTimeString() });
}

function loadApiKeys() {
  try {
    return JSON.parse(localStorage.getItem("quant_vdr_api_keys")) ?? { openai: "", gemini: "" };
  } catch {
    return { openai: "", gemini: "" };
  }
}

function loadAnalysisSettings() {
  try {
    return { ...defaultAnalysis(), ...(JSON.parse(localStorage.getItem("quant_vdr_analysis")) ?? {}) };
  } catch {
    return defaultAnalysis();
  }
}

function defaultAnalysis() {
  return {
    provider: "gemini",
    openaiModel: "gpt-5.4-mini",
    geminiModel: "gemini-2.5-flash-lite",
    maxPages: 100,
    premiumMode: false,
  };
}
