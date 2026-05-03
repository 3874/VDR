import { state } from "../store.js";
import { escapeHtml } from "../utils/html.js";

const STATEMENT_LABELS = {
  balance_sheet: "재무상태표",
  income_statement: "손익계산서",
  cash_flow_statement: "현금흐름표",
  equity_changes: "자본변동표",
};

const SCOPE_LABELS = {
  consolidated: "연결",
  separate: "별도",
  unknown: "일반",
};

const STANDARD_EQUITY_COLUMNS = [
  "자본금",
  "자본잉여금",
  "자본조정",
  "기타자본구성요소",
  "기타포괄손익누계액",
  "이익잉여금",
  "비지배지분",
  "자본총계",
  "총계",
];

const EQUITY_COLUMNS_BY_COUNT = {
  6: ["자본금", "자본잉여금", "자기주식", "기타자본구성요소", "이익잉여금", "자본 합계"],
  7: ["자본금", "자본잉여금", "자본조정", "기타자본구성요소", "이익잉여금", "비지배지분", "자본총계"],
  8: ["자본금", "자본잉여금", "자본조정", "기타자본구성요소", "이익잉여금", "지배기업 소유주지분", "비지배지분", "자본총계"],
};

export function renderArtifactsView(root) {
  root.innerHTML = `
    ${state.xbrlLike ? renderJsonArtifact() : ""}
    ${state.xbrlLike ? renderReadableStatements() : `<div class="panel"><p class="muted">No artifact generated yet.</p></div>`}
  `;

  const button = root.querySelector("#download-json");
  if (button) button.addEventListener("click", downloadJson);
}

function renderReadableStatements() {
  const grouped = groupFacts(state.xbrlLike?.facts ?? []);
  const sections = grouped.map((group) => renderStatementSection(group)).join("");
  return `
    <div class="panel">
      <div class="row between">
        <div>
          <h3>Readable Financial Statements</h3>
          <p class="muted">Human-readable view generated from the extracted XBRL-like JSON.</p>
        </div>
        <span class="badge ok">${state.xbrlLike?.facts?.length ?? 0} facts</span>
      </div>
    </div>
    ${sections || `<div class="status warn">No facts available to build statements.</div>`}
  `;
}

function renderJsonArtifact() {
  return `
    <details class="collapse-block">
      <summary>XBRL-like JSON</summary>
      <div class="json-actions">
        <button id="download-json" class="btn">Download xbrl_like.json</button>
      </div>
      <textarea rows="18" readonly>${escapeHtml(JSON.stringify(state.xbrlLike, null, 2))}</textarea>
    </details>
  `;
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

function groupFacts(facts) {
  const groups = new Map();
  for (const fact of facts) {
    const scope = getScope(fact);
    const key = `${scope}:${fact.statementType}`;
    if (!groups.has(key)) {
      groups.set(key, {
        scope,
        statementType: fact.statementType,
        facts: [],
      });
    }
    groups.get(key).facts.push(fact);
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      facts: dedupeRows(group.facts).sort((a, b) => (a.extractionOrder ?? 0) - (b.extractionOrder ?? 0)),
    }))
    .sort((a, b) => statementOrder(a) - statementOrder(b));
}

