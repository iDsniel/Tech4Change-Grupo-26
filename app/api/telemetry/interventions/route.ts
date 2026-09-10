import { join } from "node:path";
import { NextResponse } from "next/server";
import { createIntervention, interventionStoreHealth, listInterventions } from "@/lib/interventionStore";
import { demoFleet } from "@/lib/telemetry";
import { loadTelemetryCsvFile } from "@/lib/telemetryCsvAdapter";
import { runTelemetryPipeline } from "@/lib/telemetryPipeline";
import type { InterventionRecord } from "@/lib/feedbackLoop";

export const runtime = "nodejs";

const ACTION_TYPES = new Set<InterventionRecord["actionType"]>([
  "operator_coaching",
  "safety_coaching",
  "load_procedure_review",
  "maintenance_action",
  "process_change"
]);

async function demoInsights() {
  const telemetryPath = join(process.cwd(), "data", "telemetry-demo.csv");
  const { records, metadata } = await loadTelemetryCsvFile(telemetryPath);
  return runTelemetryPipeline(
    records,
    {
      mode: "demo",
      type: "normalized-csv",
      name: "data/telemetry-demo.csv",
      vendorReference: "Konecranes TRUCONNECT public telemetry concepts",
      disclaimer: "Intervenções persistidas localmente; os dados de telemetria da demo permanecem sintéticos.",
      ingestion: metadata
    },
    demoFleet
  ).insights;
}

function invalid(message: string, issues: string[] = []) {
  return NextResponse.json({ error: "intervention_validation_failed", message, issues }, { status: 422 });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const insightId = searchParams.get("insightId")?.trim();
    const interventions = listInterventions(insightId || undefined);
    const health = interventionStoreHealth();
    return NextResponse.json({
      schemaVersion: "telemetry-intervention-v1",
      storage: { engine: health.engine, records: health.records },
      interventions
    });
  } catch (error) {
    console.error("Failed to list interventions", error);
    return NextResponse.json({ error: "intervention_store_unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json({ error: "unsupported_media_type", message: "Envie application/json." }, { status: 415 });
  }

  try {
    const body = await request.json();
    const insightId = String(body.insightId || "").trim();
    const appliedAt = String(body.appliedAt || "").trim();
    const actionType = String(body.actionType || "").trim() as InterventionRecord["actionType"];
    const actorRole = String(body.actorRole || "").trim();
    const note = String(body.note || "").trim();
    const targetTurns = Number(body.targetTurns ?? 3);
    const issues: string[] = [];

    if (!insightId) issues.push("insightId é obrigatório");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appliedAt)) issues.push("appliedAt deve usar YYYY-MM-DD");
    if (!ACTION_TYPES.has(actionType)) issues.push("actionType não suportado");
    if (!Number.isInteger(targetTurns) || targetTurns < 1 || targetTurns > 10) issues.push("targetTurns deve ser inteiro entre 1 e 10");
    if (actorRole.length < 2 || actorRole.length > 60) issues.push("actorRole deve ter entre 2 e 60 caracteres");
    if (note.length < 5 || note.length > 600) issues.push("note deve ter entre 5 e 600 caracteres");
    if (issues.length) return invalid("Intervenção fora do contrato.", issues);

    const insights = await demoInsights();
    const insight = insights.find((item) => item.id === insightId);
    if (!insight) {
      return NextResponse.json({ error: "insight_not_found", message: "Insight não encontrado no dataset atual." }, { status: 404 });
    }

    const intervention = createIntervention({
      insightId,
      appliedAt,
      targetTurns,
      actionType,
      actorRole,
      note,
      source: "user"
    });

    return NextResponse.json(
      {
        schemaVersion: "telemetry-intervention-v1",
        persisted: true,
        storage: { engine: "sqlite" },
        intervention,
        tracking: {
          feedbackUrl: `/api/telemetry/feedback?insightId=${encodeURIComponent(insightId)}`,
          principle: "A ação foi registrada; o feedback mede associação temporal e convergência, não causalidade automática."
        }
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to persist intervention", error);
    return NextResponse.json({ error: "intervention_persistence_failed" }, { status: 500 });
  }
}
