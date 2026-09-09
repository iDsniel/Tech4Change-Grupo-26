import { join } from "node:path";
import { NextResponse } from "next/server";
import { fuseWithIsolationForest, type EnrichedInsight } from "@/lib/isolationForest";
import { analyzeHistoricalTelemetry, demoFleet, type HistoricalShiftRecord, type Severity } from "@/lib/telemetry";
import {
  loadTelemetryCsvFile,
  parseTelemetryCsv,
  TelemetryCsvValidationError,
  type TelemetryIngestionMetadata
} from "@/lib/telemetryCsvAdapter";

export const runtime = "nodejs";

type FleetStatus = Severity | "healthy";
type FleetAsset = { assetId: string; capacity: string; status: FleetStatus };

const severityOrder: Record<Severity, number> = { critical: 3, high: 2, attention: 1 };
const capacityByAsset = new Map<string, string>(demoFleet.map((asset) => [asset.assetId, asset.capacity]));

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fleetFromHistory(history: HistoricalShiftRecord[], insights: EnrichedInsight[]): FleetAsset[] {
  return [...new Set(history.map((record) => record.assetId))]
    .sort()
    .map((assetId) => {
      const relevant = insights
        .filter((insight) => insight.assetId === assetId)
        .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || b.score - a.score);
      const status: FleetStatus = relevant[0]?.severity ?? "healthy";
      return {
        assetId,
        capacity: capacityByAsset.get(assetId) ?? "n/d",
        status
      };
    });
}

function buildPayload(
  history: HistoricalShiftRecord[],
  ingestion: TelemetryIngestionMetadata,
  source: { mode: "demo" | "external"; name: string; disclaimer: string }
) {
  const statistical = analyzeHistoricalTelemetry(history);
  const multivariate = fuseWithIsolationForest(history, statistical.insights, statistical.analysis);
  const fleet = fleetFromHistory(history, multivariate.insights);

  return {
    mode: source.mode,
    generatedAt: new Date().toISOString(),
    source: {
      type: "normalized-csv",
      name: source.name,
      vendorReference: source.mode === "demo" ? "Konecranes TRUCONNECT public telemetry concepts" : "external normalized CSV",
      disclaimer: source.disclaimer,
      ingestion
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
    fleet,
    summary: {
      assets: fleet.length,
      healthyAssets: fleet.filter((asset) => asset.status === "healthy").length,
      activeInsights: multivariate.insights.length,
      criticalInsights: multivariate.insights.filter((insight) => insight.severity === "critical").length,
      potentialSavingsLitersPerShift: round(multivariate.insights.reduce((total, insight) => total + (insight.potentialSavingsLitersPerShift ?? 0), 0), 1)
    },
    insights: multivariate.insights
  };
}

function validationResponse(error: TelemetryCsvValidationError) {
  return NextResponse.json(
    {
      error: "telemetry_csv_validation_failed",
      message: error.message,
      issues: error.issues
    },
    { status: 422 }
  );
}

export async function GET() {
  try {
    const filePath = join(process.cwd(), "data", "telemetry-demo.csv");
    const { records, metadata } = await loadTelemetryCsvFile(filePath);
    return NextResponse.json(
      buildPayload(records, metadata, {
        mode: "demo",
        name: "data/telemetry-demo.csv",
        disclaimer: "Os valores são sintéticos e o schema é normalizado pelo MVP; não representam payload literal de qualquer fabricante."
      })
    );
  } catch (error) {
    if (error instanceof TelemetryCsvValidationError) return validationResponse(error);
    console.error("Failed to load demo telemetry CSV", error);
    return NextResponse.json({ error: "telemetry_source_unavailable" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "text/csv" && contentType !== "application/csv") {
    return NextResponse.json(
      { error: "unsupported_media_type", message: "Envie o dataset como text/csv ou application/csv." },
      { status: 415 }
    );
  }

  try {
    const csv = await request.text();
    const { records, metadata } = parseTelemetryCsv(csv);
    return NextResponse.json(
      buildPayload(records, metadata, {
        mode: "external",
        name: "request-body",
        disclaimer: "Dataset externo validado contra o contrato telemetry-shift-v1. A origem e a qualidade dos dados continuam sob responsabilidade da integração fornecedora."
      })
    );
  } catch (error) {
    if (error instanceof TelemetryCsvValidationError) return validationResponse(error);
    console.error("Failed to process external telemetry CSV", error);
    return NextResponse.json({ error: "telemetry_processing_failed" }, { status: 500 });
  }
}
