import { scoreIsolationForest } from "./isolationForestCore.ts";

export type DemoShift = "A" | "B" | "C";
export type DemoUsageContext = "production" | "maintenance";

export type CyclePhase = {
  approachEmptySec: number;
  pickupSec: number;
  loadedTransferSec: number;
  depositSec: number;
  averageCycleSec: number;
};

export type KoneDemoRecord = {
  date: string;
  assetId: string;
  shift: DemoShift;
  usageContext: DemoUsageContext;

  // OEM-like telemetry normalized by Pulso for the demo.
  runningHours: number;
  drivingHours: number;
  idleHours: number;
  offDutyHours: number;
  distanceKm: number;
  avgSpeedKmh: number;
  highSpeedSharePct: number;
  fuelLiters: number;
  totalLoadLiftedT: number;
  loadedTravelPct: number;
  emptyTravelPct: number;
  shocks: number;
  overloads: number;
  coolantHighAlerts: number;
  oilPressureAlerts: number;
  transmissionTempAlerts: number;
  maintenanceHoursRemaining: number;

  // Synthetic process layer. These fields are not claimed as native Konecranes telemetry.
  productiveCycles: number;
  balesMoved: number;
  plannedDemandT: number;
  downtimeHours: number;
  cycle: CyclePhase;
};

export type KoneDemoInsight = {
  id: string;
  assetId: string;
  date: string;
  shift: DemoShift;
  category: "productivity" | "safety" | "maintenance";
  priority: "attention" | "high";
  headline: string;
  whatHappened: string;
  whyItMatters: string;
  verify: string[];
  context: string;
  cycleContext?: {
    averageCycleSec: number;
    baselineAverageCycleSec: number;
    slowestPhase: "approachEmptySec" | "pickupSec" | "loadedTransferSec" | "depositSec";
    slowestPhaseLabel: string;
    slowestPhaseDeltaSec: number;
  };
  businessImpact?: {
    downtimeHours: number;
    baselineTonnesPerRunningHour: number;
    capacityUnavailableT: number;
    fleetAbsorbedT: number;
    effectiveOperationalImpactT: number;
    monetaryImpactBRL: null;
  };
  technical: {
    baselineSamples: number;
    trainingWindow: string;
    evidence: Array<{ label: string; current: number; median: number; robustZ: number; unit: string }>;
    isolationForestPercentile: number | null;
  };
};

export const koneDemoScenario = {
  name: "Operação simulada de celulose",
  product: "Pulso · cenário ideal multi-OEM",
  providerReference: "Konecranes TRUCONNECT public lift-truck concepts",
  fleetSize: 6,
  truckCapacityT: 16,
  baleWeightT: 2,
  balesPerLoadedMovement: 2,
  tonnesPerLoadedMovement: 4,
  shifts: [
    { code: "A" as const, start: "07:00", end: "15:00" },
    { code: "B" as const, start: "15:00", end: "23:00" },
    { code: "C" as const, start: "23:00", end: "07:00" }
  ],
  businessRule: "Cada ciclo produtivo concluído da demo transporta 2 fardos de 2 t = 4 t.",
  cycleModel: {
    phases: [
      "aproximação vazia",
      "coleta/engate da carga",
      "transferência carregada",
      "posicionamento e depósito"
    ],
    disclaimer: "As fases do ciclo são uma camada de processo sintética do Pulso. A documentação pública Konecranes usada não é apresentada como fonte de tempos de fase, direção frente/ré ou atividade hidráulica."
  },
  granularity: {
    pulsoNormalized: "asset-shift",
    providerNative: "A documentação pública consultada descreve dados de uso e operação, mas não especifica resolução nativa por turno. O turno é uma normalização sintética do Pulso para a demo."
  },
  learning: {
    periodStart: "2026-03-01",
    trainingEnd: "2026-07-31",
    evaluationStart: "2026-08-01",
    periodEnd: "2026-08-31",
    strategy: "Cinco meses formam o baseline por ativo + turno; agosto é holdout para demonstrar detecção sem treinar nos desvios apresentados."
  }
} as const;

const assets = Array.from({ length: koneDemoScenario.fleetSize }, (_, index) => ({
  assetId: `KLT-${String(index + 1).padStart(2, "0")}`,
  capacity: "16 t"
}));

