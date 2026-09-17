import {
  workforceMetricKeys,
  workforceMetricLabels,
  type HysterData,
  type WorkforceMetricKey,
  type WorkforceMetrics
} from "./hyster.ts";

export type WorkforceProfileFamily = "utilization" | "movement" | "speed" | "hydraulics" | "load-energy";

export type WorkforceProfileSignal = {
  metric: WorkforceMetricKey;
  label: string;
  family: WorkforceProfileFamily;
  value: number;
  fleetMean: number;
  zScore: number;
  unit: string;
  normalizedBy: string;
  rawValue: number;
};

export type WorkforceAssetProfile = {
  assetId: string;
  periodStart: string;
  periodEnd: string;
  usageCount: number;
  coverageSlices: number;
  activeMetricCount: number;
  metrics: WorkforceProfileSignal[];
  signals: WorkforceProfileSignal[];
};

export type WorkforceProfileResult = {
  periodStart: string;
  periodEnd: string;
  configuredMetricCount: number;
  activeMetricCount: number;
  excludedMetrics: WorkforceMetricKey[];
  profiles: WorkforceAssetProfile[];
};

const FAMILY: Record<WorkforceMetricKey, WorkforceProfileFamily> = {
  serviceHours: "utilization",
  driveHours: "utilization",
  hydraulicMeterHours: "hydraulics",
  tractionMeterHours: "movement",
  distanceKm: "movement",
  monitoredHours: "utilization",
  keyHours: "utilization",
  presenceHours: "utilization",
  motionHours: "movement",
  hydraulicHours: "hydraulics",
  workHours: "utilization",
  liftHours: "hydraulics",
  lowerHours: "hydraulics",
  auxiliaryHydraulicHours: "hydraulics",
  lowSpeedHours: "speed",
  mediumSpeedHours: "speed",
  highSpeedHours: "speed",
  lowLevelOverspeedHours: "speed",
  highLevelOverspeedHours: "speed",
  reverseHours: "movement",
  forwardHours: "movement",
  seatBeltViolationHours: "speed",
  idleHours: "utilization",
  containerCount: "load-energy",
  energyFuelUsedLiters: "load-energy",
  ladenHours: "load-energy",
  unladenHours: "load-energy",
  workingUnladenHours: "load-energy",
  unladenDurationHours: "load-energy"
};

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

function stdDev(values: number[], avg = mean(values)) {
  if (values.length <= 1) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1));
}

function mergeMetrics(rows: WorkforceMetrics[]) {
  const merged: WorkforceMetrics = {};
  for (const key of workforceMetricKeys) {
    const values = rows.flatMap((row) => row[key] == null ? [] : [row[key] as number]);
    if (values.length) merged[key] = values.reduce((sum, value) => sum + value, 0);
  }
  return merged;
}

function normalizedValue(metric: WorkforceMetricKey, metrics: WorkforceMetrics, usageCount: number) {
  const raw = metrics[metric];
  if (raw == null || !Number.isFinite(raw)) return undefined;
  const key = metrics.keyHours ?? 0;
  const work = metrics.workHours ?? 0;
  const motion = metrics.motionHours ?? 0;
  const hydraulic = metrics.hydraulicHours ?? 0;

  if (metric === "keyHours") {
    if (usageCount <= 0) return undefined;
    return { value: raw / usageCount, unit: "h/uso", normalizedBy: "usos" };
  }

  if (metric === "distanceKm") {
    if (work <= 0) return undefined;
    return { value: raw / work, unit: "km/h trabalho", normalizedBy: "trabalho" };
  }

  if (metric === "energyFuelUsedLiters") {
    if (work <= 0) return undefined;
    return { value: raw / work, unit: "L/h trabalho", normalizedBy: "trabalho" };
  }

  if (metric === "containerCount") {
    if (work <= 0) return undefined;
    return { value: raw / work, unit: "cont./h trabalho", normalizedBy: "trabalho" };
  }

  const hydraulicMetrics: WorkforceMetricKey[] = ["liftHours", "lowerHours", "auxiliaryHydraulicHours"];
  if (hydraulicMetrics.includes(metric)) {
    const denominator = hydraulic > 0 ? hydraulic : key;
    if (denominator <= 0) return undefined;
    return { value: raw / denominator * 100, unit: "%", normalizedBy: hydraulic > 0 ? "hidráulica" : "chave" };
  }

  const motionMetrics: WorkforceMetricKey[] = [
    "lowSpeedHours",
    "mediumSpeedHours",
    "highSpeedHours",
    "lowLevelOverspeedHours",
    "highLevelOverspeedHours",
    "reverseHours",
    "forwardHours"
  ];
  if (motionMetrics.includes(metric)) {
    const denominator = motion > 0 ? motion : key;
    if (denominator <= 0) return undefined;
    return { value: raw / denominator * 100, unit: "%", normalizedBy: motion > 0 ? "movimento" : "chave" };
  }

  if (key <= 0) return undefined;
  return { value: raw / key * 100, unit: "%", normalizedBy: "chave" };
}

