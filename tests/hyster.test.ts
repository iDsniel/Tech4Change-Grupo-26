import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeHyster, totals, validateHyster, workforceCardSlices, workforceStatistic, type Daily, type HysterData } from "../lib/hyster.ts";

const row = (date: string, key = 10, idle = 1): Daily => ({ assetId: "EP01", date, keyHours: key, idleHours: idle, workHours: key - idle, presenceHours: key, waitHours: idle, sourceRow: 4 });
function fixture(): HysterData {
  return { schemaVersion: 1, provider: "Hyster Tracker", periodStart: "2026-06-01", periodEnd: "2026-08-31", assets: [{ assetId: "EP01", serviceMeterHours: 100 }], daily: [row("2026-06-01")], events: [], kpi: [], currentStatus: [], fuel: [], costs: [], maintenanceAvailable: false, sources: [] };
}
function withWorkforce(): HysterData {
  const d = fixture(); d.schemaVersion = 3;
  d.workforce = { periodStart: "2026-06-01", periodEnd: "2026-08-31", granularity: "card-period", unitSystem: "metric", sourceFile: "workforceKPITier7.xlsx", sha256: "a".repeat(64), warnings: [], cards: [{ cardCode: "00845", cardQuality: "complete", usageCount: 5, sourceRow: 3, metrics: { distanceKm: 9.5, keyHours: 3, idleHours: 0.7, motionHours: 1.9, liftHours: 0.4, lowerHours: 0.4, highSpeedHours: 0.3, reverseHours: 0.6, forwardHours: 1.4 }, assets: [{ assetId: "EP01", usageCount: 5, sourceRow: 4, metrics: { distanceKm: 9.5, keyHours: 3, idleHours: 0.7 } }] }] };
  return d;
}
function withMonthlyWorkforce(): HysterData {
  const legacy = withWorkforce();
  const juneCard = structuredClone(legacy.workforce!.cards[0]);
  juneCard.metrics = { ...juneCard.metrics, keyHours: 10, workHours: 7, hydraulicHours: 4, motionHours: 6 };
  juneCard.assets[0].metrics = { ...juneCard.assets[0].metrics, keyHours: 10, workHours: 7, hydraulicHours: 4, motionHours: 6 };
  const julyCard = structuredClone(juneCard);
  julyCard.metrics = { ...julyCard.metrics, keyHours: 20, workHours: 15, hydraulicHours: 11, motionHours: 13 };
  julyCard.assets[0].metrics = { ...julyCard.assets[0].metrics, keyHours: 20, workHours: 15, hydraulicHours: 11, motionHours: 13 };
  const d = fixture();
  d.schemaVersion = 5;
  d.workforce = {
    periodStart: "2026-06-01",
    periodEnd: "2026-07-31",
    granularity: "card-month",
    unitSystem: "metric",
    cards: [],
    periods: [
      { periodStart: "2026-06-01", periodEnd: "2026-06-30", granularity: "card-month", sourceFile: "workforce-jun.xlsx", sha256: "b".repeat(64), cards: [juneCard], warnings: [] },
      { periodStart: "2026-07-01", periodEnd: "2026-07-31", granularity: "card-month", sourceFile: "workforce-jul.xlsx", sha256: "c".repeat(64), cards: [julyCard], warnings: [] }
    ],
    warnings: []
  };
  return d;
}
function schema4(): HysterData {
  const d = withWorkforce();
  d.schemaVersion = 4;
  d.assets[0] = { ...d.assets[0], trackerAssetId: "1", serviceId: "1", productId: 56019, equipmentName: "EP01 - TEST", serialNumber: "SERIAL01", site: "Santos", department: "Operação", equipmentClass: "Class V", sourceRow: 2 };
  d.daily[0] = { ...d.daily[0], equipmentUsedCount: 1, usedPercent: 100, workPercent: 90, idlePercent: 10, waitPercentOfIdle: 100 };
  d.events = [{ assetId: "EP01", date: "2026-06-01", time: "10:00:00", eventAt: "2026-06-01T10:00:00", startDate: "2026-06-01", startTime: "10:00:00", startAt: "2026-06-01T10:00:00", type: "Impacto", cardCode: "00845", operatorName: "OPERADOR TESTE", productId: 56019, equipmentName: "EP01 - TEST", serialNumber: "SERIAL01", trackerAssetId: "1", serviceId: "1", sourceCritical: true, sourceStatus: "Aberto", lockout: false, shutdown: false, sourceRow: 10 }];
  d.currentStatusSnapshotAt = "2026-09-16T12:10";
  d.currentStatus = [{ assetId: "EP01", status: "Active", lastAccessedAt: "2026-09-16T11:00", lastDrivenOrUsedBy: "OPERADOR TESTE", driveDuration: "01:10:22", driveDurationSeconds: 4222, sourceRow: 3 }];
  d.fuel = [{ assetId: "EP01", dailyAverageLiters: 0, monthlyAverageLiters: 0, reportedLiters: 0, sourceRow: 2 }];
  d.costs = [{ assetId: "EP01", startHours: 10, endHours: 100, intervalHours: 90, reportedCostPerHour: 0, reportedTotal: null, sourceRow: 3 }];
  d.maintenance = { available: false, message: "Nenhum PM Tracker Data disponível para o relatório", periodStart: d.periodStart, periodEnd: d.periodEnd, records: [] };
  d.dataQuality = { eventExportCriticalOnly: true, currentStatusSnapshotOutsideAnalysisPeriod: true, workforceMetricsAllZero: ["seatBeltViolationHours"], dailyFleetCoverage: { calendarDays: 92, assets: 1, possibleAssetDays: 92, rowsPresent: 1, rowsOmitted: 91 } };
  d.sources = [{ file: "workforceKPITier7.xlsx", sha256: "b".repeat(64), sheets: [{ name: "Workforce KPI Report", range: "A1:ZZ10", rows: 10 }] }];
  d.workforce!.cards[0].operatorName = "OPERADOR TESTE";
  d.workforce!.cards[0].metrics = { ...d.workforce!.cards[0].metrics, auxiliaryHydraulicHours: 0.5, lowSpeedHours: 1, mediumSpeedHours: 0.4, lowLevelOverspeedHours: 0.2, highLevelOverspeedHours: 0, seatBeltViolationHours: 0, containerCount: 0, energyFuelUsedLiters: 0, ladenHours: 0, unladenHours: 3, workingUnladenHours: 2.3, unladenDurationHours: 3 };
  d.workforce!.cards[0].statistics = {
    distanceKm: { sourceLabel: "Odometer", unit: "km", dailyAverage: 3.2, monthlyAverage: 4.8, total: 9.5 },
    workHours: { sourceLabel: "Working Duration", unit: "hours", dailyAverage: 0.7, monthlyAverage: 1.1, total: 2.2 }
  };
  d.workforce!.cards[0].assets[0].statistics = { distanceKm: { sourceLabel: "Odometer", unit: "km", dailyAverage: 3.2, monthlyAverage: 4.8, total: 9.5 } };
  d.workforce!.metricAvailability = { seatBeltViolationHours: { sourceLabel: "Seat Belt Violation Duration", unit: "hours", cardsWithNonZero: 0, cardsTotal: 1, totalAcrossCards: 0 } };
  d.workforce!.warnings = ["Daily and monthly averages are source-reported and must not be interpreted as a real card-by-day time series."];
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
test("schema v5 preserves real card-month granularity and allows the same card across months", () => {
  const d = withMonthlyWorkforce();
  const validated = validateHyster(d);
  assert.equal(validated.workforce?.granularity, "card-month");
  assert.equal(validated.workforce?.cards.length, 0);
  assert.equal(validated.workforce?.periods?.length, 2);
  const july = workforceCardSlices(validated, "2026-07-10", "2026-07-20");
  assert.equal(july.length, 1);
  assert.equal(july[0].periodStart, "2026-07-01");
  assert.equal(july[0].cards[0].cardCode, "00845");
  assert.equal(july[0].cards[0].metrics.hydraulicHours, 11);
});

test("schema v5 rejects overlapping Workforce months", () => {
  const d = withMonthlyWorkforce();
  d.workforce!.periods![1].periodStart = "2026-06-30";
  assert.throws(() => validateHyster(d), /sobrepostos/);
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
test("schema v4 preserves native Hyster statistics and enriched telemetry", () => {
  const d = schema4();
  const validated = validateHyster(d);
  assert.equal(validated.schemaVersion, 4);
  assert.equal(validated.assets[0].serialNumber, "SERIAL01");
  assert.equal(validated.daily[0].workPercent, 90);
  assert.equal(validated.events[0].operatorName, "OPERADOR TESTE");
  assert.equal(validated.currentStatus[0].lastAccessedAt, "2026-09-16T11:00");
  assert.equal(validated.workforce?.cards[0].metrics.auxiliaryHydraulicHours, 0.5);
  assert.equal(workforceStatistic(validated, "00845", "distanceKm")?.dailyAverage, 3.2);
  assert.equal(workforceStatistic(validated, "00845", "distanceKm", "EP01")?.monthlyAverage, 4.8);
});
test("source-reported averages remain context and quality flags remain explicit", () => {
  const d = schema4();
  const report = analyzeHyster(validateHyster(d));
  assert.equal(report.totals.records, 1);
  assert.equal(report.quality.eventExportCriticalOnly, true);
  assert.equal(report.quality.rowsOmitted, 91);
  assert.equal(d.workforce!.cards[0].statistics!.distanceKm!.dailyAverage, 3.2);
  assert.equal(d.daily.length, 1, "a média Workforce não deve fabricar linhas card-day");
});
test("schema v4 rejects inconsistent metric availability", () => {
  const d = schema4();
  d.workforce!.metricAvailability!.seatBeltViolationHours!.cardsWithNonZero = 2;
  assert.throws(() => validateHyster(d), /Disponibilidade Workforce/);
});