const shifts: DemoShift[] = ["A", "B", "C"];
const TRAINING_START = koneDemoScenario.learning.periodStart;
const TRAINING_END = koneDemoScenario.learning.trainingEnd;
const EVALUATION_START = koneDemoScenario.learning.evaluationStart;
const PERIOD_END = koneDemoScenario.learning.periodEnd;
const MIN_BASELINE_SAMPLES = 60;

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function dateRange(start: string, end: string) {
  const rows: string[] = [];
  const cursor = new Date(`${start}T12:00:00Z`);
  const stop = new Date(`${end}T12:00:00Z`);
  while (cursor <= stop) {
    rows.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return rows;
}

function wave(seed: number) {
  return Math.sin(seed * 0.73) * 0.62 + Math.cos(seed * 0.31) * 0.38;
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

function seasonalDemandFactor(date: string) {
  const month = Number(date.slice(5, 7));
  const day = weekday(date);
  const monthFactor = ({ 3: 0.96, 4: 1.00, 5: 1.04, 6: 1.02, 7: 1.06, 8: 1.05 } as Record<number, number>)[month] ?? 1;
  const weekdayFactor = day === 0 ? 0.82 : day === 6 ? 0.90 : 1;
  return monthFactor * weekdayFactor;
}

function baselineCycle(seed: number, assetIndex: number, shiftIndex: number): CyclePhase {
  const approach = 43 + wave(seed + 2) * 5 + shiftIndex * 1.5;
  const pickup = 36 + wave(seed + 4) * 3 + assetIndex * 0.35;
  const loadedTransfer = 84 + wave(seed + 7) * 7 + assetIndex * 1.1;
  const deposit = 38 + wave(seed + 10) * 4;
  return {
    approachEmptySec: round(approach),
    pickupSec: round(pickup),
    loadedTransferSec: round(loadedTransfer),
    depositSec: round(deposit),
    averageCycleSec: round(approach + pickup + loadedTransfer + deposit)
  };
}

function applyScenario(
  date: string,
  assetId: string,
  shift: DemoShift,
  cycle: CyclePhase,
  values: {
    idlePct: number;
    avgSpeedKmh: number;
    highSpeedSharePct: number;
    emptyTravelPct: number;
    productiveCycles: number;
    shocks: number;
    overloads: number;
    downtimeHours: number;
    usageContext: DemoUsageContext;
    transmissionTempAlerts: number;
  }
) {
  // Training months contain normal variability plus explicit maintenance context,
  // so the engine learns that low output during maintenance is not a productivity failure.
  if (assetId === "KLT-02" && shift === "C" && (
    (date >= "2026-04-13" && date <= "2026-04-15") ||
    (date >= "2026-06-22" && date <= "2026-06-24") ||
    (date >= "2026-08-05" && date <= "2026-08-07")
  )) {
    values.usageContext = "maintenance";
    values.productiveCycles = 6;
    values.idlePct = 31;
    values.emptyTravelPct = 58;
    cycle.approachEmptySec = 78;
    cycle.pickupSec = 44;
    cycle.loadedTransferSec = 112;
    cycle.depositSec = 48;
  }

  // Evaluation: flow bottleneck. The slowest part is empty approach / access to bales.
  if (assetId === "KLT-03" && shift === "B" && date >= "2026-08-10" && date <= "2026-08-20") {
    cycle.approachEmptySec += 48;
    values.idlePct += 13;
    values.emptyTravelPct += 10;
    values.productiveCycles -= 18;
  }

  // Evaluation: safety context. Faster travel accompanies shocks; not automatically called a violation.
  if (assetId === "KLT-04" && shift === "C" && date >= "2026-08-14" && date <= "2026-08-16") {
    values.avgSpeedKmh += 4.3;
    values.highSpeedSharePct += 22;
    cycle.loadedTransferSec = Math.max(48, cycle.loadedTransferSec - 22);
    values.shocks = date === "2026-08-15" ? 3 : 2;
  }

  // Evaluation: maintenance / availability. Other trucks partially compensate in the same shift.
  if (assetId === "KLT-05" && shift === "B" && date === "2026-08-21") {
    values.transmissionTempAlerts = 1;
    values.downtimeHours = 2.5;
    values.productiveCycles -= 28;
    values.idlePct += 10;
  }
  if ((assetId === "KLT-01" || assetId === "KLT-06") && shift === "B" && date === "2026-08-21") {
    values.productiveCycles += 9;
  }

  cycle.averageCycleSec = round(cycle.approachEmptySec + cycle.pickupSec + cycle.loadedTransferSec + cycle.depositSec);
}

export function generateKoneDemoRecords(): KoneDemoRecord[] {
  const rows: KoneDemoRecord[] = [];
  const dates = dateRange(TRAINING_START, PERIOD_END);

  for (let dayIndex = 0; dayIndex < dates.length; dayIndex += 1) {
    const date = dates[dayIndex];
    for (let assetIndex = 0; assetIndex < assets.length; assetIndex += 1) {
      const asset = assets[assetIndex];
      for (let shiftIndex = 0; shiftIndex < shifts.length; shiftIndex += 1) {
        const shift = shifts[shiftIndex];
        const seed = dayIndex * 17 + assetIndex * 11 + shiftIndex * 7 + 3;
        const cycle = baselineCycle(seed, assetIndex, shiftIndex);
        const demandFactor = seasonalDemandFactor(date);

        let runningHours = clamp(7.15 + wave(seed) * 0.28 + shiftIndex * 0.05, 6.35, 7.8);
        let idlePct = clamp(16.5 + wave(seed + 5) * 3.1 + assetIndex * 0.42, 9, 27);
        let avgSpeedKmh = clamp(10.7 + wave(seed + 9) * 0.85 - assetIndex * 0.08, 8.5, 13.2);
        let highSpeedSharePct = clamp(8.3 + wave(seed + 12) * 2.8, 2, 16);
        let emptyTravelPct = clamp(35.5 + wave(seed + 15) * 4.2 + shiftIndex, 25, 48);
        let shocks = date >= "2026-05-01" && seed % 211 === 0 ? 1 : 0;
        let overloads = 0;
        let coolantHighAlerts = 0;
        let oilPressureAlerts = 0;
        let transmissionTempAlerts = 0;
        let downtimeHours = 0;
        let usageContext: DemoUsageContext = "production";

        const activeHours = runningHours * (1 - idlePct / 100);
        const theoreticalCycles = Math.floor(activeHours * 3600 / cycle.averageCycleSec);
        const baseDemandCycles = Math.round((88 + assetIndex * 2.2 + wave(seed + 19) * 7) * demandFactor);
        let productiveCycles = Math.max(18, Math.min(theoreticalCycles, baseDemandCycles));

        applyScenario(date, asset.assetId, shift, cycle, {
          get idlePct() { return idlePct; },
          set idlePct(value) { idlePct = value; },
          get avgSpeedKmh() { return avgSpeedKmh; },
          set avgSpeedKmh(value) { avgSpeedKmh = value; },
          get highSpeedSharePct() { return highSpeedSharePct; },
          set highSpeedSharePct(value) { highSpeedSharePct = value; },
          get emptyTravelPct() { return emptyTravelPct; },
          set emptyTravelPct(value) { emptyTravelPct = value; },
          get productiveCycles() { return productiveCycles; },
          set productiveCycles(value) { productiveCycles = value; },
          get shocks() { return shocks; },
          set shocks(value) { shocks = value; },
          get overloads() { return overloads; },
          set overloads(value) { overloads = value; },
          get downtimeHours() { return downtimeHours; },
          set downtimeHours(value) { downtimeHours = value; },
          get usageContext() { return usageContext; },
          set usageContext(value) { usageContext = value; },
          get transmissionTempAlerts() { return transmissionTempAlerts; },
          set transmissionTempAlerts(value) { transmissionTempAlerts = value; }
        });

        idlePct = clamp(idlePct, 0, 65);
        highSpeedSharePct = clamp(highSpeedSharePct, 0, 60);
        emptyTravelPct = clamp(emptyTravelPct, 0, 80);
        productiveCycles = Math.max(0, Math.round(productiveCycles));

        const idleHours = runningHours * idlePct / 100;
        const drivingHours = Math.max(0.6, runningHours - idleHours - downtimeHours * 0.35);
        const offDutyHours = Math.max(0, 8 - runningHours + downtimeHours);
        const totalLoadLiftedT = productiveCycles * koneDemoScenario.tonnesPerLoadedMovement;
        const balesMoved = productiveCycles * koneDemoScenario.balesPerLoadedMovement;
        const loadedTravelPct = Math.max(0, 100 - emptyTravelPct);
        const distanceKm = drivingHours * avgSpeedKmh;
        const plannedDemandT = usageContext === "maintenance"
          ? 0
          : Math.max(totalLoadLiftedT, baseDemandCycles * koneDemoScenario.tonnesPerLoadedMovement);

        let fuelLiters =
          15 +
          drivingHours * 3.8 +
          totalLoadLiftedT * 0.043 +
          Math.max(0, idlePct - 17) * 0.24 +
          wave(seed + 27) * 1.3;

        if (asset.assetId === "KLT-03" && shift === "B" && date >= "2026-08-10" && date <= "2026-08-20") fuelLiters += 5.1;

        const baseMaintenance = [580, 620, 540, 690, 410, 650][assetIndex];
        const cumulativeUsage = dayIndex * 1.32 + shiftIndex * 0.24;
        let maintenanceHoursRemaining = Math.max(0, baseMaintenance - cumulativeUsage);
        // Simulate maintenance resets without claiming prediction: service counter returns to a new interval.
        if (asset.assetId === "KLT-05" && date > "2026-06-18") maintenanceHoursRemaining = Math.max(0, 430 - (dayIndex - 109) * 1.32 - shiftIndex * 0.24);

        rows.push({
          date,
          assetId: asset.assetId,
          shift,
          usageContext,
          runningHours: round(runningHours),
          drivingHours: round(drivingHours),
          idleHours: round(idleHours),
          offDutyHours: round(offDutyHours),
          distanceKm: round(distanceKm),
          avgSpeedKmh: round(avgSpeedKmh),
          highSpeedSharePct: round(highSpeedSharePct),
          fuelLiters: round(Math.max(4, fuelLiters)),
          totalLoadLiftedT,
          loadedTravelPct: round(loadedTravelPct),
          emptyTravelPct: round(emptyTravelPct),
          shocks,
          overloads,
          coolantHighAlerts,
          oilPressureAlerts,
          transmissionTempAlerts,
          maintenanceHoursRemaining: round(maintenanceHoursRemaining),
          productiveCycles,
          balesMoved,
          plannedDemandT: round(plannedDemandT),
          downtimeHours: round(downtimeHours),
          cycle: {
            approachEmptySec: round(cycle.approachEmptySec),
            pickupSec: round(cycle.pickupSec),
            loadedTransferSec: round(cycle.loadedTransferSec),
            depositSec: round(cycle.depositSec),
            averageCycleSec: round(cycle.averageCycleSec)
          }
        });
      }
    }
  }
  return rows;
}

type MetricKey =
  | "idlePct"
  | "emptyTravelPct"
  | "avgSpeedKmh"
  | "highSpeedSharePct"
  | "fuelPerTonne"
  | "tonnesPerRunningHour"
  | "cyclesPerRunningHour"
  | "averageCycleSec"
  | "approachEmptySec"
  | "pickupSec"
  | "loadedTransferSec"
  | "depositSec"
  | "shocks";

function metricValue(row: KoneDemoRecord, metric: MetricKey) {
  if (metric === "idlePct") return row.runningHours > 0 ? row.idleHours / row.runningHours * 100 : 0;
  if (metric === "fuelPerTonne") return row.totalLoadLiftedT > 0 ? row.fuelLiters / row.totalLoadLiftedT : 0;
  if (metric === "tonnesPerRunningHour") return row.runningHours > 0 ? row.totalLoadLiftedT / row.runningHours : 0;
  if (metric === "cyclesPerRunningHour") return row.runningHours > 0 ? row.productiveCycles / row.runningHours : 0;
  if (metric === "averageCycleSec") return row.cycle.averageCycleSec;
  if (metric === "approachEmptySec") return row.cycle.approachEmptySec;
  if (metric === "pickupSec") return row.cycle.pickupSec;
  if (metric === "loadedTransferSec") return row.cycle.loadedTransferSec;
  if (metric === "depositSec") return row.cycle.depositSec;
  return row[metric];
}

const metricMeta: Record<MetricKey, { label: string; unit: string; floor: number }> = {
  idlePct: { label: "Tempo ocioso", unit: "%", floor: 1.2 },
  emptyTravelPct: { label: "Deslocamento vazio", unit: "%", floor: 1.5 },
  avgSpeedKmh: { label: "Velocidade média", unit: "km/h", floor: 0.45 },
  highSpeedSharePct: { label: "Faixa de velocidade alta", unit: "%", floor: 1.2 },
  fuelPerTonne: { label: "Combustível por tonelada", unit: "L/t", floor: 0.015 },
  tonnesPerRunningHour: { label: "Toneladas por hora de máquina", unit: "t/h", floor: 1.5 },
  cyclesPerRunningHour: { label: "Ciclos produtivos por hora", unit: "ciclos/h", floor: 0.35 },
  averageCycleSec: { label: "Tempo médio do ciclo", unit: "s", floor: 4 },
  approachEmptySec: { label: "Aproximação vazia", unit: "s", floor: 2.5 },
  pickupSec: { label: "Coleta", unit: "s", floor: 2 },
  loadedTransferSec: { label: "Transferência carregada", unit: "s", floor: 3 },
  depositSec: { label: "Depósito", unit: "s", floor: 2 },
  shocks: { label: "Impactos", unit: "eventos", floor: 0.45 }
};

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function mad(values: number[], center = median(values)) {
  return median(values.map((value) => Math.abs(value - center)));
}

function robustEvidence(row: KoneDemoRecord, history: KoneDemoRecord[], metric: MetricKey) {
  const values = history.map((item) => metricValue(item, metric));
  const center = median(values);
  const robustScale = Math.max(mad(values, center) * 1.4826, metricMeta[metric].floor);
  const current = metricValue(row, metric);
  return {
    metric,
    label: metricMeta[metric].label,
    current: round(current),
    median: round(center),
    robustZ: round((current - center) / robustScale),
    unit: metricMeta[metric].unit
  };
}

function trainingHistory(rows: KoneDemoRecord[], row: KoneDemoRecord) {
  return rows.filter((candidate) =>
    candidate.assetId === row.assetId &&
    candidate.shift === row.shift &&
    candidate.date >= TRAINING_START &&
    candidate.date <= TRAINING_END &&
    candidate.usageContext === "production"
  );
}

function vector(row: KoneDemoRecord) {
  return [
    metricValue(row, "idlePct"),
    row.emptyTravelPct,
    row.avgSpeedKmh,
    row.highSpeedSharePct,
    metricValue(row, "fuelPerTonne"),
    metricValue(row, "tonnesPerRunningHour"),
    metricValue(row, "cyclesPerRunningHour"),
    row.cycle.averageCycleSec,
    row.shocks
  ];
}

function slowestCyclePhase(row: KoneDemoRecord, history: KoneDemoRecord[]) {
  const keys = ["approachEmptySec", "pickupSec", "loadedTransferSec", "depositSec"] as const;
  const labels: Record<typeof keys[number], string> = {
    approachEmptySec: "aproximação vazia",
    pickupSec: "coleta/engate",
    loadedTransferSec: "transferência carregada",
    depositSec: "posicionamento e depósito"
  };
  const deltas = keys.map((key) => {
    const baseline = median(history.map((item) => item.cycle[key]));
    return { key, label: labels[key], delta: row.cycle[key] - baseline };
  }).sort((a, b) => b.delta - a.delta);
  return deltas[0];
}

function fleetExpectedTonnes(records: KoneDemoRecord[], date: string, shift: DemoShift) {
  return assets.reduce((sum, asset) => {
    const history = records.filter((row) =>
      row.assetId === asset.assetId &&
      row.shift === shift &&
      row.date >= TRAINING_START &&
      row.date <= TRAINING_END &&
      row.usageContext === "production"
    );
    return sum + (history.length ? median(history.map((row) => row.totalLoadLiftedT)) : 0);
  }, 0);
}

function downtimeImpact(records: KoneDemoRecord[], row: KoneDemoRecord, history: KoneDemoRecord[]) {
  if (row.downtimeHours <= 0) return undefined;
  const baselineTph = median(history.map((item) => metricValue(item, "tonnesPerRunningHour")));
  const capacityUnavailableT = baselineTph * row.downtimeHours;
  const sameShift = records.filter((item) => item.date === row.date && item.shift === row.shift && item.usageContext === "production");
  const actualFleetT = sameShift.reduce((sum, item) => sum + item.totalLoadLiftedT, 0);
  const demandT = sameShift.reduce((sum, item) => sum + item.plannedDemandT, 0);
  const expectedFleetT = fleetExpectedTonnes(records, row.date, row.shift);
  const operationalNeedT = Math.max(0, Math.min(demandT || expectedFleetT, expectedFleetT));
  const unmetDemandT = Math.max(0, operationalNeedT - actualFleetT);
  const effectiveOperationalImpactT = Math.min(capacityUnavailableT, unmetDemandT);
  return {
    downtimeHours: round(row.downtimeHours),
    baselineTonnesPerRunningHour: round(baselineTph, 1),
    capacityUnavailableT: round(capacityUnavailableT),
    fleetAbsorbedT: round(Math.max(0, capacityUnavailableT - effectiveOperationalImpactT)),
    effectiveOperationalImpactT: round(effectiveOperationalImpactT),
    monetaryImpactBRL: null
  };
}

export function analyzeKoneDemo(records: KoneDemoRecord[]) {
  const insights: KoneDemoInsight[] = [];

  for (const row of records) {
    if (row.date < EVALUATION_START || row.date > PERIOD_END) continue;
    const history = trainingHistory(records, row);
    if (history.length < MIN_BASELINE_SAMPLES) continue;

    const metrics = {
      idle: robustEvidence(row, history, "idlePct"),
      empty: robustEvidence(row, history, "emptyTravelPct"),
      speed: robustEvidence(row, history, "avgSpeedKmh"),
      highSpeed: robustEvidence(row, history, "highSpeedSharePct"),
      fuel: robustEvidence(row, history, "fuelPerTonne"),
      throughput: robustEvidence(row, history, "tonnesPerRunningHour"),
      cycles: robustEvidence(row, history, "cyclesPerRunningHour"),
      cycleTime: robustEvidence(row, history, "averageCycleSec"),
      approach: robustEvidence(row, history, "approachEmptySec"),
      pickup: robustEvidence(row, history, "pickupSec"),
      transfer: robustEvidence(row, history, "loadedTransferSec"),
      deposit: robustEvidence(row, history, "depositSec"),
      shocks: robustEvidence(row, history, "shocks")
    };

    const isolation = scoreIsolationForest(history.map(vector), vector(row), `${row.assetId}:${row.shift}:${row.date}`);
    const ifPercentile = round(isolation.percentile * 100);
    const phase = slowestCyclePhase(row, history);

    if (
      row.usageContext === "production" &&
      metrics.throughput.robustZ <= -2.2 &&
      (metrics.cycleTime.robustZ >= 2 || metrics.idle.robustZ >= 1.8 || metrics.empty.robustZ >= 1.8 || metrics.fuel.robustZ >= 2)
    ) {
      insights.push({
        id: `${row.assetId}-productivity-${row.date}-${row.shift}`,
        assetId: row.assetId,
        date: row.date,
        shift: row.shift,
        category: "productivity",
        priority: Math.abs(metrics.throughput.robustZ) >= 3.5 || metrics.cycleTime.robustZ >= 3.5 ? "high" : "attention",
        headline: "Ciclo produtivo perdeu eficiência em relação ao baseline",
        whatHappened: `O turno concluiu ${row.productiveCycles} ciclos (${row.balesMoved} fardos / ${Math.round(row.totalLoadLiftedT)} t) e registrou ${round(metricValue(row, "tonnesPerRunningHour"), 1)} t/h de máquina. O tempo médio do ciclo chegou a ${round(row.cycle.averageCycleSec)} s.`,
        whyItMatters: `A maior deterioração ocorreu em ${phase.label}, cerca de ${Math.max(0, Math.round(phase.delta))} s acima do baseline dessa etapa. Isso ajuda a direcionar a verificação para a parte do processo que mudou, em vez de tratar toda queda de produção como problema do equipamento.`,
        verify: phase.key === "approachEmptySec"
          ? ["fila/acesso aos fardos", "organização da área de coleta", "deslocamentos vazios", "mudança de demanda", "rota até o caminhão"]
          : ["sequência do ciclo", phase.label, "condição da rota/área", "tempo ocioso", "mudança de demanda"],
        context: `Modelo de processo da demo: aproximação vazia → coleta → transferência carregada → depósito. Cada ciclo concluído = 2 fardos × 2 t = 4 t.`,
        cycleContext: {
          averageCycleSec: round(row.cycle.averageCycleSec),
          baselineAverageCycleSec: round(median(history.map((item) => item.cycle.averageCycleSec))),
          slowestPhase: phase.key,
          slowestPhaseLabel: phase.label,
          slowestPhaseDeltaSec: round(phase.delta)
        },
        technical: {
          baselineSamples: history.length,
          trainingWindow: `${TRAINING_START} → ${TRAINING_END}`,
          evidence: [metrics.throughput, metrics.cycles, metrics.cycleTime, metrics.approach, metrics.idle, metrics.empty, metrics.fuel],
          isolationForestPercentile: ifPercentile
        }
      });
    }

    if (
      row.shocks >= 2 ||
      metrics.speed.robustZ >= 2.8 ||
      metrics.highSpeed.robustZ >= 2.8 ||
      row.overloads > 0
    ) {
      insights.push({
        id: `${row.assetId}-safety-${row.date}-${row.shift}`,
        assetId: row.assetId,
        date: row.date,
        shift: row.shift,
        category: "safety",
        priority: row.shocks >= 3 || row.overloads > 0 ? "high" : "attention",
        headline: "Padrão de deslocamento merece revisão",
        whatHappened: `Foram registrados ${row.shocks} impacto(s), velocidade média de ${round(row.avgSpeedKmh, 1)} km/h e ${round(row.highSpeedSharePct, 0)}% do deslocamento na faixa alta normalizada da demo.`,
        whyItMatters: "O Pulso confronta velocidade, impactos e comportamento histórico do mesmo ativo/turno. Alta velocidade é contexto, não uma infração automática.",
        verify: ["rota e piso", "visibilidade com carga", "condição do equipamento", "contexto do turno", "eventos de impacto"],
        context: "A referência pública usada não lista frente/ré como variável TRUCONNECT para lift trucks; a demo não inventa essa dimensão.",
        technical: {
          baselineSamples: history.length,
          trainingWindow: `${TRAINING_START} → ${TRAINING_END}`,
          evidence: [metrics.shocks, metrics.speed, metrics.highSpeed, metrics.transfer],
          isolationForestPercentile: ifPercentile
        }
      });
    }

    const diagnosticAlerts = row.coolantHighAlerts + row.oilPressureAlerts + row.transmissionTempAlerts;
    if (row.downtimeHours > 0 || row.maintenanceHoursRemaining <= 16 || diagnosticAlerts > 0) {
      const impact = downtimeImpact(records, row, history);
      insights.push({
        id: `${row.assetId}-maintenance-${row.date}-${row.shift}`,
        assetId: row.assetId,
        date: row.date,
        shift: row.shift,
        category: "maintenance",
        priority: diagnosticAlerts > 0 || row.downtimeHours >= 2 ? "high" : "attention",
        headline: impact ? "Indisponibilidade com impacto operacional mensurável" : diagnosticAlerts > 0 ? "Diagnóstico e manutenção pedem verificação" : "Manutenção entrou na janela de planejamento",
        whatHappened: impact
          ? `O equipamento ficou ${round(row.downtimeHours, 1)} h indisponível. Pelo baseline do mesmo ativo/turno, isso representa cerca de ${Math.round(impact.capacityUnavailableT)} t de capacidade temporariamente indisponível.`
          : diagnosticAlerts > 0
            ? `O turno registrou ${diagnosticAlerts} alerta(s) de diagnóstico e o contador de manutenção está em ${round(row.maintenanceHoursRemaining, 0)} h.`
            : `O contador de próxima manutenção chegou a ${round(row.maintenanceHoursRemaining, 0)} h restantes.`,
        whyItMatters: impact
          ? `A frota absorveu aproximadamente ${Math.round(impact.fleetAbsorbedT)} t dessa capacidade; o impacto operacional residual estimado foi ${Math.round(impact.effectiveOperationalImpactT)} t. Não há valor financeiro configurado, portanto o Pulso não converte isso em R$.`
          : "Telemetria e contador ajudam a planejar a intervenção com base no uso real, sem transformar um alerta em previsão automática de pane.",
        verify: ["janela operacional disponível", "contador da próxima manutenção", "diagnósticos do drivetrain", "capacidade das outras máquinas para compensar", "demanda do turno"],
        context: "Impacto de indisponibilidade = capacidade histórica do ativo confrontada com demanda e throughput da frota. É capacidade/impacto operacional, não custo financeiro sem R$/t válido.",
        businessImpact: impact,
        technical: {
          baselineSamples: history.length,
          trainingWindow: `${TRAINING_START} → ${TRAINING_END}`,
          evidence: [metrics.throughput, metrics.cycles],
          isolationForestPercentile: null
        }
      });
    }
  }

  const grouped = new Map<string, KoneDemoInsight>();
  for (const insight of insights) {
    const key = `${insight.assetId}:${insight.category}`;
    const previous = grouped.get(key);
    if (!previous || insight.date > previous.date || (insight.date === previous.date && insight.priority === "high")) grouped.set(key, insight);
  }

  return [...grouped.values()].sort((a, b) => {
    const priority = { high: 2, attention: 1 };
    return priority[b.priority] - priority[a.priority] || b.date.localeCompare(a.date);
  });
}

export function aggregateKoneDemo(records: KoneDemoRecord[]) {
  const runningHours = records.reduce((sum, row) => sum + row.runningHours, 0);
  const drivingHours = records.reduce((sum, row) => sum + row.drivingHours, 0);
  const idleHours = records.reduce((sum, row) => sum + row.idleHours, 0);
  const totalLoadLiftedT = records.reduce((sum, row) => sum + row.totalLoadLiftedT, 0);
  const productiveCycles = records.reduce((sum, row) => sum + row.productiveCycles, 0);
  const balesMoved = records.reduce((sum, row) => sum + row.balesMoved, 0);
  const plannedDemandT = records.reduce((sum, row) => sum + row.plannedDemandT, 0);
  const fuelLiters = records.reduce((sum, row) => sum + row.fuelLiters, 0);
  const distanceKm = records.reduce((sum, row) => sum + row.distanceKm, 0);
  const downtimeHours = records.reduce((sum, row) => sum + row.downtimeHours, 0);
  const shocks = records.reduce((sum, row) => sum + row.shocks, 0);
  const overloads = records.reduce((sum, row) => sum + row.overloads, 0);
  const weightedSpeed = drivingHours > 0 ? records.reduce((sum, row) => sum + row.avgSpeedKmh * row.drivingHours, 0) / drivingHours : 0;
  const highSpeedSharePct = drivingHours > 0 ? records.reduce((sum, row) => sum + row.highSpeedSharePct * row.drivingHours, 0) / drivingHours : 0;
  const emptyTravelPct = drivingHours > 0 ? records.reduce((sum, row) => sum + row.emptyTravelPct * row.drivingHours, 0) / drivingHours : 0;
  const minMaintenance = records.length ? Math.min(...records.map((row) => row.maintenanceHoursRemaining)) : null;
  const weightedCycle = productiveCycles > 0 ? records.reduce((sum, row) => sum + row.cycle.averageCycleSec * row.productiveCycles, 0) / productiveCycles : 0;

  return {
    runningHours: round(runningHours),
    drivingHours: round(drivingHours),
    idleHours: round(idleHours),
    idlePct: runningHours > 0 ? round(idleHours / runningHours * 100) : null,
    totalLoadLiftedT: round(totalLoadLiftedT),
    balesMoved: round(balesMoved, 0),
    loadedMovements: round(productiveCycles, 0),
    productiveCycles: round(productiveCycles, 0),
    cyclesPerRunningHour: runningHours > 0 ? round(productiveCycles / runningHours, 1) : null,
    averageCycleSec: productiveCycles > 0 ? round(weightedCycle, 0) : null,
    tonnesPerDrivingHour: drivingHours > 0 ? round(totalLoadLiftedT / drivingHours) : null,
    tonnesPerRunningHour: runningHours > 0 ? round(totalLoadLiftedT / runningHours, 1) : null,
    demandFulfillmentPct: plannedDemandT > 0 ? round(totalLoadLiftedT / plannedDemandT * 100, 1) : null,
    fuelLiters: round(fuelLiters),
    fuelPerTonne: totalLoadLiftedT > 0 ? round(fuelLiters / totalLoadLiftedT, 3) : null,
    distanceKm: round(distanceKm),
    avgSpeedKmh: round(weightedSpeed),
    highSpeedSharePct: round(highSpeedSharePct),
    emptyTravelPct: round(emptyTravelPct),
    downtimeHours: round(downtimeHours),
    shocks,
    overloads,
    minMaintenanceHoursRemaining: minMaintenance == null ? null : round(minMaintenance)
  };
}

export function koneDemoPayload() {
  const records = generateKoneDemoRecords();
  const insights = analyzeKoneDemo(records);
  const trainingRecords = records.filter((row) => row.date <= TRAINING_END);
  const evaluationRecords = records.filter((row) => row.date >= EVALUATION_START);
  const fleet = assets.map((asset) => {
    const rows = records.filter((row) => row.assetId === asset.assetId);
    return { ...asset, summary: aggregateKoneDemo(rows), insights: insights.filter((insight) => insight.assetId === asset.assetId).length };
  });

  return {
    mode: "demo",
    generatedAt: new Date().toISOString(),
    scenario: koneDemoScenario,
    source: {
      provider: "Konecranes",
      product: "TRUCONNECT Remote Monitoring for Lift Trucks",
      dataNature: "synthetic-normalized",
      disclaimer: "Valores simulados pelo Pulso para demonstrar uma operação de celulose. Variáveis OEM-like seguem conceitos públicos Konecranes; ciclo, demanda e contexto de processo são camadas sintéticas do Pulso. Isto não representa payload literal, contrato de API ou granularidade nativa do fabricante.",
      publicCapabilities: [
        "machine status / running modes",
        "driving hours",
        "traveling distance",
        "traveling speed / speed spectrum",
        "fuel consumption",
        "total load lifted / load spectrum",
        "shock sensors",
        "override / overloads",
        "engine oil pressure / coolant / transmission issues",
        "next maintenance counter / drivetrain diagnostics"
      ],
      processLayerCapabilities: [
        "completed productive cycles",
        "bales moved",
        "planned demand",
        "cycle phase durations",
        "maintenance downtime",
        "usage context"
      ],
      unsupportedInPublicReferenceUsed: [
        "forward/reverse share",
        "hydraulic activity share",
        "native cycle phase timestamps"
      ]
    },
    periodStart: TRAINING_START,
    periodEnd: PERIOD_END,
    learning: {
      trainingStart: TRAINING_START,
      trainingEnd: TRAINING_END,
      evaluationStart: EVALUATION_START,
      evaluationEnd: PERIOD_END,
      trainingRecords: trainingRecords.length,
      evaluationRecords: evaluationRecords.length,
      totalRecords: records.length,
      baselineKey: "assetId + shift",
      minimumBaselineSamples: MIN_BASELINE_SAMPLES,
      statistics: "median + MAD robust z-score",
      multivariateSecondOpinion: "Isolation Forest",
      holdoutPolicy: "Agosto não entra no baseline usado para os insights apresentados."
    },
    benchmarkScenarios: [
      { id: "maintenance-context", assetId: "KLT-02", period: "2026-08-05 → 2026-08-07", expected: "baixa produção não deve virar perda de produtividade porque usageContext=maintenance" },
      { id: "flow-bottleneck", assetId: "KLT-03", period: "2026-08-10 → 2026-08-20", expected: "detectar perda de produtividade e localizar aproximação vazia como principal deterioração" },
      { id: "safety-context", assetId: "KLT-04", period: "2026-08-14 → 2026-08-16", expected: "priorizar velocidade + impactos sem inventar culpa ou frente/ré" },
      { id: "maintenance-impact", assetId: "KLT-05", period: "2026-08-21", expected: "estimar capacidade indisponível, compensação da frota e impacto operacional em toneladas" }
    ],
    records,
    fleet,
    insights,
    summary: aggregateKoneDemo(records),
    trainingSummary: aggregateKoneDemo(trainingRecords),
    evaluationSummary: aggregateKoneDemo(evaluationRecords)
  };
}
