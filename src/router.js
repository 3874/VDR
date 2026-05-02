import { state, setActiveView } from "./store.js";
import { chooseProvider } from "./extraction/llmClient.js";
import { renderApiKeysView } from "./views/apiKeysView.js";
import { renderAnalysisSettingsView } from "./views/analysisSettingsView.js";
import { renderArtifactsView } from "./views/artifactsView.js";
import { renderHistoryView } from "./views/historyView.js";
import { renderResultsView } from "./views/resultsView.js";
import { renderUploadReviewView } from "./views/uploadReviewView.js";

export const routes = [
  { id: "upload", label: "File Upload & Review", title: "File Upload & Review", subtitle: "Upload a PDF and review report type, table of contents, and required sections." },


  { id: "results", label: "Results", title: "Results", subtitle: "Review document structure checks before financial statement extraction." },
  { id: "artifacts", label: "Artifacts", title: "Artifacts", subtitle: "Download generated XBRL-like JSON." },
  { id: "history", label: "History", title: "History", subtitle: "Reload saved extraction runs. Saving is enabled for Premium Mode only." },
];

export const settingsRoutes = [
  { id: "apiKeys", label: "API Keys", title: "API Keys", subtitle: "Store keys locally in this browser." },
  { id: "analysis", label: "Analysis Settings", title: "Analysis Settings", subtitle: "Configure local analysis limits." },
];

let closeSettingsMenu = null;

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

function renderSettingsMenu() {
  const area = document.querySelector("#settings-area");
  if (!area) return;
  area.innerHTML = "";

  const toggle = document.createElement("button");
  toggle.className = "settings-toggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Open settings menu");
  toggle.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 15a3 3 0 100-6 3 3 0 000 6z"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33 1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82 1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/></svg>`;
  
  const popup = document.createElement("div");
  popup.className = "settings-popup";
  popup.style.display = "none";

  for (const route of settingsRoutes) {
    const item = document.createElement("button");
    item.type = "button";
    item.textContent = route.label;
    item.className = state.activeView === route.id ? "active" : "";
    item.addEventListener("click", () => {
      setActiveView(route.id);
      renderApp();
    });
    popup.append(item);
  }

  toggle.addEventListener("click", (e) => {
    e.stopPropagation();
    popup.style.display = popup.style.display === "none" ? "flex" : "none";
  });

  popup.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  if (closeSettingsMenu) document.removeEventListener("click", closeSettingsMenu);
  closeSettingsMenu = () => {
    popup.style.display = "none";
  };
  document.addEventListener("click", closeSettingsMenu);

  area.append(toggle, popup);
}

export function renderApp() {
  renderNav();
  renderSettingsMenu();
  const allRoutes = [...routes, ...settingsRoutes];
  const route = allRoutes.find((item) => item.id === state.activeView) ?? routes[0];
  document.querySelector("#page-title").textContent = route.title;
  document.querySelector("#page-subtitle").textContent = route.subtitle;
  renderProviderBadge();
  const root = document.querySelector("#app");
  if (state.activeView === "apiKeys") renderApiKeysView(root);
  else if (state.activeView === "analysis") renderAnalysisSettingsView(root);
  else if (state.activeView === "results") renderResultsView(root);
  else if (state.activeView === "artifacts") renderArtifactsView(root);
  else if (state.activeView === "history") renderHistoryView(root);
  else renderUploadReviewView(root);
}

function renderProviderBadge() {
  const badge = document.querySelector("#provider-badge");
  const provider = chooseProvider(state);
  badge.textContent = provider ? `${provider.name} ready` : "LLM key missing";
  badge.className = provider ? "badge ok" : "badge";
}
