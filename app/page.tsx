"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  ChevronRight,
  CircleGauge,
  Fuel,
  Gauge,
  HardHat,
  HeartPulse,
  Info,
  Leaf,
  ShieldCheck,
  Sparkles,
  Wrench
} from "lucide-react";
import type { Insight, InsightCategory } from "@/lib/telemetry";

type ApiPayload = {
  mode: string;
  generatedAt: string;
  source: { type: string; vendorReference: string; disclaimer: string };
  fleet: Array<{ assetId: string; capacity: string; status: string }>;
  summary: {
    assets: number;
    healthyAssets: number;
    activeInsights: number;
    criticalInsights: number;
    potentialSavingsLitersPerShift: number;
  };
  insights: Insight[];
};

const categoryLabel: Record<InsightCategory, string> = {
  efficiency: "Eficiência",
  mechanical: "Mecânica",
  safety: "Segurança",
  maintenance: "Manutenção"
};

const categoryIcon: Record<InsightCategory, React.ReactNode> = {
  efficiency: <Fuel size={17} />,
  mechanical: <HeartPulse size={17} />,
  safety: <ShieldCheck size={17} />,
  maintenance: <Wrench size={17} />
};

const severityLabel = {
  attention: "Atenção",
  high: "Alta",
  critical: "Crítica"
} as const;

