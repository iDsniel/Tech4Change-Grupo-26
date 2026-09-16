import type { HistoricalShiftRecord, Insight } from "@/lib/telemetry";
import {
  DEFAULT_ISOLATION_SUBSAMPLE,
  DEFAULT_ISOLATION_TREES,
  scoreIsolationForest
} from "@/lib/isolationForestCore";

const FEATURES = [
  "fuelLiters",
  "idlePct",
  "emptyTravelPct",
  "avgSpeedKmh",
  "maxCoolantC",
  "shocks",
  "overloads"
] as const;

type AnalysisConfig = {
  lookbackDays: number;
  minBaselineSamples: number;
  evaluationStart: string;
};

export type MultivariateAgreement = "strong" | "moderate" | "weak" | "not-applicable";

export type EnrichedInsight = Insight & {
  multivariate: {
    method: "isolation-forest";
    applicable: boolean;
    statisticalScore: number;
    anomalyScore?: number;
    peakPercentile?: number;
    meanPercentile?: number;
    agreement: MultivariateAgreement;
    trees?: number;
    sampleSize?: number;
    evaluatedTurns?: number;
    features: string[];
    explanation: string;
  };
};

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function vectorFor(row: HistoricalShiftRecord) {
  return FEATURES.map((feature) => row[feature]);
}

function scoreAgainstPeers(peers: HistoricalShiftRecord[], current: HistoricalShiftRecord) {
  return scoreIsolationForest(
    peers.map(vectorFor),
    vectorFor(current),
    `${current.assetId}:${current.shift}`,
    { trees: DEFAULT_ISOLATION_TREES, subsampleSize: DEFAULT_ISOLATION_SUBSAMPLE }
  );
}

function parsePeriod(period?: string) {
  if (!period) return undefined;
  const [start, end] = period.split(" → ");
  return { start, end: end ?? start };
}

function peersFor(history: HistoricalShiftRecord[], row: HistoricalShiftRecord, config: AnalysisConfig) {
  return history
    .filter(
      (candidate) =>
        candidate.assetId === row.assetId &&
        candidate.shift === row.shift &&
        candidate.date < row.date &&
        candidate.date < config.evaluationStart
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-config.lookbackDays);
}

function agreementFor(peakPercentile: number, meanPercentile: number): MultivariateAgreement {
  if (peakPercentile >= 0.8 && meanPercentile >= 0.65) return "strong";
  if (peakPercentile >= 0.65) return "moderate";
  return "weak";
}

function explanationFor(agreement: MultivariateAgreement, peakPercentile: number) {
  const pct = Math.round(peakPercentile * 100);
  if (agreement === "strong") return `O Isolation Forest também marcou o padrão como raro: o pico ficou acima de ${pct}% dos turnos históricos comparáveis.`;
  if (agreement === "moderate") return `O modelo multivariado encontrou suporte parcial: o pico ficou acima de ${pct}% dos turnos históricos comparáveis.`;
  return `O z-score detectou o desvio, mas o modelo multivariado encontrou suporte fraco (percentil máximo ${pct}%). Mantenha a hipótese em validação.`;
}

export function fuseWithIsolationForest(
  history: HistoricalShiftRecord[],
  insights: Insight[],
  config: AnalysisConfig
) {
  let strongAgreements = 0;
  let moderateAgreements = 0;
  let weakAgreements = 0;

  const enriched: EnrichedInsight[] = insights.map((insight) => {
    if (insight.category === "maintenance") {
      return {
        ...insight,
        multivariate: {
          method: "isolation-forest",
          applicable: false,
          statisticalScore: insight.score,
          agreement: "not-applicable",
          features: [...FEATURES],
          explanation: "Manutenção programada é uma regra operacional explícita; o Isolation Forest não é usado para transformar o contador em previsão de falha."
        }
      };
    }

    const period = parsePeriod(insight.analysis?.period);
    const relevantRows = history.filter(
      (row) =>
        row.assetId === insight.assetId &&
        (!insight.operatorId || row.operatorId === insight.operatorId) &&
        (!period || (row.date >= period.start && row.date <= period.end))
    );

    const evaluations = relevantRows
      .map((row) => {
        const peers = peersFor(history, row, config);
        if (peers.length < config.minBaselineSamples) return undefined;
        return scoreAgainstPeers(peers, row);
      })
      .filter((result): result is NonNullable<typeof result> => Boolean(result));

    if (evaluations.length === 0) {
      weakAgreements += 1;
      return {
        ...insight,
        multivariate: {
          method: "isolation-forest",
          applicable: true,
          statisticalScore: insight.score,
          agreement: "weak",
          trees: DEFAULT_ISOLATION_TREES,
          features: [...FEATURES],
          explanation: "Não havia histórico comparável suficiente para uma segunda opinião multivariada."
        }
      };
    }

    const peak = evaluations.reduce((best, item) => (item.percentile > best.percentile ? item : best));
    const meanPercentile = evaluations.reduce((total, item) => total + item.percentile, 0) / evaluations.length;
    const agreement = agreementFor(peak.percentile, meanPercentile);
    if (agreement === "strong") strongAgreements += 1;
    else if (agreement === "moderate") moderateAgreements += 1;
    else weakAgreements += 1;

    const mlSupport = peak.percentile * 100;
    const fusedScore = Math.round(insight.score * 0.8 + mlSupport * 0.2);

    return {
      ...insight,
      score: fusedScore,
      multivariate: {
        method: "isolation-forest",
        applicable: true,
        statisticalScore: insight.score,
        anomalyScore: round(peak.score, 3),
        peakPercentile: round(peak.percentile, 3),
        meanPercentile: round(meanPercentile, 3),
        agreement,
        trees: DEFAULT_ISOLATION_TREES,
        sampleSize: peak.sampleSize,
        evaluatedTurns: evaluations.length,
        features: [...FEATURES],
        explanation: explanationFor(agreement, peak.percentile)
      }
    };
  });

  return {
    insights: enriched.sort((a, b) => b.score - a.score),
    analysis: {
      method: "isolation-forest" as const,
      trees: DEFAULT_ISOLATION_TREES,
      subsampleSize: DEFAULT_ISOLATION_SUBSAMPLE,
      features: [...FEATURES],
      evaluatedInsights: enriched.filter((insight) => insight.multivariate.applicable).length,
      strongAgreements,
      moderateAgreements,
      weakAgreements
    }
  };
}
