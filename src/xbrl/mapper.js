import { mapConcept } from "./concepts.js";
import { normalizeAmount } from "./normalizer.js";

export function mapMetricsToFacts(document, metrics) {
  return metrics.map((metric) => ({
    documentId: document.id,
    filename: document.filename,
    scope: metric.scope,
    statementType: metric.statementType,
    concept: mapConcept(metric.label),
    label: metric.label,
    period: metric.period,
    value: normalizeAmount(metric.value, metric.unit, metric.scale),
    unit: metric.unit,
    pageNumber: metric.pageNumber,
    confidence: metric.confidence,
    rawLine: metric.rawLine,
    allValues: metric.allValues,
    periodLabels: metric.periodLabels,
    columnLabels: metric.columnLabels ?? metric.periodLabels,
    notes: metric.notes ?? [],
    evidence: metric.evidence ?? {},
    extractionOrder: metric.extractionOrder,
  }));
}

export function buildXbrlLike(facts) {
  const contexts = {};
  const units = {};
  const factRows = facts.map((fact) => {
    const contextRef = `${fact.scope}_${fact.period || "unknown"}`.replace(/[ .]/g, "_");
    const unitRef = (fact.unit || "KRW").toUpperCase();
    contexts[contextRef] = { scope: fact.scope, period: fact.period };
    units[unitRef] = { measure: fact.unit || "KRW" };
    return {
      concept: fact.concept,
      contextRef,
      unitRef,
      value: fact.value,
      label: fact.label,
      statementType: fact.statementType,
      source: {
        documentId: fact.documentId,
        filename: fact.filename,
        page: fact.pageNumber,
      },
      confidence: fact.confidence,
      allValues: fact.allValues,
      rawLine: fact.rawLine,
      periodLabels: fact.periodLabels,
      columnLabels: fact.columnLabels ?? fact.periodLabels,
      notes: fact.notes ?? [],
      evidence: fact.evidence ?? {},
      extractionOrder: fact.extractionOrder,
    };
  });
  return {
    schema: "quant-vdr-xbrl-like/v1",
    contexts,
    units,
    facts: factRows,
  };
}
