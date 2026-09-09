import { join } from "node:path";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  buildEvidencePacket,
  deterministicExplanation,
  explanationResult,
  parseGeneratedExplanation
} from "@/lib/generativeExplanation";
import { loadTelemetryCsvFile } from "@/lib/telemetryCsvAdapter";
import { runTelemetryPipeline } from "@/lib/telemetryPipeline";

export const runtime = "nodejs";

const MAX_INSIGHT_ID_LENGTH = 160;

function fallback(insight: Parameters<typeof deterministicExplanation>[0]) {
  return explanationResult(insight, deterministicExplanation(insight), { mode: "deterministic" });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const insightId =
    body && typeof body === "object" && "insightId" in body
      ? String((body as { insightId?: unknown }).insightId ?? "").trim()
      : "";

  if (!insightId || insightId.length > MAX_INSIGHT_ID_LENGTH) {
    return NextResponse.json({ error: "invalid_insight_id" }, { status: 400 });
  }

  try {
    const filePath = join(process.cwd(), "data", "telemetry-demo.csv");
    const { records, metadata } = await loadTelemetryCsvFile(filePath);
    const payload = runTelemetryPipeline(records, {
      mode: "demo",
      type: "normalized-csv",
      name: "data/telemetry-demo.csv",
      vendorReference: "Konecranes TRUCONNECT public telemetry concepts",
      disclaimer: "Dados sintéticos normalizados pelo MVP.",
      ingestion: metadata
    });
    const insight = payload.insights.find((item) => item.id === insightId);

    if (!insight) return NextResponse.json({ error: "insight_not_found" }, { status: 404 });

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(fallback(insight));
    }

    const evidence = buildEvidencePacket(insight);
    const model = process.env.OPENAI_EXPLANATION_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna";
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Você é a camada de explicação de um copiloto de telemetria industrial.
Sua função é SOMENTE explicar evidências já calculadas por um motor estatístico/ML. Você NÃO detecta anomalias, NÃO cria novos fatos, NÃO diagnostica causa raiz e NÃO toma decisão operacional ou disciplinar.

REGRAS OBRIGATÓRIAS:
1. Use exclusivamente o JSON em EVIDÊNCIAS PERMITIDAS.
2. Não invente números, condições ambientais, defeitos, peças, eventos, histórico ou comportamento do operador.
3. Diferencie evidência, hipótese e causalidade. Nunca apresente hipótese como causa confirmada.
4. A recomendação operacional já foi definida pelo motor. Você pode explicá-la, mas não criar uma ação diferente ou mais agressiva.
5. Se houver pouca evidência, declare a incerteza em vez de preencher lacunas.
6. Nunca recomende punição, advertência ou decisão disciplinar.
7. Retorne APENAS JSON válido, sem markdown, com exatamente estas chaves string:
   headline, explanation, whyItMatters, uncertainty
8. Em uncertainty, declare explicitamente que a leitura é uma hipótese ou que as evidências não provam causalidade.
9. Seja claro para um gestor de operação, em português do Brasil, e mantenha cada campo curto.

EVIDÊNCIAS PERMITIDAS:
${JSON.stringify(evidence)}`;

    try {
      const response = await client.responses.create({
        model,
        input: [
          {
            role: "user",
            content: [{ type: "input_text", text: prompt }]
          }
        ],
        max_output_tokens: 700
      });

      const generated = parseGeneratedExplanation(response.output_text);
      if (!generated) return NextResponse.json(fallback(insight));
      return NextResponse.json(explanationResult(insight, generated, { mode: "generative", model }));
    } catch (error) {
      console.error("Generative explanation unavailable; deterministic fallback used", error instanceof Error ? error.name : "unknown_error");
      return NextResponse.json(fallback(insight));
    }
  } catch (error) {
    console.error("Failed to build telemetry explanation", error instanceof Error ? error.name : "unknown_error");
    return NextResponse.json({ error: "telemetry_explanation_unavailable" }, { status: 500 });
  }
}
