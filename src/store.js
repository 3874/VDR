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
    return JSON.parse(localStorage.getItem("quant_vdr_analysis")) ?? defaultAnalysis();
  } catch {
    return defaultAnalysis();
  }
}

function defaultAnalysis() {
  return {
    provider: "openai",
    openaiModel: "gpt-4o-mini",
    geminiModel: "gemini-2.5-flash",
    maxPages: 80,
  };
}
