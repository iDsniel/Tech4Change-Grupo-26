import assert from "node:assert/strict";
import test from "node:test";
import type { HysterData } from "../lib/hyster.ts";
import { analyzeOperationalAI, operationalExplanationPacket } from "../lib/operationalAI.ts";
import { buildOperationalContext, validateOperationalContext } from "../lib/operationalContext.ts";
import { deterministicOperationalExplanation, validateOperationalExplanationPacket } from "../lib/operationalExplanation.ts";
import { scoreIsolationForest } from "../lib/isolationForestCore.ts";
import { monthlyBusinessSnapshots } from "../lib/monthlyContext.ts";
import { operationalShiftForTime } from "../lib/operationProfile.ts";

function isoDate(day: number) {
  return `2026-06-${String(day).padStart(2, "0")}`;
}

function fixture(): HysterData {
  const daily = Array.from({ length: 20 }, (_, index) => ({
    assetId: "EP01",
    date: isoDate(index + 1),
    keyHours: 8 + (index % 3) * 0.1,
    presenceHours: 8,
    workHours: 7,
    idleHours: 0.8,
    waitHours: 0.7,
    sourceRow: index + 2
  }));
  daily.push({ assetId: "EP01", date: "2026-06-21", keyHours: 8, presenceHours: 8, workHours: 3, idleHours: 4, waitHours: 3, sourceRow: 22 });

  const workforceMetrics = {
    keyHours: 100,
    workHours: 72,
    idleHours: 20,
    motionHours: 60,
    hydraulicHours: 40,
    liftHours: 12,
    lowerHours: 10,
    highSpeedHours: 5,
    forwardHours: 35,
    reverseHours: 25,
    distanceKm: 999
  };

  return {
    schemaVersion: 5,
    provider: "Hyster Tracker",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    operationId: "0123456789abcdef",
    assets: [{ assetId: "EP01", serviceMeterHours: 1000 }],
    daily,
    events: [
      ...Array.from({ length: 6 }, (_, index) => ({ assetId: "EP01", date: "2026-06-21", time: `10:0${index}:00`, type: "Falha do sistema", cardCode: "000845", sourceCritical: true, sourceStatus: "Aberto", sourceRow: 100 + index })),
      { assetId: "EP01", date: "2026-06-21", time: "11:00:00", type: "Impacto", cardCode: "000845", sourceCritical: true, sourceStatus: "Aberto", sourceRow: 106 }
    ],
    kpi: [{ assetId: "EP01", keyHours: 168, workHours: 143, idleHours: 20, serviceHours: 168 }],
    currentStatus: [],
    fuel: [{ assetId: "EP01", reportedLiters: 0 }],
    costs: [{ assetId: "EP01", reportedCostPerHour: 0, reportedTotal: null }],
    maintenanceAvailable: false,
    sources: [{ file: "fixture.xlsx", sha256: "a".repeat(64), sheets: [] }],
    workforce: {
      periodStart: "2026-06-01",
      periodEnd: "2026-06-30",
      granularity: "card-month",
      unitSystem: "metric",
      cards: [],
      periods: [{
        periodStart: "2026-06-01",
        periodEnd: "2026-06-30",
        granularity: "card-month",
        sourceFile: "workforce-jun.xlsx",
        sha256: "b".repeat(64),
        cards: [{ cardCode: "000845", cardQuality: "complete", usageCount: 1, metrics: workforceMetrics, assets: [{ assetId: "EP01", usageCount: 1, metrics: workforceMetrics, sourceRow: 4 }], sourceRow: 3 }],
        warnings: []
      }],
      warnings: []
    }
  };
}

test("Isolation Forest core is deterministic for the same vectors and seed", () => {
  const training = Array.from({ length: 16 }, (_, index) => [index / 10, index % 3, 10 + index]);
  const first = scoreIsolationForest(training, [9, 9, 99], "EP01:asset-day");
  const second = scoreIsolationForest(training, [9, 9, 99], "EP01:asset-day");
  assert.deepEqual(first, second);
  assert.ok(first.percentile >= 0 && first.percentile <= 1);
});

test("real Pulso data flows through baseline, z-score and Isolation Forest", () => {
  const result = analyzeOperationalAI(fixture());
  assert.equal(result.method, "rolling-zscore+isolation-forest");
  assert.ok(result.insights.length >= 1);
  const insight = result.insights.find((item) => item.date === "2026-06-21" && item.assetId === "EP01");
  assert.ok(insight);
  assert.equal(insight.category, "safety");
  assert.ok(insight.evidence.some((item) => item.metric === "idlePct"));
  assert.ok(insight.evidence.some((item) => item.metric === "impactEvents"));
  assert.equal(insight.relatedCardCodes[0], "000845");
  assert.equal(insight.multivariate.method, "isolation-forest");
  assert.ok(insight.baselineSamples >= 10);
  assert.equal(result.guardrails.cardMetricsAreContextOnly, true);
  assert.ok(!result.features.includes("distanceKm" as never));
});

