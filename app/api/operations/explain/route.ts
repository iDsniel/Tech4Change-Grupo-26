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
  const prompt = `Você é a camada de interpretação do Pulso, um copiloto de gestão operacional industrial.
O motor estatístico/ML já detectou e calculou as evidências. O Operational Context Engine acrescentou contexto estruturado de telemetria, eventos e, quando disponível, apontamentos de gestão. Sua função é transformar isso em uma leitura útil para um gestor ou usuário operacional que NÃO precisa conhecer estatística.

REGRAS OBRIGATÓRIAS:
1. Use exclusivamente o JSON em EVIDÊNCIAS E CONTEXTO PERMITIDOS.
2. Não invente números, falhas, peças, defeitos, condições ambientais, custos, economia, demanda ou eventos.
3. Não transforme associação, desvio ou raridade em causa raiz.
4. Não faça previsão de pane ou probabilidade de falha.
5. Não atribua responsabilidade a operador/cartão e não recomende decisão disciplinar.
6. Diferencie fato observado, interpretação plausível e informação ausente.
7. Na resposta principal, NÃO use os termos z-score, desvio padrão, sigma, percentil, Isolation Forest, baseline ou anomalia multivariada. Esses termos pertencem apenas à camada técnica da interface.
8. Explique em linguagem de operação: o que mudou, quais outros sinais ajudam a interpretar, por que vale olhar e o que o humano deveria verificar primeiro.
9. Respeite rigorosamente a granularidade: context.daily é do dia; context.aggregateTelemetry é agregado do período declarado e NUNCA deve ser descrito como se fosse daquele dia.
10. Hidráulica, movimento, marcha, elevação e demais indicadores agregados podem contextualizar o padrão operacional, mas não provam produtividade diária.
11. Se context.availability.demandOrProduction for false, não conclua perda de produtividade. Diga que baixa atividade também pode refletir menor demanda e que isso precisa ser verificado.
12. Se houver produção/apontamento do mesmo dia, trate apenas como fato registrado; não derive eficiência ou causalidade sem base comparável.
13. Use contexto de falhas, impactos e ordens como apoio à investigação, nunca como diagnóstico automático.
14. A recomendação já foi definida pelo motor; torne-a mais clara e acionável, sem torná-la mais agressiva.
15. Seja curto: headline com até 10 palavras; explanation com no máximo 4 frases; whyItMatters com no máximo 2 frases; uncertainty com 1 ou 2 frases.
16. Prefira expressões como "acima do habitual", "abaixo do habitual", "diferente do comportamento normal", "o contexto agregado mostra" e "vale verificar".
17. Responda em português do Brasil.
18. Retorne APENAS JSON válido com exatamente as chaves string: headline, explanation, whyItMatters, uncertainty.
19. Em uncertainty, diga explicitamente que a leitura é hipótese/indício e não comprova causalidade. Quando usar indicador agregado, também deixe claro que ele não representa necessariamente o dia analisado.

EVIDÊNCIAS E CONTEXTO PERMITIDOS:
${JSON.stringify(packet)}`;

  try {
    const response = await client.responses.create({
      model,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      max_output_tokens: 650
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
