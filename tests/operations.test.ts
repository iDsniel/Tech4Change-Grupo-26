import assert from "node:assert/strict";
import { test } from "node:test";
import { addDataset, combineDatasets, emptyWorkspace, followUp, inputSummary, validateInput, validateOrder, validateWorkspace, type DailyInput, type WorkOrder } from "../lib/operations.ts";
import { validateHyster, type HysterData } from "../lib/hyster.ts";

function fixture(start = "2026-06-01", end = start): HysterData {
  return { schemaVersion: 2, operationId: "0123456789abcdef", provider: "Hyster Tracker", periodStart: start, periodEnd: end, assets: [{ assetId: "EP01", serviceMeterHours: 100 }], daily: [{ assetId: "EP01", date: start, keyHours: 10, workHours: 8, idleHours: 2, presenceHours: 9, waitHours: 1, sourceRow: 4 }], events: [{ assetId: "EP01", date: start, time: "12:00:00", type: "Impacto", cardCode: "00123", sourceCritical: true, sourceStatus: "Aberto", sourceRow: 2 }], kpi: [], currentStatus: [], fuel: [], costs: [], maintenanceAvailable: false, sources: [] };
}
const input = (): DailyInput => ({ id: "input-1", assetId: "EP01", date: "2026-06-01", plannedHours: 8, downtimeHours: 2, fuelQuantity: 10, fuelUnit: "L", costBRL: 100, production: 30, productionUnit: "t", note: "Fonte manual" });
const order = (): WorkOrder => ({ id: "os-1", assetId: "EP01", title: "Inspecionar máquina", kind: "corrective", priority: "normal", team: "Manutenção", dueDate: "2026-06-15", status: "completed", openedAt: "2026-06-01T10:00:00Z", completedAt: "2026-06-15", note: "Intervenção", history: [{ at: "2026-06-15T10:00:00Z", status: "completed", note: "Concluído" }] });

test("cards remain strings with leading zeros and v1 stays readable", () => {
  const d = fixture(); assert.equal(validateHyster(d).events[0].cardCode, "00123");
  d.schemaVersion = 1; delete d.operationId; delete d.events[0].cardCode;
  assert.equal(validateHyster(d).schemaVersion, 1);
});
test("same period re-import is idempotent and newest values replace old ones", () => {
  const d = fixture(); const w = addDataset(emptyWorkspace(), d);
  const next = structuredClone(d); next.daily[0].idleHours = 3;
  const result = addDataset(w, next);
  assert.equal(result.datasets.length, 1);
  assert.equal(combineDatasets(result.datasets)?.daily[0].idleHours, 3);
  assert.equal(combineDatasets(result.datasets)?.events.length, 1);
});
test("overlapping export replaces daily scope without inventing missing days or deduping source events", () => {
  const first = fixture("2026-06-01", "2026-06-30");
  first.daily.push({ ...first.daily[0], date: "2026-06-02" });
  const next = fixture("2026-06-01", "2026-06-15"); next.events.push({ ...next.events[0], sourceRow: 3 });
  const combined = combineDatasets([first, next])!;
  assert.equal(combined.daily.length, 1); assert.equal(combined.events.length, 2); assert.deepEqual(combined.kpi, []);
});
test("different operations never silently combine", () => {
  const w = addDataset(emptyWorkspace(), fixture()); const d = fixture(); d.operationId = "ffffffffffffffff";
  assert.throws(() => addDataset(w, d), /operação/);
});
test("availability uses only measured days; fuel and production units remain separate", () => {
  const a = input(), b = { ...input(), id: "2", date: "2026-06-02", plannedHours: null, downtimeHours: null, fuelUnit: "kg" as const, fuelQuantity: 5, productionUnit: "movimentos" as const };
  const s = inputSummary([a, b]);
  assert.equal(s.covered, 1); assert.equal(s.availability, 75); assert.equal(s.fuelL, 10); assert.equal(s.fuelKg, 5); assert.equal(s.tonnes, 30); assert.equal(s.movements, 30);
  assert.equal(inputSummary([b]).availability, null);
  assert.throws(() => validateInput({ ...a, downtimeHours: 9 }));
  assert.throws(() => validateInput({ ...a, plannedHours: null }));
});
test("completed orders require a completion date; backup validates references and unique daily entries", () => {
  assert.throws(() => validateOrder({ ...order(), completedAt: null }));
  const w = addDataset(emptyWorkspace(), fixture()); w.orders = [order()]; w.inputs = [input()];
  assert.deepEqual(validateWorkspace(JSON.parse(JSON.stringify(w))), w);
  assert.throws(() => validateWorkspace({ ...w, inputs: [input(), { ...input(), id: "other" }] }));
  assert.throws(() => validateWorkspace({ ...w, orders: [{ ...order(), assetId: "EP99" }] }));
});
test("follow-up excludes action day and uses observed days, not generated zeroes", () => {
  const d = fixture("2026-06-01", "2026-06-30");
  d.daily = Array.from({ length: 30 }, (_, i) => ({ ...d.daily[0], date: `2026-06-${String(i + 1).padStart(2, "0")}`, idleHours: i < 14 ? 2 : i === 14 ? 10 : 1 }));
  const f = followUp(d, order())!;
  assert.equal(f.before.records, 14); assert.equal(f.after.records, 14); assert.equal(f.delta, -10);
  d.daily = d.daily.slice(0, 18); assert.equal(followUp(d, order())!.delta, null);
});
