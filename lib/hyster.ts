export type Daily = { assetId: string; date: string; keyHours: number; presenceHours: number; workHours: number; idleHours: number; waitHours: number; sourceRow: number };
export type HysterEvent = { assetId: string; date: string; time: string; type: string; cardCode?: string | null; sourceCritical: boolean; sourceStatus: string; sourceRow: number };
export type WorkforceMetricKey = "serviceHours" | "driveHours" | "hydraulicMeterHours" | "tractionMeterHours" | "distanceKm" | "monitoredHours" | "keyHours" | "presenceHours" | "motionHours" | "hydraulicHours" | "workHours" | "liftHours" | "lowerHours" | "highSpeedHours" | "reverseHours" | "forwardHours" | "idleHours";
export type WorkforceMetrics = Partial<Record<WorkforceMetricKey, number>>;
export type WorkforceAsset = { assetId: string; usageCount: number; metrics: WorkforceMetrics; sourceRow: number };
export type WorkforceCard = { cardCode: string | null; cardQuality: "complete" | "incomplete" | "ambiguous"; usageCount: number; metrics: WorkforceMetrics; assets: WorkforceAsset[]; sourceRow: number };
export type WorkforceData = { periodStart: string; periodEnd: string; granularity: "card-period"; unitSystem: "metric"; sourceFile: string; sha256: string; cards: WorkforceCard[]; warnings: string[] };
export type LegacyData = { periodLabel: string; sourceFile: string; sha256: string; rows: { rowId: string; cardCode: string | null; cardQuality: string; sourceRow: number; metrics: Record<string, number | null>; legacyCalculated: Record<string, number | null>; legacyDisplay?: Record<string, number | string> }[]; impactArchive: { dateText: string; cardCode: string; type: string; sourceRow: number }[]; displayImpactTotal: number; displayFuelKg: number; warnings: string[] };
export type HysterData = {
  schemaVersion: number; provider: string; periodStart: string; periodEnd: string; operationId?: string; legacy?: LegacyData; workforce?: WorkforceData;
  assets: { assetId: string; serviceMeterHours: number }[];
  daily: Daily[]; events: HysterEvent[];
  kpi: { assetId: string; keyHours: number; workHours: number; idleHours: number; serviceHours: number; presenceHours?: number; motionHours?: number; hydraulicHours?: number; liftHours?: number; monitoredHours?: number; loadHours?: number }[];
  currentStatus: { assetId: string; status: string; lastAccess: string }[];
  fuel: { assetId: string; reportedLiters: number }[];
  costs: { assetId: string; reportedCostPerHour: number; reportedTotal: number | null }[];
  maintenanceAvailable: boolean;
  sources: { file: string; sha256: string; sheets: { name: string; rows: number; state: string }[] }[];
};
export const workforceMetricKeys: WorkforceMetricKey[] = ["serviceHours", "driveHours", "hydraulicMeterHours", "tractionMeterHours", "distanceKm", "monitoredHours", "keyHours", "presenceHours", "motionHours", "hydraulicHours", "workHours", "liftHours", "lowerHours", "highSpeedHours", "reverseHours", "forwardHours", "idleHours"];
const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const finite = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0;
const validCardCode = (v: unknown) => typeof v === "string" && /^\d{1,64}$/.test(v);
function validateWorkforceMetrics(metrics: WorkforceMetrics) {
  if (!metrics || typeof metrics !== "object" || Array.isArray(metrics)) throw new Error("Métricas Workforce inválidas.");
  for (const [key, value] of Object.entries(metrics)) if (!workforceMetricKeys.includes(key as WorkforceMetricKey) || !finite(value)) throw new Error("Métrica Workforce inválida.");
}

