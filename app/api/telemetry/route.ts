import { NextRequest, NextResponse } from "next/server";
import { analyzeTelemetry, demoFleet, demoTelemetryWindows, fleetSummary, type TelemetryWindow } from "@/lib/telemetry";

export const runtime = "nodejs";

export async function GET() {
  const insights = analyzeTelemetry();

  return NextResponse.json({
    mode: "demo",
    generatedAt: new Date().toISOString(),
    source: {
      type: "synthetic",
      vendorReference: "Konecranes TRUCONNECT public telemetry concepts",
      disclaimer: "Os valores são sintéticos e o schema é normalizado pelo MVP; não representa payload literal da API Konecranes."
    },
    fleet: demoFleet,
    windows: demoTelemetryWindows,
    summary: fleetSummary(insights),
    insights
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const windows = body?.windows as TelemetryWindow[] | undefined;

  if (!Array.isArray(windows) || windows.length === 0) {
    return NextResponse.json({ error: "Envie ao menos uma janela de telemetria em windows[]." }, { status: 400 });
  }

  const insights = analyzeTelemetry(windows);
  return NextResponse.json({ summary: fleetSummary(insights), insights });
}
