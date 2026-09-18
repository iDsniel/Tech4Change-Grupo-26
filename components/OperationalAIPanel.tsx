"use client";

import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, CheckCircle2, ChevronRight, Microscope, ShieldCheck, Sparkles } from "lucide-react";
import type { HysterData } from "@/lib/hyster";
import type { DailyInput, WorkOrder } from "@/lib/operations";
import {
  analyzeOperationalAI,
  operationalExplanationPacket,
  type OperationalAIInsight
} from "@/lib/operationalAI";
import { analyzeWorkforceProfiles } from "@/lib/workforceProfile";
import { buildOperationalContext } from "@/lib/operationalContext";
import type { OperationalExplanation } from "@/lib/operationalExplanation";

const fmt = (value: number | null | undefined) => value == null ? "n/d" : Math.round(value).toLocaleString("pt-BR");
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
  orders?: WorkOrder[];
  inputs?: DailyInput[];
  onRegisterAction: (insight: OperationalAIInsight) => void;
};

function plainInsight(insight: OperationalAIInsight) {
  if (insight.category === "safety") return `${insight.relatedEvents.impacts} impacto(s) registrado(s) neste contexto.`;
  if (insight.category === "reliability") return `${insight.relatedEvents.faults} registro(s) de falha apareceram em um comportamento diferente do habitual.`;
  if (insight.category === "multivariate") return "Vários sinais mudaram juntos de uma forma pouco comum para este equipamento.";
  const phrases: string[] = [];
  if (insight.evidence.some((item) => item.metric === "idlePct" && item.zScore > 0)) phrases.push("tempo ocioso acima do habitual");
  if (insight.evidence.some((item) => item.metric === "waitPct" && item.zScore > 0)) phrases.push("espera acima do habitual");
  if (insight.evidence.some((item) => item.metric === "workPct" && item.zScore < 0)) phrases.push("trabalho abaixo do habitual");
  return phrases.length ? `O Pulso encontrou ${phrases.join(" e ")}.` : "O comportamento ficou diferente do padrão habitual deste equipamento.";
}

function orientation(insight: OperationalAIInsight) {
  if (insight.category === "safety") return "Revise rota, piso, carga e condição do equipamento.";
  if (insight.category === "reliability") return "Confira recorrência dos códigos de falha e condição do equipamento.";
  if (insight.category === "multivariate") return "Valide o que mudou na operação e acompanhe os próximos dias comparáveis.";
  return "Valide demanda, filas, rota, abastecimento e condição do equipamento.";
}

