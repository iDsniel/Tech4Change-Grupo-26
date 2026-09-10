import { join } from "node:path";
import { NextResponse } from "next/server";
import { assessIntervention } from "@/lib/feedbackLoop";
import { interventionStoreHealth, listInterventions } from "@/lib/interventionStore";
import { demoFleet } from "@/lib/telemetry";
import { loadTelemetryCsvFile } from "@/lib/telemetryCsvAdapter";
import { runTelemetryPipeline } from "@/lib/telemetryPipeline";

export const runtime = "nodejs";

async function loadContext() {
  const telemetryPath = join(process.cwd(), "data", "telemetry-demo.csv");
  const { records, metadata } = await loadTelemetryCsvFile(telemetryPath);
  const pipeline = runTelemetryPipeline(
    records,
    {
      mode: "demo",
      type: "normalized-csv",
      name: "data/telemetry-demo.csv",
      vendorReference: "Konecranes TRUCONNECT public telemetry concepts",
      disclaimer: "Feedback calculado sobre dados sintéticos; associação temporal não prova causalidade.",
      ingestion: metadata
    },
    demoFleet
  );

  return { records, insights: pipeline.insights };
}

function registrationContext(insight: ReturnType<typeof runTelemetryPipeline>["insights"][number]) {
  const period = insight.analysis?.period;
  const suggestedAppliedAt = period ? (period.split(" → ")[1] ?? period.split(" → ")[0]) : new Date().toISOString().slice(0, 10);
  return {
    category: insight.category,
    recommendedAction: insight.recommendedAction,
    suggestedAppliedAt,
    demoDateNote: "A data sugerida é o fim da janela anômala para que a fixture sintética tenha turnos posteriores disponíveis."
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const insightId = searchParams.get("insightId")?.trim();
    const [{ records, insights }, interventions] = await Promise.all([
      loadContext(),
      Promise.resolve(listInterventions(insightId || undefined))
    ]);

    const assessments = interventions.flatMap((intervention) => {
      const insight = insights.find((item) => item.id === intervention.insightId);
      return insight ? [assessIntervention(records, insight, intervention)] : [];
    });

    if (insightId && assessments.length === 0) {
      const insight = insights.find((item) => item.id === insightId);
      return NextResponse.json(
        {
          schemaVersion: "telemetry-feedback-v1",
          insightId,
          tracked: false,
          storage: { engine: "sqlite", persistedInterventions: 0 },
          registration: insight ? registrationContext(insight) : undefined,
          message: insight
            ? "Ainda não existe uma intervenção registrada para este insight."
            : "Insight não encontrado no dataset atual."
        },
        { status: insight ? 200 : 404 }
      );
    }

    const health = interventionStoreHealth();
    const insight = insightId ? insights.find((item) => item.id === insightId) : undefined;
    return NextResponse.json({
      schemaVersion: "telemetry-feedback-v1",
      tracked: assessments.length > 0,
      storage: { engine: health.engine, persistedInterventions: health.records },
      registration: insight ? registrationContext(insight) : undefined,
      assessments,
      summary: {
        registeredInterventions: health.records,
        assessedInterventions: assessments.length,
        improved: assessments.filter((item) => item.status === "improved").length,
        stable: assessments.filter((item) => item.status === "stable").length,
        worsened: assessments.filter((item) => item.status === "worsened").length,
        insufficientData: assessments.filter((item) => item.status === "insufficient-data").length
      },
      principle: "O feedback mede convergência após uma ação persistida, mas não atribui causalidade automaticamente."
    });
  } catch (error) {
    console.error("Failed to evaluate telemetry feedback", error);
    return NextResponse.json({ error: "telemetry_feedback_unavailable" }, { status: 500 });
  }
}
