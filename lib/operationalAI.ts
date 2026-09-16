import type { HysterData } from "@/lib/hyster";
import {
  DEFAULT_ISOLATION_SUBSAMPLE,
  DEFAULT_ISOLATION_TREES,
  scoreIsolationForest
} from "@/lib/isolationForestCore";

export type OperationalInsightCategory = "efficiency" | "reliability" | "safety" | "multivariate";
export type OperationalPriority = "attention" | "high";
export type OperationalAgreement = "strong" | "moderate" | "weak";
export type OperationalMetricKey = "keyHours" | "workPct" | "idlePct" | "waitPct" | "faultEvents" | "impactEvents";

export type OperationalEvidence = {
  metric: OperationalMetricKey;
  label: string;
  current: number;
  mean: number;
  stdDev: number;
  zScore: number;
  unit: string;
};

export type OperationalAIInsight = {
  id: string;
  assetId: string;
  date: string;
  category: OperationalInsightCategory;
  priority: OperationalPriority;
  title: string;
  summary: string;
  evidenceStrength: number;
  baselineSamples: number;
  lookbackDays: number;
  evidence: OperationalEvidence[];
  multivariate: {
    method: "isolation-forest";
    agreement: OperationalAgreement;
    anomalyScore: number;
    percentile: number;
    trees: number;
    sampleSize: number;
    features: OperationalMetricKey[];
    explanation: string;
  };
  relatedEvents: { faults: number; impacts: number };
  relatedCardCodes: string[];
  recommendation: string;
  uncertainty: string;
  sourceRows: number[];
};

export type OperationalAIResult = {
  method: "rolling-zscore+isolation-forest";
  lookbackDays: number;
  minBaselineSamples: number;
  features: OperationalMetricKey[];
  eligibleDays: number;
  insights: OperationalAIInsight[];
  strongAgreements: number;
  moderateAgreements: number;
  weakAgreements: number;
  guardrails: {
    cardMetricsAreContextOnly: true;
    associationNotCausation: true;
    noAutomaticDisciplinaryDecision: true;
    noFailurePrediction: true;
  };
};

type FeatureRow = {
  assetId: string;
  date: string;
  sourceRow: number;
  keyHours: number;
  workPct: number;
  idlePct: number;
  waitPct: number;
  faultEvents: number;
  impactEvents: number;
};

type MetricStats = { mean: number; stdDev: number };

const LOOKBACK_DAYS = 28;
const MIN_BASELINE_SAMPLES = 10;
const FEATURE_KEYS: OperationalMetricKey[] = ["keyHours", "workPct", "idlePct", "waitPct", "faultEvents", "impactEvents"];
const METRIC_META: Record<OperationalMetricKey, { label: string; unit: string; floor: number }> = {
  keyHours: { label: "Chave ligada", unit: "h/dia", floor: 0.5 },
  workPct: { label: "Trabalho / chave", unit: "%", floor: 3 },
  idlePct: { label: "Ociosidade / chave", unit: "%", floor: 3 },
  waitPct: { label: "Espera / chave", unit: "%", floor: 3 },
  faultEvents: { label: "Registros de falha", unit: "eventos/dia", floor: 0.5 },
  impactEvents: { label: "Impactos", unit: "eventos/dia", floor: 0.5 }
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: number[]) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

function stdDev(values: number[], avg = mean(values)) {
  if (values.length <= 1) return 0;
  return Math.sqrt(values.reduce((total, value) => total + (value - avg) ** 2, 0) / (values.length - 1));
}

function daysBetween(a: string, b: string) {
  return (Date.parse(b) - Date.parse(a)) / 86400000;
}

function eventIndex(data: HysterData) {
  const index = new Map<string, { faults: number; impacts: number; cards: Set<string> }>();
  for (const event of data.events) {
    const key = `${event.assetId}:${event.date}`;
    const current = index.get(key) ?? { faults: 0, impacts: 0, cards: new Set<string>() };
    if (event.type === "Falha do sistema") current.faults += 1;
    if (event.type === "Impacto") current.impacts += 1;
    if (event.cardCode) current.cards.add(event.cardCode);
    index.set(key, current);
  }
  return index;
}

