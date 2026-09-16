import type { HysterData, WorkforceMetrics } from "./hyster.ts";
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
  };
  aggregateTelemetry?: {
    granularity: "asset-period";
    periodStart: string;
    periodEnd: string;
    usageCount: number;
    coverageSlices: number;
    metrics: WorkforceMetrics;
    ratios: {
      hydraulicPct: number | null;
      motionPct: number | null;
      liftPct: number | null;
      lowerPct: number | null;
      highSpeedPct: number | null;
      marchPct: number | null;
      forwardSharePct: number | null;
      reverseSharePct: number | null;
    };
    caveat: string;
  };
  events: {
    faults: number;
    impacts: number;
    total: number;
    byType: { type: string; count: number }[];
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

function aggregateTelemetry(data: HysterData, assetId: string): OperationalContext["aggregateTelemetry"] | undefined {
  if (!data.workforce) return undefined;
  // Aggregate all complete asset slices. This deliberately removes card identity from the AI context.
  const slices = data.workforce.cards
    .filter((card) => card.cardQuality === "complete")
    .flatMap((card) => card.assets.filter((asset) => asset.assetId === assetId));
  if (!slices.length) return undefined;

  const metrics = mergeMetrics(slices.map((slice) => slice.metrics));
  const marchHours = metrics.forwardHours != null && metrics.reverseHours != null
    ? metrics.forwardHours + metrics.reverseHours
    : undefined;

  return {
    granularity: "asset-period",
    periodStart: data.workforce.periodStart,
    periodEnd: data.workforce.periodEnd,
    usageCount: slices.reduce((sum, slice) => sum + slice.usageCount, 0),
    coverageSlices: slices.length,
    metrics,
    ratios: {
      hydraulicPct: ratio(metrics.hydraulicHours, metrics.keyHours),
      motionPct: ratio(metrics.motionHours, metrics.keyHours),
      liftPct: ratio(metrics.liftHours, metrics.keyHours),
      lowerPct: ratio(metrics.lowerHours, metrics.keyHours),
      highSpeedPct: ratio(metrics.highSpeedHours, metrics.keyHours),
      marchPct: ratio(marchHours, metrics.keyHours),
      forwardSharePct: ratio(metrics.forwardHours, marchHours),
      reverseSharePct: ratio(metrics.reverseHours, marchHours)
    },
    caveat: "Indicadores de movimento, hidráulica, elevação e marcha são agregados do período informado; não representam necessariamente o dia do insight e não devem ser rateados artificialmente."
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
    byType: [...counts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count || a.type.localeCompare(b.type)).slice(0, 20)
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

  const aggregate = aggregateTelemetry(data, insight.assetId);
  const events = eventContext(data, insight.assetId, insight.date);
  const management = managementContext(insight.assetId, insight.date, orders, inputs);
  const limitations: string[] = [
    "O contexto organiza evidências disponíveis; não determina causa raiz, previsão de pane ou responsabilidade individual.",
    "Identidade e código de cartão não são enviados no contexto de interpretação da IA."
  ];
  if (aggregate) limitations.push(aggregate.caveat);
  else limitations.push("Não há indicadores agregados de hidráulica, movimento, elevação ou marcha para este equipamento.");
  if (!management.sameDayInput?.production) limitations.push("Demanda/produção do dia não está disponível; baixa atividade pode refletir menor demanda e não pode ser classificada automaticamente como perda de produtividade.");
  if (!data.maintenanceAvailable) limitations.push("A origem não contém manutenção detalhada suficiente para confirmar diagnóstico técnico.");

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
      waitPct: ratio(row.waitHours, row.keyHours)
    },
    aggregateTelemetry: aggregate,
    events,
    management,
    availability: {
      demandOrProduction: management.sameDayInput?.production != null,
      plannedHours: management.sameDayInput?.plannedHours != null,
      downtime: management.sameDayInput?.downtimeHours != null,
      maintenanceDetail: data.maintenanceAvailable,
      aggregateTelemetry: !!aggregate
    },
    limitations
  };
}
