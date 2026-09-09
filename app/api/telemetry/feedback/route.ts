import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { assessIntervention, type InterventionRecord } from "@/lib/feedbackLoop";
import { demoFleet } from "@/lib/telemetry";
import { loadTelemetryCsvFile } from "@/lib/telemetryCsvAdapter";
import { runTelemetryPipeline } from "@/lib/telemetryPipeline";

export const runtime = "nodejs";

type InterventionFixture = {
  schemaVersion: "telemetry-feedback-v1";
  interventions: InterventionRecord[];
};

async function loadContext() {
  const telemetryPath = join(process.cwd(), "data", "telemetry-demo.csv");
  const interventionsPath = join(process.cwd(), "data", "interventions-demo.json");
  const [{ records, metadata }, interventionsRaw] = await Promise.all([
    loadTelemetryCsvFile(telemetryPath),
    readFile(interventionsPath, "utf8")
  ]);

  const fixture = JSON.parse(interventionsRaw) as InterventionFixture;
  if (fixture.schemaVersion !== "telemetry-feedback-v1" || !Array.isArray(fixture.interventions)) {
    throw new Error("Invalid feedback fixture contract");
  }

  const pipeline = runTelemetryPipeline(
    records,
    {
      mode: "demo",
      type: "normalized-csv",
      name: "data/telemetry-demo.csv",
      vendorReference: "Konecranes TRUCONNECT public telemetry concepts",
      disclaimer: "Feedback demo calculado sobre dados sintéticos; associação temporal não prova causalidade.",
      ingestion: metadata
    },
    demoFleet
  );

  return { records, interventions: fixture.interventions, insights: pipeline.insights };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const insightId = searchParams.get("insightId")?.trim();
    const { records, interventions, insights } = await loadContext();

    const relevant = insightId
      ? interventions.filter((item) => item.insightId === insightId)
      : interventions;

    const assessments = relevant.flatMap((intervention) => {
      const insight = insights.find((item) => item.id === intervention.insightId);
      return insight ? [assessIntervention(records, insight, intervention)] : [];
    });

    if (insightId && assessments.length === 0) {
      const insightExists = insights.some((item) => item.id === insightId);
      return NextResponse.json(
        {
          schemaVersion: "telemetry-feedback-v1",
          insightId,
          tracked: false,
          message: insightExists
            ? "Ainda não existe uma intervenção registrada para este insight."
            : "Insight não encontrado no dataset atual."
        },
        { status: insightExists ? 200 : 404 }
      );
    }

    return NextResponse.json({
      schemaVersion: "telemetry-feedback-v1",
      tracked: assessments.length > 0,
      assessments,
      summary: {
        registeredInterventions: interventions.length,
        assessedInterventions: assessments.length,
        improved: assessments.filter((item) => item.status === "improved").length,
        stable: assessments.filter((item) => item.status === "stable").length,
        worsened: assessments.filter((item) => item.status === "worsened").length,
        insufficientData: assessments.filter((item) => item.status === "insufficient-data").length
      },
      principle: "O feedback mede convergência após uma ação, mas não atribui causalidade automaticamente."
    });
  } catch (error) {
    console.error("Failed to evaluate telemetry feedback", error);
    return NextResponse.json({ error: "telemetry_feedback_unavailable" }, { status: 500 });
  }
}
