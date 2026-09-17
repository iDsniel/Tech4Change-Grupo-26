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
  Settings2,
  Sparkles,
  Truck
} from "lucide-react";
import { analyzeHyster, validateHyster, type HysterData } from "@/lib/hyster";
import {
  analyzeOperationalAI,
  type OperationalAIInsight
} from "@/lib/operationalAI";
import { analyzeWorkforceProfiles, type WorkforceAssetProfile } from "@/lib/workforceProfile";
import { addDataset, combineDatasets, emptyWorkspace, validateWorkspace, type Workspace } from "@/lib/operations";
import { readWorkspace, saveWorkspace } from "@/lib/operationsStorage";
import OperationsConsole from "./OperationsConsole";
import OperationalAIPanel from "./OperationalAIPanel";
import "./hyster.css";

const fmt = (value: number | null | undefined) => value == null ? "n/d" : Math.round(value).toLocaleString("pt-BR");
const ratio = (numerator: number | undefined, denominator: number | undefined) => numerator != null && denominator != null && denominator > 0 ? numerator / denominator * 100 : undefined;
const between = (value: string, start: string, end: string) => value >= start && value <= end;

type ViewKey = "overview" | "investigate" | "actions" | "base";

const navItems: Array<{ key: ViewKey; label: string; icon: React.ReactNode }> = [
  { key: "overview", label: "Visão geral", icon: <Activity size={17} /> },
  { key: "investigate", label: "Investigar", icon: <BrainCircuit size={17} /> },
  { key: "actions", label: "Ações", icon: <ClipboardList size={17} /> },
  { key: "base", label: "Base", icon: <Database size={17} /> }
];

const containsHistoricalDataset = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if ("legacy" in record || "historical2023" in record) return true;
  const datasets = Array.isArray(record.datasets) ? record.datasets : [];
  return datasets.some((item) => !!item && typeof item === "object" && ("legacy" in (item as Record<string, unknown>) || "historical2023" in (item as Record<string, unknown>)));
};

function dailyTotals(rows: HysterData["daily"]) {
  const total = (key: "keyHours" | "workHours" | "idleHours" | "waitHours") => rows.reduce((sum, row) => sum + row[key], 0);
  const key = total("keyHours");
  const work = total("workHours");
  const idle = total("idleHours");
  const wait = total("waitHours");
  return { key, work, idle, wait, workPct: ratio(work, key), idlePct: ratio(idle, key), waitPct: ratio(wait, key), records: rows.length };
}

function plainInsight(insight: OperationalAIInsight) {
  if (insight.category === "safety") return `${insight.relatedEvents.impacts} impacto(s) em contexto fora do padrão.`;
  if (insight.category === "reliability") return `${insight.relatedEvents.faults} registro(s) de falha concentrados no dia.`;
  if (insight.category === "multivariate") return "Combinação operacional rara para este equipamento.";
  const phrases: string[] = [];
  if (insight.evidence.some((item) => item.metric === "idlePct" && item.zScore > 0)) phrases.push("tempo ocioso acima do padrão");
  if (insight.evidence.some((item) => item.metric === "waitPct" && item.zScore > 0)) phrases.push("espera acima do padrão");
  if (insight.evidence.some((item) => item.metric === "workPct" && item.zScore < 0)) phrases.push("trabalho abaixo do padrão");
  return phrases.length ? phrases.join(" e ") : "Comportamento diferente do histórico.";
}

function profileHeadline(profile?: WorkforceAssetProfile) {
  const signal = profile?.signals[0];
  if (!signal) return "Sem desvio relevante no perfil";
  const direction = signal.value >= signal.fleetMean ? "acima" : "abaixo";
  return `${signal.label}: ${fmt(signal.value)}${signal.unit === "%" ? "%" : ` ${signal.unit}`} · ${direction} da frota`;
}

