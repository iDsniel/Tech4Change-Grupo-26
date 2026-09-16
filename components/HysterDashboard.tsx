"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Database,
  Gauge,
  Settings2,
  Sparkles,
  Truck,
  UsersRound
} from "lucide-react";
import { analyzeHyster, validateHyster } from "@/lib/hyster";
import { analyzeOperationalAI, type OperationalAIInsight } from "@/lib/operationalAI";
import { addDataset, combineDatasets, emptyWorkspace, validateWorkspace, type Workspace } from "@/lib/operations";
import { readWorkspace, saveWorkspace } from "@/lib/operationsStorage";
import OperationsConsole from "./OperationsConsole";
import WorkforceCards from "./WorkforceCards";
import OperationalAIPanel from "./OperationalAIPanel";
import "./hyster.css";

const fmt = (value: number | null | undefined, digits = 2) => value == null ? "Sem dados" : value.toLocaleString("pt-BR", { maximumFractionDigits: digits });

type ViewKey = "summary" | "fleet" | "ai" | "cards" | "orders" | "base";

const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "summary", label: "Resumo", icon: <Activity size={17} /> },
  { key: "fleet", label: "Frota", icon: <Truck size={17} /> },
  { key: "ai", label: "Desvios", icon: <BrainCircuit size={17} /> },
  { key: "cards", label: "Cartões", icon: <UsersRound size={17} /> },
  { key: "orders", label: "Ordens", icon: <ClipboardList size={17} /> },
  { key: "base", label: "Base", icon: <Database size={17} /> }
];

const containsHistoricalDataset = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if ("legacy" in record || "historical2023" in record) return true;
  const datasets = Array.isArray(record.datasets) ? record.datasets : [];
  return datasets.some((item) => !!item && typeof item === "object" && ("legacy" in (item as Record<string, unknown>) || "historical2023" in (item as Record<string, unknown>)));
};

