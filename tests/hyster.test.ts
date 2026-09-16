import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeHyster, totals, validateHyster, type Daily, type HysterData } from "../lib/hyster.ts";

const row = (date: string, key = 10, idle = 1): Daily => ({ assetId: "EP01", date, keyHours: key, idleHours: idle, workHours: key - idle, presenceHours: key, waitHours: idle, sourceRow: 4 });
function fixture(): HysterData {
  return { schemaVersion: 1, provider: "Hyster Tracker", periodStart: "2026-06-01", periodEnd: "2026-08-31", assets: [{ assetId: "EP01", serviceMeterHours: 100 }], daily: [row("2026-06-01")], events: [], kpi: [], currentStatus: [], fuel: [], costs: [], maintenanceAvailable: false, sources: [] };
}
function withWorkforce(): HysterData {
  const d = fixture(); d.schemaVersion = 3;
  d.workforce = { periodStart: "2026-06-01", periodEnd: "2026-08-31", granularity: "card-period", unitSystem: "metric", sourceFile: "workforceKPITier7.xlsx", sha256: "a".repeat(64), warnings: [], cards: [{ cardCode: "00845", cardQuality: "complete", usageCount: 5, sourceRow: 3, metrics: { distanceKm: 9.5, keyHours: 3, idleHours: 0.7, motionHours: 1.9, liftHours: 0.4, lowerHours: 0.4, highSpeedHours: 0.3, reverseHours: 0.6, forwardHours: 1.4 }, assets: [{ assetId: "EP01", usageCount: 5, sourceRow: 4, metrics: { distanceKm: 9.5, keyHours: 3, idleHours: 0.7 } }] }] };
  return d;
}
test("ratios weight hours, not percentages; empty is unknown", () => {
  assert.equal(totals([row("2026-06-01", 1, 1), row("2026-06-02", 9, 0)]).idlePct, 10);
  assert.equal(totals([]).idlePct, null);
});
test("reject duplicate dates per asset, unknown assets and malformed values", () => {
  const d = fixture(); d.daily.push(row("2026-06-01"));
  assert.throws(() => validateHyster(d), /duplicado/);
  d.daily = [{ ...row("2026-06-01"), keyHours: NaN }];
  assert.throws(() => validateHyster(d));
  d.daily = [{ ...row("2026-06-01"), assetId: "EP99" }];
  assert.throws(() => validateHyster(d));
});
test("source critical status does not convert status messages into failures", () => {
  const d = fixture();
  d.events = [{ assetId: "EP01", date: "2026-06-01", time: "10:00:00", type: "Status de caminhão", sourceCritical: true, sourceStatus: "Aberto", sourceRow: 2 }];
  assert.equal(analyzeHyster(d).assets[0].faults, 0);
  assert.equal(analyzeHyster(d).incidents.length, 0);
});
test("baseline excludes present/future and filters preserve prior context", () => {
  const d = fixture();
  d.daily = Array.from({ length: 15 }, (_, i) => row(`2026-06-${String(i + 16).padStart(2, "0")}`, 10, 1 + i % 2 * 0.1));
  d.daily.push(row("2026-07-01", 10, 5));
  const before = analyzeHyster(d, "2026-07").deviations[0];
  assert.equal(before.samples, 15);
  d.daily.push(row("2026-07-02", 10, 10));
  assert.deepEqual(analyzeHyster(d, "2026-07").deviations.find(r => r.date === "2026-07-01"), before);
});
test("missing days stay missing and insufficient baseline yields no signal", () => {
  const d = fixture();
  assert.equal(analyzeHyster(d).totals.records, 1);
  assert.equal(analyzeHyster(d).deviations.length, 0);
  assert.equal(analyzeHyster(d, "2026-07").totals.idlePct, null);
});
test("workforce keeps card code as text and does not manufacture monthly history", () => {
  const d = withWorkforce();
  const validated = validateHyster(d);
  assert.equal(validated.workforce?.cards[0].cardCode, "00845");
  assert.equal(validated.workforce?.granularity, "card-period");
  assert.equal(analyzeHyster(d).months[0].key, 10);
  assert.equal(analyzeHyster(d, "2026-07").totals.key, 0);
});
test("workforce rejects invalid metrics, duplicated asset slices and unsignaled duplicate codes", () => {
  const badMetric = withWorkforce(); badMetric.workforce!.cards[0].metrics.idleHours = -1;
  assert.throws(() => validateHyster(badMetric), /Workforce/);
  const duplicateAsset = withWorkforce(); duplicateAsset.workforce!.cards[0].assets.push({ ...duplicateAsset.workforce!.cards[0].assets[0], sourceRow: 5 });
  assert.throws(() => validateHyster(duplicateAsset), /equipamento/);
  const duplicateCode = withWorkforce(); duplicateCode.workforce!.cards.push({ ...structuredClone(duplicateCode.workforce!.cards[0]), sourceRow: 9 });
  assert.throws(() => validateHyster(duplicateCode), /ambiguidade/);
});
test("workforce incomplete identifiers stay null instead of leaking source labels", () => {
  const d = withWorkforce();
  d.workforce!.cards[0].cardCode = null; d.workforce!.cards[0].cardQuality = "incomplete";
  assert.equal(validateHyster(d).workforce?.cards[0].cardCode, null);
  d.workforce!.cards[0].cardCode = "845";
  assert.throws(() => validateHyster(d));
});
