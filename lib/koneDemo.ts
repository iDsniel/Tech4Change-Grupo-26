import { scoreIsolationForest } from "./isolationForestCore.ts";

export type DemoShift = "A" | "B" | "C";
export type DemoUsageContext = "production" | "maintenance";

export type KoneDemoRecord = {
  date: string;
  assetId: string;
  shift: DemoShift;
  usageContext: DemoUsageContext;
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
  technical: {
    baselineSamples: number;
    lookbackDays: number;
    evidence: Array<{ label: string; current: number; mean: number; zScore: number; unit: string }>;
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
  businessRule: "Cada movimento produtivo da demo transporta 2 fardos de 2 t = 4 t.",
  granularity: {
    pulsoNormalized: "asset-shift",
    providerNative: "A documentação pública consultada descreve dados de uso e operação, mas não especifica resolução nativa por turno. O turno é uma normalização sintética do Pulso para a demo."
  }
} as const;

const assets = Array.from({ length: koneDemoScenario.fleetSize }, (_, index) => ({
  assetId: `KLT-${String(index + 1).padStart(2, "0")}`,
  capacity: "16 t"
}));

const shifts: DemoShift[] = ["A", "B", "C"];
const LOOKBACK_DAYS = 21;
const MIN_BASELINE_SAMPLES = 10;
const EVALUATION_START = "2026-09-04";

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isoDate(offset: number) {
  const date = new Date("2026-08-11T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function wave(seed: number) {
  return Math.sin(seed * 0.73) * 0.62 + Math.cos(seed * 0.31) * 0.38;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function generateKoneDemoRecords(): KoneDemoRecord[] {
  const rows: KoneDemoRecord[] = [];

  for (let day = 0; day < 30; day += 1) {
    const date = isoDate(day);
    for (let assetIndex = 0; assetIndex < assets.length; assetIndex += 1) {
      const asset = assets[assetIndex];
      for (let shiftIndex = 0; shiftIndex < shifts.length; shiftIndex += 1) {
        const shift = shifts[shiftIndex];
        const seed = day * 17 + assetIndex * 11 + shiftIndex * 7 + 3;
        const w = wave(seed);
        const usageContext: DemoUsageContext =
          asset.assetId === "KLT-02" && date >= "2026-09-07" && shift === "C" ? "maintenance" : "production";

        let runningHours = clamp(7.15 + w * 0.28 + shiftIndex * 0.05, 6.4, 7.8);
        let idlePct = clamp(17.5 + wave(seed + 5) * 3.2 + assetIndex * 0.45, 10, 28);
        let avgSpeedKmh = clamp(10.8 + wave(seed + 9) * 0.9 - assetIndex * 0.08, 8.5, 13.4);
        let highSpeedSharePct = clamp(8.5 + wave(seed + 12) * 3.1, 2, 16);
        let emptyTravelPct = clamp(37 + wave(seed + 15) * 4.5 + shiftIndex, 26, 48);
        let productiveMovements = Math.max(24, Math.round(43 + wave(seed + 21) * 5 + assetIndex * 1.5));
        let shocks = date >= "2026-08-25" && (seed % 53 === 0) ? 1 : 0;
        let overloads = 0;
        let coolantHighAlerts = 0;
        let oilPressureAlerts = 0;
        let transmissionTempAlerts = 0;

        if (asset.assetId === "KLT-03" && shift === "B" && date >= "2026-09-05") {
          idlePct = clamp(idlePct + 15, 0, 60);
          emptyTravelPct = clamp(emptyTravelPct + 9, 0, 75);
          productiveMovements = Math.max(20, productiveMovements - 15);
        }

        if (asset.assetId === "KLT-04" && shift === "C" && date >= "2026-09-06" && date <= "2026-09-08") {
          avgSpeedKmh += 4.4;
          highSpeedSharePct = clamp(highSpeedSharePct + 21, 0, 55);
          shocks = date === "2026-09-07" ? 3 : 2;
        }

        if (asset.assetId === "KLT-05" && date === "2026-09-08" && shift === "B") transmissionTempAlerts = 1;

        if (usageContext === "maintenance") {
          productiveMovements = 6;
          idlePct = 31;
          emptyTravelPct = 58;
        }

        const idleHours = runningHours * idlePct / 100;
        const drivingHours = Math.max(0.8, runningHours - idleHours);
        const offDutyHours = Math.max(0, 8 - runningHours);
        const totalLoadLiftedT = productiveMovements * koneDemoScenario.tonnesPerLoadedMovement;
        const loadedTravelPct = Math.max(0, 100 - emptyTravelPct);
        const distanceKm = drivingHours * avgSpeedKmh;
        let fuelLiters = 18 + drivingHours * 4.05 + totalLoadLiftedT * 0.045 + Math.max(0, idlePct - 18) * 0.23 + wave(seed + 27) * 1.5;

        if (asset.assetId === "KLT-03" && shift === "B" && date >= "2026-09-05") fuelLiters += 5.5;

        const baseMaintenance = [132, 158, 118, 176, 49, 145][assetIndex];
        const maintenanceHoursRemaining = Math.max(0, baseMaintenance - day * 1.35 - shiftIndex * 0.22);

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
          fuelLiters: round(Math.max(5, fuelLiters)),
          totalLoadLiftedT,
          loadedTravelPct: round(loadedTravelPct),
          emptyTravelPct: round(emptyTravelPct),
          shocks,
          overloads,
          coolantHighAlerts,
          oilPressureAlerts,
          transmissionTempAlerts,
          maintenanceHoursRemaining: round(maintenanceHoursRemaining)
        });
      }
    }
  }
  return rows;
}

type MetricKey = "idlePct" | "emptyTravelPct" | "avgSpeedKmh" | "highSpeedSharePct" | "fuelPerTonne" | "tonnesPerDrivingHour" | "shocks";

function metricValue(row: KoneDemoRecord, metric: MetricKey) {
  if (metric === "idlePct") return row.runningHours > 0 ? row.idleHours / row.runningHours * 100 : 0;
  if (metric === "fuelPerTonne") return row.totalLoadLiftedT > 0 ? row.fuelLiters / row.totalLoadLiftedT : 0;
  if (metric === "tonnesPerDrivingHour") return row.drivingHours > 0 ? row.totalLoadLiftedT / row.drivingHours : 0;
  return row[metric];
}

const metricMeta: Record<MetricKey, { label: string; unit: string; floor: number }> = {
  idlePct: { label: "Tempo ocioso", unit: "%", floor: 1.2 },
  emptyTravelPct: { label: "Deslocamento vazio", unit: "%", floor: 1.5 },
  avgSpeedKmh: { label: "Velocidade média", unit: "km/h", floor: 0.45 },
  highSpeedSharePct: { label: "Faixa de velocidade alta", unit: "%", floor: 1.2 },
  fuelPerTonne: { label: "Combustível por tonelada", unit: "L/t", floor: 0.015 },
  tonnesPerDrivingHour: { label: "Toneladas por hora em deslocamento", unit: "t/h", floor: 1.2 },
  shocks: { label: "Impactos", unit: "eventos", floor: 0.45 }
};

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function std(values: number[], avg = mean(values)) {
  if (values.length < 2) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1));
}

