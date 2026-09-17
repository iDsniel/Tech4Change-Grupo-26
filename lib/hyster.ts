export type HysterStatistic = {
  sourceLabel: string;
  unit: string;
  dailyAverage: number;
  monthlyAverage: number;
  total: number;
};

export type WorkforceMetricKey =
  | "serviceHours"
  | "driveHours"
  | "hydraulicMeterHours"
  | "tractionMeterHours"
  | "distanceKm"
  | "monitoredHours"
  | "keyHours"
  | "presenceHours"
  | "motionHours"
  | "hydraulicHours"
  | "workHours"
  | "liftHours"
  | "lowerHours"
  | "auxiliaryHydraulicHours"
  | "lowSpeedHours"
  | "mediumSpeedHours"
  | "highSpeedHours"
  | "lowLevelOverspeedHours"
  | "highLevelOverspeedHours"
  | "reverseHours"
  | "forwardHours"
  | "seatBeltViolationHours"
  | "idleHours"
  | "containerCount"
  | "energyFuelUsedLiters"
  | "ladenHours"
  | "unladenHours"
  | "workingUnladenHours"
  | "unladenDurationHours";

export type WorkforceMetrics = Partial<Record<WorkforceMetricKey, number>>;
export type WorkforceStatistics = Partial<Record<WorkforceMetricKey, HysterStatistic>>;

export type Daily = {
  assetId: string;
  date: string;
  keyHours: number;
  presenceHours: number;
  workHours: number;
  idleHours: number;
  waitHours: number;
  equipmentUsedCount?: number;
  usedPercent?: number;
  workPercent?: number;
  idlePercent?: number;
  waitPercentOfIdle?: number;
  sourceRow: number;
};

export type HysterAsset = {
  assetId: string;
  serviceMeterHours: number;
  trackerAssetId?: string;
  serviceId?: string;
  productId?: number;
  equipmentName?: string;
  serialNumber?: string;
  site?: string;
  department?: string;
  equipmentClass?: string;
  sourceRow?: number;
};

export type HysterEvent = {
  assetId: string;
  date: string;
  time: string;
  type: string;
  cardCode?: string | null;
  sourceCritical: boolean;
  sourceStatus: string;
  sourceRow: number;
  productId?: number;
  equipmentName?: string;
  serialNumber?: string;
  trackerAssetId?: string;
  serviceId?: string;
  eventAt?: string;
  startDate?: string;
  startTime?: string;
  startAt?: string;
  operatorFirstName?: string | null;
  operatorLastName?: string | null;
  operatorName?: string | null;
  lockout?: boolean;
  shutdown?: boolean;
};

export type WorkforceAsset = {
  assetId: string;
  usageCount: number;
  metrics: WorkforceMetrics;
  statistics?: WorkforceStatistics;
  sourceRow: number;
  productId?: number;
  serialNumber?: string;
  trackerAssetId?: string;
  serviceId?: string;
  equipmentName?: string;
};

export type WorkforceCard = {
  cardCode: string | null;
  operatorName?: string | null;
  cardQuality: "complete" | "incomplete" | "ambiguous";
  usageCount: number;
  metrics: WorkforceMetrics;
  statistics?: WorkforceStatistics;
  assets: WorkforceAsset[];
  sourceRow: number;
};

export type WorkforceMetricAvailability = {
  sourceLabel: string;
  unit: string;
  cardsWithNonZero: number;
  cardsTotal: number;
  totalAcrossCards: number;
};

export type WorkforceData = {
  periodStart: string;
  periodEnd: string;
  granularity: "card-period";
  unitSystem: "metric";
  sourceFile: string;
  sha256: string;
  cards: WorkforceCard[];
  metricAvailability?: Partial<Record<WorkforceMetricKey, WorkforceMetricAvailability>>;
  warnings: string[];
};

export type LegacyData = {
  periodLabel: string;
  sourceFile: string;
  sha256: string;
  rows: {
    rowId: string;
    cardCode: string | null;
    cardQuality: string;
    sourceRow: number;
    metrics: Record<string, number | null>;
    legacyCalculated: Record<string, number | null>;
    legacyDisplay?: Record<string, number | string>;
  }[];
  impactArchive: { dateText: string; cardCode: string; type: string; sourceRow: number }[];
  displayImpactTotal: number;
  displayFuelKg: number;
  warnings: string[];
};

