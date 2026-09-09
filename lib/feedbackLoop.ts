import type { EnrichedInsight } from "@/lib/isolationForest";
import type { HistoricalShiftRecord, StatisticalEvidence } from "@/lib/telemetry";

export type FeedbackStatus = "improved" | "stable" | "worsened" | "insufficient-data" | "not-applicable";

export type InterventionRecord = {
  id: string;
  insightId: string;
  appliedAt: string;
  targetTurns: number;
  actionType: "operator_coaching" | "safety_coaching" | "load_procedure_review" | "maintenance_action" | "process_change";
  actorRole: string;
  note: string;
};

export type FeedbackMetric = {
  metric: StatisticalEvidence["metric"];
  label: string;
  unit: string;
  baselineMean: number;
  baselineStdDev: number;
  beforeValue: number;
  beforeAbsZ: number;
  afterMean: number;
  afterAbsZ: number;
  convergencePct: number;
};

export type FeedbackAssessment = {
  schemaVersion: "telemetry-feedback-v1";
  intervention: InterventionRecord;
  insightId: string;
  assetId: string;
  operatorReference?: string;
  status: FeedbackStatus;
  context: {
    shift?: HistoricalShiftRecord["shift"];
    comparisonScope: "asset-shift" | "asset";
    observedTurns: number;
    targetTurns: number;
    sameOperatorTurns: number;
    period?: string;
  };
  convergence: {
    beforeMeanAbsZ?: number;
    afterMeanAbsZ?: number;
    improvementPct?: number;
    metrics: FeedbackMetric[];
  };
  impact: {
    fuelLitersPerShiftDelta?: number;
    idlePercentagePointsDelta?: number;
    estimatedFuelSavedAcrossObservedTurns?: number;
  };
  interpretation: string;
  guardrails: {
    associationNotCausation: true;
    noAutomaticDisciplinaryDecision: true;
    contextMustBeValidated: true;
    operatorComparisonIsSecondary: true;
  };
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function periodBounds(period?: string) {
  if (!period) return undefined;
  const [start, end] = period.split(" → ");
  return { start, end: end ?? start };
}

function chooseShift(history: HistoricalShiftRecord[], insight: EnrichedInsight) {
  const bounds = periodBounds(insight.analysis?.period);
  if (!bounds) return undefined;

  const candidates = history.filter(
    (row) =>
      row.assetId === insight.assetId &&
      row.date >= bounds.start &&
      row.date <= bounds.end &&
      (!insight.operatorId || row.operatorId === insight.operatorId)
  );

  const counts = new Map<HistoricalShiftRecord["shift"], number>();
  for (const row of candidates) counts.set(row.shift, (counts.get(row.shift) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function metricValue(row: HistoricalShiftRecord, evidence: StatisticalEvidence) {
  return row[evidence.metric];
}

function buildMetricAssessment(evidence: StatisticalEvidence, rows: HistoricalShiftRecord[]): FeedbackMetric {
  const afterMean = mean(rows.map((row) => metricValue(row, evidence)));
  const afterZ = Math.abs((afterMean - evidence.mean) / Math.max(evidence.stdDev, Number.EPSILON));
  const beforeAbsZ = Math.abs(evidence.zScore);
  const convergencePct = beforeAbsZ > 0 ? clamp(((beforeAbsZ - afterZ) / beforeAbsZ) * 100, -100, 100) : 0;

  return {
    metric: evidence.metric,
    label: evidence.label,
    unit: evidence.unit,
    baselineMean: round(evidence.mean),
    baselineStdDev: round(evidence.stdDev),
    beforeValue: round(evidence.current),
    beforeAbsZ: round(beforeAbsZ),
    afterMean: round(afterMean),
    afterAbsZ: round(afterZ),
    convergencePct: round(convergencePct, 1)
  };
}

function feedbackStatus(beforeMeanAbsZ: number, afterMeanAbsZ: number, improvementPct: number, observedTurns: number) : FeedbackStatus {
  if (observedTurns < 2) return "insufficient-data";
  if (afterMeanAbsZ <= 1.25 && improvementPct >= 35) return "improved";
  if (afterMeanAbsZ > beforeMeanAbsZ * 1.1) return "worsened";
  return "stable";
}

function interpretation(status: FeedbackStatus, improvementPct?: number, observedTurns?: number) {
  if (status === "improved") return `Os sinais acompanhados se aproximaram do baseline após a orientação (${round(improvementPct ?? 0, 1)}% de convergência média em ${observedTurns ?? 0} turnos). Isso é evidência de melhora temporal, não prova isolada de causalidade.`;
  if (status === "worsened") return "Os sinais se afastaram ainda mais do baseline após a orientação. Amplie a investigação antes de atribuir causa ao operador, máquina ou processo.";
  if (status === "stable") return "Os sinais ainda não voltaram claramente ao baseline. Continue o acompanhamento e valide contexto operacional antes de concluir se a ação teve efeito.";
  if (status === "not-applicable") return "Este insight não possui um ciclo de feedback comportamental aplicável neste MVP.";
  return "Ainda não existem turnos comparáveis suficientes após a intervenção para avaliar tendência com segurança.";
}

export function assessIntervention(
  history: HistoricalShiftRecord[],
  insight: EnrichedInsight,
  intervention: InterventionRecord
): FeedbackAssessment {
  const base = {
    schemaVersion: "telemetry-feedback-v1" as const,
    intervention,
    insightId: insight.id,
    assetId: insight.assetId,
    operatorReference: insight.operatorId,
    guardrails: {
      associationNotCausation: true as const,
      noAutomaticDisciplinaryDecision: true as const,
      contextMustBeValidated: true as const,
      operatorComparisonIsSecondary: true as const
    }
  };

  if (!insight.analysis || insight.analysis.statisticalEvidence.length === 0 || insight.category === "maintenance") {
    return {
      ...base,
      status: "not-applicable",
      context: {
        comparisonScope: "asset",
        observedTurns: 0,
        targetTurns: intervention.targetTurns,
        sameOperatorTurns: 0
      },
      convergence: { metrics: [] },
      impact: {},
      interpretation: interpretation("not-applicable")
    };
  }

  const shift = chooseShift(history, insight);
  const comparable = history
    .filter(
      (row) =>
        row.assetId === insight.assetId &&
        row.date > intervention.appliedAt &&
        (!shift || row.shift === shift)
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, intervention.targetTurns);

  const sameOperatorTurns = insight.operatorId
    ? comparable.filter((row) => row.operatorId === insight.operatorId).length
    : 0;

  const period = comparable.length
    ? comparable[0].date === comparable[comparable.length - 1].date
      ? comparable[0].date
      : `${comparable[0].date} → ${comparable[comparable.length - 1].date}`
    : undefined;

  if (comparable.length === 0) {
    return {
      ...base,
      status: "insufficient-data",
      context: {
        shift,
        comparisonScope: shift ? "asset-shift" : "asset",
        observedTurns: 0,
        targetTurns: intervention.targetTurns,
        sameOperatorTurns: 0
      },
      convergence: { metrics: [] },
      impact: {},
      interpretation: interpretation("insufficient-data")
    };
  }

  const metrics = insight.analysis.statisticalEvidence.map((evidence) => buildMetricAssessment(evidence, comparable));
  const beforeMeanAbsZ = mean(metrics.map((metric) => metric.beforeAbsZ));
  const afterMeanAbsZ = mean(metrics.map((metric) => metric.afterAbsZ));
  const improvementPct = beforeMeanAbsZ > 0 ? clamp(((beforeMeanAbsZ - afterMeanAbsZ) / beforeMeanAbsZ) * 100, -100, 100) : 0;
  const status = feedbackStatus(beforeMeanAbsZ, afterMeanAbsZ, improvementPct, comparable.length);

  const fuel = metrics.find((metric) => metric.metric === "fuelLiters");
  const idle = metrics.find((metric) => metric.metric === "idlePct");
  const fuelDelta = fuel ? fuel.beforeValue - fuel.afterMean : undefined;

  return {
    ...base,
    status,
    context: {
      shift,
      comparisonScope: shift ? "asset-shift" : "asset",
      observedTurns: comparable.length,
      targetTurns: intervention.targetTurns,
      sameOperatorTurns,
      period
    },
    convergence: {
      beforeMeanAbsZ: round(beforeMeanAbsZ),
      afterMeanAbsZ: round(afterMeanAbsZ),
      improvementPct: round(improvementPct, 1),
      metrics
    },
    impact: {
      fuelLitersPerShiftDelta: fuelDelta !== undefined ? round(fuelDelta, 1) : undefined,
      idlePercentagePointsDelta: idle ? round(idle.beforeValue - idle.afterMean, 1) : undefined,
      estimatedFuelSavedAcrossObservedTurns: fuelDelta !== undefined ? round(Math.max(0, fuelDelta) * comparable.length, 1) : undefined
    },
    interpretation: interpretation(status, improvementPct, comparable.length)
  };
}