function renderStatementSection(group) {
  const isEquityChanges = group.statementType === "equity_changes";
  const columnCount = getColumnCount(group.facts, isEquityChanges);
  const columns = buildColumns(group.facts, columnCount, isEquityChanges);
  const title = statementTitle(group);
  const unit = dominantUnit(group.facts);
  const columnNotice = isEquityChanges && hasInferredEquityColumns(group.facts, columns)
    ? `<p class="muted">자본변동표 컬럼명이 기간/일반 컬럼으로 추출되어 표시 단계에서 표준 자본 구성 컬럼명으로 보정했습니다.</p>`
    : "";
  return `
    <section class="financial-statement panel">
      <div class="statement-header">
        <div>
          <h3>${escapeHtml(title)}</h3>
          <p class="muted">${escapeHtml(group.facts[0]?.source?.filename ?? "")}</p>
          ${columnNotice}
        </div>
        <span class="badge">${escapeHtml(unit)}</span>
      </div>
      <div class="statement-table-wrap">
        <table class="statement-table">
          <thead>
            <tr>
              <th class="account-col">계정명</th>
              ${columns.map((column) => `<th class="amount-col">${escapeHtml(column)}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${group.facts.map((fact) => renderStatementRow(fact, columns)).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderStatementRow(fact, columns) {
  const depth = Math.max(0, Math.min(4, Number(fact.evidence?.depth ?? 0)));
  const rowClass = isTotalLike(fact.label) ? " total-row" : "";
  return `
    <tr class="statement-row${rowClass}">
      <td class="account-col depth-${depth}">
        <span>${escapeHtml(cleanDisplayLabel(fact.label))}</span>
        ${renderNotes(fact.notes)}
      </td>
      ${columns.map((_, index) => `<td class="amount-col">${formatRawNumber((fact.allValues ?? [fact.value])[index])}</td>`).join("")}
    </tr>
  `;
}

function renderNotes(notes) {
  const values = Array.isArray(notes) ? notes.filter(Boolean) : [];
  if (!values.length) return "";
  return `<small class="note-ref">주석 ${escapeHtml(values.join(", "))}</small>`;
}

function dedupeRows(rows) {
  const seen = new Set();
  const output = [];
  for (const row of rows) {
    const key = `${row.contextRef}:${row.statementType}:${row.label}:${row.extractionOrder ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(row);
  }
  return output;
}

function statementTitle(group) {
  const scope = SCOPE_LABELS[group.scope] ?? group.scope;
  const statement = STATEMENT_LABELS[group.statementType] ?? group.statementType;
  if (group.scope === "unknown") return statement;
  return `${scope} ${statement}`;
}

function statementOrder(group) {
  const scopeOrder = group.scope === "consolidated" ? 0 : group.scope === "separate" ? 1 : 2;
  const typeOrder = {
    balance_sheet: 0,
    income_statement: 1,
    cash_flow_statement: 2,
    equity_changes: 3,
  }[group.statementType] ?? 9;
  return scopeOrder * 10 + typeOrder;
}

function getScope(fact) {
  const fromContext = fact.contextRef?.split("_")[0];
  if (fromContext) return fromContext;
  return "unknown";
}

function getColumnCount(rows, isEquityChanges) {
  const counts = rows.map((fact) => (fact.allValues ?? []).length).filter((count) => count > 0);
  if (!counts.length) return 1;
  const max = Math.max(...counts);
  return isEquityChanges ? max : Math.min(3, max);
}

function buildColumns(rows, columnCount, isEquityChanges) {
  if (isEquityChanges) return buildEquityColumns(rows, columnCount);

  const labels = [];
  for (const row of rows) {
    const sourceLabels = row.columnLabels?.length ? row.columnLabels : row.periodLabels ?? [];
    for (const label of sourceLabels) {
      const normalized = normalizeColumnLabel(label, isEquityChanges);
      if (normalized && !labels.includes(normalized)) labels.push(normalized);
      if (labels.length >= columnCount) return labels;
    }
  }
  return Array.from({ length: columnCount }, (_, index) => fiscalColumnLabel(index));
}

function buildEquityColumns(rows, columnCount) {
  const labels = [];
  for (const row of rows) {
    const sourceLabels = row.columnLabels?.length ? row.columnLabels : row.periodLabels ?? [];
    for (const label of sourceLabels) {
      const normalized = normalizeColumnLabel(label, true);
      if (normalized && !labels.includes(normalized)) labels.push(normalized);
      if (labels.length >= columnCount) break;
    }
    if (labels.length >= columnCount) break;
  }

  if (labels.length >= columnCount && !labels.some(isSuspiciousEquityColumn)) {
    return labels.slice(0, columnCount);
  }

  const fallback = EQUITY_COLUMNS_BY_COUNT[columnCount] ?? STANDARD_EQUITY_COLUMNS;
  return Array.from({ length: columnCount }, (_, index) => fallback[index] ?? `Column ${index + 1}`);
}

function fiscalColumnLabel(index) {
  if (index === 0) return "최근 연도";
  if (index === 1) return "직전 연도";
  return `${index + 1}번째 연도`;
}

function normalizeColumnLabel(label, isEquityChanges) {
  const value = String(label ?? "").trim();
  if (!isEquityChanges) return value;
  const aliases = new Map([
    ["share_capital", "자본금"],
    ["capital_surplus", "자본잉여금"],
    ["capital_adjustments", "자본조정"],
    ["treasury_stock", "자기주식"],
    ["other_components_of_equity", "기타자본구성요소"],
    ["other_comprehensive_income", "기타포괄손익누계액"],
    ["retained_earnings", "이익잉여금"],
    ["owners_of_parent", "지배기업 소유주지분"],
    ["parent_equity", "지배기업 소유주지분"],
    ["noncontrolling_interests", "비지배지분"],
    ["total_equity", "자본총계"],
  ]);
  return aliases.get(value) ?? value;
}

function isSuspiciousEquityColumn(label) {
  const compact = String(label ?? "").replace(/\s+/g, "").toLowerCase();
  return (
    !compact ||
    /^20\d{2}$/.test(compact) ||
    compact.includes("당기") ||
    compact.includes("전기") ||
    compact.includes("current") ||
    compact.includes("prior") ||
    compact.includes("period") ||
    compact.includes("column") ||
    compact === "구분" ||
    compact === "과목"
  );
}

function hasInferredEquityColumns(rows, displayedColumns) {
  const rawLabels = rows.flatMap((row) => row.columnLabels?.length ? row.columnLabels : row.periodLabels ?? []);
  if (!rawLabels.length) return true;
  return rawLabels.some(isSuspiciousEquityColumn) || displayedColumns.some((column) => /^Column \d+$/.test(column));
}

function cleanDisplayLabel(label) {
  return String(label ?? "")
    .replace(/^[\s\u3000]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isTotalLike(label) {
  const compact = String(label ?? "").replace(/\s+/g, "");
  return /총계|합계|총자산|부채총계|자본총계|기말|당기순이익|총포괄손익|영업이익|현금및현금성자산/.test(compact);
}

function dominantUnit(rows) {
  const unit = rows.find((fact) => fact.unitRef)?.unitRef || rows.find((fact) => fact.unit)?.unit || "KRW";
  const labels = new Map([
    ["KRW", "단위: 원"],
    ["천원", "단위: 천원"],
    ["백만원", "단위: 백만원"],
    ["억원", "단위: 억원"],
  ]);
  return labels.get(unit) ?? `단위: ${unit}`;
}

function formatRawNumber(value) {
  if (value == null || value === "") return "";
  const text = String(value).trim();
  if (text === "-") return "-";
  const normalized = text.replace(/[(),]/g, "").replace(/[^0-9.-]/g, "");
  const number = Number(normalized);
  if (Number.isNaN(number)) return escapeHtml(text);
  const formatted = Math.abs(number).toLocaleString("ko-KR");
  return text.startsWith("(") && text.endsWith(")") ? `(${formatted})` : number < 0 ? `(${formatted})` : formatted;
}