type FleetKpi = {
  assetId: string;
  keyHours: number;
  workHours: number;
  idleHours: number;
  serviceHours: number;
  presenceHours?: number;
  motionHours?: number;
  hydraulicHours?: number;
  liftHours?: number;
  monitoredHours?: number;
  loadHours?: number;
  ladenHours?: number;
  unladenHours?: number;
  workingUnladenHours?: number;
  unladenDurationHours?: number;
  statistics?: Record<string, HysterStatistic>;
  sourceRow?: number;
};

type CurrentStatus = {
  assetId: string;
  status: string;
  lastAccess?: string;
  lastAccessedAt?: string;
  productId?: number;
  equipmentName?: string;
  serialNumber?: string;
  trackerAssetId?: string;
  equipmentClass?: string;
  lockoutCause?: string | null;
  lastDrivenOrUsedBy?: string | null;
  driveDuration?: string | null;
  driveDurationSeconds?: number | null;
  sourceRow?: number;
};

type FuelRow = {
  assetId: string;
  reportedLiters: number;
  dailyAverageLiters?: number;
  monthlyAverageLiters?: number;
  productId?: number;
  equipmentName?: string;
  serialNumber?: string;
  trackerAssetId?: string;
  serviceId?: string;
  sourceRow?: number;
};

type CostRow = {
  assetId: string;
  reportedCostPerHour: number;
  reportedTotal: number | null;
  startHours?: number;
  endHours?: number;
  intervalHours?: number;
  costDetails?: unknown;
  productId?: number;
  equipmentName?: string;
  serialNumber?: string;
  trackerAssetId?: string;
  serviceId?: string;
  sourceRow?: number;
};

export type HysterData = {
  schemaVersion: number;
  provider: string;
  periodStart: string;
  periodEnd: string;
  operationId?: string;
  granularity?: string;
  unitSystem?: string;
  operation?: { site?: string; department?: string; equipmentClass?: string; assetCount?: number };
  legacy?: LegacyData;
  workforce?: WorkforceData;
  assets: HysterAsset[];
  daily: Daily[];
  events: HysterEvent[];
  kpi: FleetKpi[];
  currentStatusSnapshotAt?: string;
  currentStatus: CurrentStatus[];
  fleetStatusSummary?: Record<string, unknown>;
  eventSummary?: Record<string, unknown>;
  fuel: FuelRow[];
  costs: CostRow[];
  maintenanceAvailable: boolean;
  maintenance?: {
    available: boolean;
    message?: string;
    periodStart?: string;
    periodEnd?: string;
    records?: unknown[];
  };
  reportMetadata?: Record<string, unknown>;
  dataQuality?: Record<string, unknown> & {
    eventExportCriticalOnly?: boolean;
    currentStatusSnapshotOutsideAnalysisPeriod?: boolean;
    workforceMetricsAllZero?: string[];
    dailyFleetCoverage?: {
      calendarDays?: number;
      assets?: number;
      possibleAssetDays?: number;
      rowsPresent?: number;
      rowsOmitted?: number;
    };
  };
  sources: {
    file: string;
    sha256: string;
    sheets: { name: string; rows: number; state?: string; range?: string }[];
  }[];
};

export const workforceMetricKeys: WorkforceMetricKey[] = [
  "serviceHours",
  "driveHours",
  "hydraulicMeterHours",
  "tractionMeterHours",
  "distanceKm",
  "monitoredHours",
  "keyHours",
  "presenceHours",
  "motionHours",
  "hydraulicHours",
  "workHours",
  "liftHours",
  "lowerHours",
  "auxiliaryHydraulicHours",
  "lowSpeedHours",
  "mediumSpeedHours",
  "highSpeedHours",
  "lowLevelOverspeedHours",
  "highLevelOverspeedHours",
  "reverseHours",
  "forwardHours",
  "seatBeltViolationHours",
  "idleHours",
  "containerCount",
  "energyFuelUsedLiters",
  "ladenHours",
  "unladenHours",
  "workingUnladenHours",
  "unladenDurationHours"
];