test("Operational Context Engine adds scoped telemetry without operator identity", () => {
  const data = fixture();
  const insight = analyzeOperationalAI(data).insights.find((item) => item.date === "2026-06-21");
  assert.ok(insight);
  const context = buildOperationalContext({ data, insight });
  const validated = validateOperationalContext(context);
  assert.equal(validated.daily.granularity, "asset-day");
  assert.equal(validated.daily.workPct, 37.5);
  assert.equal(validated.events.impacts, 1);
  assert.equal(validated.events.faults, 6);
  assert.equal(validated.aggregateTelemetry?.granularity, "asset-month");
  assert.equal(validated.aggregateTelemetry?.ratios.hydraulicPct, 40);
  assert.equal(validated.aggregateTelemetry?.ratios.motionPct, 60);
  assert.equal(validated.aggregateTelemetry?.ratios.marchPct, 60);
  assert.equal(validated.aggregateTelemetry?.ratios.forwardSharePct, 58.33);
  assert.equal(validated.aggregateTelemetry?.periodStart, "2026-06-01");
  assert.equal(validated.aggregateTelemetry?.periodEnd, "2026-06-30");
  assert.equal(validated.availability.demandOrProduction, false);
  assert.equal(validated.businessContext.primaryMaterialFlow, "pallets de hardboard");
  assert.equal(validated.businessContext.fleetAlsoUsedByMaintenance, true);
  assert.equal(validated.events.byShift.A.impacts, 1);
  assert.equal(validated.businessContext.workforceShiftGranularity, "month-only");
  const serialized = JSON.stringify(validated);
  assert.equal(serialized.includes("000845"), false);
  assert.equal(serialized.toLowerCase().includes("cardcode"), false);
  assert.match(validated.limitations.join(" "), /não.*produtividade|demanda\/produção/i);
});

test("monthly business comparator preserves monthly activity and derives shifts only from timestamped events", () => {
  const data = fixture();
  data.periodEnd = "2026-07-31";
  data.workforce!.periodEnd = "2026-07-31";
  const july = structuredClone(data.workforce!.periods![0]);
  july.periodStart = "2026-07-01";
  july.periodEnd = "2026-07-31";
  july.sourceFile = "workforce-jul.xlsx";
  july.sha256 = "c".repeat(64);
  july.cards[0].metrics = { ...july.cards[0].metrics, keyHours: 120, workHours: 78, hydraulicHours: 36, motionHours: 66, forwardHours: 30, reverseHours: 36, highSpeedHours: 12, lowLevelOverspeedHours: 3, highLevelOverspeedHours: 1 };
  july.cards[0].assets[0].metrics = structuredClone(july.cards[0].metrics);
  data.workforce!.periods!.push(july);
  data.events.push(
    { assetId: "EP01", date: "2026-07-10", time: "08:00:00", type: "Impacto", sourceCritical: true, sourceStatus: "Aberto", sourceRow: 201 },
    { assetId: "EP01", date: "2026-07-11", time: "16:00:00", type: "Impacto", sourceCritical: true, sourceStatus: "Aberto", sourceRow: 202 },
    { assetId: "EP01", date: "2026-07-12", time: "23:30:00", type: "Falha do sistema", sourceCritical: true, sourceStatus: "Aberto", sourceRow: 203 }
  );
  const snapshots = monthlyBusinessSnapshots(data, "EP01", "all", [
    { id: "jul", assetId: "EP01", date: "2026-07-10", plannedHours: 8, downtimeHours: 0, fuelQuantity: null, fuelUnit: "L", costBRL: 420, production: 140, productionUnit: "pallets", usageContext: "production", note: "" }
  ]);
  assert.equal(snapshots.length, 2);
  const current = snapshots[1];
  assert.equal(current.month, "2026-07");
  assert.equal(current.activity.hydraulicPct, 30);
  assert.equal(current.travelSafety.reverseSharePct, 54.55);
  assert.equal(current.travelSafety.highSpeedSharePct, 18.18);
  assert.equal(current.events.byShift.A.impacts, 1);
  assert.equal(current.events.byShift.B.impacts, 1);
  assert.equal(current.events.byShift.C.faults, 1);
  assert.equal(current.business.costPerPallet, 3);
  assert.equal(operationalShiftForTime("06:59:59"), "C");
  assert.equal(operationalShiftForTime("07:00:00"), "A");
  assert.equal(operationalShiftForTime("15:00:00"), "B");
  assert.equal(operationalShiftForTime("23:00:00"), "C");
});

test("Operational Context Engine can include structured human inputs without free-text notes", () => {
  const data = fixture();
  const insight = analyzeOperationalAI(data).insights.find((item) => item.date === "2026-06-21");
  assert.ok(insight);
  const context = buildOperationalContext({
    data,
    insight,
    inputs: [{ id: "input-1", assetId: "EP01", date: "2026-06-21", plannedHours: 8, downtimeHours: 1, fuelQuantity: 12, fuelUnit: "L", costBRL: 150, production: 42, productionUnit: "movimentos", usageContext: "maintenance", note: "texto livre que não deve sair" }],
    orders: [{ id: "order-1", assetId: "EP01", title: "Inspeção", kind: "operational", priority: "high", team: "Operação", dueDate: "2026-06-25", status: "open", openedAt: "2026-06-21T12:00:00.000Z", completedAt: null, note: "nota privada", history: [] }]
  });
  assert.equal(context.availability.demandOrProduction, true);
  assert.equal(context.management.sameDayInput?.production, 42);
  assert.equal(context.management.openOrders, 1);
  assert.equal(context.management.sameDayInput?.usageContext, "maintenance");
  const serialized = JSON.stringify(context);
  assert.equal(serialized.includes("texto livre"), false);
  assert.equal(serialized.includes("nota privada"), false);
  assert.equal(serialized.includes("Inspeção"), false);
});

test("real explanation packet excludes card identity and stays evidence-bound", () => {
  const data = fixture();
  const insight = analyzeOperationalAI(data).insights[0];
  assert.ok(insight);
  const context = buildOperationalContext({ data, insight });
  const packet = { ...operationalExplanationPacket(insight), context };
  assert.equal("relatedCardCodes" in packet, false);
  assert.equal(JSON.stringify(packet).includes("000845"), false);
  const validated = validateOperationalExplanationPacket(packet);
  const explanation = deterministicOperationalExplanation(validated);
  assert.match(explanation.uncertainty, /não prova|não comprova|Não prova/i);
  assert.match(explanation.explanation, /hidráulica|movimento|marcha/i);
});
