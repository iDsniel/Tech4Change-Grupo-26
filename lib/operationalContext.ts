import { workforceCardSlices, type HysterData, type WorkforceMetrics } from "./hyster.ts";
import type { DailyInput, WorkOrder } from "./operations.ts";
import type { OperationalAIInsight } from "./operationalAI.ts";

export type OperationalContext = {
  schemaVersion: "pulso-operational-context-v1";
  assetId: string;
  date: string;
  daily: {
    granularity: "asset-day";
    keyHours: number;
    presenceHours: number;
    workHours: number;
    idleHours: number;
    waitHours: number;
    workPct: number | null;
    idlePct: number | null;
    waitPct: number | null;
    sourceWorkPct?: number | null;
    sourceIdlePct?: number | null;
    sourceWaitPctOfIdle?: number | null;
  };
  aggregateTelemetry?: {
    granularity: "asset-month" | "asset-period";
    periodStart: string;
    periodEnd: string;
    usageCount: number;
    coverageSlices: number;
    metrics: WorkforceMetrics;
    ratios: {
      hydraulicPct: number | null;
      auxiliaryHydraulicPct: number | null;
      motionPct: number | null;
      liftPct: number | null;
      lowerPct: number | null;
      lowSpeedPct: number | null;
      mediumSpeedPct: number | null;
      highSpeedPct: number | null;
      lowOverspeedPct: number | null;
      highOverspeedPct: number | null;
      marchPct: number | null;
      forwardSharePct: number | null;
      reverseSharePct: number | null;
      seatBeltViolationPct: number | null;
      ladenPct: number | null;
      unladenPct: number | null;
    };
    caveat: string;
  };
  events: {
    faults: number;
    impacts: number;
    total: number;
    byType: { type: string; count: number }[];
    criticalOnly: boolean;
  };
  management: {
    granularity: "workspace-current";
    sameDayInput?: {
      plannedHours: number | null;
      downtimeHours: number | null;
      fuelQuantity: number | null;
      fuelUnit: "L" | "kg";
      costBRL: number | null;
      production: number | null;
      productionUnit: "t" | "movimentos";
    };
    openOrders: number;
    inProgressOrders: number;
    completedOrders: number;
    latestCompletedAt: string | null;
  };
  availability: {
    demandOrProduction: boolean;
    plannedHours: boolean;
    downtime: boolean;
    maintenanceDetail: boolean;
    aggregateTelemetry: boolean;
    loadTelemetry: boolean;
    fuelTelemetry: boolean;
  };
  limitations: string[];
};

type ContextInput = {
  data: HysterData;
  insight: OperationalAIInsight;
  orders?: WorkOrder[];
  inputs?: DailyInput[];
};

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const ratio = (numerator: number | undefined, denominator: number | undefined) =>
  numerator != null && denominator != null && denominator > 0 ? round(numerator / denominator * 100) : null;

const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const optionalFinite = (value: unknown) => value === null || finite(value);
const validDate = (value: unknown) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value));

function mergeMetrics(rows: WorkforceMetrics[]) {
  const merged: WorkforceMetrics = {};
  const keys = new Set(rows.flatMap((row) => Object.keys(row)));
  for (const key of keys) {
    const values = rows.flatMap((row) => {
      const value = row[key as keyof WorkforceMetrics];
      return typeof value === "number" && Number.isFinite(value) ? [value] : [];
    });
    if (values.length) merged[key as keyof WorkforceMetrics] = round(values.reduce((sum, value) => sum + value, 0));
  }
  return merged;
}