export const workforceMetricLabels: Record<WorkforceMetricKey, string> = {
  serviceHours: "Medidor principal",
  driveHours: "Motor / tração",
  hydraulicMeterHours: "Medidor hidráulico",
  tractionMeterHours: "Transmissão / tração",
  distanceKm: "Distância",
  monitoredHours: "Duração monitorada",
  keyHours: "Chave ligada",
  presenceHours: "Presença do operador",
  motionHours: "Em movimento",
  hydraulicHours: "Função hidráulica",
  workHours: "Trabalho",
  liftHours: "Elevação",
  lowerHours: "Descida",
  auxiliaryHydraulicHours: "Hidráulica auxiliar",
  lowSpeedHours: "Baixa velocidade",
  mediumSpeedHours: "Média velocidade",
  highSpeedHours: "Alta velocidade",
  lowLevelOverspeedHours: "Overspeed nível baixo",
  highLevelOverspeedHours: "Overspeed nível alto",
  reverseHours: "Marcha ré",
  forwardHours: "Marcha à frente",
  seatBeltViolationHours: "Violação de cinto",
  idleHours: "Ociosidade",
  containerCount: "Contêineres",
  energyFuelUsedLiters: "Energia / combustível",
  ladenHours: "Carregado",
  unladenHours: "Descarregado",
  workingUnladenHours: "Trabalho descarregado",
  unladenDurationHours: "Duração descarregado"
};

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const finiteOrNull = (v: unknown) => v === null || finite(v);
const validCardCode = (v: unknown) => typeof v === "string" && /^\d{1,64}$/.test(v);
const safeText = (v: unknown, max = 500) => typeof v === "string" && v.length <= max;

function validateWorkforceMetrics(metrics: WorkforceMetrics) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) throw new Error("Métricas Workforce inválidas.");
  for (const [key, value] of Object.entries(metrics)) {
    if (!workforceMetricKeys.includes(key as WorkforceMetricKey) || !finite(value)) throw new Error(`Métrica Workforce inválida: ${key}.`);
  }
}

function validateStatistics(stats: WorkforceStatistics | undefined) {
  if (stats === undefined) return;
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) throw new Error("Estatísticas Workforce inválidas.");
  for (const [key, value] of Object.entries(stats)) {
    if (!workforceMetricKeys.includes(key as WorkforceMetricKey) || !value || !safeText(value.sourceLabel) || !safeText(value.unit, 80) || !finite(value.dailyAverage) || !finite(value.monthlyAverage) || !finite(value.total)) {
      throw new Error(`Estatística Workforce inválida: ${key}.`);
    }
  }
}

function validateMetricAvailability(value: WorkforceData["metricAvailability"]) {
  if (value === undefined) return;
  for (const [key, row] of Object.entries(value)) {
    if (!workforceMetricKeys.includes(key as WorkforceMetricKey) || !row || !safeText(row.sourceLabel) || !safeText(row.unit, 80) || !Number.isInteger(row.cardsWithNonZero) || !Number.isInteger(row.cardsTotal) || row.cardsWithNonZero < 0 || row.cardsTotal < 0 || row.cardsWithNonZero > row.cardsTotal || !finite(row.totalAcrossCards)) {
      throw new Error(`Disponibilidade Workforce inválida: ${key}.`);
    }
  }
}