// Fail closed before rendering imported files. Never interpret arbitrary JSON as telemetry.
export function validateHyster(value: unknown): HysterData {
  const d = value as HysterData;
  if (!d || ![1, 2, 3].includes(d.schemaVersion) || d.provider !== "Hyster Tracker" || !isDate(d.periodStart) || !isDate(d.periodEnd) || d.periodStart > d.periodEnd) throw new Error("Formato ou período Hyster inválido.");
  if (d.operationId !== undefined && !/^[a-f0-9]{16}$/.test(d.operationId)) throw new Error("Operação inválida.");
  for (const key of ["assets", "daily", "events", "kpi", "currentStatus", "fuel", "costs", "sources"] as const) {
    if (!Array.isArray(d[key])) throw new Error(`Coleção ausente: ${key}`);
  }
  if (!d.assets.length || d.assets.length > 1000 || !d.daily.length || d.daily.length > 100000 || d.events.length > 200000) throw new Error("Volume de dados inválido.");
  const ids = new Set(d.assets.map(a => a?.assetId));
  if (ids.size !== d.assets.length || d.assets.some(a => !a || !/^EP\d{2,6}$/.test(a.assetId) || !finite(a.serviceMeterHours))) throw new Error("Cadastro de equipamentos inválido.");
  const seen = new Set<string>();
  for (const r of d.daily) {
    if (!r || !ids.has(r.assetId) || !isDate(r.date) || r.date < d.periodStart || r.date > d.periodEnd || ![r.keyHours, r.presenceHours, r.workHours, r.idleHours, r.waitHours].every(finite) || !Number.isInteger(r.sourceRow)) throw new Error("Registro diário inválido.");
    const key = `${r.assetId}:${r.date}`;
    if (seen.has(key)) throw new Error("Registro diário duplicado.");
    seen.add(key);
  }
  for (const e of d.events) if (!e || !ids.has(e.assetId) || !isDate(e.date) || e.date < d.periodStart || e.date > d.periodEnd || typeof e.type !== "string" || typeof e.time !== "string" || typeof e.sourceCritical !== "boolean") throw new Error("Evento inválido.");
  for (const e of d.events) if (e.cardCode != null && (typeof e.cardCode !== "string" || !/^[a-zA-Z0-9_-]{1,64}$/.test(e.cardCode))) throw new Error("Código de cartão inválido.");
  for (const r of d.kpi) for (const key of ["presenceHours", "motionHours", "hydraulicHours", "liftHours", "monitoredHours", "loadHours"] as const) if (r[key] !== undefined && !finite(r[key])) throw new Error("Contador adicional inválido.");
  if (d.workforce) {
    const w = d.workforce;
    if (d.schemaVersion < 3 || !isDate(w.periodStart) || !isDate(w.periodEnd) || w.periodStart > w.periodEnd || w.periodStart < d.periodStart || w.periodEnd > d.periodEnd || w.granularity !== "card-period" || w.unitSystem !== "metric" || typeof w.sourceFile !== "string" || !/^[a-f0-9]{64}$/.test(w.sha256) || !Array.isArray(w.cards) || w.cards.length > 10000 || !Array.isArray(w.warnings) || w.warnings.some(item => typeof item !== "string")) throw new Error("Workforce KPI inválido.");
    const rowIds = new Set<number>();
    const codeRows = new Map<string, WorkforceCard[]>();
    for (const card of w.cards) {
      if (!card || !["complete", "incomplete", "ambiguous"].includes(card.cardQuality) || !Number.isInteger(card.sourceRow) || card.sourceRow < 1 || !Number.isInteger(card.usageCount) || card.usageCount < 0 || !Array.isArray(card.assets)) throw new Error("Cartão Workforce inválido.");
      if (rowIds.has(card.sourceRow)) throw new Error("Linha Workforce duplicada.");
      rowIds.add(card.sourceRow);
      if (card.cardQuality === "incomplete") {
        if (card.cardCode !== null) throw new Error("Código Workforce incompleto deve permanecer nulo.");
      } else if (!validCardCode(card.cardCode)) throw new Error("Código Workforce inválido.");
      validateWorkforceMetrics(card.metrics);
      const cardAssetIds = new Set<string>();
      for (const asset of card.assets) {
        if (!asset || !ids.has(asset.assetId) || cardAssetIds.has(asset.assetId) || !Number.isInteger(asset.usageCount) || asset.usageCount < 0 || !Number.isInteger(asset.sourceRow) || asset.sourceRow < 1) throw new Error("Recorte Workforce por equipamento inválido.");
        cardAssetIds.add(asset.assetId);
        validateWorkforceMetrics(asset.metrics);
      }
      if (card.cardCode) codeRows.set(card.cardCode, [...(codeRows.get(card.cardCode) ?? []), card]);
    }
    for (const rows of codeRows.values()) if (rows.length > 1 && rows.some(row => row.cardQuality !== "ambiguous")) throw new Error("Código Workforce duplicado sem sinalização de ambiguidade.");
  }
  if (d.legacy) {
    const l = d.legacy;
    if (typeof l.periodLabel !== "string" || typeof l.sourceFile !== "string" || !/^[a-f0-9]{64}$/.test(l.sha256) || !Array.isArray(l.rows) || !Array.isArray(l.warnings) || l.warnings.some(w => typeof w !== "string") || !Array.isArray(l.impactArchive) || !finite(l.displayImpactTotal) || !finite(l.displayFuelKg)) throw new Error("Histórico legado inválido.");
    for (const r of l.rows) if (!r || typeof r.rowId !== "string" || (r.cardCode !== null && !/^\d{1,64}$/.test(r.cardCode)) || !["complete", "incomplete", "ambiguous"].includes(r.cardQuality) || !Number.isInteger(r.sourceRow) || !r.metrics || !r.legacyCalculated || [...Object.values(r.metrics), ...Object.values(r.legacyCalculated)].some(v => v !== null && (typeof v !== "number" || !Number.isFinite(v)))) throw new Error("Linha legada inválida.");
    for (const r of l.rows) if (r.legacyDisplay && Object.values(r.legacyDisplay).some(v => typeof v !== "string" && (typeof v !== "number" || !Number.isFinite(v)))) throw new Error("Quadro histórico inválido.");
  }
  for (const r of d.kpi) if (!r || !ids.has(r.assetId) || ![r.keyHours, r.workHours, r.idleHours, r.serviceHours].every(finite)) throw new Error("KPI inválido.");
  for (const r of d.currentStatus) if (!r || !ids.has(r.assetId) || typeof r.status !== "string" || typeof r.lastAccess !== "string") throw new Error("Snapshot inválido.");
  for (const r of d.fuel) if (!r || !ids.has(r.assetId) || !finite(r.reportedLiters)) throw new Error("Combustível inválido.");
  for (const r of d.costs) if (!r || !ids.has(r.assetId) || !finite(r.reportedCostPerHour) || !(r.reportedTotal === null || finite(r.reportedTotal))) throw new Error("Custo inválido.");
  if (typeof d.maintenanceAvailable !== "boolean" || d.sources.some(s => !s || typeof s.file !== "string" || !/^[a-f0-9]{64}$/.test(s.sha256))) throw new Error("Proveniência inválida.");
  return d;
}

