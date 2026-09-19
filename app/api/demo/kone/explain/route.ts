import OpenAI from "openai";
import { NextResponse } from "next/server";
import type { KoneDemoInsight } from "@/lib/koneDemo";

export const runtime = "nodejs";

function isInsight(value: unknown): value is KoneDemoInsight {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === "string" &&
    typeof row.assetId === "string" &&
    typeof row.date === "string" &&
    ["A", "B", "C"].includes(String(row.shift)) &&
    ["productivity", "safety", "maintenance"].includes(String(row.category)) &&
    ["attention", "high"].includes(String(row.priority)) &&
    typeof row.headline === "string" &&
    typeof row.whatHappened === "string" &&
    typeof row.whyItMatters === "string" &&
    Array.isArray(row.verify) &&
    typeof row.context === "string";
}

function deterministic(insight: KoneDemoInsight) {
  const firstChecks = insight.verify.slice(0, 3).join(", ");
  return `${insight.whatHappened} ${insight.whyItMatters} Vale verificar primeiro: ${firstChecks}. A leitura é um indício para investigação e não comprova causa ou responsabilidade individual.`;
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const insight = body && typeof body === "object" && "insight" in body ? (body as { insight: unknown }).insight : undefined;
  if (!isInsight(insight)) return NextResponse.json({ error: "invalid_insight" }, { status: 422 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ mode: "deterministic", explanation: deterministic(insight) });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_EXPLANATION_MODEL || process.env.OPENAI_MODEL || "gpt-5.6-luna";
  const prompt = `Você é a camada de interpretação do Pulso em uma DEMO sintética de operação de celulose com empilhadeiras Konecranes de 16 t.
Premissas do cenário: cada fardo pesa 2 t; dois fardos são movimentados por ciclo produtivo, portanto 4 t por ciclo; turnos A=07-15, B=15-23, C=23-07. O ciclo sintético do Pulso é aproximação vazia → coleta/engate → transferência carregada → posicionamento e depósito.
As variáveis simuladas foram escolhidas a partir de conceitos públicos do TRUCONNECT para lift trucks: machine status/running modes, driving hours, distance, speed/speed spectrum, fuel, total load lifted/load spectrum, shocks, overloads, diagnostics e maintenance counter.
A documentação pública usada não confirma forward/reverse share nem hydraulic activity share para esse produto; não invente essas métricas.
A resolução asset-shift é uma normalização sintética do Pulso para a demo; não afirme que é granularidade nativa da Konecranes.
O motor usa cinco meses (março a julho/2026) como baseline do mesmo ativo+turno e agosto/2026 como holdout. Os tempos das fases do ciclo, demanda e downtime são camadas sintéticas de processo do Pulso, não campos declarados da Konecranes.

Regras:
- use somente o insight JSON abaixo;
- não invente causa, custo, produção, evento ou diagnóstico;
- não atribua responsabilidade ao operador;
- não use z-score, sigma ou Isolation Forest no texto principal;
- produtividade deve ser explicada por ciclos concluídos, carga movimentada, t/h de máquina e pela fase do ciclo que mais se afastou do baseline quando cycleContext existir;
- não trate cycleContext como telemetria nativa Konecranes; diga "modelo de processo da demo" quando necessário;
- quando businessImpact existir, diferencie capacidade temporariamente indisponível, parte absorvida pela frota e impacto operacional residual. Nunca converta para R$ sem um valor financeiro explícito;
- alta velocidade é contexto; não chame de violação. Sobrecarga/impacto só quando registrados;
- manutenção é planejamento/diagnóstico a verificar, não previsão automática de falha;
- responda em português do Brasil, em até 4 frases;
- termine deixando claro que a decisão é humana.

INSIGHT:
${JSON.stringify(insight)}`;

  try {
    const response = await client.responses.create({
      model,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      max_output_tokens: 320
    });
    const text = response.output_text.trim();
    if (!text) return NextResponse.json({ mode: "deterministic", explanation: deterministic(insight) });
    return NextResponse.json({ mode: "generative", model, explanation: text });
  } catch {
    return NextResponse.json({ mode: "deterministic", explanation: deterministic(insight) });
  }
}
