import { TELEMETRY_SCHEMA_VERSION } from "@/lib/telemetryCsvAdapter";
import type { HistoricalShiftRecord, Shift } from "@/lib/telemetry";
import type { AssetMetadata } from "@/lib/telemetryPipeline";

export const KONECRANES_MOCK_CONTRACT_VERSION = "konecranes-truconnect-mock-v1";

export type KonecranesMockMeasurement = {
  periodStart: string;
  shiftCode: Shift;
  operatorRef?: string | null;
  fuelConsumedLiters: number;
  idleRatio: number;
  emptyTravelRatio: number;
  averageTravelSpeedKmh: number;
  maxEngineCoolantC: number;
  shockEvents: number;
  overloadEvents: number;
  maintenanceHoursRemaining: number;
};

export type KonecranesMockAsset = {
  assetId: string;
  capacityTonnes?: number;
  measurements: KonecranesMockMeasurement[];
};

export type KonecranesMockPayload = {
  contractVersion: typeof KONECRANES_MOCK_CONTRACT_VERSION;
  provider: "konecranes";
  sourceSystem: "truconnect-mock";
  assets: KonecranesMockAsset[];
};

type AdapterIssue = { path: string; message: string };

export class KonecranesAdapterValidationError extends Error {
  readonly issues: AdapterIssue[];

  constructor(message: string, issues: AdapterIssue[]) {
    super(message);
    this.name = "KonecranesAdapterValidationError";
    this.issues = issues;
  }
}

export type KonecranesAdapterResult = {
  records: HistoricalShiftRecord[];
  assets: AssetMetadata[];
  metadata: {
    provider: "konecranes";
    sourceSystem: "truconnect-mock";
    contractVersion: typeof KONECRANES_MOCK_CONTRACT_VERSION;
    normalizedSchemaVersion: typeof TELEMETRY_SCHEMA_VERSION;
    records: number;
    assets: number;
    operators: number;
    firstDate: string;
    lastDate: string;
    unassignedOperators: number;
  };
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown, path: string, min: number, max: number, integer = false) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [{ path, message: "deve ser numérico" }]);
  }
  if (integer && !Number.isInteger(value)) {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [{ path, message: "deve ser inteiro" }]);
  }
  if (value < min || value > max) {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [{ path, message: `fora do intervalo ${min}..${max}` }]);
  }
  return value;
}

function isoDateTime(value: unknown, path: string) {
  if (typeof value !== "string") {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [{ path, message: "deve ser string ISO 8601" }]);
  }
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [{ path, message: "data/hora ISO 8601 inválida" }]);
  }
  return parsed;
}

function shift(value: unknown, path: string): Shift {
  if (value !== "A" && value !== "B" && value !== "C") {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [{ path, message: "use A, B ou C" }]);
  }
  return value;
}

function text(value: unknown, path: string, maxLength: number, optional = false) {
  if ((value === undefined || value === null || value === "") && optional) return undefined;
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [{ path, message: `string obrigatória com até ${maxLength} caracteres` }]);
  }
  return value;
}

function normalizeMeasurement(
  raw: Record<string, unknown>,
  assetId: string,
  assetIndex: number,
  measurementIndex: number
): HistoricalShiftRecord {
  const base = `assets[${assetIndex}].measurements[${measurementIndex}]`;
  const periodStart = isoDateTime(raw.periodStart, `${base}.periodStart`);
  const operatorRef = text(raw.operatorRef, `${base}.operatorRef`, 64, true) ?? "UNASSIGNED";

  return {
    date: periodStart.toISOString().slice(0, 10),
    assetId,
    operatorId: operatorRef,
    shift: shift(raw.shiftCode, `${base}.shiftCode`),
    fuelLiters: finiteNumber(raw.fuelConsumedLiters, `${base}.fuelConsumedLiters`, 0, 10_000),
    idlePct: finiteNumber(raw.idleRatio, `${base}.idleRatio`, 0, 1) * 100,
    emptyTravelPct: finiteNumber(raw.emptyTravelRatio, `${base}.emptyTravelRatio`, 0, 1) * 100,
    avgSpeedKmh: finiteNumber(raw.averageTravelSpeedKmh, `${base}.averageTravelSpeedKmh`, 0, 200),
    maxCoolantC: finiteNumber(raw.maxEngineCoolantC, `${base}.maxEngineCoolantC`, -50, 250),
    shocks: finiteNumber(raw.shockEvents, `${base}.shockEvents`, 0, 100_000, true),
    overloads: finiteNumber(raw.overloadEvents, `${base}.overloadEvents`, 0, 100_000, true),
    maintenanceHoursRemaining: finiteNumber(raw.maintenanceHoursRemaining, `${base}.maintenanceHoursRemaining`, 0, 100_000)
  };
}

