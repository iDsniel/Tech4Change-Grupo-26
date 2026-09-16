"use client";

import { useEffect, useMemo, useState } from "react";
import type { HysterData } from "@/lib/hyster";
import {
  analyzeOperationalAI,
  operationalExplanationPacket,
  type OperationalAIInsight
} from "@/lib/operationalAI";
import type { OperationalExplanation } from "@/lib/operationalExplanation";

const agreementLabel = { strong: "forte", moderate: "moderada", weak: "fraca" } as const;
const priorityLabel = { attention: "Atenção", high: "Alta" } as const;
const categoryLabel = {
  efficiency: "Eficiência operacional",
  reliability: "Confiabilidade",
  safety: "Segurança",
  multivariate: "Padrão multivariado"
} as const;

const fmt = (value: number, digits = 2) => value.toLocaleString("pt-BR", { maximumFractionDigits: digits });

type ExplanationResponse = {
  mode: "generative" | "deterministic";
  model?: string;
  explanation: OperationalExplanation;
};

type Props = {
  data: HysterData;
  assetFilter?: string;
  monthFilter?: string;
  onRegisterAction: (insight: OperationalAIInsight) => void;
};

export default function OperationalAIPanel({ data, assetFilter = "all", monthFilter = "all", onRegisterAction }: Props) {
  const analysis = useMemo(() => analyzeOperationalAI(data), [data]);
  const filtered = useMemo(() => analysis.insights.filter((insight) =>
    (assetFilter === "all" || insight.assetId === assetFilter) &&
    (monthFilter === "all" || insight.date.startsWith(monthFilter))
  ), [analysis.insights, assetFilter, monthFilter]);
  const [selectedId, setSelectedId] = useState<string>();
  const [explanation, setExplanation] = useState<ExplanationResponse>();
  const [explanationError, setExplanationError] = useState("");

  const selected = useMemo(() => filtered.find((item) => item.id === selectedId) ?? filtered[0], [filtered, selectedId]);

  useEffect(() => {
    setSelectedId(filtered[0]?.id);
  }, [assetFilter, monthFilter, data.operationId]);

  useEffect(() => {
    if (!selected) {
      setExplanation(undefined);
      return;
    }
    const controller = new AbortController();
    setExplanation(undefined);
    setExplanationError("");
    fetch("/api/operations/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence: operationalExplanationPacket(selected) }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível explicar este insight.");
        return response.json() as Promise<ExplanationResponse>;
      })
      .then(setExplanation)
      .catch((error: Error) => {
        if (error.name !== "AbortError") setExplanationError(error.message);
      });
    return () => controller.abort();
  }, [selected]);

  return <section className="workspace operationalAI">
    <aside className="insightsPane">
      <h2>Pulso AI · prioridades</h2>
      <p>Baseline do próprio equipamento + z-score + Isolation Forest. O score indica força da evidência, não risco de pane.</p>
      <p><small>{analysis.eligibleDays} equipamento-dias elegíveis · {analysis.strongAgreements} concordâncias fortes · {analysis.moderateAgreements} moderadas · {analysis.weakAgreements} fracas.</small></p>
      <div className="insightList">
        {filtered.slice(0, 40).map((insight) => <button
          className={`insightCard ${selected?.id === insight.id ? "selected" : ""}`}
          key={insight.id}
          onClick={() => setSelectedId(insight.id)}
        >
          <div>
            <small>{priorityLabel[insight.priority]} · {categoryLabel[insight.category]}</small>
            <strong>{insight.assetId} · {insight.date}</strong>
            <p>{insight.title}</p>
            <small>Evidência {insight.evidenceStrength}/100 · IF {agreementLabel[insight.multivariate.agreement]}</small>
          </div>
        </button>)}
        {!filtered.length && <p>Nenhum sinal priorizado neste filtro. Isso não certifica a saúde dos equipamentos.</p>}
      </div>
    </aside>

    <article className="detailPane">
      <h2>Evidência → explicação → ação</h2>
      {!selected && <p>Selecione outro período ou equipamento para consultar os insights disponíveis.</p>}
      {selected && <>
        <h3>{selected.assetId} · {selected.date}</h3>
        <p><strong>{selected.title}</strong></p>
        <p>{selected.summary}</p>

        <section className="detailGrid">
          <article className="detailCard">
            <h3>Evidências estatísticas</h3>
            <div className="hysterTable"><table><thead><tr><th>Métrica</th><th>Atual</th><th>Baseline</th><th>z-score</th></tr></thead><tbody>
              {selected.evidence.map((item) => <tr key={item.metric}><th>{item.label}</th><td>{fmt(item.current)} {item.unit}</td><td>{fmt(item.mean)} ± {fmt(item.stdDev)}</td><td>{item.zScore >= 0 ? "+" : ""}{fmt(item.zScore)}σ</td></tr>)}
            </tbody></table></div>
            <p><small>Baseline: {selected.baselineSamples} registros anteriores do mesmo equipamento dentro de {selected.lookbackDays} dias.</small></p>
          </article>
          <article className="detailCard">
            <h3>2ª opinião · Isolation Forest</h3>
            <p>{selected.multivariate.explanation}</p>
            <p><strong>Percentil:</strong> {Math.round(selected.multivariate.percentile * 100)}% · <strong>Concordância:</strong> {agreementLabel[selected.multivariate.agreement]}</p>
            <small>{selected.multivariate.trees} árvores · amostra {selected.multivariate.sampleSize} · mesmos dados reais normalizados.</small>
          </article>
        </section>

        <article className="detailCard">
          <h3>Explicação do copiloto</h3>
          {!explanation && !explanationError && <p>Explicando as evidências…</p>}
          {explanationError && <p>{explanationError}</p>}
          {explanation && <>
            <p><strong>{explanation.explanation.headline}</strong></p>
            <p>{explanation.explanation.explanation}</p>
            <p><strong>Por que importa:</strong> {explanation.explanation.whyItMatters}</p>
            <p><small>{explanation.explanation.uncertainty}</small></p>
            <small>Modo: {explanation.mode === "generative" ? `IA generativa${explanation.model ? ` · ${explanation.model}` : ""}` : "fallback determinístico"}.</small>
          </>}
        </article>

        <article className="detailCard">
          <h3>Contexto operacional</h3>
          <p>{selected.relatedEvents.faults} registros de falha · {selected.relatedEvents.impacts} impactos no mesmo equipamento/dia.</p>
          <p>Cartões presentes nesse contexto: {selected.relatedCardCodes.length ? selected.relatedCardCodes.join(", ") : "nenhum código disponível"}.</p>
          <small>A associação serve para investigação e não comprova responsabilidade individual. Indicadores agregados por cartão não são usados para criar score de operador.</small>
        </article>

        <article className="detailCard">
          <h3>Próxima ação</h3>
          <p>{selected.recommendation}</p>
          <p><small>{selected.uncertainty}</small></p>
          <button className="opsAction" onClick={() => onRegisterAction(selected)}>Registrar ação para {selected.assetId}</button>
        </article>
      </>}
    </article>
  </section>;
}
