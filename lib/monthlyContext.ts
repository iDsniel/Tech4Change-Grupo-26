import { workforceCardSlices, workforceMetricKeys, type HysterData, type WorkforceMetrics } from "./hyster.ts";
import type { DailyInput } from "./operations.ts";
import { operationalShiftForTime, type OperationalShiftCode } from "./operationProfile.ts";

export type MonthlyBusinessSnapshot = {
  month: string;
  periodStart: string;
  periodEnd: string;
  assetId: string;
  usageCount: number;
  metrics: WorkforceMetrics;
  activity: {
    workPct: number | null;
    hydraulicPct: number | null;
    motionPct: number | null;
    idlePct: number | null;
    liftShareOfHydraulicPct: number | null;
    lowerShareOfHydraulicPct: number | null;
    auxiliaryShareOfHydraulicPct: number | null;
  };
  travelSafety: {
    marchPct: number | null;
    forwardSharePct: number | null;
    reverseSharePct: number | null;
    lowSpeedSharePct: number | null;
    mediumSpeedSharePct: number | null;
    highSpeedSharePct: number | null;
    overspeedSharePct: number | null;
    seatBeltViolationPct: number | null;
  };
  events: {
    impacts: number;
    faults: number;
    byShift: Record<OperationalShiftCode, { impacts: number; faults: number; total: number }>;
  };
  business: {
    costBRL: number | null;
    production: {
      pallets: number | null;
      tonnes: number | null;
      movements: number | null;
    };
    costPerPallet: number | null;
  };
};

export type MonthlyMetricDelta = {
  current: number | null;
  previous: number | null;
  delta: number | null;
};

export type MonthlyBusinessComparison = {
  current: MonthlyBusinessSnapshot;
  previous?: MonthlyBusinessSnapshot;
  changes: {
    workPct: MonthlyMetricDelta;
    hydraulicPct: MonthlyMetricDelta;
    motionPct: MonthlyMetricDelta;
    idlePct: MonthlyMetricDelta;
    reverseSharePct: MonthlyMetricDelta;
    highSpeedSharePct: MonthlyMetricDelta;
    overspeedSharePct: MonthlyMetricDelta;
    impacts: MonthlyMetricDelta;
  };
};

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const ratio = (numerator: number | undefined, denominator: number | undefined) =>
  numerator != null && denominator != null && denominator > 0 ? round(numerator / denominator * 100) : null;

function mergeMetrics(rows: WorkforceMetrics[]) {
  const merged: WorkforceMetrics = {};
  for (const key of workforceMetricKeys) {
    const values = rows.flatMap((row) => row[key] == null ? [] : [row[key] as number]);
    if (values.length) merged[key] = round(values.reduce((sum, value) => sum + value, 0));
  }
  return merged;
}

function emptyShiftCounts(): Record<OperationalShiftCode, { impacts: number; faults: number; total: number }> {
  return {
    A: { impacts: 0, faults: 0, total: 0 },
    B: { impacts: 0, faults: 0, total: 0 },
    C: { impacts: 0, faults: 0, total: 0 }
  };
}

function businessInputs(inputs: DailyInput[], assetId: string, start: string, end: string) {
  const rows = inputs.filter((row) => row.assetId === assetId && row.date >= start && row.date <= end);
  const costs = rows.flatMap((row) => row.costBRL == null ? [] : [row.costBRL]);
  const sumUnit = (unit: DailyInput["productionUnit"]) => {
    const values = rows.flatMap((row) => row.productionUnit === unit && row.production != null ? [row.production] : []);
    return values.length ? round(values.reduce((sum, value) => sum + value, 0)) : null;
  };
  const costBRL = costs.length ? round(costs.reduce((sum, value) => sum + value, 0)) : null;
  const pallets = sumUnit("pallets");
  return {
    costBRL,
    production: {
      pallets,
      tonnes: sumUnit("t"),
      movements: sumUnit("movimentos")
    },
    costPerPallet: costBRL != null && pallets != null && pallets > 0 ? round(costBRL / pallets) : null
  };
}

