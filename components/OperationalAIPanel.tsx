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

const fmt = (value: number, digits = 2) => value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const between = (value: string, start: string, end: string) => value >= start && value <= end;

type ExplanationResponse = {
  mode: "generative" | "deterministic";
  model?: string;
  explanation: OperationalExplanation;
};

type Props = {
  data: HysterData;
  assetFilter?: string;
  cardFilter?: string;
  dateFrom: string;
  dateTo: string;
  initialInsightId?: string;
  onRegisterAction: (insight: OperationalAIInsight) => void;
};

function plainInsight(insight: OperationalAIInsight) {
  if (insight.category === "safety") return `${insight.relatedEvents.impacts} impacto(s) registrado(s) neste contexto.`;
  if (insight.category === "reliability") return `${insight.relatedEvents.faults} registro(s) de falha apareceram juntos em um comportamento diferente do habitual.`;
  if (insight.category === "multivariate") return "Vários sinais mudaram juntos de uma forma pouco comum para este equipamento.";
  const phrases: string[] = [];
  if (insight.evidence.some((item) => item.metric === "idlePct" && item.zScore > 0)) phrases.push("ociosidade acima do habitual");
  if (insight.evidence.some((item) => item.metric === "waitPct" && item.zScore > 0)) phrases.push("espera acima do habitual");
  if (insight.evidence.some((item) => item.metric === "workPct" && item.zScore < 0)) phrases.push("trabalho abaixo do habitual");
  return phrases.length ? `O Pulso encontrou ${phrases.join(" e ")}.` : "O comportamento ficou diferente do padrão habitual deste equipamento.";
}

function whyItMatters(insight: OperationalAIInsight) {
  if (insight.category === "safety") return "Um impacto merece revisão porque o contexto pode envolver rota, piso, carga, condição do equipamento ou condução. O evento sozinho não explica a causa.";
  if (insight.category === "reliability") return "Falhas concentradas podem afetar disponibilidade; cruzar recorrência e manutenção ajuda a decidir se existe algo a tratar.";
  return "Uma mudança de comportamento pode refletir demanda, fila, rota, liberação de área ou condição do equipamento. O Pulso ajuda a reduzir o tempo gasto procurando onde olhar primeiro.";
}

function orientation(insight: OperationalAIInsight) {
  if (insight.category === "safety") return "Revise o evento com operação e segurança. Confira rota, piso, carga e condição do equipamento antes de concluir a causa.";
  if (insight.category === "reliability") return "Confira recorrência, histórico de manutenção e condição do equipamento. Só depois decida se é necessário abrir uma corretiva.";
  if (insight.category === "multivariate") return "Converse com a operação para entender o que mudou no dia e acompanhe os próximos turnos comparáveis.";
  return "Valide demanda, filas, abastecimento, liberação de área, rota e condição do equipamento. Se o comportamento persistir, registre uma ação para acompanhar o resultado.";
}