export function analyzeWorkforceProfiles(data: HysterData, cardCode?: string): WorkforceProfileResult | undefined {
  if (!data.workforce) return undefined;

  const cards = data.workforce.cards.filter((card) =>
    card.cardQuality === "complete" && (!cardCode || card.cardCode === cardCode)
  );

  const byAsset = new Map<string, { rows: WorkforceMetrics[]; usageCount: number; coverageSlices: number }>();
  for (const card of cards) {
    for (const asset of card.assets) {
      const current = byAsset.get(asset.assetId) ?? { rows: [], usageCount: 0, coverageSlices: 0 };
      current.rows.push(asset.metrics);
      current.usageCount += asset.usageCount;
      current.coverageSlices += 1;
      byAsset.set(asset.assetId, current);
    }
  }

  const aggregates = [...byAsset.entries()].map(([assetId, group]) => ({
    assetId,
    metrics: mergeMetrics(group.rows),
    usageCount: group.usageCount,
    coverageSlices: group.coverageSlices
  }));

  const normalized = new Map<WorkforceMetricKey, Array<{ assetId: string; value: number; rawValue: number; unit: string; normalizedBy: string }>>();
  const excludedMetrics: WorkforceMetricKey[] = [];

  for (const metric of workforceMetricKeys) {
    const values = aggregates.flatMap((asset) => {
      const value = normalizedValue(metric, asset.metrics, asset.usageCount);
      const rawValue = asset.metrics[metric];
      return value && rawValue != null
        ? [{ assetId: asset.assetId, value: value.value, rawValue, unit: value.unit, normalizedBy: value.normalizedBy }]
        : [];
    });

    const hasSignal = values.some((item) => Math.abs(item.rawValue) > 1e-9);
    const variation = values.length >= 3 ? stdDev(values.map((item) => item.value)) : 0;
    if (!hasSignal || values.length < 3 || variation < 1e-9) {
      excludedMetrics.push(metric);
      continue;
    }
    normalized.set(metric, values);
  }

  const profiles: WorkforceAssetProfile[] = aggregates.map((asset) => {
    const metrics: WorkforceProfileSignal[] = [];

    for (const [metric, rows] of normalized.entries()) {
      const current = rows.find((row) => row.assetId === asset.assetId);
      if (!current) continue;
      const values = rows.map((row) => row.value);
      const avg = mean(values);
      const sd = stdDev(values, avg);
      if (sd <= 0) continue;

      metrics.push({
        metric,
        label: workforceMetricLabels[metric],
        family: FAMILY[metric],
        value: round(current.value),
        fleetMean: round(avg),
        zScore: round((current.value - avg) / sd),
        unit: current.unit,
        normalizedBy: current.normalizedBy,
        rawValue: round(current.rawValue)
      });
    }

    const signals = [...metrics].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 3);
    return {
      assetId: asset.assetId,
      periodStart: data.workforce!.periodStart,
      periodEnd: data.workforce!.periodEnd,
      usageCount: asset.usageCount,
      coverageSlices: asset.coverageSlices,
      activeMetricCount: metrics.length,
      metrics,
      signals
    };
  }).sort((a, b) => {
    const aPeak = Math.max(...a.signals.map((item) => Math.abs(item.zScore)), 0);
    const bPeak = Math.max(...b.signals.map((item) => Math.abs(item.zScore)), 0);
    return bPeak - aPeak || a.assetId.localeCompare(b.assetId);
  });

  return {
    periodStart: data.workforce.periodStart,
    periodEnd: data.workforce.periodEnd,
    configuredMetricCount: workforceMetricKeys.length,
    activeMetricCount: normalized.size,
    excludedMetrics,
    profiles
  };
}
