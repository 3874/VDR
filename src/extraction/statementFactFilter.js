export function filterFactsForStatement(facts, statementType) {
  if (statementType !== "cash_flow_statement") return facts;
  return filterCashFlowFacts(facts);
}

function filterCashFlowFacts(facts) {
  const rows = [...facts].sort((a, b) => Number(a.extractionOrder ?? 0) - Number(b.extractionOrder ?? 0));
  const startIndex = rows.findIndex((fact) => isCashFlowStart(fact.label));
  const working = startIndex >= 0 ? rows.slice(startIndex) : rows;
  const output = [];

  for (const fact of working) {
    if (isObviousNoteRow(fact.label)) continue;
    output.push(fact);
    if (isCashFlowEnd(fact.label)) break;
  }

  return output;
}

function isCashFlowStart(label) {
  const compact = compactLabel(label);
  return compact.includes("영업활동현금흐름") || compact.includes("영업활동으로인한현금흐름") || compact.includes("cashflowsfromoperating");
}

function isCashFlowEnd(label) {
  const compact = compactLabel(label);
  return (
    compact.includes("기말현금및현금성자산") ||
    compact.includes("기말의현금") ||
    compact.includes("현금및현금성자산의기말잔액") ||
    compact.includes("cashandcashequivalentsatend")
  );
}

function isObviousNoteRow(label) {
  const compact = compactLabel(label);
  if (!compact) return true;
  const banned = [
    "재무제표주석",
    "연결재무제표주석",
    "회사의개요",
    "일반적사항",
    "재무제표작성기준",
    "중요한회계처리방침",
    "주주명",
    "소유주식수",
    "지분율",
    "전자공시시스템",
    "dart.fss.or.kr",
  ];
  return banned.some((fragment) => compact.includes(fragment));
}

function compactLabel(label) {
  return String(label ?? "")
    .toLowerCase()
    .replace(/[\s\u3000()[\]{}"'‘’“”,.·ㆍ:;/-]+/g, "");
}
