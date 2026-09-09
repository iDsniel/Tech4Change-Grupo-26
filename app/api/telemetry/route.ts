import { NextResponse } from "next/server";
import { fuseWithIsolationForest } from "@/lib/isolationForest";
import { analyzeHistoricalTelemetry, buildDemoHistory, fleetSummary, fleetWithStatus } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function GET() {
  const history = buildDemoHistory();
  const statistical = analyzeHistoricalTelemetry(history);
  const multivariate = fuseWithIsolationForest(history, statistical.insights, statistical.analysis);

  return NextResponse.json({
    mode: "demo",
    generatedAt: new Date().toISOString(),
    source: {
      type: "synthetic",
      vendorReference: "Konecranes TRUCONNECT public telemetry concepts",
      disclaimer: "Os valores são sintéticos e o schema é normalizado pelo MVP; não representa payload literal da API Konecranes."
    },
    analysis: {
      statistical: statistical.analysis,
      multivariate: multivariate.analysis,
      fusion: {
        statisticalWeight: 0.8,
        multivariateWeight: 0.2,
        principle: "O z-score explica quais métricas desviaram; o Isolation Forest funciona como segunda opinião sobre a combinação multivariada."
      }
    },
    fleet: fleetWithStatus(multivariate.insights),
    summary: fleetSummary(multivariate.insights),
    insights: multivariate.insights
  });
}
