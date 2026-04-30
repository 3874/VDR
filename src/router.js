import { state, setActiveView } from "./store.js";
import { renderApiKeysView } from "./views/apiKeysView.js";
import { renderAnalysisSettingsView } from "./views/analysisSettingsView.js";
import { renderArtifactsView } from "./views/artifactsView.js";
import { renderResultsView } from "./views/resultsView.js";
import { renderUploadReviewView } from "./views/uploadReviewView.js";

export const routes = [
  { id: "upload", label: "File Upload & Review", title: "File Upload & Review", subtitle: "Upload a PDF and review report type, table of contents, and required sections." },
  { id: "apiKeys", label: "API Keys", title: "API Keys", subtitle: "Store keys locally in this browser." },
  { id: "analysis", label: "Analysis Settings", title: "Analysis Settings", subtitle: "Configure local analysis limits." },
  { id: "results", label: "Results", title: "Results", subtitle: "Review document structure checks before financial statement extraction." },
  { id: "artifacts", label: "Artifacts", title: "Artifacts", subtitle: "Download generated XBRL-like JSON." },
];

function renderNav() {
  const nav = document.querySelector("#nav");
  nav.innerHTML = "";
  for (const route of routes) {
    const button = document.createElement("button");
    button.textContent = route.label;
    button.className = state.activeView === route.id ? "active" : "";
    button.addEventListener("click", () => {
      setActiveView(route.id);
      renderApp();
    });
    nav.append(button);
  }
}

export function renderApp() {
  renderNav();
  const route = routes.find((item) => item.id === state.activeView) ?? routes[0];
  document.querySelector("#page-title").textContent = route.title;
  document.querySelector("#page-subtitle").textContent = route.subtitle;
  renderProviderBadge();
  const root = document.querySelector("#app");
  if (state.activeView === "apiKeys") renderApiKeysView(root);
  else if (state.activeView === "analysis") renderAnalysisSettingsView(root);
  else if (state.activeView === "results") renderResultsView(root);
  else if (state.activeView === "artifacts") renderArtifactsView(root);
  else renderUploadReviewView(root);
}

function renderProviderBadge() {
  const badge = document.querySelector("#provider-badge");
  const provider = state.analysis.provider;
  const hasKey = provider === "openai" ? Boolean(state.apiKeys.openai) : Boolean(state.apiKeys.gemini);
  badge.textContent = hasKey ? `${provider} ready` : `${provider} key missing`;
  badge.className = hasKey ? "badge ok" : "badge";
}
