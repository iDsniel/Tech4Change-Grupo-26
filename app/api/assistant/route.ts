import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { demoAnswer } from "@/lib/demo";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const question = String(body.question || "").trim();
  const manual = String(body.manual || "").trim();
  const imageDataUrl = body.imageDataUrl ? String(body.imageDataUrl) : undefined;

  if (!question) return NextResponse.json({ error: "Pergunta obrigatória" }, { status: 400 });
  if (!manual) return NextResponse.json({ error: "Procedimento obrigatório" }, { status: 400 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ answer: demoAnswer(question, manual), demo: true });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const content: any[] = [
    {
      type: "input_text",
      text: `Você é um copiloto de campo. Responda SOMENTE com base no procedimento fornecido. Se a resposta não estiver explicitamente sustentada pelo procedimento, diga que não há base suficiente e oriente o usuário a escalar ao responsável técnico. Não invente parâmetros, valores, passos ou garantias de segurança. Seja curto, operacional e cite o número/trecho da etapa quando possível.\n\nPROCEDIMENTO:\n${manual}\n\nPERGUNTA:\n${question}`
    }
  ];

  if (imageDataUrl) {
    content.push({ type: "input_image", image_url: imageDataUrl, detail: "auto" });
  }

  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
    input: [{ role: "user", content }]
  });

  return NextResponse.json({ answer: response.output_text, demo: false });
}