function aggregateTelemetry(data: HysterData, assetId: string, date: string): OperationalContext["aggregateTelemetry"] | undefined {
  if (!data.workforce) return undefined;
  const month = date.slice(0, 7);
  const sourcePeriods = workforceCardSlices(data, `${month}-01`, `${month}-31`);
  if (!sourcePeriods.length) return undefined;

  // Aggregate complete slices from the month containing the insight. Card identity is deliberately removed.
  const assetSlices = sourcePeriods.flatMap((period) =>
    period.cards
      .filter((card) => card.cardQuality === "complete")
      .flatMap((card) => card.assets.filter((asset) => asset.assetId === assetId))
  );
  if (!assetSlices.length) return undefined;

  const metrics = mergeMetrics(assetSlices.map((slice) => slice.metrics));
  const marchHours = metrics.forwardHours != null && metrics.reverseHours != null
    ? metrics.forwardHours + metrics.reverseHours
    : undefined;
  const loadHours = metrics.ladenHours != null && metrics.unladenHours != null
    ? metrics.ladenHours + metrics.unladenHours
    : undefined;
  const monthly = sourcePeriods.every((period) => period.granularity === "card-month");

  return {
    granularity: monthly ? "asset-month" : "asset-period",
    periodStart: sourcePeriods[0].periodStart,
    periodEnd: sourcePeriods.at(-1)!.periodEnd,
    usageCount: assetSlices.reduce((sum, slice) => sum + slice.usageCount, 0),
    coverageSlices: assetSlices.length,
    metrics,
    ratios: {
      hydraulicPct: ratio(metrics.hydraulicHours, metrics.keyHours),
      auxiliaryHydraulicPct: ratio(metrics.auxiliaryHydraulicHours, metrics.keyHours),
      motionPct: ratio(metrics.motionHours, metrics.keyHours),
      liftPct: ratio(metrics.liftHours, metrics.keyHours),
      lowerPct: ratio(metrics.lowerHours, metrics.keyHours),
      lowSpeedPct: ratio(metrics.lowSpeedHours, metrics.keyHours),
      mediumSpeedPct: ratio(metrics.mediumSpeedHours, metrics.keyHours),
      highSpeedPct: ratio(metrics.highSpeedHours, metrics.keyHours),
      lowOverspeedPct: ratio(metrics.lowLevelOverspeedHours, metrics.keyHours),
      highOverspeedPct: ratio(metrics.highLevelOverspeedHours, metrics.keyHours),
      marchPct: ratio(marchHours, metrics.keyHours),
      forwardSharePct: ratio(metrics.forwardHours, marchHours),
      reverseSharePct: ratio(metrics.reverseHours, marchHours),
      seatBeltViolationPct: ratio(metrics.seatBeltViolationHours, metrics.keyHours),
      ladenPct: ratio(metrics.ladenHours, loadHours),
      unladenPct: ratio(metrics.unladenHours, loadHours)
    },
    caveat: monthly
      ? `Hidráulica, movimento, marcha, velocidade e carga são totais reais do mês ${sourcePeriods[0].periodStart.slice(0, 7)}. Eles contextualizam o insight, mas não representam necessariamente o mesmo dia.`
      : "Indicadores de movimento, hidráulica, velocidade, carga e marcha são agregados do período Workforce informado; não representam necessariamente o dia do insight."
  };
}

function eventContext(data: HysterData, assetId: string, date: string): OperationalContext["events"] {
  const events = data.events.filter((event) => event.assetId === assetId && event.date === date);
  const counts = new Map<string, number>();
  for (const event of events) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
  return {
    faults: events.filter((event) => event.type === "Falha do sistema").length,
    impacts: events.filter((event) => event.type === "Impacto").length,
    total: events.length,
    byType: [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)).slice(0, 20),
    criticalOnly: data.dataQuality?.eventExportCriticalOnly === true
  };
}

