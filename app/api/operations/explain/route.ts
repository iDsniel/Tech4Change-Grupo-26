import OpenAI from "openai";
import { NextResponse } from "next/server";
import {
  deterministicOperationalExplanation,
  parseOperationalGeneratedExplanation,
  validateOperationalExplanationPacket
} from "@/lib/operationalExplanation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  let packet;
  try {
    const candidate = body && typeof body === "object" && "evidence" in body ? (body as { evidence: unknown }).evidence : undefined;
    packet = validateOperationalExplanationPacket(candidate);
  } catch {
    return NextResponse.json({ error: "invalid_operational_evidence" }, { status: 422 });
  }

  const fallback = () => NextResponse.json({
    schemaVersion: "pulso-operational-explanation-v1",
    mode: "deterministic",
    explanation: deterministicOperationalExplanation(packet),
    guardrails: { evidenceBound: true, noAutomaticDecision: true, noRootCauseClaim: true, noOperatorIdentitySent: true }
  });

  if (!process.env.OPENAI_API_KEY) return fallback();

  const model = process.env.OPENAI_EXPLANATION_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna";
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `Você é a camada de explicação do Pulso, um copiloto de gestão operacional industrial.
O motor estatístico/ML já detectou e calculou as evidências. Você SOMENTE explica o pacote fornecido para um gestor.

REGRAS OBRIGATÓRIAS:
1. Use exclusivamente o JSON em EVIDÊNCIAS PERMITIDAS.
2. Não invente números, falhas, peças, defeitos, condições ambientais, custos, economia ou eventos.
3. Não transforme associação, desvio ou raridade em causa raiz.
4. Não faça previsão de pane ou probabilidade de falha.
5. Não atribua responsabilidade a operador/cartão e não recomende decisão disciplinar.
6. A recomendação já foi definida pelo motor; apenas explique-a, sem torná-la mais agressiva.
7. Diferencie evidência, hipótese e incerteza.
8. Responda em português do Brasil e seja curto, claro e gerencial.
9. Retorne APENAS JSON válido com exatamente as chaves string: headline, explanation, whyItMatters, uncertainty.
10. Em uncertainty, diga explicitamente que a leitura é hipótese/indício e não prova causalidade.

EVIDÊNCIAS PERMITIDAS:
${JSON.stringify(packet)}`;

  try {
    const response = await client.responses.create({
      model,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      max_output_tokens: 700
    });
    const explanation = parseOperationalGeneratedExplanation(response.output_text);
    if (!explanation) return fallback();
    return NextResponse.json({
      schemaVersion: "pulso-operational-explanation-v1",
      mode: "generative",
      model,
      explanation,
      guardrails: { evidenceBound: true, noAutomaticDecision: true, noRootCauseClaim: true, noOperatorIdentitySent: true }
    });
  } catch (error) {
    console.error("Operational AI explanation unavailable; deterministic fallback used", error instanceof Error ? error.name : "unknown_error");
    return fallback();
  }
}
