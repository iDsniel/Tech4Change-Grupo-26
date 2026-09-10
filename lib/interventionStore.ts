import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { InterventionRecord } from "@/lib/feedbackLoop";

export type StoredIntervention = InterventionRecord & {
  createdAt: string;
  source: "demo-seed" | "user" | "api";
};

export type CreateInterventionInput = Omit<InterventionRecord, "id"> & {
  id?: string;
  source?: StoredIntervention["source"];
};

type DemoFixture = {
  schemaVersion: "telemetry-feedback-v1";
  interventions: InterventionRecord[];
};

const ACTION_TYPES = new Set<InterventionRecord["actionType"]>([
  "operator_coaching",
  "safety_coaching",
  "load_procedure_review",
  "maintenance_action",
  "process_change"
]);

function dbPath() {
  return process.env.INTERVENTION_DB_PATH || join(process.cwd(), ".data", "tech4change.sqlite");
}

function openDatabase() {
  const path = dbPath();
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS interventions (
      id TEXT PRIMARY KEY,
      insight_id TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      target_turns INTEGER NOT NULL CHECK (target_turns BETWEEN 1 AND 10),
      action_type TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      note TEXT NOT NULL,
      created_at TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'user'
    );
    CREATE INDEX IF NOT EXISTS idx_interventions_insight_applied
      ON interventions(insight_id, applied_at DESC, created_at DESC);
  `);
  return db;
}

function rowToIntervention(row: Record<string, unknown>): StoredIntervention {
  return {
    id: String(row.id),
    insightId: String(row.insight_id),
    appliedAt: String(row.applied_at),
    targetTurns: Number(row.target_turns),
    actionType: String(row.action_type) as InterventionRecord["actionType"],
    actorRole: String(row.actor_role),
    note: String(row.note),
    createdAt: String(row.created_at),
    source: String(row.source) as StoredIntervention["source"]
  };
}

function insertIntervention(db: DatabaseSync, input: CreateInterventionInput, ignoreExisting = false) {
  if (!ACTION_TYPES.has(input.actionType)) throw new Error("Unsupported intervention action type");
  const id = input.id || `INT-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const source = input.source ?? "user";
  const sql = `${ignoreExisting ? "INSERT OR IGNORE" : "INSERT"} INTO interventions
    (id, insight_id, applied_at, target_turns, action_type, actor_role, note, created_at, source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
  db.prepare(sql).run(
    id,
    input.insightId,
    input.appliedAt,
    input.targetTurns,
    input.actionType,
    input.actorRole,
    input.note,
    createdAt,
    source
  );
  return id;
}

function seedDemoInterventions(db: DatabaseSync) {
  const fixturePath = join(process.cwd(), "data", "interventions-demo.json");
  const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as DemoFixture;
  if (fixture.schemaVersion !== "telemetry-feedback-v1" || !Array.isArray(fixture.interventions)) {
    throw new Error("Invalid intervention seed fixture");
  }

  db.exec("BEGIN");
  try {
    for (const intervention of fixture.interventions) {
      insertIntervention(db, { ...intervention, source: "demo-seed" }, true);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function initializeInterventionStore() {
  const db = openDatabase();
  seedDemoInterventions(db);
  db.close();
  return {
    engine: "sqlite" as const,
    path: dbPath(),
    seededFrom: "data/interventions-demo.json"
  };
}

export function listInterventions(insightId?: string) {
  const db = openDatabase();
  seedDemoInterventions(db);
  const rows = insightId
    ? db.prepare("SELECT * FROM interventions WHERE insight_id = ? ORDER BY applied_at DESC, created_at DESC").all(insightId)
    : db.prepare("SELECT * FROM interventions ORDER BY applied_at DESC, created_at DESC").all();
  db.close();
  return rows.map((row) => rowToIntervention(row as Record<string, unknown>));
}

export function createIntervention(input: CreateInterventionInput) {
  const db = openDatabase();
  seedDemoInterventions(db);
  const id = insertIntervention(db, input, false);
  const row = db.prepare("SELECT * FROM interventions WHERE id = ?").get(id);
  db.close();
  if (!row) throw new Error("Intervention insert did not persist");
  return rowToIntervention(row as Record<string, unknown>);
}

export function interventionStoreHealth() {
  const db = openDatabase();
  seedDemoInterventions(db);
  const row = db.prepare("SELECT COUNT(*) AS count FROM interventions").get() as { count: number };
  db.close();
  return { engine: "sqlite" as const, path: dbPath(), records: Number(row.count) };
}
