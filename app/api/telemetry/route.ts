import { NextResponse } from "next/server";
import { analyzeHistoricalTelemetry, buildDemoHistory, fleetSummary, fleetWithStatus } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function GET() {
  const history = buildDemoHistory();
  const result = analyzeHistoricalTelemetry(history);

  return NextResponse.json({
    mode: "demo",
    generatedAt: new Date().toISOString(),
    source: {
      type: "synthetic",
      vendorReference: "Konecranes TRUCONNECT public telemetry concepts",
      disclaimer: "Os valores são sintéticos e o schema é normalizado pelo MVP; não representa payload literal da API Konecranes."
    },
    analysis: result.analysis,
    fleet: fleetWithStatus(result.insights),
    summary: fleetSummary(result.insights),
    insights: result.insights
  });
}