function managementContext(assetId: string, date: string, orders: WorkOrder[], inputs: DailyInput[]): OperationalContext["management"] {
  const sameDay = inputs.find((input) => input.assetId === assetId && input.date === date);
  const assetOrders = orders.filter((order) => order.assetId === assetId);
  const completed = assetOrders.filter((order) => order.status === "completed" && order.completedAt);
  const latestCompletedAt = completed.map((order) => order.completedAt!).sort().at(-1) ?? null;

  return {
    granularity: "workspace-current",
    sameDayInput: sameDay ? {
      plannedHours: sameDay.plannedHours,
      downtimeHours: sameDay.downtimeHours,
      fuelQuantity: sameDay.fuelQuantity,
      fuelUnit: sameDay.fuelUnit,
      costBRL: sameDay.costBRL,
      production: sameDay.production,
      productionUnit: sameDay.productionUnit
    } : undefined,
    openOrders: assetOrders.filter((order) => order.status === "open").length,
    inProgressOrders: assetOrders.filter((order) => order.status === "in_progress").length,
    completedOrders: completed.length,
    latestCompletedAt
  };
}

export function buildOperationalContext({ data, insight, orders = [], inputs = [] }: ContextInput): OperationalContext {
  const row = data.daily.find((item) => item.assetId === insight.assetId && item.date === insight.date);
  if (!row) throw new Error("O insight não possui registro diário correspondente na base operacional.");

  const aggregate = aggregateTelemetry(data, insight.assetId, insight.date);
  const events = eventContext(data, insight.assetId, insight.date);
  const management = managementContext(insight.assetId, insight.date, orders, inputs);
  const loadAvailable = !!aggregate && (aggregate.metrics.ladenHours ?? 0) + (aggregate.metrics.unladenHours ?? 0) > 0;
  const fuelAvailable = data.fuel.some((item) => item.assetId === insight.assetId && item.reportedLiters > 0);
  const limitations: string[] = [
    "O contexto organiza evidências disponíveis; não determina causa raiz, previsão de pane ou responsabilidade individual.",
    "Identidade e código de cartão não são enviados no contexto de interpretação da IA."
  ];
  if (aggregate) limitations.push(aggregate.caveat);
  else limitations.push("Não há indicadores agregados de hidráulica, movimento, velocidade, carga ou marcha para este equipamento.");
  if (management.sameDayInput?.production == null) limitations.push("Demanda/produção do dia não está disponível; baixa atividade pode refletir menor demanda e não pode ser classificada automaticamente como perda de produtividade.");
  if (!data.maintenanceAvailable) limitations.push("A origem não contém manutenção detalhada suficiente para confirmar diagnóstico técnico.");
  if (events.criticalOnly) limitations.push("O histórico de eventos foi exportado com filtro Crítica = Sim; contagens de eventos não representam necessariamente todos os eventos ocorridos.");
  if (!loadAvailable && data.workforce) limitations.push("Os indicadores de carga estão zerados ou indisponíveis neste período; não inferir operação carregada/descarregada.");
  if (!fuelAvailable) limitations.push("Combustível/energia está zerado ou indisponível nesta base; não estimar consumo ou economia.");

  return {
    schemaVersion: "pulso-operational-context-v1",
    assetId: insight.assetId,
    date: insight.date,
    daily: {
      granularity: "asset-day",
      keyHours: round(row.keyHours),
      presenceHours: round(row.presenceHours),
      workHours: round(row.workHours),
      idleHours: round(row.idleHours),
      waitHours: round(row.waitHours),
      workPct: ratio(row.workHours, row.keyHours),
      idlePct: ratio(row.idleHours, row.keyHours),
      waitPct: ratio(row.waitHours, row.keyHours),
      sourceWorkPct: row.workPercent ?? null,
      sourceIdlePct: row.idlePercent ?? null,
      sourceWaitPctOfIdle: row.waitPercentOfIdle ?? null
    },
    aggregateTelemetry: aggregate,
    events,
    management,
    availability: {
      demandOrProduction: management.sameDayInput?.production != null,
      plannedHours: management.sameDayInput?.plannedHours != null,
      downtime: management.sameDayInput?.downtimeHours != null,
      maintenanceDetail: data.maintenanceAvailable,
      aggregateTelemetry: !!aggregate,
      loadTelemetry: loadAvailable,
      fuelTelemetry: fuelAvailable
    },
    limitations
  };
}

