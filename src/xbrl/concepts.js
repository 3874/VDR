const ALIASES = [
  ["\\ud604\\uae08\\ubc0f\\ud604\\uae08\\uc131\\uc790\\uc0b0", "CashAndCashEquivalents"],
  ["\\uae30\\ub9d0\\ud604\\uae08\\ubc0f\\ud604\\uae08\\uc131\\uc790\\uc0b0", "CashAndCashEquivalentsEnding"],
  ["\\uae30\\ucd08\\ud604\\uae08\\ubc0f\\ud604\\uae08\\uc131\\uc790\\uc0b0", "CashAndCashEquivalentsBeginning"],
  ["\\ub9e4\\ucd9c\\ucc44\\uad8c\\ubc0f\\uae30\\ud0c0\\uc720\\ub3d9\\ucc44\\uad8c", "TradeAndOtherCurrentReceivables"],
  ["\\ub9e4\\ucd9c\\ucc44\\uad8c", "TradeReceivables"],
  ["\\uc7ac\\uace0\\uc790\\uc0b0", "Inventories"],
  ["\\uc720\\ub3d9\\uc7ac\\uace0\\uc790\\uc0b0", "Inventories"],
  ["\\ub2f9\\uae30\\ubc95\\uc778\\uc138\\uc790\\uc0b0", "CurrentTaxAssets"],
  ["\\uae30\\ud0c0\\uc720\\ub3d9\\uae08\\uc735\\uc790\\uc0b0", "OtherCurrentFinancialAssets"],
  ["\\uae30\\ud0c0\\uc720\\ub3d9\\uc790\\uc0b0", "OtherCurrentAssets"],
  ["\\ube44\\uc720\\ub3d9\\uc790\\uc0b0", "NoncurrentAssets"],
  ["\\uc720\\ub3d9\\uc790\\uc0b0", "CurrentAssets"],
  ["\\uc720\\ud615\\uc790\\uc0b0", "PropertyPlantAndEquipment"],
  ["\\ud22c\\uc790\\ubd80\\ub3d9\\uc0b0", "InvestmentProperty"],
  ["\\ubb34\\ud615\\uc790\\uc0b0", "IntangibleAssets"],
  ["\\uc0ac\\uc6a9\\uad8c\\uc790\\uc0b0", "RightOfUseAssets"],
  ["\\uc21c\\uc774\\uc5f0\\ubc95\\uc778\\uc138\\uc790\\uc0b0", "DeferredTaxAssets"],
  ["\\uc774\\uc5f0\\ubc95\\uc778\\uc138\\uc790\\uc0b0", "DeferredTaxAssets"],
  ["\\uc9c0\\ubd84\\ubc95\\uc801\\uc6a9\\ud22c\\uc790\\uc9c0\\ubd84", "InvestmentsAccountedForUsingEquityMethod"],
  ["\\uc790\\uc0b0\\ucd1d\\uacc4", "Assets"],
  ["\\ub9e4\\uc785\\ucc44\\ubb34\\ubc0f\\uae30\\ud0c0\\uc720\\ub3d9\\ucc44\\ubb34", "TradeAndOtherCurrentPayables"],
  ["\\ub9e4\\uc785\\ucc44\\ubb34\\ubc0f\\uae30\\ud0c0\\ucc44\\ubb34", "TradeAndOtherPayables"],
  ["\\ub2e8\\uae30\\ucc28\\uc785\\uae08\\ubc0f\\uc0ac\\ucc44", "ShortTermBorrowingsAndBonds"],
  ["\\uc720\\ub3d9\\ucc28\\uc785\\uae08", "CurrentBorrowings"],
  ["\\uc720\\ub3d9\\ub9ac\\uc2a4\\ubd80\\ucc44", "CurrentLeaseLiabilities"],
  ["\\uc720\\ub3d9\\uc131\\ub9ac\\uc2a4\\ubd80\\ucc44", "CurrentLeaseLiabilities"],
  ["\\uc720\\ub3d9\\ucda9\\ub2f9\\ubd80\\ucc44", "CurrentProvisions"],
  ["\\uae30\\ud0c0\\uc720\\ub3d9\\uae08\\uc735\\ubd80\\ucc44", "OtherCurrentFinancialLiabilities"],
  ["\\uae30\\ud0c0\\uc720\\ub3d9\\ubd80\\ucc44", "OtherCurrentLiabilities"],
  ["\\ub2f9\\uae30\\ubc95\\uc778\\uc138\\ubd80\\ucc44", "CurrentTaxLiabilities"],
  ["\\ube44\\uc720\\ub3d9\\ubd80\\ucc44", "NoncurrentLiabilities"],
  ["\\uc720\\ub3d9\\ubd80\\ucc44", "CurrentLiabilities"],
  ["\\uc7a5\\uae30\\ucc28\\uc785\\uae08\\ubc0f\\uc0ac\\ucc44", "LongTermBorrowingsAndBonds"],
  ["\\uc7a5\\uae30\\ucc28\\uc785\\uae08", "LongTermBorrowings"],
  ["\\ube44\\uc720\\ub3d9\\ub9ac\\uc2a4\\ubd80\\ucc44", "NoncurrentLeaseLiabilities"],
  ["\\ubd80\\ucc44\\ucd1d\\uacc4", "Liabilities"],
  ["\\uc790\\ubcf8\\uae08", "ShareCapital"],
  ["\\uc790\\ubcf8\\uc789\\uc5ec\\uae08", "CapitalSurplus"],
  ["\\uc790\\ubcf8\\uc870\\uc815", "CapitalAdjustments"],
  ["\\uc790\\uae30\\uc8fc\\uc2dd", "TreasuryShares"],
  ["\\uae30\\ud0c0\\uc790\\ubcf8\\uad6c\\uc131\\uc694\\uc18c", "OtherComponentsOfEquity"],
  ["\\uc774\\uc775\\uc789\\uc5ec\\uae08", "RetainedEarnings"],
  ["\\ube44\\uc9c0\\ubc30\\uc9c0\\ubd84", "NoncontrollingInterests"],
  ["\\uc790\\ubcf8\\ucd1d\\uacc4", "Equity"],
  ["\\ub9e4\\ucd9c\\uc561", "Revenue"],
  ["\\ub9e4\\ucd9c\\uc6d0\\uac00", "CostOfRevenue"],
  ["\\ub9e4\\ucd9c\\ucd1d\\uc774\\uc775", "GrossProfit"],
  ["\\ud310\\ub9e4\\ube44\\uc640\\uad00\\ub9ac\\ube44", "SellingGeneralAdministrativeExpenses"],
  ["\\uc601\\uc5c5\\uc774\\uc775", "OperatingIncome"],
  ["\\uae08\\uc735\\uc218\\uc775", "FinanceIncome"],
  ["\\uae08\\uc735\\ube44\\uc6a9", "FinanceCosts"],
  ["\\ubc95\\uc778\\uc138\\ube44\\uc6a9\\ucc28\\uac10\\uc804\\uc21c\\uc774\\uc775", "ProfitBeforeTax"],
  ["\\ubc95\\uc778\\uc138\\ube44\\uc6a9", "IncomeTaxExpense"],
  ["\\ub2f9\\uae30\\uc21c\\uc774\\uc775", "NetIncome"],
  ["\\ucd1d\\ud3ec\\uad04\\uc190\\uc775", "ComprehensiveIncome"],
  ["\\uc601\\uc5c5\\ud65c\\ub3d9\\ud604\\uae08\\ud750\\ub984", "CashFlowFromOperatingActivities"],
  ["\\ud22c\\uc790\\ud65c\\ub3d9\\ud604\\uae08\\ud750\\ub984", "CashFlowFromInvestingActivities"],
  ["\\uc7ac\\ubb34\\ud65c\\ub3d9\\ud604\\uae08\\ud750\\ub984", "CashFlowFromFinancingActivities"],
  ["\\ucc28\\uc785\\uae08", "Borrowings"],
  ["\\ub9ac\\uc2a4\\ubd80\\ucc44", "LeaseLiabilities"],
];

export function mapConcept(label) {
  const compact = normalizeLabel(label);
  const sorted = [...ALIASES].sort((a, b) => normalizeLabel(b[0]).length - normalizeLabel(a[0]).length);
  const hit = sorted.find(([keyword]) => compact.includes(normalizeLabel(keyword)));
  if (hit) return hit[1];
  return compact.slice(0, 80) || "UnknownConcept";
}

function normalizeLabel(label) {
  return String(label ?? "")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)))
    .replace(/[\s\u3000()[\]{}\u00b7\u318d,.-]+/g, "")
    .toLowerCase();
}