export function adaptKonecranesMockPayload(payload: unknown): KonecranesAdapterResult {
  if (!isObject(payload)) {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [{ path: "$", message: "objeto JSON esperado" }]);
  }
  if (payload.contractVersion !== KONECRANES_MOCK_CONTRACT_VERSION) {
    throw new KonecranesAdapterValidationError("Contrato Konecranes incompatível", [
      { path: "contractVersion", message: `esperado ${KONECRANES_MOCK_CONTRACT_VERSION}` }
    ]);
  }
  if (payload.provider !== "konecranes" || payload.sourceSystem !== "truconnect-mock") {
    throw new KonecranesAdapterValidationError("Origem Konecranes inválida", [
      { path: "provider/sourceSystem", message: "esperado konecranes / truconnect-mock" }
    ]);
  }
  if (!Array.isArray(payload.assets) || payload.assets.length === 0 || payload.assets.length > 1_000) {
    throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [
      { path: "assets", message: "informe entre 1 e 1000 ativos" }
    ]);
  }

  const records: HistoricalShiftRecord[] = [];
  const assets: AssetMetadata[] = [];
  const unique = new Set<string>();

  payload.assets.forEach((assetRaw, assetIndex) => {
    if (!isObject(assetRaw)) {
      throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [
        { path: `assets[${assetIndex}]`, message: "objeto esperado" }
      ]);
    }
    const assetId = text(assetRaw.assetId, `assets[${assetIndex}].assetId`, 64)!;
    const capacityTonnes = assetRaw.capacityTonnes === undefined
      ? undefined
      : finiteNumber(assetRaw.capacityTonnes, `assets[${assetIndex}].capacityTonnes`, 0.1, 500);

    if (!Array.isArray(assetRaw.measurements) || assetRaw.measurements.length === 0) {
      throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [
        { path: `assets[${assetIndex}].measurements`, message: "ao menos uma medição é obrigatória" }
      ]);
    }

    assets.push({ assetId, capacity: capacityTonnes ? `${capacityTonnes} t` : undefined });

    assetRaw.measurements.forEach((measurementRaw, measurementIndex) => {
      if (!isObject(measurementRaw)) {
        throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [
          { path: `assets[${assetIndex}].measurements[${measurementIndex}]`, message: "objeto esperado" }
        ]);
      }
      const record = normalizeMeasurement(measurementRaw, assetId, assetIndex, measurementIndex);
      const key = `${record.date}:${record.assetId}:${record.shift}`;
      if (unique.has(key)) {
        throw new KonecranesAdapterValidationError("Payload Konecranes inválido", [
          { path: `assets[${assetIndex}].measurements[${measurementIndex}]`, message: `registro duplicado para ${key}` }
        ]);
      }
      unique.add(key);
      records.push(record);
    });
  });

  if (records.length > 50_000) {
    throw new KonecranesAdapterValidationError("Payload Konecranes excede o limite", [
      { path: "assets[].measurements", message: "máximo de 50.000 registros normalizados" }
    ]);
  }

  records.sort((a, b) => a.date.localeCompare(b.date) || a.assetId.localeCompare(b.assetId) || a.shift.localeCompare(b.shift));
  const dates = records.map((record) => record.date);
  const operators = new Set(records.filter((record) => record.operatorId !== "UNASSIGNED").map((record) => record.operatorId));

  return {
    records,
    assets,
    metadata: {
      provider: "konecranes",
      sourceSystem: "truconnect-mock",
      contractVersion: KONECRANES_MOCK_CONTRACT_VERSION,
      normalizedSchemaVersion: TELEMETRY_SCHEMA_VERSION,
      records: records.length,
      assets: new Set(records.map((record) => record.assetId)).size,
      operators: operators.size,
      firstDate: dates[0],
      lastDate: dates[dates.length - 1],
      unassignedOperators: records.filter((record) => record.operatorId === "UNASSIGNED").length
    }
  };
}
