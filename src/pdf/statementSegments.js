import { compactText } from "./textNormalize.js";

export const STATEMENT_TYPES = ["balance_sheet", "income_statement", "cash_flow_statement", "equity_changes"];

export function sliceStatementText(text, statementType) {
  const lines = String(text ?? "").split(/\n+/);
  const titles = findStatementTitles(lines);
  const targetTitles = titles.filter((title) => title.statementType === statementType);
  if (!targetTitles.length) {
    const firstOtherTitle = titles.find((title) => !title.hasSectionPrefix);
    return firstOtherTitle ? lines.slice(0, firstOtherTitle.index).join("\n") : text;
  }
  const start = chooseBestTitle(targetTitles).index;
  const next = titles.find((title) => title.index > start && !title.hasSectionPrefix);
  const end = next ? next.index : lines.length;
  return lines.slice(start, end).join("\n");
}

export function hasStatementTitle(text, statementType) {
  return findStatementTitles(String(text ?? "").split(/\n+/)).some((title) => title.statementType === statementType);
}

export function hasAnyStatementTitle(text) {
  return findStatementTitles(String(text ?? "").split(/\n+/)).length > 0;
}

export function findStatementTitles(lines) {
  const titles = [];
  for (const [index, line] of lines.entries()) {
    const title = getStatementTitleType(line);
    if (title) titles.push({ index, ...title });
  }
  return titles;
}

function getStatementTitleType(line) {
  const compact = compactText(line);
  if (!compact || compact.length > 50) return null;
  if (compact.includes("\uc8fc\uc11d") || compact.includes("\uc778\uc2dd") || compact.includes("\uad00\ub828")) return null;
  const sectionPrefix = compact.match(/^(\d+)(?:-(\d+))?\./);
  const hasSectionPrefix = Boolean(sectionPrefix);
  if (sectionPrefix && !isFinancialStatementSectionPrefix(sectionPrefix)) return null;
  const pure = compact.replace(/^\d+(?:-\d+)?\./, "");
  const statementType = matchStatementType(pure);
  if (!statementType) return null;
  return { statementType, hasSectionPrefix };
}

function isFinancialStatementSectionPrefix(match) {
  const major = Number(match[1]);
  const minor = match[2] ? Number(match[2]) : null;
  if (!Number.isFinite(major)) return false;
  if (major >= 10) return false;
  if (minor !== null) return major >= 1 && major <= 4 && minor >= 1 && minor <= 4;
  return major >= 1 && major <= 4;
}

function chooseBestTitle(titles) {
  const pureTitles = titles.filter((title) => !title.hasSectionPrefix);
  return pureTitles.length ? pureTitles[0] : titles[titles.length - 1];
}

function matchStatementType(compact) {
  if (/^(?:\uc5f0\uacb0|\uac1c\ubcc4|\ubcc4\ub3c4)?(?:\ud3ec\uad04)?\uc190\uc775\uacc4\uc0b0\uc11c$/.test(compact)) return "income_statement";
  if (/^(?:\uc5f0\uacb0|\uac1c\ubcc4|\ubcc4\ub3c4)?(?:\ud3ec\uad04)?\uc7ac\ubb34\uc0c1\ud0dc\ud45c$/.test(compact)) return "balance_sheet";
  if (/^(?:\uc5f0\uacb0|\uac1c\ubcc4|\ubcc4\ub3c4)?(?:\ud3ec\uad04)?\ud604\uae08\ud750\ub984\ud45c$/.test(compact)) return "cash_flow_statement";
  if (/^(?:\uc5f0\uacb0|\uac1c\ubcc4|\ubcc4\ub3c4)?\uc790\ubcf8\ubcc0\ub3d9\ud45c$/.test(compact)) return "equity_changes";
  return null;
}

