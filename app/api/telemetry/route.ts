import { join } from "node:path";
import { NextResponse } from "next/server";
import { demoFleet } from "@/lib/telemetry";
import {
  loadTelemetryCsvFile,
  parseTelemetryCsv,
  TelemetryCsvValidationError
} from "@/lib/telemetryCsvAdapter";
import { runTelemetryPipeline } from "@/lib/telemetryPipeline";

export const runtime = "nodejs";

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
      runTelemetryPipeline(
        records,
        {
          mode: "demo",
          type: "normalized-csv",
          name: "data/telemetry-demo.csv",
          vendorReference: "Konecranes TRUCONNECT public telemetry concepts",
          disclaimer: "Os valores são sintéticos e o schema é normalizado pelo MVP; não representam payload literal de qualquer fabricante.",
          ingestion: metadata
        },
        demoFleet
      )
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
      runTelemetryPipeline(records, {
        mode: "external",
        type: "normalized-csv",
        name: "request-body",
        vendorReference: "external normalized CSV",
        disclaimer: "Dataset externo validado contra o contrato telemetry-shift-v1. A origem e a qualidade dos dados continuam sob responsabilidade da integração fornecedora.",
        ingestion: metadata
      })
    );
  } catch (error) {
    if (error instanceof TelemetryCsvValidationError) return validationResponse(error);
    console.error("Failed to process external telemetry CSV", error);
    return NextResponse.json({ error: "telemetry_processing_failed" }, { status: 500 });
  }
}
