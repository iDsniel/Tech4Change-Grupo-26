import { NextResponse } from "next/server";
import {
  adaptKonecranesMockPayload,
  KonecranesAdapterValidationError
} from "@/lib/providers/konecranesAdapter";
import { runTelemetryPipeline } from "@/lib/telemetryPipeline";

export const runtime = "nodejs";

function validationResponse(error: KonecranesAdapterValidationError) {
  return NextResponse.json(
    {
      error: "konecranes_adapter_validation_failed",
      message: error.message,
      issues: error.issues
    },
    { status: 422 }
  );
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    return NextResponse.json(
      { error: "unsupported_media_type", message: "Envie o payload Konecranes mock como application/json." },
      { status: 415 }
    );
  }

  try {
    const body = await request.json();
    const adapted = adaptKonecranesMockPayload(body);

    return NextResponse.json(
      runTelemetryPipeline(
        adapted.records,
        {
          mode: "external",
          type: "provider-adapter",
          name: "konecranes-truconnect-mock",
          provider: "konecranes",
          vendorReference: "TRUCONNECT-inspired mock contract; not a literal Konecranes production payload",
          disclaimer: "Este endpoint demonstra a arquitetura de adapter usando um contrato mock inspirado em conceitos públicos do TRUCONNECT. Campos e estrutura não devem ser apresentados como payload proprietário oficial da Konecranes.",
          ingestion: adapted.metadata
        },
        adapted.assets
      )
    );
  } catch (error) {
    if (error instanceof KonecranesAdapterValidationError) return validationResponse(error);
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "invalid_json", message: "JSON inválido." },
        { status: 400 }
      );
    }
    console.error("Failed to process Konecranes mock telemetry payload", error);
    return NextResponse.json({ error: "telemetry_processing_failed" }, { status: 500 });
  }
}