export function monthlyBusinessSnapshots(data: HysterData, assetId: string, cardCode = "all", inputs: DailyInput[] = []): MonthlyBusinessSnapshot[] {
  const periods = workforceCardSlices(data);
  return periods.flatMap((period) => {
    const cards = period.cards.filter((card) => card.cardQuality === "complete" && (cardCode === "all" || card.cardCode === cardCode));
    const slices = cards.flatMap((card) => card.assets.filter((asset) => asset.assetId === assetId));
    if (!slices.length) return [];

    const metrics = mergeMetrics(slices.map((slice) => slice.metrics));
    const marchHours = metrics.forwardHours != null && metrics.reverseHours != null
      ? metrics.forwardHours + metrics.reverseHours
      : undefined;
    const overspeedHours = metrics.lowLevelOverspeedHours != null || metrics.highLevelOverspeedHours != null
      ? (metrics.lowLevelOverspeedHours ?? 0) + (metrics.highLevelOverspeedHours ?? 0)
      : undefined;

    const shiftCounts = emptyShiftCounts();
    const events = data.events.filter((event) =>
      event.assetId === assetId &&
      event.date >= period.periodStart &&
      event.date <= period.periodEnd &&
      (cardCode === "all" || event.cardCode === cardCode)
    );
    for (const event of events) {
      const shift = operationalShiftForTime(event.time);
      if (!shift) continue;
      shiftCounts[shift].total += 1;
      if (event.type === "Impacto") shiftCounts[shift].impacts += 1;
      if (event.type === "Falha do sistema") shiftCounts[shift].faults += 1;
    }

    return [{
      month: period.periodStart.slice(0, 7),
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      assetId,
      usageCount: slices.reduce((sum, slice) => sum + slice.usageCount, 0),
      metrics,
      activity: {
        workPct: ratio(metrics.workHours, metrics.keyHours),
        hydraulicPct: ratio(metrics.hydraulicHours, metrics.keyHours),
        motionPct: ratio(metrics.motionHours, metrics.keyHours),
        idlePct: ratio(metrics.idleHours, metrics.keyHours),
        liftShareOfHydraulicPct: ratio(metrics.liftHours, metrics.hydraulicHours),
        lowerShareOfHydraulicPct: ratio(metrics.lowerHours, metrics.hydraulicHours),
        auxiliaryShareOfHydraulicPct: ratio(metrics.auxiliaryHydraulicHours, metrics.hydraulicHours)
      },
      travelSafety: {
        marchPct: ratio(marchHours, metrics.keyHours),
        forwardSharePct: ratio(metrics.forwardHours, marchHours),
        reverseSharePct: ratio(metrics.reverseHours, marchHours),
        lowSpeedSharePct: ratio(metrics.lowSpeedHours, metrics.motionHours),
        mediumSpeedSharePct: ratio(metrics.mediumSpeedHours, metrics.motionHours),
        highSpeedSharePct: ratio(metrics.highSpeedHours, metrics.motionHours),
        overspeedSharePct: ratio(overspeedHours, metrics.motionHours),
        seatBeltViolationPct: ratio(metrics.seatBeltViolationHours, metrics.keyHours)
      },
      events: {
        impacts: events.filter((event) => event.type === "Impacto").length,
        faults: events.filter((event) => event.type === "Falha do sistema").length,
        byShift: shiftCounts
      },
      business: businessInputs(inputs, assetId, period.periodStart, period.periodEnd)
    }];
  }).sort((a, b) => a.month.localeCompare(b.month));
}

function delta(current: number | null, previous: number | null): MonthlyMetricDelta {
  return { current, previous, delta: current != null && previous != null ? round(current - previous) : null };
}

export function monthlyBusinessComparison(data: HysterData, assetId: string, month: string, cardCode = "all", inputs: DailyInput[] = []): MonthlyBusinessComparison | undefined {
  const snapshots = monthlyBusinessSnapshots(data, assetId, cardCode, inputs);
  const index = snapshots.findIndex((item) => item.month === month);
  if (index < 0) return undefined;
  const current = snapshots[index];
  const previous = index > 0 ? snapshots[index - 1] : undefined;
  return {
    current,
    previous,
    changes: {
      workPct: delta(current.activity.workPct, previous?.activity.workPct ?? null),
      hydraulicPct: delta(current.activity.hydraulicPct, previous?.activity.hydraulicPct ?? null),
      motionPct: delta(current.activity.motionPct, previous?.activity.motionPct ?? null),
      idlePct: delta(current.activity.idlePct, previous?.activity.idlePct ?? null),
      reverseSharePct: delta(current.travelSafety.reverseSharePct, previous?.travelSafety.reverseSharePct ?? null),
      highSpeedSharePct: delta(current.travelSafety.highSpeedSharePct, previous?.travelSafety.highSpeedSharePct ?? null),
      overspeedSharePct: delta(current.travelSafety.overspeedSharePct, previous?.travelSafety.overspeedSharePct ?? null),
      impacts: delta(current.events.impacts, previous?.events.impacts ?? null)
    }
  };
}
