export function runStatementChecks(facts, tolerance = 1) {
  const issues = [];
  const groups = new Map();
  for (const fact of facts) {
    const key = `${fact.scope}:${fact.period}`;
    if (!groups.has(key)) groups.set(key, new Map());
    groups.get(key).set(fact.concept, fact);
  }
  for (const [key, byConcept] of groups) {
    const [scope, period] = key.split(":");
    const assets = byConcept.get("Assets");
    const liabilities = byConcept.get("Liabilities");
    const equity = byConcept.get("Equity");
    if (!assets || !liabilities || !equity) continue;
    const expected = Number(liabilities.value ?? 0) + Number(equity.value ?? 0);
    const actual = Number(assets.value ?? 0);
    if (Math.abs(actual - expected) > tolerance) {
      issues.push({
        severity: "critical",
        checkName: "Assets = Liabilities + Equity",
        message: "Balance sheet equation does not reconcile.",
        scope,
        period,
        concept: "Assets",
        expected,
        actual,
        difference: actual - expected,
      });
    }
  }
  return issues;
}
