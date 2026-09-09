"use client";

import { useEffect, useState } from "react";
import { BrainCircuit, ShieldCheck, Sparkles } from "lucide-react";
import { FeedbackLoop } from "@/components/FeedbackLoop";

type ExplanationResponse = {
  schemaVersion: "telemetry-explanation-v1";
  mode: "generative" | "deterministic";
  insightId: string;
  model?: string;
  explanation: {
    headline: string;
    explanation: string;
    whyItMatters: string;
    uncertainty: string;
  };
  guardrails: {
    evidenceBound: true;
    noAutomaticDecision: true;
    noRootCauseClaim: true;
    fallbackAvailable: true;
  };
};

export function GenerativeExplanation({ insightId }: { insightId: string }) {
  const [result, setResult] = useState<ExplanationResponse>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setResult(undefined);

    fetch("/api/telemetry/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insightId }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Explicação indisponível");
        return response.json();
      })
      .then((payload: ExplanationResponse) => setResult(payload))
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [insightId]);

  let explanationCard: React.ReactNode;

  if (loading) {
    explanationCard = (
      <article className="aiConclusion">
        <div className="aiTitle"><BrainCircuit className="pulse" size={20} /> <strong>Copiloto explicando as evidências…</strong></div>
        <p>A análise estatística já está pronta. Esta camada apenas traduz as evidências para linguagem operacional.</p>
      </article>
    );
  } else if (error || !result) {
    explanationCard = (
      <article className="aiConclusion">
        <div className="aiTitle"><ShieldCheck size={20} /> <strong>Explicação protegida</strong></div>
        <p>{error || "A camada explicadora não respondeu. As evidências técnicas abaixo continuam disponíveis para decisão humana."}</p>
      </article>
    );
  } else {
    explanationCard = (
      <article className="aiConclusion">
        <div className="aiTitle">
          <Sparkles size={20} />
          <strong>Copiloto · explicação das evidências</strong>
        </div>
        <p><strong>{result.explanation.headline}</strong></p>
        <p>{result.explanation.explanation}</p>
        <p>{result.explanation.whyItMatters}</p>
        <small>{result.explanation.uncertainty}</small>
        <small>
          {result.mode === "generative"
            ? ` · IA generativa (${result.model ?? "modelo configurado"})`
            : " · fallback determinístico — a demo funciona sem chave de API"}
          {" · "}evidência limitada ao motor · decisão final humana
        </small>
      </article>
    );
  }

  return (
    <>
      {explanationCard}
      <FeedbackLoop insightId={insightId} />
    </>
  );
}
