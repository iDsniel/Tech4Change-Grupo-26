import { readFile } from "node:fs/promises";
import type { HistoricalShiftRecord, Shift } from "@/lib/telemetry";

export const TELEMETRY_SCHEMA_VERSION = "telemetry-shift-v1";
export const TELEMETRY_CSV_HEADERS = [
  "date",
  "asset_id",
  "operator_id",
  "shift",
  "fuel_liters",
  "idle_pct",
  "empty_travel_pct",
  "avg_speed_kmh",
  "max_coolant_c",
  "shocks",
  "overloads",
  "maintenance_hours_remaining"
] as const;

const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 50_000;

type CsvIssue = { row: number; field?: string; message: string };

export class TelemetryCsvValidationError extends Error {
  readonly issues: CsvIssue[];

  constructor(message: string, issues: CsvIssue[]) {
    super(message);
    this.name = "TelemetryCsvValidationError";
    this.issues = issues;
  }
}

export type TelemetryIngestionMetadata = {
  schemaVersion: typeof TELEMETRY_SCHEMA_VERSION;
  format: "csv";
  rows: number;
  assets: number;
  operators: number;
  firstDate: string;
  lastDate: string;
  unassignedOperators: number;
};

export type TelemetryCsvResult = {
  records: HistoricalShiftRecord[];
  metadata: TelemetryIngestionMetadata;
};

function parseCsvLine(line: string) {
  const fields: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      fields.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  if (quoted) throw new Error("aspas não fechadas");
  fields.push(current.trim());
  return fields;
}

function numberField(value: string, field: string, row: number, min: number, max: number, integer = false) {
  if (value === "") throw new TelemetryCsvValidationError("CSV inválido", [{ row, field, message: "valor obrigatório" }]);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new TelemetryCsvValidationError("CSV inválido", [{ row, field, message: "deve ser numérico" }]);
  if (integer && !Number.isInteger(parsed)) throw new TelemetryCsvValidationError("CSV inválido", [{ row, field, message: "deve ser inteiro" }]);
  if (parsed < min || parsed > max) throw new TelemetryCsvValidationError("CSV inválido", [{ row, field, message: `fora do intervalo ${min}..${max}` }]);
  return parsed;
}

function validIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function mapRow(fields: string[], rowNumber: number): HistoricalShiftRecord {
  if (fields.length !== TELEMETRY_CSV_HEADERS.length) {
    throw new TelemetryCsvValidationError("CSV inválido", [{ row: rowNumber, message: `esperadas ${TELEMETRY_CSV_HEADERS.length} colunas; recebidas ${fields.length}` }]);
  }

  const [date, assetId, rawOperatorId, rawShift, fuel, idle, emptyTravel, speed, coolant, shocks, overloads, maintenance] = fields;
  if (!validIsoDate(date)) throw new TelemetryCsvValidationError("CSV inválido", [{ row: rowNumber, field: "date", message: "use YYYY-MM-DD" }]);
  if (!assetId || assetId.length > 64) throw new TelemetryCsvValidationError("CSV inválido", [{ row: rowNumber, field: "asset_id", message: "identificador obrigatório com até 64 caracteres" }]);
  if (!(["A", "B", "C"] as string[]).includes(rawShift)) throw new TelemetryCsvValidationError("CSV inválido", [{ row: rowNumber, field: "shift", message: "use A, B ou C" }]);

  return {
    date,
    assetId,
    operatorId: rawOperatorId || "UNASSIGNED",
    shift: rawShift as Shift,
    fuelLiters: numberField(fuel, "fuel_liters", rowNumber, 0, 10_000),
    idlePct: numberField(idle, "idle_pct", rowNumber, 0, 100),
    emptyTravelPct: numberField(emptyTravel, "empty_travel_pct", rowNumber, 0, 100),
    avgSpeedKmh: numberField(speed, "avg_speed_kmh", rowNumber, 0, 200),
    maxCoolantC: numberField(coolant, "max_coolant_c", rowNumber, -50, 250),
    shocks: numberField(shocks, "shocks", rowNumber, 0, 100_000, true),
    overloads: numberField(overloads, "overloads", rowNumber, 0, 100_000, true),
    maintenanceHoursRemaining: numberField(maintenance, "maintenance_hours_remaining", rowNumber, 0, 100_000)
  };
}

function validateHeader(header: string[]) {
  const expected = TELEMETRY_CSV_HEADERS.join(",");
  const received = header.join(",");
  if (received !== expected) {
    throw new TelemetryCsvValidationError("Cabeçalho CSV incompatível", [{ row: 1, message: `esperado: ${expected}` }]);
  }
}

function metadataFor(records: HistoricalShiftRecord[]): TelemetryIngestionMetadata {
  const dates = records.map((record) => record.date).sort();
  return {
    schemaVersion: TELEMETRY_SCHEMA_VERSION,
    format: "csv",
    rows: records.length,
    assets: new Set(records.map((record) => record.assetId)).size,
    operators: new Set(records.filter((record) => record.operatorId !== "UNASSIGNED").map((record) => record.operatorId)).size,
    firstDate: dates[0],
    lastDate: dates[dates.length - 1],
    unassignedOperators: records.filter((record) => record.operatorId === "UNASSIGNED").length
  };
}

export function parseTelemetryCsv(csv: string): TelemetryCsvResult {
  const size = Buffer.byteLength(csv, "utf8");
  if (size === 0) throw new TelemetryCsvValidationError("CSV vazio", [{ row: 1, message: "nenhum conteúdo recebido" }]);
  if (size > MAX_CSV_BYTES) throw new TelemetryCsvValidationError("CSV excede o limite de 2 MB", [{ row: 1, message: `${size} bytes recebidos` }]);

  const normalized = csv.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const lines = normalized.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new TelemetryCsvValidationError("CSV sem registros", [{ row: 1, message: "inclua cabeçalho e ao menos uma linha de dados" }]);
  if (lines.length - 1 > MAX_ROWS) throw new TelemetryCsvValidationError("CSV excede o limite de linhas", [{ row: 1, message: `máximo: ${MAX_ROWS}` }]);

  let header: string[];
  try {
    header = parseCsvLine(lines[0]);
  } catch (error) {
    throw new TelemetryCsvValidationError("Cabeçalho CSV inválido", [{ row: 1, message: error instanceof Error ? error.message : "erro de parsing" }]);
  }
  validateHeader(header);

  const records: HistoricalShiftRecord[] = [];
  const issues: CsvIssue[] = [];
  const uniqueKeys = new Set<string>();

  for (let index = 1; index < lines.length; index += 1) {
    const rowNumber = index + 1;
    try {
      const fields = parseCsvLine(lines[index]);
      const record = mapRow(fields, rowNumber);
      const key = `${record.date}:${record.assetId}:${record.shift}`;
      if (uniqueKeys.has(key)) throw new TelemetryCsvValidationError("CSV inválido", [{ row: rowNumber, message: `registro duplicado para ${key}` }]);
      uniqueKeys.add(key);
      records.push(record);
    } catch (error) {
      if (error instanceof TelemetryCsvValidationError) issues.push(...error.issues);
      else issues.push({ row: rowNumber, message: error instanceof Error ? error.message : "erro de parsing" });
      if (issues.length >= 20) break;
    }
  }

  if (issues.length > 0) throw new TelemetryCsvValidationError("Falha na validação do CSV", issues);
  return { records, metadata: metadataFor(records) };
}

export async function loadTelemetryCsvFile(filePath: string) {
  const content = await readFile(filePath, "utf8");
  return parseTelemetryCsv(content);
}