export default function Home() {
  const [data, setData] = useState<ApiPayload | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  const [filter, setFilter] = useState<"all" | InsightCategory>("all");
  const [view, setView] = useState<"manager" | "operator">("manager");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/telemetry")
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar telemetria");
        return response.json();
      })
      .then((payload: ApiPayload) => {
        setData(payload);
        setSelectedId(payload.insights[0]?.id);
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    return filter === "all" ? data.insights : data.insights.filter((item) => item.category === filter);
  }, [data, filter]);

  const selected = useMemo(() => {
    if (!data) return undefined;
    return data.insights.find((item) => item.id === selectedId) ?? filtered[0] ?? data.insights[0];
  }, [data, filtered, selectedId]);

  if (error) {
    return (
      <main className="loadingPage">
        <AlertTriangle size={30} />
        <h1>Não foi possível carregar o MVP</h1>
        <p>{error}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="loadingPage">
        <BrainCircuit className="pulse" size={34} />
        <h1>Analisando telemetria…</h1>
        <p>Comparando ativos, turnos e padrões operacionais.</p>
      </main>
    );
  }

  return (
    <main className="pageShell">
      <header className="hero">
        <div>
          <div className="eyebrow">TECH4CHANGE 2026 · GRUPO 26</div>
          <h1>Copiloto <span>Operacional AI</span></h1>
          <p>A máquina gera dados. A IA encontra o padrão. O ser humano decide.</p>
        </div>
        <div className="heroActions">
          <div className="live"><span /> telemetria conectada</div>
          <div className="viewToggle" aria-label="Alternar visão">
            <button className={view === "manager" ? "active" : ""} onClick={() => setView("manager")}>Gestor</button>
            <button className={view === "operator" ? "active" : ""} onClick={() => setView("operator")}>Operador</button>
          </div>
        </div>
      </header>

      <section className="trustBanner">
        <ShieldCheck size={19} />
        <div>
          <strong>IA como copiloto, não como juiz.</strong>
          <span>Os alertas mostram evidências e hipóteses. A decisão final continua humana.</span>
        </div>
      </section>

      {view === "manager" ? (
        <>
          <section className="kpiGrid">
            <article className="kpiCard">
              <div className="kpiIcon"><Gauge size={20} /></div>
              <div><span>Ativos monitorados</span><strong>{data.summary.assets}</strong><small>{data.summary.healthyAssets} sem desvio relevante</small></div>
            </article>
            <article className="kpiCard">
              <div className="kpiIcon"><Sparkles size={20} /></div>
              <div><span>Insights ativos</span><strong>{data.summary.activeInsights}</strong><small>{data.summary.criticalInsights} prioridade crítica</small></div>
            </article>
            <article className="kpiCard">
              <div className="kpiIcon"><Fuel size={20} /></div>
              <div><span>Economia identificada</span><strong>{data.summary.potentialSavingsLitersPerShift} L</strong><small>por turno no caso detectado</small></div>
            </article>
            <article className="kpiCard">
              <div className="kpiIcon"><Leaf size={20} /></div>
              <div><span>Foco do copiloto</span><strong>4 frentes</strong><small>eficiência · segurança · máquina · manutenção</small></div>
            </article>
          </section>

          <section className="workspace">
            <aside className="insightsPane">
              <div className="sectionHeading">
                <div><span className="sectionEyebrow">PRIORIZAÇÃO</span><h2>O que merece atenção agora</h2></div>
                <CircleGauge size={24} />
              </div>

              <div className="filterRow">
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos</button>
                <button className={filter === "efficiency" ? "active" : ""} onClick={() => setFilter("efficiency")}>Eficiência</button>
                <button className={filter === "safety" ? "active" : ""} onClick={() => setFilter("safety")}>Segurança</button>
                <button className={filter === "mechanical" ? "active" : ""} onClick={() => setFilter("mechanical")}>Mecânica</button>
                <button className={filter === "maintenance" ? "active" : ""} onClick={() => setFilter("maintenance")}>Manutenção</button>
              </div>

              <div className="insightList">
                {filtered.map((insight) => (
                  <button
                    key={insight.id}
                    className={`insightCard ${selected?.id === insight.id ? "selected" : ""}`}
                    onClick={() => setSelectedId(insight.id)}
                  >
                    <div className={`severityDot ${insight.severity}`} />
                    <div className="insightBody">
                      <div className="insightMeta">
                        <span className={`severityBadge ${insight.severity}`}>{severityLabel[insight.severity]}</span>
                        <span>{categoryIcon[insight.category]} {categoryLabel[insight.category]}</span>
                      </div>
                      <strong>{insight.assetId} · {insight.title}</strong>
                      <p>{insight.summary}</p>
                      {insight.operatorId && <small>Concentração: {insight.operatorId}</small>}
                    </div>
                    <ChevronRight size={18} />
                  </button>
                ))}
              </div>
            </aside>

            {selected && (
              <section className="detailPane">
                <div className="detailHeader">
                  <div>
                    <div className="detailBadges">
                      <span className={`severityBadge ${selected.severity}`}>{severityLabel[selected.severity]}</span>
                      <span className="categoryBadge">{categoryIcon[selected.category]} {categoryLabel[selected.category]}</span>
                    </div>
                    <h2>{selected.assetId}</h2>
                    <p>{selected.title}</p>
                  </div>
                  <div className="scoreRing"><strong>{selected.score}</strong><span>score</span></div>
                </div>

                <article className="aiConclusion">
                  <div className="aiTitle"><BrainCircuit size={20} /> <strong>Leitura do copiloto</strong></div>
                  <p>{selected.probableCause}</p>
                </article>

                <div className="detailGrid">
                  <article className="detailCard">
                    <div className="cardTitle"><Activity size={18} /> Evidências</div>
                    <ul>
                      {selected.evidence.map((evidence) => <li key={evidence}>{evidence}</li>)}
                    </ul>
                  </article>

                  <article className="detailCard actionCard">
                    <div className="cardTitle"><HardHat size={18} /> Próxima ação</div>
                    <p>{selected.recommendedAction}</p>
                    <div className="humanControl"><CheckCircle2 size={16} /> Recomendação sujeita à validação humana</div>
                  </article>
                </div>

                {selected.potentialSavingsLitersPerShift && (
                  <article className="impactCard">
                    <Fuel size={21} />
                    <div><span>Oportunidade estimada</span><strong>{selected.potentialSavingsLitersPerShift} L de combustível / turno</strong></div>
                    <small>Estimativa calculada pela diferença para o baseline sintético do ativo.</small>
                  </article>
                )}
              </section>
            )}
          </section>
        </>
      ) : (
        <section className="operatorView">
          <div className="operatorHero">
            <div className="avatar"><HardHat size={28} /></div>
            <div><span>MEU TURNO · OP-042</span><h2>Seu copiloto de operação</h2><p>Feedback para ajudar você a operar com mais segurança e eficiência.</p></div>
            <div className="operatorScore"><strong>88</strong><span>desempenho</span></div>
          </div>

          <div className="coachGrid">
            <article className="coachCard positive">
              <CheckCircle2 size={23} />
              <div><span>Você evoluiu</span><strong>Segurança estável</strong><p>Nenhum impacto ou sobrecarga no período analisado.</p></div>
            </article>
            <article className="coachCard focus">
              <Fuel size={23} />
              <div><span>Oportunidade</span><strong>Reduza tempo ocioso</strong><p>Seu turno teve 32% de idle contra 22% do histórico do equipamento.</p></div>
            </article>
            <article className="coachCard neutral">
              <Activity size={23} />
              <div><span>Próxima meta</span><strong>3 turnos de acompanhamento</strong><p>O copiloto mede a tendência depois da orientação para reconhecer sua evolução.</p></div>
            </article>
          </div>

          <article className="coachMessage">
            <Sparkles size={22} />
            <div><strong>Recomendação personalizada</strong><p>{data.insights.find((item) => item.operatorId === "OP-042")?.humanMessage}</p></div>
          </article>

          <article className="privacyCard">
            <ShieldCheck size={20} />
            <div><strong>Transparência por design</strong><p>O MVP não toma decisão disciplinar automática. Contexto da rota, máquina, planejamento e histórico também precisam ser avaliados.</p></div>
          </article>
        </section>
      )}

      <footer className="dataFooter">
        <Info size={16} />
        <p><strong>Demo auditável:</strong> {data.source.disclaimer} Referência conceitual: {data.source.vendorReference}.</p>
      </footer>
    </main>
  );
}
