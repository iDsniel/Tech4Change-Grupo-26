import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeHyster, totals, validateHyster, type Daily, type HysterData } from "../lib/hyster.ts";

const row = (date: string, key = 10, idle = 1): Daily => ({ assetId: "EP01", date, keyHours: key, idleHours: idle, workHours: key - idle, presenceHours: key, waitHours: idle, sourceRow: 4 });
function fixture(): HysterData {
  return { schemaVersion: 1, provider: "Hyster Tracker", periodStart: "2026-06-01", periodEnd: "2026-08-31", assets: [{ assetId: "EP01", serviceMeterHours: 100 }], daily: [row("2026-06-01")], events: [], kpi: [], currentStatus: [], fuel: [], costs: [], maintenanceAvailable: false, sources: [] };
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
