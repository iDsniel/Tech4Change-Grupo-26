import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateKoneDemo,
  analyzeKoneDemo,
  generateKoneDemoRecords,
  koneDemoPayload,
  koneDemoScenario
} from "../lib/koneDemo.ts";

test("six-month demo preserves business movement and process cycle", () => {
  assert.equal(koneDemoScenario.truckCapacityT, 16);
  assert.equal(koneDemoScenario.baleWeightT, 2);
  assert.equal(koneDemoScenario.balesPerLoadedMovement, 2);
  assert.equal(koneDemoScenario.tonnesPerLoadedMovement, 4);

  const records = generateKoneDemoRecords();
  // Mar 1 -> Aug 31 2026 = 184 days × 6 assets × 3 shifts.
  assert.equal(records.length, 184 * 6 * 3);

  for (const row of records) {
    assert.equal(row.totalLoadLiftedT, row.productiveCycles * 4);
    assert.equal(row.balesMoved, row.productiveCycles * 2);
    assert.equal(
      row.cycle.averageCycleSec,
      Math.round((row.cycle.approachEmptySec + row.cycle.pickupSec + row.cycle.loadedTransferSec + row.cycle.depositSec) * 100) / 100
    );
  }

  const total = aggregateKoneDemo(records);
  assert.equal(total.balesMoved, total.totalLoadLiftedT / 2);
  assert.equal(total.loadedMovements, total.totalLoadLiftedT / 4);
  assert.ok((total.cyclesPerRunningHour ?? 0) > 0);
  assert.ok((total.averageCycleSec ?? 0) > 0);
});

test("five months train and august remains a holdout", () => {
  const payload = koneDemoPayload();
  assert.equal(payload.learning.trainingStart, "2026-03-01");
  assert.equal(payload.learning.trainingEnd, "2026-07-31");
  assert.equal(payload.learning.evaluationStart, "2026-08-01");
  assert.equal(payload.learning.evaluationEnd, "2026-08-31");
  assert.equal(payload.learning.trainingRecords, 153 * 6 * 3);
  assert.equal(payload.learning.evaluationRecords, 31 * 6 * 3);
  assert.equal(payload.learning.totalRecords, 184 * 6 * 3);
  assert.match(payload.learning.statistics, /median.*MAD/i);
});

test("cycle engine locates the flow bottleneck instead of only reporting low throughput", () => {
  const records = generateKoneDemoRecords();
  const insights = analyzeKoneDemo(records);
  const flow = insights.find((item) => item.assetId === "KLT-03" && item.category === "productivity");
  assert.ok(flow);
  assert.ok(flow.cycleContext);
  assert.equal(flow.cycleContext?.slowestPhase, "approachEmptySec");
  assert.ok((flow.cycleContext?.slowestPhaseDeltaSec ?? 0) > 20);
  assert.match(flow.whyItMatters, /aproximação vazia/i);
  assert.ok(flow.technical.baselineSamples >= 140);
});

test("demo engine produces safety and maintenance contexts", () => {
  const records = generateKoneDemoRecords();
  const insights = analyzeKoneDemo(records);
  assert.ok(insights.some((item) => item.assetId === "KLT-04" && item.category === "safety"));
  const maintenance = insights.find((item) => item.assetId === "KLT-05" && item.category === "maintenance");
  assert.ok(maintenance);
  assert.ok(maintenance.businessImpact);
  assert.ok((maintenance.businessImpact?.capacityUnavailableT ?? 0) > 0);
  assert.ok((maintenance.businessImpact?.fleetAbsorbedT ?? -1) >= 0);
  assert.equal(maintenance.businessImpact?.monetaryImpactBRL, null);
});

test("maintenance-context use is not automatically called productivity loss", () => {
  const records = generateKoneDemoRecords();
  const maintenanceRows = records.filter((row) => row.assetId === "KLT-02" && row.usageContext === "maintenance" && row.date >= "2026-08-01");
  assert.ok(maintenanceRows.length > 0);
  const ids = new Set(maintenanceRows.map((row) => `${row.date}:${row.shift}`));
  const insights = analyzeKoneDemo(records);
  assert.equal(
    insights.some((item) => item.assetId === "KLT-02" && item.category === "productivity" && ids.has(`${item.date}:${item.shift}`)),
    false
  );
});

test("provider capability contract separates OEM telemetry from synthetic process layer", () => {
  const payload = koneDemoPayload();
  assert.equal(payload.source.provider, "Konecranes");
  assert.ok(payload.source.publicCapabilities.includes("total load lifted / load spectrum"));
  assert.ok(payload.source.processLayerCapabilities.includes("cycle phase durations"));
  assert.ok(payload.source.unsupportedInPublicReferenceUsed.includes("forward/reverse share"));
  assert.ok(payload.source.unsupportedInPublicReferenceUsed.includes("hydraulic activity share"));
  assert.ok(payload.source.unsupportedInPublicReferenceUsed.includes("native cycle phase timestamps"));
  assert.match(payload.scenario.granularity.providerNative, /não especifica resolução nativa por turno/i);
  assert.match(payload.source.disclaimer, /camadas sintéticas do Pulso/i);
  assert.equal(JSON.stringify(payload.records).includes("reverseShare"), false);
  assert.equal(JSON.stringify(payload.records).includes("hydraulic"), false);
});
