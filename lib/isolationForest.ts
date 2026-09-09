import type { HistoricalShiftRecord, Insight } from "@/lib/telemetry";

const FEATURES = [
  "fuelLiters",
  "idlePct",
  "emptyTravelPct",
  "avgSpeedKmh",
  "maxCoolantC",
  "shocks",
  "overloads"
] as const;

type FeatureKey = (typeof FEATURES)[number];
type Vector = number[];
type AnalysisConfig = {
  lookbackDays: number;
  minBaselineSamples: number;
  evaluationStart: string;
};

type IsolationNode =
  | { leaf: true; size: number }
  | { leaf: false; feature: number; split: number; left: IsolationNode; right: IsolationNode };

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

const TREES = 96;
const SUBSAMPLE_SIZE = 16;

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function vectorFor(row: HistoricalShiftRecord): Vector {
  return FEATURES.map((feature) => row[feature]);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function harmonic(number: number) {
  let total = 0;
  for (let value = 1; value <= number; value += 1) total += 1 / value;
  return total;
}

function averagePathLength(size: number) {
  if (size <= 1) return 0;
  if (size === 2) return 1;
  return 2 * harmonic(size - 1) - (2 * (size - 1)) / size;
}

function sampleWithoutReplacement<T>(items: T[], size: number, random: () => number) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy.slice(0, size);
}

function buildTree(points: Vector[], depth: number, maxDepth: number, random: () => number): IsolationNode {
  if (depth >= maxDepth || points.length <= 1) return { leaf: true, size: points.length };

  const candidates: Array<{ feature: number; min: number; max: number }> = [];
  for (let feature = 0; feature < FEATURES.length; feature += 1) {
    const values = points.map((point) => point[feature]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (max > min) candidates.push({ feature, min, max });
  }

  if (candidates.length === 0) return { leaf: true, size: points.length };

  const selected = candidates[Math.floor(random() * candidates.length)];
  const split = selected.min + random() * (selected.max - selected.min);
  const left = points.filter((point) => point[selected.feature] < split);
  const right = points.filter((point) => point[selected.feature] >= split);

  if (left.length === 0 || right.length === 0) return { leaf: true, size: points.length };

  return {
    leaf: false,
    feature: selected.feature,
    split,
    left: buildTree(left, depth + 1, maxDepth, random),
    right: buildTree(right, depth + 1, maxDepth, random)
  };
}

function pathLength(node: IsolationNode, point: Vector, depth = 0): number {
  if (node.leaf) return depth + (node.size > 1 ? averagePathLength(node.size) : 0);
  return pathLength(point[node.feature] < node.split ? node.left : node.right, point, depth + 1);
}

function buildForest(training: Vector[], seed: number) {
  const sampleSize = Math.min(SUBSAMPLE_SIZE, training.length);
  const maxDepth = Math.ceil(Math.log2(Math.max(2, sampleSize)));
  const forest: IsolationNode[] = [];

  for (let tree = 0; tree < TREES; tree += 1) {
    const random = seededRandom((seed + Math.imul(tree + 1, 2654435761)) >>> 0);
    const sample = sampleWithoutReplacement(training, sampleSize, random);
    forest.push(buildTree(sample, 0, maxDepth, random));
  }

  return { forest, sampleSize };
}

function anomalyScore(forest: IsolationNode[], sampleSize: number, point: Vector) {
  const normalizer = averagePathLength(sampleSize);
  if (normalizer === 0) return 0.5;
  const meanPath = forest.reduce((total, tree) => total + pathLength(tree, point), 0) / forest.length;
  return 2 ** (-meanPath / normalizer);
}

function scoreAgainstPeers(peers: HistoricalShiftRecord[], current: HistoricalShiftRecord) {
  const training = peers.map(vectorFor);
  const seed = hashString(`${current.assetId}:${current.shift}`);
  const { forest, sampleSize } = buildForest(training, seed);
  const peerScores = training.map((point) => anomalyScore(forest, sampleSize, point));
  const currentScore = anomalyScore(forest, sampleSize, vectorFor(current));
  const percentile = peerScores.filter((score) => score <= currentScore).length / Math.max(1, peerScores.length);
  return { score: currentScore, percentile, sampleSize };
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
          trees: TREES,
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
        trees: TREES,
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
      trees: TREES,
      subsampleSize: SUBSAMPLE_SIZE,
      features: [...FEATURES],
      evaluatedInsights: enriched.filter((insight) => insight.multivariate.applicable).length,
      strongAgreements,
      moderateAgreements,
      weakAgreements
    }
  };
}