export function validateOperationalContext(value: unknown): OperationalContext {
  if (!value || typeof value !== "object") throw new Error("Contexto operacional inválido.");
  const context = value as Record<string, unknown>;
  if (context.schemaVersion !== "pulso-operational-context-v1" || !/^EP\d{2,6}$/.test(String(context.assetId)) || !validDate(context.date)) throw new Error("Identidade do contexto operacional inválida.");

  const daily = context.daily as Record<string, unknown> | undefined;
  if (!daily || daily.granularity !== "asset-day" || ![daily.keyHours, daily.presenceHours, daily.workHours, daily.idleHours, daily.waitHours].every(finite) || ![daily.workPct, daily.idlePct, daily.waitPct, daily.sourceWorkPct, daily.sourceIdlePct, daily.sourceWaitPctOfIdle].every(optionalFinite)) throw new Error("Contexto diário inválido.");

  if (context.aggregateTelemetry !== undefined) {
    const aggregate = context.aggregateTelemetry as Record<string, unknown>;
    const ratios = aggregate.ratios as Record<string, unknown> | undefined;
    if (!["asset-month", "asset-period"].includes(String(aggregate.granularity)) || !validDate(aggregate.periodStart) || !validDate(aggregate.periodEnd) || String(aggregate.periodStart) > String(aggregate.periodEnd) || !Number.isInteger(aggregate.usageCount) || !Number.isInteger(aggregate.coverageSlices) || !aggregate.metrics || typeof aggregate.metrics !== "object" || !ratios || !Object.values(ratios).every(optionalFinite) || typeof aggregate.caveat !== "string") throw new Error("Contexto agregado inválido.");
  }

  const events = context.events as Record<string, unknown> | undefined;
  if (!events || ![events.faults, events.impacts, events.total].every((item) => Number.isInteger(item) && Number(item) >= 0) || typeof events.criticalOnly !== "boolean" || !Array.isArray(events.byType) || events.byType.length > 20 || events.byType.some((item) => !item || typeof item !== "object" || typeof (item as Record<string, unknown>).type !== "string" || !Number.isInteger((item as Record<string, unknown>).count))) throw new Error("Contexto de eventos inválido.");

  const management = context.management as Record<string, unknown> | undefined;
  if (!management || management.granularity !== "workspace-current" || ![management.openOrders, management.inProgressOrders, management.completedOrders].every((item) => Number.isInteger(item) && Number(item) >= 0) || !(management.latestCompletedAt === null || validDate(management.latestCompletedAt))) throw new Error("Contexto de gestão inválido.");
  if (management.sameDayInput !== undefined) {
    const input = management.sameDayInput as Record<string, unknown>;
    if (![input.plannedHours, input.downtimeHours, input.fuelQuantity, input.costBRL, input.production].every(optionalFinite) || !["L", "kg"].includes(String(input.fuelUnit)) || !["t", "movimentos"].includes(String(input.productionUnit))) throw new Error("Apontamento de contexto inválido.");
  }

  const availability = context.availability as Record<string, unknown> | undefined;
  if (!availability || ![availability.demandOrProduction, availability.plannedHours, availability.downtime, availability.maintenanceDetail, availability.aggregateTelemetry, availability.loadTelemetry, availability.fuelTelemetry].every((item) => typeof item === "boolean")) throw new Error("Disponibilidade do contexto inválida.");
  if (!Array.isArray(context.limitations) || context.limitations.length > 16 || context.limitations.some((item) => typeof item !== "string" || item.length > 500)) throw new Error("Limitações do contexto inválidas.");

  // Defense in depth: the model context must never contain operator/card identity fields.
  const serialized = JSON.stringify(value).toLowerCase();
  if (serialized.includes('"cardcode"') || serialized.includes('"operator"') || serialized.includes('"operatorname"')) throw new Error("Identidade individual não pode integrar o contexto de IA.");

  return value as OperationalContext;
}