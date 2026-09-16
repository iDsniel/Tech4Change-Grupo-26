"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, ChevronRight, Microscope, ShieldCheck, Sparkles } from "lucide-react";
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
  initialInsightId?: string;
  onRegisterAction: (insight: OperationalAIInsight) => void;
};

export default function OperationalAIPanel({ data, assetFilter = "all", monthFilter = "all", initialInsightId, onRegisterAction }: Props) {
  const analysis = useMemo(() => analyzeOperationalAI(data), [data]);
  const filtered = useMemo(() => analysis.insights.filter((insight) =>
    (assetFilter === "all" || insight.assetId === assetFilter) &&
    (monthFilter === "all" || insight.date.startsWith(monthFilter))
  ), [analysis.insights, assetFilter, monthFilter]);
  const [selectedId, setSelectedId] = useState<string>();
  const [explanation, setExplanation] = useState<ExplanationResponse>();
  const [explanationError, setExplanationError] = useState("");

  const selected = useMemo(() => filtered.find((item) => item.id === selectedId) ?? filtered.find((item) => item.id === initialInsightId) ?? filtered[0], [filtered, selectedId, initialInsightId]);

  useEffect(() => {
    setSelectedId(filtered.find((item) => item.id === initialInsightId)?.id ?? filtered[0]?.id);
  }, [assetFilter, monthFilter, data.operationId, initialInsightId]);

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

  return <section className="aiWorkspace">
    <aside className="aiQueue">
      <div className="sectionHeading">
        <div><span className="sectionEyebrow">PRIORIZAÇÃO</span><h2>Desvios para investigar</h2></div>
        <BrainCircuit size={23} />
      </div>
      <p className="mutedCopy">O score representa força da evidência combinada. Não representa risco de pane.</p>
      <div className="aiQueueStats"><span>{filtered.length} priorizados</span><span>{analysis.strongAgreements} concordâncias fortes</span></div>
      <div className="aiInsightList">
        {filtered.slice(0, 40).map((insight) => <button className={selected?.id === insight.id ? "selected" : ""} key={insight.id} onClick={() => setSelectedId(insight.id)}>
          <span className={`priorityPill ${insight.priority}`}>{priorityLabel[insight.priority]}</span>
          <div><strong>{insight.assetId} · {insight.date}</strong><p>{insight.title}</p><small>{categoryLabel[insight.category]} · evidência {insight.evidenceStrength}/100</small></div>
          <ChevronRight size={17} />
        </button>)}
        {!filtered.length && <div className="quietState">Nenhum sinal priorizado neste filtro. Isso não certifica a saúde dos equipamentos.</div>}
      </div>
    </aside>

    <article className="aiInvestigation">
      {!selected && <div className="quietState large">Selecione outro período ou equipamento para consultar os insights disponíveis.</div>}
      {selected && <>
        <div className="investigationHeader">
          <div>
            <div className="detailTopline"><span className={`priorityPill ${selected.priority}`}>{selected.priority === "high" ? "Alta atenção" : "Atenção"}</span><span>{categoryLabel[selected.category]}</span></div>
            <h2>{selected.assetId}</h2>
            <p>{selected.title}</p>
          </div>
          <div className="evidenceScore"><span>Evidência</span><strong>{selected.evidenceStrength}</strong><small>/100</small></div>
        </div>

        <section className="plainSection">
          <span className="sectionEyebrow">O QUE ACONTECEU</span>
          <p className="leadCopy">{selected.summary}</p>
        </section>

        <section className="copilotCard">
          <div className="aiTitle"><Sparkles size={19} /><strong>Explicação do copiloto</strong></div>
          {!explanation && !explanationError && <p className="mutedCopy">Traduzindo as evidências para linguagem de gestão…</p>}
          {explanationError && <p className="mutedCopy">{explanationError}</p>}
          {explanation && <>
            <h3>{explanation.explanation.headline}</h3>
            <p>{explanation.explanation.explanation}</p>
            <div className="whyItMatters"><strong>Por que importa</strong><p>{explanation.explanation.whyItMatters}</p></div>
            <small>{explanation.explanation.uncertainty}</small>
            <div className="modeTag">{explanation.mode === "generative" ? `IA generativa${explanation.model ? ` · ${explanation.model}` : ""}` : "fallback determinístico"}</div>
          </>}
        </section>

        <section className="actionPanel">
          <div><span className="sectionEyebrow">PRÓXIMA AÇÃO</span><h3>Validar antes de concluir</h3><p>{selected.recommendation}</p><small>{selected.uncertainty}</small></div>
          <button className="primaryAction" onClick={() => onRegisterAction(selected)}>Registrar ação</button>
        </section>

        <section className="evidenceCards">
          <article><div className="cardTitle"><Microscope size={18} /> Evidências observadas</div><div className="hysterTable compactTable"><table><thead><tr><th>Métrica</th><th>Atual</th><th>Referência</th><th>Desvio</th></tr></thead><tbody>{selected.evidence.map((item) => <tr key={item.metric}><th>{item.label}</th><td>{fmt(item.current)} {item.unit}</td><td>{fmt(item.mean)} ± {fmt(item.stdDev)}</td><td>{item.zScore >= 0 ? "+" : ""}{fmt(item.zScore)}σ</td></tr>)}</tbody></table></div><small>Baseline: {selected.baselineSamples} registros anteriores do mesmo equipamento dentro de {selected.lookbackDays} dias.</small></article>
          <article><div className="cardTitle"><BrainCircuit size={18} /> Segunda opinião multivariada</div><p>{selected.multivariate.explanation}</p><div className="miniStats"><div><span>Percentil</span><strong>{Math.round(selected.multivariate.percentile * 100)}%</strong></div><div><span>Concordância</span><strong>{agreementLabel[selected.multivariate.agreement]}</strong></div></div><small>{selected.multivariate.trees} árvores · amostra {selected.multivariate.sampleSize} · mesmos dados reais normalizados.</small></article>
        </section>

        <details className="technicalDetails"><summary>Ver contexto e rastreabilidade</summary><div className="technicalGrid"><div><strong>Eventos relacionados</strong><p>{selected.relatedEvents.faults} registros de falha · {selected.relatedEvents.impacts} impactos no mesmo equipamento/dia.</p></div><div><strong>Cartões no contexto</strong><p>{selected.relatedCardCodes.length ? selected.relatedCardCodes.join(", ") : "Nenhum código disponível"}</p></div><div><strong>Guardrail</strong><p>Associação serve para investigação e não comprova responsabilidade individual.</p></div></div></details>

        <div className="humanDecisionNote"><ShieldCheck size={17} /><span><strong>Decisão final humana.</strong> A IA prioriza, explica e recomenda; inspeção, diagnóstico e execução continuam com pessoas autorizadas.</span><CheckCircle2 size={17} /></div>
      </>}
    </article>
  </section>;
}
