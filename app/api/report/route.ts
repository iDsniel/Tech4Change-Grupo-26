import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { transcript = [] } = await req.json();
  const entries = Array.isArray(transcript) ? transcript : [];

  if (!process.env.OPENAI_API_KEY) {
    const observations = entries.filter((e: any) => e.role === "user").map((e: any) => `- ${e.text}`).slice(-6).join("\n") || "- Nenhuma observação registrada.";
    return NextResponse.json({ report: `RELATÓRIO DEMO\n\nAtividade: atendimento assistido pelo MãoLivre AI\n\nInterações registradas:\n${observations}\n\nPendências: validar qualquer condição não prevista com o responsável técnico.\n\nStatus: demonstração concluída.` , demo: true });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: `Gere um relatório técnico curto e neutro a partir das interações abaixo. Não invente fatos. Estruture em: atividade, observações, ações realizadas, pendências e status.\n\n${JSON.stringify(entries)}`
  });
  return NextResponse.json({ report: response.output_text, demo: false });
}
