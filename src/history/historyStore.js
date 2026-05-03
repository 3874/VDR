const HISTORY_KEY = "quant_vdr_history";
const MAX_HISTORY_ITEMS = 50;

export function loadHistoryItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveHistoryRun(run) {
  try {
    const items = loadHistoryItems();
    const normalized = normalizeRun(run);
    const next = [normalized, ...items.filter((item) => item.id !== normalized.id)].slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    throw new Error(`Could not save local History. ${error.message}`);
  }
}

export function deleteHistoryRun(id) {
  try {
    const next = loadHistoryItems().filter((item) => item.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    return next;
  } catch (error) {
    throw new Error(`Could not delete local History item. ${error.message}`);
  }
}

export function clearHistoryRuns() {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // Ignore local cleanup failures. The caller can continue without History.
  }
}

export function findHistoryByFile(file) {
  const name = String(file?.name ?? "");
  const size = Number(file?.size ?? -1);
  if (!name || !Number.isFinite(size) || size < 0) return null;
  return loadHistoryItems().find((item) =>
    (item.files ?? []).some((saved) => saved.name === name && Number(saved.size) === size)
  ) ?? null;
}

function normalizeRun(run) {
  return {
    id: run.id || crypto.randomUUID(),
    createdAt: run.createdAt || new Date().toISOString(),
    filename: run.filename || "Untitled extraction",
    files: Array.isArray(run.files) ? run.files.map(normalizeFile) : [],
    reportTypes: Array.isArray(run.reportTypes) ? run.reportTypes : [],
    candidates: Array.isArray(run.candidates) ? run.candidates : [],
    facts: Array.isArray(run.facts) ? run.facts : [],
    issues: Array.isArray(run.issues) ? run.issues : [],
    xbrlLike: run.xbrlLike ?? null,
  };
}

function normalizeFile(file) {
  return {
    name: String(file?.name ?? ""),
    size: Number(file?.size ?? 0),
  };
}