export default function OperationalAIPanel({ data, assetFilter = "all", cardFilter = "all", dateFrom, dateTo, initialInsightId, orders = [], inputs = [], onRegisterAction }: Props) {
  const analysis = useMemo(() => analyzeOperationalAI(data), [data]);
  const workforceProfiles = useMemo(() => analyzeWorkforceProfiles(data, cardFilter === "all" ? undefined : cardFilter, dateFrom, dateTo), [data, cardFilter, dateFrom, dateTo]);
  const filtered = useMemo(() => analysis.insights.filter((insight) =>
    between(insight.date, dateFrom, dateTo) &&
    (assetFilter === "all" || insight.assetId === assetFilter) &&
    (cardFilter === "all" || insight.relatedCardCodes.includes(cardFilter))
  ), [analysis.insights, assetFilter, cardFilter, dateFrom, dateTo]);

  const [selectedId, setSelectedId] = useState<string>();
  const [explanation, setExplanation] = useState<ExplanationResponse>();
  const [explanationError, setExplanationError] = useState("");
  const selected = useMemo(() => filtered.find((item) => item.id === selectedId) ?? filtered.find((item) => item.id === initialInsightId) ?? filtered[0], [filtered, initialInsightId, selectedId]);
  const selectedContext = useMemo(() => selected ? buildOperationalContext({ data, insight: selected, orders, inputs }) : undefined, [data, selected, orders, inputs]);
  const selectedProfile = useMemo(
    () => selected ? workforceProfiles?.profiles.find((profile) => profile.assetId === selected.assetId) : undefined,
    [selected, workforceProfiles]
  );

  useEffect(() => {
    setSelectedId(initialInsightId && filtered.some((item) => item.id === initialInsightId) ? initialInsightId : filtered[0]?.id);
  }, [assetFilter, cardFilter, dateFrom, dateTo, data.operationId, initialInsightId]);

  useEffect(() => {
    if (!selected || !selectedContext) {
      setExplanation(undefined);
      return;
    }
    const controller = new AbortController();
    setExplanation(undefined);
    setExplanationError("");
    fetch("/api/operations/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidence: { ...operationalExplanationPacket(selected), context: selectedContext } }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível gerar a leitura deste contexto.");
        return response.json() as Promise<ExplanationResponse>;
      })
      .then(setExplanation)
      .catch((error: Error) => {
        if (error.name !== "AbortError") setExplanationError(error.message);
      });
    return () => controller.abort();
  }, [selected, selectedContext]);

  return <section className="aiWorkspace humanAI">
    <aside className="aiQueue">
      <div className="sectionHeading"><div><span className="sectionEyebrow">PRIORIDADES</span><h3>Onde olhar primeiro</h3></div><BrainCircuit size={22} /></div>
      <div className="aiInsightList">
        {filtered.slice(0, 40).map((insight) => <button className={selected?.id === insight.id ? "selected" : ""} key={insight.id} onClick={() => setSelectedId(insight.id)}>
          <span className={`priorityPill ${insight.priority}`}>{insight.priority === "high" ? "Alta" : "Atenção"}</span>
          <div><strong>{insight.assetId} · {insight.date}</strong><p>{plainInsight(insight)}</p></div>
          <ChevronRight size={17} />
        </button>)}
        {!filtered.length && <div className="quietState">Nenhum sinal priorizado neste contexto.</div>}
      </div>
    </aside>

    <article className="aiDetail humanDetail">
      {!selected && <div className="quietState large">Ajuste os filtros para consultar outro contexto.</div>}
      {selected && <>
        <div className="detailTopline"><span className={`priorityPill ${selected.priority}`}>{selected.priority === "high" ? "Alta atenção" : "Atenção"}</span><span>{selected.assetId} · {selected.date}</span></div>
        <h2>{selected.title}</h2>

        <article className="copilotExplanation">
          <div className="cardTitle"><Sparkles size={18} /> Leitura do Pulso</div>
          {!explanation && !explanationError && <p>Analisando histórico, eventos e perfil operacional…</p>}
          {explanationError && <p>{plainInsight(selected)}</p>}
          {explanation && <><h3>{explanation.explanation.headline}</h3><p>{explanation.explanation.explanation}</p><p><strong>Por que importa:</strong> {explanation.explanation.whyItMatters}</p></>}
        </article>

        <article className="contextEvidence">
          <div className="cardTitle"><ShieldCheck size={18} /> Evidências</div>
          <div className="contextFacts">
            <span><strong>{fmt(selectedContext?.daily.workPct)}%</strong> trabalho/chave</span>
            <span><strong>{fmt(selectedContext?.daily.idlePct)}%</strong> ocioso/chave</span>
            <span><strong>{selected.relatedEvents.impacts}</strong> impacto(s)</span>
            <span><strong>{selected.relatedEvents.faults}</strong> falha(s)</span>
          </div>
        </article>

        {selectedContext?.monthlyTrend && <article className="contextEvidence">
          <div className="sectionHeading"><div><span className="sectionEyebrow">EVOLUÇÃO MENSAL</span><h3>{selectedContext.monthlyTrend.previousMonth ? `${selectedContext.monthlyTrend.previousMonth} → ${selectedContext.monthlyTrend.currentMonth}` : selectedContext.monthlyTrend.currentMonth}</h3></div><span className="scopeChip">Workforce mensal</span></div>
          <div className="contextFacts">
            <span><strong>{selectedContext.monthlyTrend.activity.workPct.delta == null ? "—" : `${selectedContext.monthlyTrend.activity.workPct.delta > 0 ? "+" : ""}${fmt(selectedContext.monthlyTrend.activity.workPct.delta)} p.p.`}</strong>trabalho/chave</span>
            <span><strong>{selectedContext.monthlyTrend.activity.hydraulicPct.delta == null ? "—" : `${selectedContext.monthlyTrend.activity.hydraulicPct.delta > 0 ? "+" : ""}${fmt(selectedContext.monthlyTrend.activity.hydraulicPct.delta)} p.p.`}</strong>função hidráulica</span>
            <span><strong>{selectedContext.monthlyTrend.activity.motionPct.delta == null ? "—" : `${selectedContext.monthlyTrend.activity.motionPct.delta > 0 ? "+" : ""}${fmt(selectedContext.monthlyTrend.activity.motionPct.delta)} p.p.`}</strong>movimento</span>
            <span><strong>{fmt(selectedContext.monthlyTrend.travelSafety.reverseSharePct.current)}%</strong>ré na marcha</span>
            <span><strong>{fmt(selectedContext.monthlyTrend.travelSafety.highSpeedSharePct.current)}%</strong>alta velocidade/movimento</span>
            <span><strong>{fmt(selectedContext.monthlyTrend.travelSafety.overspeedSharePct.current)}%</strong>overspeed/movimento</span>
          </div>
          <p><small>Preferência operacional informada: maior uso de ré. Alta velocidade é contexto; overspeed só é tratado como tal quando marcado pela origem. Workforce não possui hora por uso, portanto esses indicadores não são atribuídos aos turnos.</small></p>
          <p><small>Impactos no mês por turno: A {selectedContext.monthlyTrend.travelSafety.impactsByShift.A} · B {selectedContext.monthlyTrend.travelSafety.impactsByShift.B} · C {selectedContext.monthlyTrend.travelSafety.impactsByShift.C}.</small></p>
        </article>}

        {selectedProfile && <article className="contextEvidence">
          <div className="sectionHeading"><div><span className="sectionEyebrow">PERFIL OPERACIONAL</span><h3>{selectedProfile.assetId}</h3></div><span className="scopeChip">{selectedProfile.periodStart} → {selectedProfile.periodEnd}</span></div>
          <div className="contextFacts">
            {selectedProfile.signals.map((signal) => <span key={signal.metric}><strong>{fmt(signal.value)}{signal.unit === "%" ? "%" : ` ${signal.unit}`}</strong>{signal.label} · frota {fmt(signal.fleetMean)}{signal.unit === "%" ? "%" : ""}</span>)}
          </div>
        </article>}

        <section className="actionDecision">
          <div><span className="sectionEyebrow">PRÓXIMA VERIFICAÇÃO</span><h3>{orientation(selected)}</h3></div>
          <button className="primaryAction" onClick={() => onRegisterAction(selected)}><CheckCircle2 size={17} /> Registrar ação</button>
        </section>

        <details className="technicalDetails">
          <summary><Microscope size={17} /> Detalhes técnicos</summary>
          <div className="hysterTable"><table><thead><tr><th>Métrica</th><th>Atual</th><th>Histórico</th><th>28 dias</th><th>Desvio</th></tr></thead><tbody>{selected.evidence.map((item) => <tr key={item.metric}><th>{item.label}</th><td>{fmt(item.current)} {item.unit}</td><td>{fmt(item.mean)} {item.unit}</td><td>{item.recentMean == null ? "—" : `${fmt(item.recentMean)} ${item.unit}`}</td><td>{item.zScore >= 0 ? "+" : ""}{fmt(item.zScore)}σ</td></tr>)}</tbody></table></div>
          <p><small>Baseline histórico: {selected.baselineSamples} registros anteriores · janela recente: {selected.recentBaselineSamples} registros em até {selected.lookbackDays} dias · percentil multivariado {Math.round(selected.multivariate.percentile * 100)}%.</small></p>
        </details>
      </>}
    </article>
  </section>;
}