export default function HysterDashboard() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [view, setView] = useState<ViewKey>("overview");
  const [suggestion, setSuggestion] = useState<{ assetId: string; title: string }>();
  const [asset, setAsset] = useState("all");
  const [card, setCard] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [focusInsightId, setFocusInsightId] = useState<string>();

  const data = useMemo(() => combineDatasets(workspace.datasets), [workspace.datasets]);
  const fullReport = useMemo(() => data ? analyzeHyster(data) : null, [data]);
  const ai = useMemo(() => data ? analyzeOperationalAI(data) : null, [data]);
  const workforceProfiles = useMemo(() => data ? analyzeWorkforceProfiles(data) : undefined, [data]);

  useEffect(() => {
    readWorkspace()
      .then((loaded) => {
        setWorkspace(loaded);
        setReady(true);
        setSaved("Base recuperada.");
      })
      .catch((cause: Error) => {
        setError(cause.message);
        setReady(true);
      });
  }, []);

  useEffect(() => {
    if (!data) return;
    setDateFrom((value) => value && value >= data.periodStart && value <= data.periodEnd ? value : data.periodStart);
    setDateTo((value) => value && value >= data.periodStart && value <= data.periodEnd ? value : data.periodEnd);
  }, [data?.operationId, data?.periodStart, data?.periodEnd]);

  async function save(next: Workspace) {
    setBusy(true);
    try {
      await saveWorkspace(next);
      setWorkspace(next);
      setSaved("Alterações salvas.");
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
      if (!window.confirm("Restaurar este backup substituirá a gestão salva neste navegador.")) return;
      await save(restored);
      setError("");
      setAsset("all");
      setCard("all");
      setDateFrom("");
      setDateTo("");
      setView("overview");
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
      setAsset("all");
      setCard("all");
      setDateFrom(parsed.periodStart);
      setDateTo(parsed.periodEnd);
      setView("overview");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Arquivo inválido");
    }
  }

  function registerAIAction(insight: OperationalAIInsight) {
    setSuggestion({ assetId: insight.assetId, title: `Investigar ${insight.title.toLowerCase()} · ${insight.date}` });
    setView("actions");
  }

  function openInsight(insight: OperationalAIInsight) {
    setFocusInsightId(insight.id);
    setAsset(insight.assetId);
    setView("investigate");
  }

  if (!data || !fullReport || !ai) {
    return <main className="pageShell hyster">
      <header className="pulsoHeader">
        <div className="pulsoBrand"><div className="pulsoMark"><Sparkles size={20} /></div><div><span>Copiloto Operacional AI</span><h1>Pulso</h1></div></div>
        <div className="pulsoHeaderMeta"><span className="sourceBadge muted">Aguardando base</span></div>
      </header>
      {error && <div className="inlineAlert" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}
      <section className="emptyState">
        <div className="emptyIcon"><Database size={26} /></div><h2>Importe a base operacional</h2>
        <label className="primaryUpload">Importar JSON<input disabled={!ready || busy} aria-label="Selecionar base operacional JSON" type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label>
      </section>
    </main>;
  }

  const activeFrom = dateFrom || data.periodStart;
  const activeTo = dateTo || data.periodEnd;
  const effectiveCard = view === "investigate" ? card : "all";
  const cards = [...new Set([
    ...(data.workforce?.cards.flatMap((row) => row.cardCode ? [row.cardCode] : []) ?? []),
    ...data.events.flatMap((event) => event.cardCode ? [event.cardCode] : [])
  ])].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  const filteredDaily = data.daily.filter((row) => between(row.date, activeFrom, activeTo) && (asset === "all" || row.assetId === asset));
  const filteredEvents = data.events.filter((event) =>
    between(event.date, activeFrom, activeTo) &&
    (asset === "all" || event.assetId === asset) &&
    (effectiveCard === "all" || event.cardCode === effectiveCard)
  );
  const totals = dailyTotals(filteredDaily);
  const impacts = filteredEvents.filter((event) => event.type === "Impacto").length;
  const faults = filteredEvents.filter((event) => event.type === "Falha do sistema").length;

  const filteredAI = ai.insights.filter((insight) =>
    between(insight.date, activeFrom, activeTo) &&
    (asset === "all" || insight.assetId === asset) &&
    (effectiveCard === "all" || insight.relatedCardCodes.includes(effectiveCard))
  );
  const highInsights = filteredAI.filter((insight) => insight.priority === "high").length;
  const summarySelected = filteredAI.find((item) => item.id === focusInsightId) ?? filteredAI[0];

  const profileMap = new Map((workforceProfiles?.profiles ?? []).map((profile) => [profile.assetId, profile]));
  const fleetRows = data.assets
    .filter((item) => asset === "all" || item.assetId === asset)
    .map((item) => {
      const rows = data.daily.filter((row) => row.assetId === item.assetId && between(row.date, activeFrom, activeTo));
      const assetTotals = dailyTotals(rows);
      const assetEvents = data.events.filter((event) => event.assetId === item.assetId && between(event.date, activeFrom, activeTo));
      return {
        assetId: item.assetId,
        workPct: assetTotals.workPct,
        idlePct: assetTotals.idlePct,
        faults: assetEvents.filter((event) => event.type === "Falha do sistema").length,
        impacts: assetEvents.filter((event) => event.type === "Impacto").length,
        profile: profileMap.get(item.assetId)
      };
    });

  return <main className="pageShell hyster">
    <header className="pulsoHeader">
      <div className="pulsoBrand"><div className="pulsoMark"><Sparkles size={20} /></div><div><span>Copiloto Operacional AI</span><h1>Pulso</h1></div></div>
      <div className="pulsoHeaderMeta"><span className="sourceBadge">Dados reais · Hyster Tracker</span><span><CalendarRange size={15} /> {data.periodStart} → {data.periodEnd}</span><span><Truck size={15} /> {data.assets.length} equipamentos</span><button className="iconAction" onClick={() => setView("base")} aria-label="Gerenciar base"><Settings2 size={18} /></button></div>
    </header>

    {error && <div className="inlineAlert" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}

    <nav className="productNav" aria-label="Navegação do Pulso">{navItems.map((item) => <button key={item.key} aria-current={view === item.key ? "page" : undefined} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>{item.icon}<span>{item.label}</span>{item.key === "investigate" && highInsights > 0 && <em>{highInsights}</em>}</button>)}</nav>

    {(view === "overview" || view === "investigate") && <section className="globalFilters" aria-label="Filtros do contexto operacional">
      <div className="filterLead"><span className="sectionEyebrow">CONTEXTO</span><strong>{asset === "all" ? "Toda a frota" : asset}{effectiveCard === "all" ? "" : ` · cartão ${effectiveCard}`}</strong><small>{activeFrom} → {activeTo}</small></div>
      <div className="filterFields">
        <label>De<input type="date" min={data.periodStart} max={data.periodEnd} value={activeFrom} onChange={(event) => { const value = event.target.value; setDateFrom(value); if (value > activeTo) setDateTo(value); }} /></label>
        <label>Até<input type="date" min={data.periodStart} max={data.periodEnd} value={activeTo} onChange={(event) => { const value = event.target.value; setDateTo(value); if (value < activeFrom) setDateFrom(value); }} /></label>
        <label>Equipamento<select value={asset} onChange={(event) => setAsset(event.target.value)}><option value="all">Toda a frota</option>{data.assets.map((item) => <option key={item.assetId}>{item.assetId}</option>)}</select></label>
        {view === "investigate" && <label>Cartão<select value={card} onChange={(event) => setCard(event.target.value)}><option value="all">Todos</option>{cards.map((code) => <option value={code} key={code}>Cartão {code}</option>)}</select></label>}
        <button className="secondaryAction" onClick={() => { setAsset("all"); setCard("all"); setDateFrom(data.periodStart); setDateTo(data.periodEnd); }}>Limpar</button>
      </div>
    </section>}

    {view === "overview" && <section className="executivePage">
      <div className="pageIntro"><div><span className="sectionEyebrow">OPERAÇÃO</span><h2>Pulso da operação</h2></div><button className="secondaryAction" onClick={() => setView("investigate")}><BrainCircuit size={17} /> Investigar sinais</button></div>

      <section className="priorityWorkspace humanFirst">
        <aside className="priorityListPane"><div className="sectionHeading"><div><span className="sectionEyebrow">PRIORIDADES</span><h3>O que merece atenção</h3></div></div><div className="priorityList">
          {filteredAI.slice(0, 5).map((insight) => <button key={insight.id} className={summarySelected?.id === insight.id ? "selected" : ""} onClick={() => setFocusInsightId(insight.id)}><span className={`priorityPill ${insight.priority}`}>{insight.priority === "high" ? "Alta" : "Atenção"}</span><div><strong>{insight.assetId} · {insight.date}</strong><p>{plainInsight(insight)}</p></div><ChevronRight size={17} /></button>)}
          {!filteredAI.length && <div className="quietState">Nenhum sinal priorizado neste período.</div>}
        </div></aside>
        <article className="priorityDetailPane">{summarySelected ? <><div className="detailTopline"><span className={`priorityPill ${summarySelected.priority}`}>{summarySelected.priority === "high" ? "Alta atenção" : "Atenção"}</span><span>{summarySelected.assetId} · {summarySelected.date}</span></div><h3>{summarySelected.title}</h3><p>{plainInsight(summarySelected)}</p><div className="detailActions"><button className="primaryAction" onClick={() => openInsight(summarySelected)}>Investigar</button></div></> : <div className="quietState large">Operação sem sinal priorizado no filtro.</div>}</article>
      </section>

      <section className="executiveKpis">
        <article><span>Trabalho / chave</span><strong>{totals.workPct == null ? "n/d" : `${fmt(totals.workPct)}%`}</strong><small>{fmt(totals.work)} h</small></article>
        <article><span>Ocioso / chave</span><strong>{totals.idlePct == null ? "n/d" : `${fmt(totals.idlePct)}%`}</strong><small>{fmt(totals.idle)} h</small></article>
        <article className={impacts ? "impactKpi" : ""}><span>Impactos</span><strong>{impacts}</strong><small>eventos no período</small></article>
        <article><span>Falhas</span><strong>{faults}</strong><small>registros no período</small></article>
        <article><span>Sinais priorizados</span><strong>{filteredAI.length}</strong><small>{highInsights} de alta atenção</small></article>
      </section>

      <article className="surfaceCard fleetOverview">
        <div className="sectionHeading"><div><span className="sectionEyebrow">FROTA</span><h3>Performance e perfil operacional</h3></div>{workforceProfiles && <span className="scopeChip">Workforce · {workforceProfiles.activeMetricCount}/{workforceProfiles.configuredMetricCount} métricas ativas · {workforceProfiles.periodStart} → {workforceProfiles.periodEnd}</span>}</div>
        <div className="hysterTable fleetTable"><table><thead><tr><th>Equipamento</th><th>Trabalho/chave</th><th>Ocioso/chave</th><th>Falhas</th><th>Impactos</th><th>Perfil operacional</th><th></th></tr></thead><tbody>{fleetRows.map((row) => <tr key={row.assetId}><th>{row.assetId}</th><td>{row.workPct == null ? "n/d" : `${fmt(row.workPct)}%`}</td><td>{row.idlePct == null ? "n/d" : `${fmt(row.idlePct)}%`}</td><td>{row.faults}</td><td>{row.impacts}</td><td>{profileHeadline(row.profile)}</td><td><button className="rowAction" onClick={() => { setAsset(row.assetId); setView("investigate"); }}>Investigar</button></td></tr>)}</tbody></table></div>
      </article>
    </section>}

    {view === "investigate" && <section className="contentSection"><div className="pageIntro"><div><span className="sectionEyebrow">INVESTIGAR</span><h2>Sinais priorizados</h2></div></div><OperationalAIPanel data={data} assetFilter={asset} cardFilter={card} dateFrom={activeFrom} dateTo={activeTo} initialInsightId={focusInsightId} onRegisterAction={registerAIAction} /></section>}

    {view === "actions" && <section className="contentSection"><div className="pageIntro"><div><span className="sectionEyebrow">AÇÕES</span><h2>Acompanhamento</h2></div></div><OperationsConsole tab="maintenance" workspace={workspace} data={data} save={save} busy={busy} suggestion={suggestion} /></section>}

    {view === "base" && <section className="contentSection basePage"><div className="pageIntro"><div><span className="sectionEyebrow">BASE</span><h2>Dados e qualidade</h2></div></div><section className="baseGrid"><article className="surfaceCard baseActions"><h3>Base operacional</h3><p><strong>{data.periodStart} → {data.periodEnd}</strong><br />{data.assets.length} equipamentos · {data.sources.length} fontes · schema v{data.schemaVersion}</p><label className="primaryUpload">Importar nova base JSON<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label><button className="secondaryAction" disabled={!ready || busy} onClick={backup}>Exportar backup</button><label className="secondaryUpload">Restaurar backup<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void restore(event.target.files?.[0])} /></label><small role="status">{!ready ? "Recuperando…" : busy ? "Salvando…" : saved}</small></article><article className="surfaceCard"><h3>Qualidade</h3><ul className="qualityList"><li><strong>{fullReport.quality.waitAboveIdle}</strong><span>espera maior que tempo ocioso</span></li><li><strong>{fullReport.quality.nonAdditive}</strong><span>contadores não aditivos</span></li><li><strong>{fullReport.quality.rowsOmitted ?? "n/d"}</strong><span>equipamento-dias ausentes</span></li><li><strong>{data.dataQuality?.eventExportCriticalOnly ? "sim" : "não"}</strong><span>eventos filtrados para críticos</span></li><li><strong>{data.maintenanceAvailable ? "sim" : "não"}</strong><span>manutenção detalhada</span></li></ul></article></section><article className="surfaceCard"><h3>Fontes</h3><div className="sourceList">{data.sources.map((source) => <details key={source.sha256}><summary>{source.file}</summary><code>{source.sha256}</code><p>{source.sheets.map((sheet) => `${sheet.name} · ${sheet.rows} linhas${sheet.range ? ` · ${sheet.range}` : ""}`).join(" · ")}</p></details>)}</div></article></section>}
  </main>;
}