export default function OperationalAIPanel({ data, assetFilter = "all", cardFilter = "all", dateFrom, dateTo, initialInsightId, onRegisterAction }: Props) {
  const analysis = useMemo(() => analyzeOperationalAI(data), [data]);
  const filtered = useMemo(() => analysis.insights.filter((insight) =>
    between(insight.date, dateFrom, dateTo) &&
    (assetFilter === "all" || insight.assetId === assetFilter) &&
    (cardFilter === "all" || insight.relatedCardCodes.includes(cardFilter))
  ), [analysis.insights, assetFilter, cardFilter, dateFrom, dateTo]);

  const [selectedId, setSelectedId] = useState<string>();
  const [explanation, setExplanation] = useState<ExplanationResponse>();
  const [explanationError, setExplanationError] = useState("");
  const selected = useMemo(() => filtered.find((item) => item.id === selectedId) ?? filtered.find((item) => item.id === initialInsightId) ?? filtered[0], [filtered, initialInsightId, selectedId]);

  useEffect(() => {
    setSelectedId(initialInsightId && filtered.some((item) => item.id === initialInsightId) ? initialInsightId : filtered[0]?.id);
  }, [assetFilter, cardFilter, dateFrom, dateTo, data.operationId, initialInsightId]);

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
        if (!response.ok) throw new Error("Não foi possível gerar a explicação deste contexto.");
        return response.json() as Promise<ExplanationResponse>;
      })
      .then(setExplanation)
      .catch((error: Error) => {
        if (error.name !== "AbortError") setExplanationError(error.message);
      });
    return () => controller.abort();
  }, [selected]);

  return <section className="aiWorkspace humanAI">
    <aside className="aiQueue">
      <div className="sectionHeading"><div><span className="sectionEyebrow">FILA DE INVESTIGAÇÃO</span><h3>Onde olhar primeiro</h3></div><BrainCircuit size={22} /></div>
      <p className="mutedCopy">A fila mostra situações diferentes do comportamento habitual. Ela não é previsão de pane nem ranking de operador.</p>
      <div className="aiInsightList">
        {filtered.slice(0, 40).map((insight) => <button className={selected?.id === insight.id ? "selected" : ""} key={insight.id} onClick={() => setSelectedId(insight.id)}>
          <span className={`priorityPill ${insight.priority}`}>{insight.priority === "high" ? "Alta" : "Atenção"}</span>
          <div><strong>{insight.assetId} · {insight.date}</strong><p>{plainInsight(insight)}</p><small>{insight.relatedCardCodes.length ? `Cartão(ões): ${insight.relatedCardCodes.join(", ")}` : "Sem cartão associado no evento"}</small></div>
          <ChevronRight size={17} />
        </button>)}
        {!filtered.length && <div className="quietState">Nenhuma situação foi priorizada neste contexto. Isso não certifica a saúde da operação.</div>}
      </div>
    </aside>

    <article className="aiDetail humanDetail">
      {!selected && <div className="quietState large">Ajuste os filtros para consultar outro período, equipamento ou cartão.</div>}
      {selected && <>
        <div className="detailTopline"><span className={`priorityPill ${selected.priority}`}>{selected.priority === "high" ? "Alta atenção" : "Atenção"}</span><span>{selected.assetId} · {selected.date}</span></div>
        <h2>{plainInsight(selected)}</h2>

        <section className="decisionFlow">
          <article><span>1 · O que aconteceu</span><p>{plainInsight(selected)}</p></article>
          <article><span>2 · Por que importa</span><p>{whyItMatters(selected)}</p></article>
          <article><span>3 · O que verificar</span><p>{orientation(selected)}</p></article>
        </section>

        <article className="copilotExplanation">
          <div className="cardTitle"><Sparkles size={18} /> Leitura do copiloto</div>
          {!explanation && !explanationError && <p>Organizando as evidências em uma explicação simples…</p>}
          {explanationError && <p>{explanationError}</p>}
          {explanation && <><h3>{explanation.explanation.headline}</h3><p>{explanation.explanation.explanation}</p><p><strong>Por que vale olhar:</strong> {explanation.explanation.whyItMatters}</p><small>{explanation.explanation.uncertainty}</small></>}
        </article>

        <section className="actionDecision">
          <div><span className="sectionEyebrow">PRÓXIMA AÇÃO</span><h3>Valide em campo e registre o que foi decidido</h3><p>{orientation(selected)}</p><small>A associação de cartão com equipamento ou evento não comprova responsabilidade individual.</small></div>
          <button className="primaryAction" onClick={() => onRegisterAction(selected)}><CheckCircle2 size={17} /> Registrar ação</button>
        </section>

        <article className="contextEvidence">
          <div className="cardTitle"><ShieldCheck size={18} /> Contexto disponível</div>
          <div className="contextFacts"><span><strong>{selected.relatedEvents.impacts}</strong> impacto(s)</span><span><strong>{selected.relatedEvents.faults}</strong> falha(s)</span><span><strong>{selected.relatedCardCodes.length}</strong> cartão(ões) associado(s)</span></div>
        </article>

        <details className="technicalDetails">
          <summary><Microscope size={17} /> Ver detalhes técnicos da detecção</summary>
          <p>Esta seção existe para auditoria e análise técnica. O usuário não precisa interpretar desvio padrão ou Isolation Forest para decidir o próximo passo.</p>
          <div className="hysterTable"><table><thead><tr><th>Métrica</th><th>Atual</th><th>Referência</th><th>Desvio técnico</th></tr></thead><tbody>{selected.evidence.map((item) => <tr key={item.metric}><th>{item.label}</th><td>{fmt(item.current)} {item.unit}</td><td>{fmt(item.mean)} {item.unit}</td><td>{item.zScore >= 0 ? "+" : ""}{fmt(item.zScore)}σ</td></tr>)}</tbody></table></div>
          <p><strong>Segunda camada:</strong> {selected.multivariate.explanation}</p>
          <p><small>Baseline: {selected.baselineSamples} registros anteriores do mesmo equipamento · janela de {selected.lookbackDays} dias · percentil multivariado {Math.round(selected.multivariate.percentile * 100)}%.</small></p>
        </details>
      </>}
    </article>
  </section>;
}