// Fail closed before rendering imported files. Never interpret arbitrary JSON as telemetry.
export function validateHyster(value: unknown): HysterData {
  const d = value as HysterData;
  if (!d || ![1, 2, 3, 4].includes(d.schemaVersion) || d.provider !== "Hyster Tracker" || !isDate(d.periodStart) || !isDate(d.periodEnd) || d.periodStart > d.periodEnd) throw new Error("Formato ou período Hyster inválido.");
  if (d.operationId !== undefined && !/^[a-f0-9]{16}$/.test(d.operationId)) throw new Error("Operação inválida.");

  for (const key of ["assets", "daily", "events", "kpi", "currentStatus", "fuel", "costs", "sources"] as const) {
    if (!Array.isArray(d[key])) throw new Error(`Coleção ausente: ${key}`);
  }
  if (!d.assets.length || d.assets.length > 1000 || !d.daily.length || d.daily.length > 100000 || d.events.length > 200000) throw new Error("Volume de dados inválido.");

  const ids = new Set(d.assets.map((a) => a?.assetId));
  if (ids.size !== d.assets.length || d.assets.some((a) => !a || !/^EP\d{2,6}$/.test(a.assetId) || !finite(a.serviceMeterHours))) throw new Error("Cadastro de equipamentos inválido.");
  for (const a of d.assets) {
    if (a.productId !== undefined && !finite(a.productId)) throw new Error("Product ID inválido.");
    if (a.sourceRow !== undefined && (!Number.isInteger(a.sourceRow) || a.sourceRow < 1)) throw new Error("Linha de cadastro inválida.");
    for (const text of [a.trackerAssetId, a.serviceId, a.equipmentName, a.serialNumber, a.site, a.department, a.equipmentClass]) if (text !== undefined && !safeText(text)) throw new Error("Metadado de equipamento inválido.");
  }

  const seen = new Set<string>();
  for (const r of d.daily) {
    if (!r || !ids.has(r.assetId) || !isDate(r.date) || r.date < d.periodStart || r.date > d.periodEnd || ![r.keyHours, r.presenceHours, r.workHours, r.idleHours, r.waitHours].every(finite) || !Number.isInteger(r.sourceRow)) throw new Error("Registro diário inválido.");
    const key = `${r.assetId}:${r.date}`;
    if (seen.has(key)) throw new Error("Registro diário duplicado.");
    seen.add(key);
    for (const optional of [r.equipmentUsedCount, r.usedPercent, r.workPercent, r.idlePercent, r.waitPercentOfIdle]) if (optional !== undefined && !finite(optional)) throw new Error("Indicador diário adicional inválido.");
  }

  for (const e of d.events) {
    if (!e || !ids.has(e.assetId) || !isDate(e.date) || e.date < d.periodStart || e.date > d.periodEnd || typeof e.type !== "string" || typeof e.time !== "string" || typeof e.sourceCritical !== "boolean" || typeof e.sourceStatus !== "string" || !Number.isInteger(e.sourceRow)) throw new Error("Evento inválido.");
    if (e.cardCode != null && (typeof e.cardCode !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(e.cardCode))) throw new Error("Código de cartão inválido.");
    if (e.productId !== undefined && !finite(e.productId)) throw new Error("Product ID de evento inválido.");
    if (e.lockout !== undefined && typeof e.lockout !== "boolean") throw new Error("Lockout inválido.");
    if (e.shutdown !== undefined && typeof e.shutdown !== "boolean") throw new Error("Shutdown inválido.");
  }

  for (const r of d.kpi) {
    if (!r || !ids.has(r.assetId) || ![r.keyHours, r.workHours, r.idleHours, r.serviceHours].every(finite)) throw new Error("KPI inválido.");
    for (const key of ["presenceHours", "motionHours", "hydraulicHours", "liftHours", "monitoredHours", "loadHours", "ladenHours", "unladenHours", "workingUnladenHours", "unladenDurationHours"] as const) if (r[key] !== undefined && !finite(r[key])) throw new Error("Contador adicional inválido.");
    if (r.statistics !== undefined) {
      if (!r.statistics || typeof r.statistics !== "object" || Array.isArray(r.statistics)) throw new Error("Estatísticas de frota inválidas.");
      for (const value of Object.values(r.statistics)) if (!value || !safeText(value.sourceLabel) || !safeText(value.unit, 80) || !finite(value.dailyAverage) || !finite(value.monthlyAverage) || !finite(value.total)) throw new Error("Estatística de frota inválida.");
    }
  }

  if (d.workforce) {
    const w = d.workforce;
    if (d.schemaVersion < 3 || !isDate(w.periodStart) || !isDate(w.periodEnd) || w.periodStart > w.periodEnd || w.periodStart < d.periodStart || w.periodEnd > d.periodEnd || w.granularity !== "card-period" || w.unitSystem !== "metric" || typeof w.sourceFile !== "string" || !/^[a-f0-9]{64}$/.test(w.sha256) || !Array.isArray(w.cards) || w.cards.length > 10000 || !Array.isArray(w.warnings) || w.warnings.some((item) => typeof item !== "string")) throw new Error("Workforce KPI inválido.");
    validateMetricAvailability(w.metricAvailability);
    const rowIds = new Set<number>();
    const codeRows = new Map<string, WorkforceCard[]>();
    for (const card of w.cards) {
      if (!card || !["complete", "incomplete", "ambiguous"].includes(card.cardQuality) || !Number.isInteger(card.sourceRow) || card.sourceRow < 1 || !Number.isInteger(card.usageCount) || card.usageCount < 0 || !Array.isArray(card.assets)) throw new Error("Cartão Workforce inválido.");
      if (rowIds.has(card.sourceRow)) throw new Error("Linha Workforce duplicada.");
      rowIds.add(card.sourceRow);
      if (card.operatorName !== undefined && card.operatorName !== null && !safeText(card.operatorName, 200)) throw new Error("Nome de operador inválido.");
      if (card.cardQuality === "incomplete") {
        if (card.cardCode !== null) throw new Error("Código Workforce incompleto deve permanecer nulo.");
      } else if (!validCardCode(card.cardCode)) throw new Error("Código Workforce inválido.");
      validateWorkforceMetrics(card.metrics);
      validateStatistics(card.statistics);
      const cardAssetIds = new Set<string>();
      for (const asset of card.assets) {
        if (!asset || !ids.has(asset.assetId) || cardAssetIds.has(asset.assetId) || !Number.isInteger(asset.usageCount) || asset.usageCount < 0 || !Number.isInteger(asset.sourceRow) || asset.sourceRow < 1) throw new Error("Recorte Workforce por equipamento inválido.");
        cardAssetIds.add(asset.assetId);
        validateWorkforceMetrics(asset.metrics);
        validateStatistics(asset.statistics);
      }
      if (card.cardCode) codeRows.set(card.cardCode, [...(codeRows.get(card.cardCode) ?? []), card]);
    }
    for (const rows of codeRows.values()) if (rows.length > 1 && rows.some((row) => row.cardQuality !== "ambiguous")) throw new Error("Código Workforce duplicado sem sinalização de ambiguidade.");
  }

  if (d.legacy) {
    const l = d.legacy;
    if (typeof l.periodLabel !== "string" || typeof l.sourceFile !== "string" || !/^[a-f0-9]{64}$/.test(l.sha256) || !Array.isArray(l.rows) || !Array.isArray(l.warnings) || l.warnings.some((w) => typeof w !== "string") || !Array.isArray(l.impactArchive) || !finite(l.displayImpactTotal) || !finite(l.displayFuelKg)) throw new Error("Histórico legado inválido.");
    for (const r of l.rows) if (!r || typeof r.rowId !== "string" || (r.cardCode !== null && !/^\d{1,64}$/.test(r.cardCode)) || !["complete", "incomplete", "ambiguous"].includes(r.cardQuality) || !Number.isInteger(r.sourceRow) || !r.metrics || !r.legacyCalculated || [...Object.values(r.metrics), ...Object.values(r.legacyCalculated)].some((v) => v !== null && (typeof v !== "number" || !Number.isFinite(v)))) throw new Error("Linha legada inválida.");
    for (const r of l.rows) if (r.legacyDisplay && Object.values(r.legacyDisplay).some((v) => typeof v !== "string" && (typeof v !== "number" || !Number.isFinite(v)))) throw new Error("Quadro histórico inválido.");
  }

  for (const r of d.currentStatus) {
    if (!r || !ids.has(r.assetId) || typeof r.status !== "string" || (r.lastAccess === undefined && r.lastAccessedAt === undefined)) throw new Error("Snapshot inválido.");
    if (r.lastAccess !== undefined && typeof r.lastAccess !== "string") throw new Error("Último acesso inválido.");
    if (r.lastAccessedAt !== undefined && typeof r.lastAccessedAt !== "string") throw new Error("Último acesso inválido.");
    if (r.driveDurationSeconds !== undefined && r.driveDurationSeconds !== null && !finite(r.driveDurationSeconds)) throw new Error("Duração atual inválida.");
  }
  for (const r of d.fuel) if (!r || !ids.has(r.assetId) || !finite(r.reportedLiters) || (r.dailyAverageLiters !== undefined && !finite(r.dailyAverageLiters)) || (r.monthlyAverageLiters !== undefined && !finite(r.monthlyAverageLiters))) throw new Error("Combustível inválido.");
  for (const r of d.costs) if (!r || !ids.has(r.assetId) || !finite(r.reportedCostPerHour) || !finiteOrNull(r.reportedTotal) || (r.startHours !== undefined && !finite(r.startHours)) || (r.endHours !== undefined && !finite(r.endHours)) || (r.intervalHours !== undefined && !finite(r.intervalHours))) throw new Error("Custo inválido.");

  if (d.maintenance !== undefined && (!d.maintenance || typeof d.maintenance.available !== "boolean" || (d.maintenance.message !== undefined && !safeText(d.maintenance.message)))) throw new Error("Manutenção inválida.");
  if (typeof d.maintenanceAvailable !== "boolean" || d.sources.some((s) => !s || typeof s.file !== "string" || !/^[a-f0-9]{64}$/.test(s.sha256) || !Array.isArray(s.sheets) || s.sheets.some((sheet) => !sheet || typeof sheet.name !== "string" || !Number.isInteger(sheet.rows) || sheet.rows < 0))) throw new Error("Proveniência inválida.");

  return d;
}