export default function HysterDashboard() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [view, setView] = useState<ViewKey>("summary");
  const [suggestion, setSuggestion] = useState<{ assetId: string; title: string }>();
  const [month, setMonth] = useState("all");
  const [asset, setAsset] = useState("all");
  const [error, setError] = useState("");
  const [focusInsightId, setFocusInsightId] = useState<string>();

  const data = useMemo(() => combineDatasets(workspace.datasets), [workspace.datasets]);
  const report = useMemo(() => data ? analyzeHyster(data, month, asset) : null, [data, month, asset]);
  const ai = useMemo(() => data ? analyzeOperationalAI(data) : null, [data]);
  const filteredAI = useMemo(() => ai?.insights.filter((insight) =>
    (asset === "all" || insight.assetId === asset) && (month === "all" || insight.date.startsWith(month))
  ) ?? [], [ai, asset, month]);
  const summarySelected = filteredAI.find((item) => item.id === focusInsightId) ?? filteredAI[0];

  useEffect(() => {
    readWorkspace()
      .then((loaded) => {
        setWorkspace(loaded);
        setReady(true);
        setSaved("Base recuperada deste navegador.");
      })
      .catch((cause: Error) => {
        setError(cause.message);
        setReady(true);
      });
  }, []);

  async function save(next: Workspace) {
    setBusy(true);
    try {
      await saveWorkspace(next);
      setWorkspace(next);
      setSaved("Alterações salvas neste navegador.");
    } finally {
      setBusy(false);
    }
  }

  function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(workspace)], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `Pulso-gestao-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error("Backup excede 50 MB.");
      const raw = JSON.parse(await file.text());
      if (containsHistoricalDataset(raw)) throw new Error("Este backup contém dados fora da operação atual.");
      const restored = validateWorkspace(raw);
      if (!window.confirm("Restaurar este backup substituirá a gestão salva neste navegador. Exporte o backup atual antes de continuar.")) return;
      await save(restored);
      setError("");
      setMonth("all");
      setAsset("all");
      setView("summary");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Limite de 20 MB por arquivo.");
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      if (containsHistoricalDataset(raw)) throw new Error("A base contém dados fora da operação atual.");
      const parsed = validateHyster(raw);
      await save(addDataset(workspace, parsed));
      setMonth("all");
      setAsset("all");
      setView("summary");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Arquivo inválido");
    }
  }

  function registerAIAction(insight: OperationalAIInsight) {
    setSuggestion({ assetId: insight.assetId, title: `Investigar ${insight.title.toLowerCase()} · ${insight.date}` });
    setView("orders");
  }

  function openInsight(insight: OperationalAIInsight) {
    setFocusInsightId(insight.id);
    setView("ai");
  }

  const latest = workspace.datasets.at(-1);
  const today = new Date().toISOString().slice(0, 10);
  const openOrders = workspace.orders.filter((order) => order.status === "open" || order.status === "in_progress");
  const overdueOrders = openOrders.filter((order) => order.dueDate < today).length;
  const highInsights = filteredAI.filter((item) => item.priority === "high").length;

  return <main className="pageShell hyster">
    <header className="pulsoHeader">
      <div className="pulsoBrand">
        <div className="pulsoMark"><Sparkles size={20} /></div>
        <div><span>Copiloto Operacional AI</span><h1>Pulso</h1></div>
      </div>
      <div className="pulsoHeaderMeta">
        {data ? <><span className="sourceBadge">Dados reais</span><span><CalendarRange size={15} /> {data.periodStart} → {data.periodEnd}</span><span><Truck size={15} /> {data.assets.length} equipamentos</span></> : <span className="sourceBadge muted">Aguardando base</span>}
        <a className="demoLink" href="/">Ver demo sintética</a>
        <button className="iconAction" onClick={() => setView("base")} aria-label="Gerenciar base"><Settings2 size={18} /></button>
      </div>
    </header>

    {error && <div className="inlineAlert" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}

    {!data && <section className="emptyState">
      <div className="emptyIcon"><Database size={26} /></div><span className="sectionEyebrow">COMEÇAR</span><h2>Carregue a operação para ativar o Pulso</h2>
      <p>Uma única importação alimenta frota, cartões, eventos, ordens e o motor de IA. O arquivo deve conter somente o período operacional atual.</p>
      <label className="primaryUpload">Importar base operacional JSON<input disabled={!ready || busy} aria-label="Selecionar base operacional JSON" type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label>
      <small>{!ready ? "Recuperando dados locais…" : busy ? "Salvando…" : "Persistência local ao navegador nesta etapa."}</small>
    </section>}

    {data && report && ai && <>
      <nav className="productNav" aria-label="Navegação do Pulso">{navItems.map((item) => <button key={item.key} aria-current={view === item.key ? "page" : undefined} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>{item.icon}<span>{item.label}</span>{item.key === "ai" && highInsights > 0 && <em>{highInsights}</em>}</button>)}</nav>

      {(view === "summary" || view === "fleet" || view === "ai") && <section className="contextBar">
        <div className="contextIntro"><span className="sectionEyebrow">CONTEXTO ATIVO</span><strong>{asset === "all" ? "Toda a frota" : asset}</strong><small>{month === "all" ? "Todo o período" : month}</small></div>
        <div className="compactFilters"><label>Período<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">Todo o período</option>{report.months.map((item) => <option key={item.month}>{item.month}</option>)}</select></label><label>Equipamento<select value={asset} onChange={(event) => setAsset(event.target.value)}><option value="all">Toda a frota</option>{data.assets.map((item) => <option key={item.assetId}>{item.assetId}</option>)}</select></label></div>
      </section>}

      {view === "summary" && <>
        <section className="pageIntro"><div><span className="sectionEyebrow">RESUMO EXECUTIVO</span><h2>Como está a operação</h2><p>Os dados são consolidados primeiro; a IA prioriza exceções depois. Nenhum insight representa diagnóstico ou decisão automática.</p></div><button className="secondaryAction" onClick={() => setView("ai")}><BrainCircuit size={17} /> Abrir investigação</button></section>

        <section className="managementKpis">
          <article><span>Chave ligada</span><strong>{fmt(report.totals.key)} h</strong><small>{report.totals.records} registros equipamento-dia</small></article>
          <article><span>Trabalho registrado</span><strong>{fmt(report.totals.work)} h</strong><small>{fmt(report.totals.workPct)}% da chave</small></article>
          <article><span>Ociosidade / chave</span><strong>{fmt(report.totals.idlePct)}%</strong><small>{fmt(report.totals.idle)} h registradas</small></article>
          <article className={highInsights ? "attentionKpi" : ""}><span>Desvios priorizados</span><strong>{filteredAI.length}</strong><small>{highInsights} de alta atenção</small></article>
          <article><span>Ordens abertas</span><strong>{openOrders.length}</strong><small>{overdueOrders ? `${overdueOrders} vencida(s)` : "nenhuma vencida"}</small></article>
        </section>

        <section className="priorityWorkspace">
          <aside className="priorityListPane"><div className="sectionHeading"><div><span className="sectionEyebrow">PRIORIDADES</span><h3>O que merece atenção agora</h3></div><Gauge size={22} /></div><div className="priorityList">
            {filteredAI.slice(0, 5).map((insight) => <button key={insight.id} className={summarySelected?.id === insight.id ? "selected" : ""} onClick={() => setFocusInsightId(insight.id)}><span className={`priorityPill ${insight.priority}`}>{insight.priority === "high" ? "Alta" : "Atenção"}</span><div><strong>{insight.assetId} · {insight.date}</strong><p>{insight.title}</p><small>Evidência {insight.evidenceStrength}/100 · IF {insight.multivariate.agreement}</small></div><ChevronRight size={17} /></button>)}
            {!filteredAI.length && <div className="quietState">Nenhum contexto foi priorizado neste filtro. Isso não certifica a saúde da frota.</div>}
          </div></aside>
          <article className="priorityDetailPane">{summarySelected ? <><div className="detailTopline"><span className={`priorityPill ${summarySelected.priority}`}>{summarySelected.priority === "high" ? "Alta atenção" : "Atenção"}</span><span>{summarySelected.assetId} · {summarySelected.date}</span></div><h3>{summarySelected.title}</h3><p className="leadCopy">{summarySelected.summary}</p><div className="evidenceStrip"><div><span>Força da evidência</span><strong>{summarySelected.evidenceStrength}/100</strong></div><div><span>Isolation Forest</span><strong>{Math.round(summarySelected.multivariate.percentile * 100)}º pct.</strong></div><div><span>Eventos no contexto</span><strong>{summarySelected.relatedEvents.faults + summarySelected.relatedEvents.impacts}</strong></div></div><div className="recommendedNext"><span>Ação recomendada</span><p>{summarySelected.recommendation}</p></div><div className="detailActions"><button className="primaryAction" onClick={() => openInsight(summarySelected)}>Ver investigação completa</button><button className="secondaryAction" onClick={() => registerAIAction(summarySelected)}>Registrar ação</button></div><small className="guardrailCopy">{summarySelected.uncertainty}</small></> : <div className="quietState large">Selecione um contexto para ver evidências e próxima ação.</div>}</article>
        </section>

        <section className="summaryGrid">
          <article className="surfaceCard"><div className="sectionHeading"><div><span className="sectionEyebrow">FROTA</span><h3>Uso e exceções por equipamento</h3></div><button className="textAction" onClick={() => setView("fleet")}>Ver frota</button></div><div className="hysterTable compactTable"><table><thead><tr><th>Ativo</th><th>Chave</th><th>Ociosidade</th><th>Falhas</th><th>Impactos</th><th>Insights</th></tr></thead><tbody>{report.assets.map((item) => <tr key={item.assetId}><th>{item.assetId}</th><td>{fmt(item.key)} h</td><td>{fmt(item.idlePct)}%</td><td>{item.faults}</td><td>{item.impacts}</td><td>{filteredAI.filter((insight) => insight.assetId === item.assetId).length}</td></tr>)}</tbody></table></div></article>
          <article className="surfaceCard"><div className="sectionHeading"><div><span className="sectionEyebrow">EVOLUÇÃO</span><h3>Ociosidade ao longo do período</h3></div><Gauge size={21} /></div><div className="trendList">{report.months.map((item) => <div key={item.month}><div><span>{item.month}</span><strong>{fmt(item.idlePct)}%</strong></div><div className="trendTrack"><span style={{ width: `${Math.min(100, Math.max(0, item.idlePct ?? 0))}%` }} /></div><small>{fmt(item.key)} h de chave</small></div>)}</div></article>
        </section>
      </>}

      {view === "fleet" && <section className="contentSection"><div className="pageIntro"><div><span className="sectionEyebrow">FROTA</span><h2>Compare ativos, depois investigue o contexto</h2><p>A ordenação ajuda a encontrar exceções operacionais; não representa ranking humano nem diagnóstico.</p></div></div><article className="surfaceCard"><div className="hysterTable fleetTable"><table><thead><tr><th>Equipamento</th><th>Chave (h)</th><th>Trabalho (h)</th><th>Ocioso (h)</th><th>Ocioso/chave</th><th>Falhas</th><th>Impactos</th><th>Insights</th><th></th></tr></thead><tbody>{report.assets.map((item) => { const count = ai.insights.filter((insight) => insight.assetId === item.assetId && (month === "all" || insight.date.startsWith(month))).length; return <tr key={item.assetId}><th>{item.assetId}</th><td>{fmt(item.key)}</td><td>{fmt(item.work)}</td><td>{fmt(item.idle)}</td><td>{fmt(item.idlePct)}%</td><td>{item.faults}</td><td>{item.impacts}</td><td>{count}</td><td><button className="rowAction" onClick={() => { setAsset(item.assetId); setView("ai"); }}>Investigar</button></td></tr>; })}</tbody></table></div></article><section className="summaryGrid"><article className="surfaceCard"><span className="sectionEyebrow">TELEMETRIA DO PERÍODO</span><h3>Indicadores complementares</h3><p>Movimento, hidráulica e elevação permanecem no período completo da extração; não são rateados artificialmente pelo filtro mensal.</p><div className="hysterTable compactTable"><table><thead><tr><th>Ativo</th><th>Movimento</th><th>Hidráulica</th><th>Elevação</th></tr></thead><tbody>{latest?.kpi.filter((item) => asset === "all" || item.assetId === asset).map((item) => <tr key={item.assetId}><th>{item.assetId}</th><td>{item.motionHours === undefined ? "n/d" : `${fmt(item.motionHours)} h`}</td><td>{item.hydraulicHours === undefined ? "n/d" : `${fmt(item.hydraulicHours)} h`}</td><td>{item.liftHours === undefined ? "n/d" : `${fmt(item.liftHours)} h`}</td></tr>)}</tbody></table></div></article><article className="surfaceCard"><span className="sectionEyebrow">LEITURA</span><h3>Como interpretar</h3><p>Diferenças de uso precisam de contexto de demanda, escala, rota e função. Dias ausentes permanecem desconhecidos e não viram zero.</p><div className="callout"><BrainCircuit size={19} /><span>O motor de IA aprende o histórico do próprio equipamento e prioriza contextos que merecem investigação.</span></div></article></section></section>}

      {view === "ai" && <OperationalAIPanel data={data} assetFilter={asset} monthFilter={month} initialInsightId={focusInsightId} onRegisterAction={registerAIAction} />}
      {view === "cards" && <section className="contentSection"><div className="pageIntro"><div><span className="sectionEyebrow">CARTÕES</span><h2>Contexto de uso sem ranking individual</h2><p>Associação de cartão com equipamento ou evento não comprova responsabilidade individual.</p></div></div><WorkforceCards data={data} workspace={workspace} /></section>}
      {view === "orders" && <section className="contentSection"><div className="pageIntro"><div><span className="sectionEyebrow">EXECUÇÃO</span><h2>Ordens e acompanhamento</h2><p>Transforme evidência em investigação, registre a decisão humana e acompanhe o que ocorreu depois.</p></div></div><OperationsConsole tab="maintenance" workspace={workspace} data={data} save={save} busy={busy} suggestion={suggestion} /></section>}

      {view === "base" && <section className="contentSection basePage"><div className="pageIntro"><div><span className="sectionEyebrow">BASE</span><h2>Dados, qualidade e persistência</h2><p>Funções administrativas ficam fora da visão executiva para não competir com a operação.</p></div></div><section className="baseGrid"><article className="surfaceCard baseActions"><h3>Base operacional</h3><p><strong>{data.periodStart} → {data.periodEnd}</strong><br />{data.assets.length} equipamentos · {data.sources.length} fontes registradas</p><label className="primaryUpload">Importar nova base JSON<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label><button className="secondaryAction" disabled={!ready || busy} onClick={backup}>Exportar backup</button><label className="secondaryUpload">Restaurar backup<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void restore(event.target.files?.[0])} /></label><small role="status">{!ready ? "Recuperando…" : busy ? "Salvando…" : saved}</small></article><article className="surfaceCard"><h3>Qualidade observada</h3><ul className="qualityList"><li><strong>{report.quality.waitAboveIdle}</strong><span>registros com espera maior que ociosidade</span></li><li><strong>{report.quality.nonAdditive}</strong><span>registros com contadores não aditivos</span></li><li><strong>{data.fuel.every((item) => item.reportedLiters === 0) ? "n/d" : "ok"}</strong><span>combustível validado</span></li><li><strong>{data.maintenanceAvailable ? "sim" : "não"}</strong><span>manutenção detalhada na origem</span></li></ul><p className="mutedCopy">O Pulso não preenche dias ausentes, não inventa economia e não transforma ausência em zero.</p></article></section><article className="surfaceCard"><h3>Fontes da operação</h3><div className="sourceList">{data.sources.map((source) => <details key={source.sha256}><summary>{source.file}</summary><code>{source.sha256}</code><p>{source.sheets.map((sheet) => `${sheet.name} · ${sheet.rows} linhas`).join(" · ")}</p></details>)}</div></article><article className="surfaceCard"><h3>Dados complementares e apontamentos</h3><p>Planejamento, parada, combustível, custo e produção inseridos pela gestão continuam locais neste navegador.</p><OperationsConsole tab="inputs" workspace={workspace} data={data} save={save} busy={busy} suggestion={suggestion} /></article><article className="surfaceCard roadmapCard"><h3>Persistência compartilhada · próximo estágio</h3><p>Backend autenticado, banco central, autorização por perfil, auditoria, sincronização multiusuário e backup central permanecem documentados como roadmap. Esta etapa continua local ao navegador.</p></article></section>}
    </>}
  </main>;
}
