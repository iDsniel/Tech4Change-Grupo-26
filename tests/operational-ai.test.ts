import assert from "node:assert/strict";
import test from "node:test";
import type { HysterData } from "../lib/hyster.ts";
import { analyzeOperationalAI, operationalExplanationPacket } from "../lib/operationalAI.ts";
import { deterministicOperationalExplanation, validateOperationalExplanationPacket } from "../lib/operationalExplanation.ts";
import { scoreIsolationForest } from "../lib/isolationForestCore.ts";

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

  return {
    schemaVersion: 3,
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
      granularity: "card-period",
      unitSystem: "metric",
      sourceFile: "workforce.xlsx",
      sha256: "b".repeat(64),
      cards: [{ cardCode: "000845", cardQuality: "complete", usageCount: 1, metrics: { distanceKm: 999, idleHours: 500 }, assets: [{ assetId: "EP01", usageCount: 1, metrics: { distanceKm: 999, idleHours: 500 }, sourceRow: 4 }], sourceRow: 3 }],
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

test("real explanation packet excludes card identity and stays evidence-bound", () => {
  const insight = analyzeOperationalAI(fixture()).insights[0];
  assert.ok(insight);
  const packet = operationalExplanationPacket(insight);
  assert.equal("relatedCardCodes" in packet, false);
  const validated = validateOperationalExplanationPacket(packet);
  const explanation = deterministicOperationalExplanation(validated);
  assert.match(explanation.uncertainty, /não prova|não comprova|Não prova/i);
});
