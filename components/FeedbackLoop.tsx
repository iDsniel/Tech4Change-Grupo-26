"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Clock3, Gauge, RefreshCw, ShieldCheck, TrendingDown, TrendingUp } from "lucide-react";
import type { FeedbackAssessment } from "@/lib/feedbackLoop";

type FeedbackResponse = {
  schemaVersion: "telemetry-feedback-v1";
  tracked: boolean;
  message?: string;
  assessments?: FeedbackAssessment[];
};

const statusCopy = {
  improved: { label: "Convergindo ao baseline", icon: TrendingDown },
  stable: { label: "Ainda em acompanhamento", icon: Activity },
  worsened: { label: "Desvio aumentou", icon: TrendingUp },
  "insufficient-data": { label: "Aguardando mais turnos", icon: Clock3 },
  "not-applicable": { label: "Não aplicável", icon: ShieldCheck }
} as const;

export function FeedbackLoop({ insightId }: { insightId: string }) {
  const [payload, setPayload] = useState<FeedbackResponse | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    setError("");

    fetch(`/api/telemetry/feedback?insightId=${encodeURIComponent(insightId)}`)
      .then(async (response) => {
        const body = (await response.json()) as FeedbackResponse;
        if (!response.ok && response.status !== 404) throw new Error("Falha ao carregar acompanhamento");
        return body;
      })
      .then((body) => {
        if (!cancelled) setPayload(body);
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });

    return () => {
      cancelled = true;
    };
  }, [insightId]);

  if (error) {
    return (
      <article className="aiConclusion">
        <div className="aiTitle"><RefreshCw size={20} /> <strong>Feedback pós-recomendação</strong></div>
        <p>{error}</p>
      </article>
    );
  }

  if (!payload) {
    return (
      <article className="aiConclusion">
        <div className="aiTitle"><RefreshCw size={20} className="pulse" /> <strong>Feedback pós-recomendação</strong></div>
        <p>Comparando os próximos turnos com o baseline original…</p>
      </article>
    );
  }

  if (!payload.tracked || !payload.assessments?.length) {
    return (
      <article className="aiConclusion">
        <div className="aiTitle"><Clock3 size={20} /> <strong>Feedback pós-recomendação</strong></div>
        <p>{payload.message ?? "Ainda não existe uma intervenção registrada para este insight."}</p>
        <small>O acompanhamento só começa depois que uma orientação ou ação é registrada.</small>
      </article>
    );
  }

  const feedback = payload.assessments[0];
  const status = statusCopy[feedback.status];
  const StatusIcon = status.icon;

  return (
    <article className="aiConclusion">
      <div className="aiTitle"><StatusIcon size={20} /> <strong>Feedback pós-recomendação · {status.label}</strong></div>
      <p>{feedback.interpretation}</p>

      <div className="detailGrid" style={{ marginTop: 14 }}>
        <div className="detailCard">
          <div className="cardTitle"><CheckCircle2 size={17} /> Ação registrada</div>
          <p>{feedback.intervention.note}</p>
          <small>{feedback.intervention.appliedAt} · {feedback.intervention.actorRole} · {feedback.intervention.actionType}</small>
        </div>

        <div className="detailCard">
          <div className="cardTitle"><Gauge size={17} /> Resultado observado</div>
          <p>
            {feedback.convergence.improvementPct !== undefined
              ? `${feedback.convergence.improvementPct}% de convergência média ao baseline.`
              : "Ainda sem dados suficientes para calcular convergência."}
          </p>
          <small>
            {feedback.context.observedTurns}/{feedback.context.targetTurns} turno(s) ·
            {feedback.context.shift ? ` turno ${feedback.context.shift} ·` : ""}
            {feedback.context.period ? ` ${feedback.context.period}` : " aguardando novos dados"}
          </small>
        </div>
      </div>

      {feedback.convergence.metrics.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {feedback.convergence.metrics.map((metric) => (
            <div key={metric.metric} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,.18)" }}>
              <strong>{metric.label}</strong>
              <span>antes {metric.beforeValue} {metric.unit}</span>
              <span>depois {metric.afterMean} {metric.unit}</span>
            </div>
          ))}
        </div>
      )}

      <small style={{ display: "block", marginTop: 12 }}>
        <ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
        Comparação principal: mesmo ativo + mesmo turno. Operador é referência secundária ({feedback.context.sameOperatorTurns} turno(s) com o mesmo operador). Associação temporal não prova causalidade.
      </small>
    </article>
  );
}