export const sum = (rows: Daily[], key: "keyHours" | "workHours" | "idleHours" | "waitHours") => rows.reduce((s, r) => s + r[key], 0);
export const ratio = (n: number, d: number) => d > 0 ? n / d * 100 : null;
export function totals(rows: Daily[]) {
  const key = sum(rows, "keyHours"), idle = sum(rows, "idleHours"), work = sum(rows, "workHours");
  return { key, idle, work, idlePct: ratio(idle, key), workPct: ratio(work, key), records: rows.length };
}

export function workforceStatistic(data: HysterData, cardCode: string, metric: WorkforceMetricKey, assetId = "all") {
  const rows = data.workforce?.cards.filter((row) => row.cardCode === cardCode && row.cardQuality === "complete") ?? [];
  if (rows.length !== 1) return undefined;
  if (assetId === "all") return rows[0].statistics?.[metric];
  return rows[0].assets.find((row) => row.assetId === assetId)?.statistics?.[metric];
}

export function analyzeHyster(data: HysterData, month = "all", asset = "all") {
  const matches = (r: { date: string; assetId: string }) => (month === "all" || r.date.startsWith(month)) && (asset === "all" || r.assetId === asset);
  const daily = data.daily.filter(matches), events = data.events.filter(matches);
  const assets = data.assets.filter((a) => asset === "all" || a.assetId === asset).map((a) => {
    const rows = daily.filter((r) => r.assetId === a.assetId), es = events.filter((e) => e.assetId === a.assetId);
    return { assetId: a.assetId, ...totals(rows), faults: es.filter((e) => e.type === "Falha do sistema").length, impacts: es.filter((e) => e.type === "Impacto").length };
  });
  const months = [...new Set(data.daily.map((r) => r.date.slice(0, 7)))].sort().map((m) => ({ month: m, ...totals(data.daily.filter((r) => r.date.startsWith(m) && (asset === "all" || r.assetId === asset))) }));
  const deviations: { assetId: string; date: string; current: number; baseline: number; z: number; samples: number; sourceRow: number; idleHours: number }[] = [];
  for (const r of daily) {
    if (r.keyHours < 1) continue;
    const cutoff = Date.parse(r.date) - 28 * 86400000;
    const previous = data.daily.filter((p) => p.assetId === r.assetId && p.date < r.date && Date.parse(p.date) >= cutoff && p.keyHours >= 1);
    if (previous.length < 10) continue;
    const values = previous.map((p) => p.idleHours / p.keyHours * 100);
    const baseline = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - baseline) ** 2, 0) / (values.length - 1));
    const current = r.idleHours / r.keyHours * 100;
    if (sd < 0.01) continue;
    const z = (current - baseline) / sd;
    if (z >= 2 && current - baseline >= 10) deviations.push({ assetId: r.assetId, date: r.date, current, baseline, z, samples: previous.length, sourceRow: r.sourceRow, idleHours: r.idleHours });
  }
  deviations.sort((a, b) => b.z - a.z);
  const types = Object.fromEntries([...new Set(events.map((e) => e.type))].map((t) => [t, events.filter((e) => e.type === t).length]));
  const sourcePctAbove100 = daily.filter((r) => [r.usedPercent, r.workPercent, r.idlePercent, r.waitPercentOfIdle].some((value) => value !== undefined && value > 100)).length;
  return {
    daily,
    assets,
    months,
    deviations,
    types,
    totals: totals(daily),
    eventCount: events.length,
    quality: {
      waitAboveIdle: daily.filter((r) => r.waitHours > r.idleHours).length,
      nonAdditive: daily.filter((r) => r.workHours + r.idleHours > r.keyHours + 0.03).length,
      sourcePctAbove100,
      eventExportCriticalOnly: data.dataQuality?.eventExportCriticalOnly === true,
      rowsOmitted: data.dataQuality?.dailyFleetCoverage?.rowsOmitted ?? null,
      currentStatusOutsideAnalysisPeriod: data.dataQuality?.currentStatusSnapshotOutsideAnalysisPeriod === true
    },
    incidents: events.filter((e) => e.type === "Falha do sistema" || e.type === "Impacto")
  };
}
