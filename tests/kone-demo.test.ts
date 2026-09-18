import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateKoneDemo,
  analyzeKoneDemo,
  generateKoneDemoRecords,
  koneDemoPayload,
  koneDemoScenario
} from "../lib/koneDemo.ts";

test("Kone cellulose demo preserves the declared business movement", () => {
  assert.equal(koneDemoScenario.truckCapacityT, 16);
  assert.equal(koneDemoScenario.baleWeightT, 2);
  assert.equal(koneDemoScenario.balesPerLoadedMovement, 2);
  assert.equal(koneDemoScenario.tonnesPerLoadedMovement, 4);

  const records = generateKoneDemoRecords();
  assert.equal(records.length, 30 * 6 * 3);
  for (const row of records) {
    assert.equal(row.totalLoadLiftedT % 4, 0);
  }

  const total = aggregateKoneDemo(records);
  assert.equal(total.balesMoved, total.totalLoadLiftedT / 2);
  assert.equal(total.loadedMovements, total.totalLoadLiftedT / 4);
});

test("demo engine produces productivity, safety and maintenance contexts", () => {
  const records = generateKoneDemoRecords();
  const insights = analyzeKoneDemo(records);
  assert.ok(insights.some((item) => item.assetId === "KLT-03" && item.category === "productivity"));
  assert.ok(insights.some((item) => item.assetId === "KLT-04" && item.category === "safety"));
  assert.ok(insights.some((item) => item.assetId === "KLT-05" && item.category === "maintenance"));
});

test("maintenance-context use is not automatically called productivity loss", () => {
  const records = generateKoneDemoRecords();
  const maintenanceRows = records.filter((row) => row.assetId === "KLT-02" && row.usageContext === "maintenance");
  assert.ok(maintenanceRows.length > 0);
  const ids = new Set(maintenanceRows.map((row) => `${row.date}:${row.shift}`));
  const insights = analyzeKoneDemo(records);
  assert.equal(
    insights.some((item) => item.assetId === "KLT-02" && item.category === "productivity" && ids.has(`${item.date}:${item.shift}`)),
    false
  );
});

test("provider capability contract does not invent Hyster-only dimensions", () => {
  const payload = koneDemoPayload();
  assert.equal(payload.source.provider, "Konecranes");
  assert.ok(payload.source.publicCapabilities.includes("total load lifted / load spectrum"));
  assert.ok(payload.source.unsupportedInPublicReferenceUsed.includes("forward/reverse share"));
  assert.ok(payload.source.unsupportedInPublicReferenceUsed.includes("hydraulic activity share"));
  assert.match(payload.scenario.granularity.providerNative, /não especifica resolução nativa por turno/i);
  assert.equal(JSON.stringify(payload.records).includes("reverseShare"), false);
  assert.equal(JSON.stringify(payload.records).includes("hydraulic"), false);
});