export const sum = (rows: Daily[], key: "keyHours" | "workHours" | "idleHours" | "waitHours") => rows.reduce((s, r) => s + r[key], 0);
export const ratio = (n: number, d: number) => d > 0 ? n / d * 100 : null;
export function totals(rows: Daily[]) {
  const key = sum(rows, "keyHours"), idle = sum(rows, "idleHours"), work = sum(rows, "workHours");
  return { key, idle, work, idlePct: ratio(idle, key), workPct: ratio(work, key), records: rows.length };
}

export function analyzeHyster(data: HysterData, month = "all", asset = "all") {
  const matches = (r: { date: string; assetId: string }) => (month === "all" || r.date.startsWith(month)) && (asset === "all" || r.assetId === asset);
  const daily = data.daily.filter(matches), events = data.events.filter(matches);
  const assets = data.assets.filter(a => asset === "all" || a.assetId === asset).map(a => {
    const rows = daily.filter(r => r.assetId === a.assetId), es = events.filter(e => e.assetId === a.assetId);
    return { assetId: a.assetId, ...totals(rows), faults: es.filter(e => e.type === "Falha do sistema").length, impacts: es.filter(e => e.type === "Impacto").length };
  });
  const months = [...new Set(data.daily.map(r => r.date.slice(0, 7)))].sort().map(m => ({ month: m, ...totals(data.daily.filter(r => r.date.startsWith(m) && (asset === "all" || r.assetId === asset))) }));
  const deviations: { assetId: string; date: string; current: number; baseline: number; z: number; samples: number; sourceRow: number; idleHours: number }[] = [];
  for (const r of daily) {
    if (r.keyHours < 1) continue;
    const cutoff = Date.parse(r.date) - 28 * 86400000;
    const previous = data.daily.filter(p => p.assetId === r.assetId && p.date < r.date && Date.parse(p.date) >= cutoff && p.keyHours >= 1);
    if (previous.length < 10) continue;
    const values = previous.map(p => p.idleHours / p.keyHours * 100);
    const baseline = values.reduce((a, b) => a + b, 0) / values.length;
    const sd = Math.sqrt(values.reduce((a, b) => a + (b - baseline) ** 2, 0) / (values.length - 1));
    const current = r.idleHours / r.keyHours * 100;
    // A constant historical series is not sufficient for a calibrated z-score.
    if (sd < 0.01) continue;
    const z = (current - baseline) / sd;
    if (z >= 2 && current - baseline >= 10) deviations.push({ assetId: r.assetId, date: r.date, current, baseline, z, samples: previous.length, sourceRow: r.sourceRow, idleHours: r.idleHours });
  }
  deviations.sort((a, b) => b.z - a.z);
  const types = Object.fromEntries([...new Set(events.map(e => e.type))].map(t => [t, events.filter(e => e.type === t).length]));
  return { daily, assets, months, deviations, types, totals: totals(daily), eventCount: events.length,
    quality: { waitAboveIdle: daily.filter(r => r.waitHours > r.idleHours).length,
      nonAdditive: daily.filter(r => r.workHours + r.idleHours > r.keyHours + 0.03).length },
    incidents: events.filter(e => e.type === "Falha do sistema" || e.type === "Impacto") };
}