function featureRows(data: HysterData) {
  const events = eventIndex(data);
  return data.daily
    .filter((row) => row.keyHours >= 1)
    .map<FeatureRow>((row) => {
      const related = events.get(`${row.assetId}:${row.date}`);
      return {
        assetId: row.assetId,
        date: row.date,
        sourceRow: row.sourceRow,
        keyHours: row.keyHours,
        workPct: row.workHours / row.keyHours * 100,
        idlePct: row.idleHours / row.keyHours * 100,
        waitPct: row.waitHours / row.keyHours * 100,
        faultEvents: related?.faults ?? 0,
        impactEvents: related?.impacts ?? 0
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.assetId.localeCompare(b.assetId));
}

function stats(rows: FeatureRow[], metric: OperationalMetricKey): MetricStats {
  const values = rows.map((row) => row[metric]);
  const avg = mean(values);
  return { mean: avg, stdDev: Math.max(stdDev(values, avg), METRIC_META[metric].floor) };
}

function evidence(row: FeatureRow, baseline: FeatureRow[], metric: OperationalMetricKey): OperationalEvidence {
  const s = stats(baseline, metric);
  return {
    metric,
    label: METRIC_META[metric].label,
    current: round(row[metric], 2),
    mean: round(s.mean, 2),
    stdDev: round(s.stdDev, 2),
    zScore: round((row[metric] - s.mean) / s.stdDev, 2),
    unit: METRIC_META[metric].unit
  };
}

function vector(row: FeatureRow) {
  return FEATURE_KEYS.map((metric) => row[metric]);
}

function triggeredEvidence(row: FeatureRow, baseline: FeatureRow[]) {
  const all = Object.fromEntries(FEATURE_KEYS.map((metric) => [metric, evidence(row, baseline, metric)])) as Record<OperationalMetricKey, OperationalEvidence>;
  const selected: OperationalEvidence[] = [];
  if (all.idlePct.zScore >= 2 && all.idlePct.current - all.idlePct.mean >= 10) selected.push(all.idlePct);
  if (all.waitPct.zScore >= 2 && all.waitPct.current - all.waitPct.mean >= 10) selected.push(all.waitPct);
  if (all.workPct.zScore <= -2 && all.workPct.mean - all.workPct.current >= 10) selected.push(all.workPct);
  if (row.faultEvents >= 2 && all.faultEvents.zScore >= 2) selected.push(all.faultEvents);
  if (row.impactEvents >= 1) selected.push(all.impactEvents);
  return { all, selected };
}

function multivariateAgreement(percentile: number): OperationalAgreement {
  if (percentile >= 0.85) return "strong";
  if (percentile >= 0.7) return "moderate";
  return "weak";
}

function multivariateExplanation(agreement: OperationalAgreement, percentile: number) {
  const pct = Math.round(percentile * 100);
  if (agreement === "strong") return `A combinação de sinais também é rara: o Isolation Forest posicionou o dia no percentil ${pct} frente ao histórico comparável do mesmo equipamento.`;
  if (agreement === "moderate") return `O modelo multivariado encontrou suporte parcial para o desvio (percentil ${pct} no histórico comparável).`;
  return `O z-score encontrou evidência, mas a combinação completa teve suporte multivariado fraco (percentil ${pct}). A investigação deve permanecer aberta.`;
}

function priorityFor(selected: OperationalEvidence[], percentile: number, row: FeatureRow): OperationalPriority {
  if (row.impactEvents > 0 || row.faultEvents >= 5 || percentile >= 0.9 || selected.some((item) => Math.abs(item.zScore) >= 3.5)) return "high";
  return "attention";
}

function categoryFor(row: FeatureRow, selected: OperationalEvidence[], ifOnly: boolean): OperationalInsightCategory {
  if (row.impactEvents > 0) return "safety";
  if (selected.some((item) => item.metric === "faultEvents")) return "reliability";
  if (ifOnly) return "multivariate";
  return "efficiency";
}

function titleFor(category: OperationalInsightCategory) {
  if (category === "safety") return "Impacto registrado em contexto fora do padrão";
  if (category === "reliability") return "Concentração incomum de registros de falha";
  if (category === "multivariate") return "Combinação operacional rara";
  return "Comportamento operacional fora do padrão";
}

function recommendationFor(category: OperationalInsightCategory, selected: OperationalEvidence[]) {
  if (category === "safety") return "Revisar o evento com segurança e operação, validando piso, rota, carga, condição do equipamento e contexto do turno. Não atribuir responsabilidade apenas pelo cartão associado.";
  if (category === "reliability") return "Revisar a recorrência dos registros de falha no equipamento e confrontar com inspeção/manutenção antes de concluir causa ou abrir corretiva.";
  if (category === "multivariate") return "Validar em campo o que mudou no dia — demanda, fila, rota, liberação de área, escala e condição do equipamento — e acompanhar dias comparáveis antes de decidir intervenção.";
  const hasWait = selected.some((item) => item.metric === "waitPct");
  const hasIdle = selected.some((item) => item.metric === "idlePct");
  const hasWork = selected.some((item) => item.metric === "workPct");
  const focus = [hasWait ? "espera" : "", hasIdle ? "ociosidade" : "", hasWork ? "queda de trabalho/chave" : ""].filter(Boolean).join(", ");
  return `Validar demanda, fila, abastecimento, liberação de área, rota e condição do equipamento${focus ? `, com foco em ${focus}` : ""}. Registrar a ação somente após validação operacional.`;
}

function summaryFor(selected: OperationalEvidence[], ifOnly: boolean, percentile: number) {
  if (ifOnly) return `Nenhuma métrica isolada cruzou o gatilho principal, mas a combinação diária ficou no percentil ${Math.round(percentile * 100)} de raridade do histórico comparável.`;
  return selected.map((item) => `${item.label}: ${item.current} ${item.unit} vs ${item.mean} (${item.zScore >= 0 ? "+" : ""}${item.zScore}σ)`).join(" · ");
}

function evidenceStrength(selected: OperationalEvidence[], percentile: number, ifOnly: boolean) {
  if (ifOnly) return Math.round(percentile * 100);
  const maxZ = Math.max(...selected.map((item) => Math.abs(item.zScore)), 0);
  const statistical = Math.min(100, 35 + maxZ * 12 + Math.max(0, selected.length - 1) * 5);
  return Math.round(statistical * 0.8 + percentile * 100 * 0.2);
}

export function analyzeOperationalAI(data: HysterData): OperationalAIResult {
  const rows = featureRows(data);
  const eventMap = eventIndex(data);
  const insights: OperationalAIInsight[] = [];

  for (const row of rows) {
    const baseline = rows.filter((candidate) => candidate.assetId === row.assetId && candidate.date < row.date && daysBetween(candidate.date, row.date) <= LOOKBACK_DAYS);
    if (baseline.length < MIN_BASELINE_SAMPLES) continue;

    const { all, selected } = triggeredEvidence(row, baseline);
    const isolation = scoreIsolationForest(baseline.map(vector), vector(row), `${row.assetId}:asset-day`, {
      trees: DEFAULT_ISOLATION_TREES,
      subsampleSize: DEFAULT_ISOLATION_SUBSAMPLE
    });
    const ifOnly = selected.length === 0 && isolation.percentile >= 0.97;
    if (selected.length === 0 && !ifOnly) continue;

    const category = categoryFor(row, selected, ifOnly);
    const agreement = multivariateAgreement(isolation.percentile);
    const related = eventMap.get(`${row.assetId}:${row.date}`);
    const detailEvidence = ifOnly
      ? Object.values(all).sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 3)
      : selected;

    insights.push({
      id: `${row.assetId}-${row.date}-${category}`,
      assetId: row.assetId,
      date: row.date,
      category,
      priority: priorityFor(detailEvidence, isolation.percentile, row),
      title: titleFor(category),
      summary: summaryFor(detailEvidence, ifOnly, isolation.percentile),
      evidenceStrength: evidenceStrength(detailEvidence, isolation.percentile, ifOnly),
      baselineSamples: baseline.length,
      lookbackDays: LOOKBACK_DAYS,
      evidence: detailEvidence,
      multivariate: {
        method: "isolation-forest",
        agreement,
        anomalyScore: round(isolation.score, 3),
        percentile: round(isolation.percentile, 3),
        trees: isolation.trees,
        sampleSize: isolation.sampleSize,
        features: [...FEATURE_KEYS],
        explanation: multivariateExplanation(agreement, isolation.percentile)
      },
      relatedEvents: { faults: related?.faults ?? 0, impacts: related?.impacts ?? 0 },
      relatedCardCodes: [...(related?.cards ?? new Set<string>())].sort(),
      recommendation: recommendationFor(category, detailEvidence),
      uncertainty: "O sinal mostra desvio ou raridade no histórico do mesmo equipamento. Não prova causa, não prevê pane e não atribui responsabilidade individual.",
      sourceRows: [row.sourceRow]
    });
  }

  const sorted = insights.sort((a, b) => b.evidenceStrength - a.evidenceStrength || b.date.localeCompare(a.date));
  return {
    method: "rolling-zscore+isolation-forest",
    lookbackDays: LOOKBACK_DAYS,
    minBaselineSamples: MIN_BASELINE_SAMPLES,
    features: [...FEATURE_KEYS],
    eligibleDays: rows.length,
    insights: sorted,
    strongAgreements: sorted.filter((item) => item.multivariate.agreement === "strong").length,
    moderateAgreements: sorted.filter((item) => item.multivariate.agreement === "moderate").length,
    weakAgreements: sorted.filter((item) => item.multivariate.agreement === "weak").length,
    guardrails: {
      cardMetricsAreContextOnly: true,
      associationNotCausation: true,
      noAutomaticDisciplinaryDecision: true,
      noFailurePrediction: true
    }
  };
}

export function operationalExplanationPacket(insight: OperationalAIInsight) {
  return {
    schemaVersion: "pulso-operational-explanation-v1" as const,
    assetId: insight.assetId,
    date: insight.date,
    category: insight.category,
    priority: insight.priority,
    title: insight.title,
    summary: insight.summary,
    evidenceStrength: insight.evidenceStrength,
    baselineSamples: insight.baselineSamples,
    lookbackDays: insight.lookbackDays,
    evidence: insight.evidence,
    multivariate: insight.multivariate,
    relatedEvents: insight.relatedEvents,
    recommendation: insight.recommendation,
    uncertainty: insight.uncertainty
  };
}