function evidence(row: KoneDemoRecord, history: KoneDemoRecord[], metric: MetricKey) {
  const values = history.map((item) => metricValue(item, metric));
  const avg = mean(values);
  const deviation = Math.max(std(values, avg), metricMeta[metric].floor);
  const current = metricValue(row, metric);
  return {
    metric,
    label: metricMeta[metric].label,
    current: round(current),
    mean: round(avg),
    zScore: round((current - avg) / deviation),
    unit: metricMeta[metric].unit
  };
}

function comparableHistory(rows: KoneDemoRecord[], row: KoneDemoRecord) {
  const cutoff = Date.parse(row.date) - LOOKBACK_DAYS * 86400000;
  return rows.filter((candidate) =>
    candidate.assetId === row.assetId &&
    candidate.shift === row.shift &&
    candidate.date < row.date &&
    Date.parse(candidate.date) >= cutoff &&
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
    metricValue(row, "tonnesPerDrivingHour"),
    row.shocks
  ];
}

export function analyzeKoneDemo(records: KoneDemoRecord[]) {
  const insights: KoneDemoInsight[] = [];

  for (const row of records) {
    if (row.date < EVALUATION_START) continue;
    const history = comparableHistory(records, row);
    if (history.length < MIN_BASELINE_SAMPLES) continue;

    const metrics = {
      idle: evidence(row, history, "idlePct"),
      empty: evidence(row, history, "emptyTravelPct"),
      speed: evidence(row, history, "avgSpeedKmh"),
      highSpeed: evidence(row, history, "highSpeedSharePct"),
      fuel: evidence(row, history, "fuelPerTonne"),
      throughput: evidence(row, history, "tonnesPerDrivingHour"),
      shocks: evidence(row, history, "shocks")
    };

    const isolation = scoreIsolationForest(history.map(vector), vector(row), `${row.assetId}:${row.shift}:${row.date}`);
    const ifPercentile = round(isolation.percentile * 100);

    if (
      row.usageContext === "production" &&
      metrics.throughput.zScore <= -2 &&
      (metrics.idle.zScore >= 1.8 || metrics.fuel.zScore >= 2)
    ) {
      insights.push({
        id: `${row.assetId}-productivity-${row.date}-${row.shift}`,
        assetId: row.assetId,
        date: row.date,
        shift: row.shift,
        category: "productivity",
        priority: Math.abs(metrics.throughput.zScore) >= 3 ? "high" : "attention",
        headline: "Atividade produtiva abaixo do comportamento habitual",
        whatHappened: `O turno movimentou ${Math.round(row.totalLoadLiftedT)} t (${Math.round(row.totalLoadLiftedT / koneDemoScenario.baleWeightT)} fardos) e registrou ${round(metricValue(row, "tonnesPerDrivingHour"), 1)} t/h em deslocamento, abaixo do histórico comparável do mesmo ativo e turno.`,
        whyItMatters: "Menor tonelagem com mais ociosidade ou maior consumo por tonelada pode apontar espera, fluxo de abastecimento, deslocamento vazio ou outra restrição operacional que vale verificar.",
        verify: ["fila/abastecimento de fardos", "deslocamentos vazios", "tempo ocioso", "restrição de rota ou área", "mudança de demanda"],
        context: `Cenário configurado: 2 fardos de 2 t por movimento produtivo (4 t). Este turno está marcado como produção.`,
        technical: {
          baselineSamples: history.length,
          lookbackDays: LOOKBACK_DAYS,
          evidence: [metrics.throughput, metrics.idle, metrics.fuel, metrics.empty],
          isolationForestPercentile: ifPercentile
        }
      });
    }

    if (
      row.shocks >= 2 ||
      metrics.speed.zScore >= 2.3 ||
      metrics.highSpeed.zScore >= 2.3 ||
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
        whyItMatters: "Konecranes documenta traveling speed, shock sensors e overloads como sinais relevantes para uso seguro. O Pulso combina esses sinais para priorizar investigação, sem concluir responsabilidade.",
        verify: ["rota e piso", "visibilidade e carga", "condição do equipamento", "contexto do turno", "eventos de impacto"],
        context: "A documentação pública consultada não lista frente/ré como variável do TRUCONNECT para lift trucks; por isso a demo não inventa esse indicador para Konecranes.",
        technical: {
          baselineSamples: history.length,
          lookbackDays: LOOKBACK_DAYS,
          evidence: [metrics.shocks, metrics.speed, metrics.highSpeed],
          isolationForestPercentile: ifPercentile
        }
      });
    }

    const diagnosticAlerts = row.coolantHighAlerts + row.oilPressureAlerts + row.transmissionTempAlerts;
    if (row.maintenanceHoursRemaining <= 16 || diagnosticAlerts > 0) {
      insights.push({
        id: `${row.assetId}-maintenance-${row.date}-${row.shift}`,
        assetId: row.assetId,
        date: row.date,
        shift: row.shift,
        category: "maintenance",
        priority: row.maintenanceHoursRemaining <= 8 || diagnosticAlerts > 0 ? "high" : "attention",
        headline: diagnosticAlerts > 0 ? "Diagnóstico e manutenção pedem verificação" : "Manutenção entrou na janela de planejamento",
        whatHappened: diagnosticAlerts > 0
          ? `O turno registrou ${diagnosticAlerts} alerta(s) de diagnóstico e o contador de manutenção está em ${round(row.maintenanceHoursRemaining, 0)} h.`
          : `O contador de próxima manutenção chegou a ${round(row.maintenanceHoursRemaining, 0)} h restantes.`,
        whyItMatters: "A telemetria ajuda a planejar a intervenção com base no uso real e a confrontar alertas com manutenção, sem transformar um alerta em diagnóstico automático.",
        verify: ["contador da próxima manutenção", "diagnósticos do drivetrain", "histórico de alertas", "janela operacional disponível"],
        context: row.transmissionTempAlerts > 0 ? "A demo usa transmission overheating como exemplo de issue documentada publicamente para TRUCONNECT lift trucks." : "Insight orientado pelo contador de manutenção documentado para lift trucks.",
        technical: {
          baselineSamples: history.length,
          lookbackDays: LOOKBACK_DAYS,
          evidence: [],
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
  const fuelLiters = records.reduce((sum, row) => sum + row.fuelLiters, 0);
  const distanceKm = records.reduce((sum, row) => sum + row.distanceKm, 0);
  const shocks = records.reduce((sum, row) => sum + row.shocks, 0);
  const overloads = records.reduce((sum, row) => sum + row.overloads, 0);
  const weightedSpeed = drivingHours > 0 ? records.reduce((sum, row) => sum + row.avgSpeedKmh * row.drivingHours, 0) / drivingHours : 0;
  const highSpeedSharePct = drivingHours > 0 ? records.reduce((sum, row) => sum + row.highSpeedSharePct * row.drivingHours, 0) / drivingHours : 0;
  const emptyTravelPct = drivingHours > 0 ? records.reduce((sum, row) => sum + row.emptyTravelPct * row.drivingHours, 0) / drivingHours : 0;
  const minMaintenance = records.length ? Math.min(...records.map((row) => row.maintenanceHoursRemaining)) : null;

  return {
    runningHours: round(runningHours),
    drivingHours: round(drivingHours),
    idleHours: round(idleHours),
    idlePct: runningHours > 0 ? round(idleHours / runningHours * 100) : null,
    totalLoadLiftedT: round(totalLoadLiftedT),
    balesMoved: round(totalLoadLiftedT / koneDemoScenario.baleWeightT, 0),
    loadedMovements: round(totalLoadLiftedT / koneDemoScenario.tonnesPerLoadedMovement, 0),
    tonnesPerDrivingHour: drivingHours > 0 ? round(totalLoadLiftedT / drivingHours) : null,
    fuelLiters: round(fuelLiters),
    fuelPerTonne: totalLoadLiftedT > 0 ? round(fuelLiters / totalLoadLiftedT, 3) : null,
    distanceKm: round(distanceKm),
    avgSpeedKmh: round(weightedSpeed),
    highSpeedSharePct: round(highSpeedSharePct),
    emptyTravelPct: round(emptyTravelPct),
    shocks,
    overloads,
    minMaintenanceHoursRemaining: minMaintenance == null ? null : round(minMaintenance)
  };
}

export function koneDemoPayload() {
  const records = generateKoneDemoRecords();
  const insights = analyzeKoneDemo(records);
  const fleet = assets.map((asset) => {
    const rows = records.filter((row) => row.assetId === asset.assetId);
    return { ...asset, summary: aggregateKoneDemo(rows), insights: insights.filter((insight) => insight.assetId === asset.assetId).length };
  });
  const dates = records.map((row) => row.date).sort();

  return {
    mode: "demo",
    generatedAt: new Date().toISOString(),
    scenario: koneDemoScenario,
    source: {
      provider: "Konecranes",
      product: "TRUCONNECT Remote Monitoring for Lift Trucks",
      dataNature: "synthetic-normalized",
      disclaimer: "Valores simulados pelo Pulso para demonstrar uma operação de celulose. As variáveis foram escolhidas a partir de conceitos documentados publicamente pela Konecranes; isto não representa payload literal, contrato de API ou granularidade nativa do fabricante.",
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
      unsupportedInPublicReferenceUsed: [
        "forward/reverse share",
        "hydraulic activity share"
      ]
    },
    periodStart: dates[0],
    periodEnd: dates.at(-1),
    records,
    fleet,
    insights,
    summary: aggregateKoneDemo(records)
  };
}
