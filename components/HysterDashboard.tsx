"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  BrainCircuit,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Database,
  Droplets,
  Gauge,
  Move,
  PauseCircle,
  Settings2,
  ShieldAlert,
  Sparkles,
  Truck
} from "lucide-react";
import {
  analyzeHyster,
  validateHyster,
  workforceMetricKeys,
  type HysterData,
  type WorkforceMetricKey,
  type WorkforceMetrics
} from "@/lib/hyster";
import {
  analyzeOperationalAI,
  type OperationalAIInsight
} from "@/lib/operationalAI";
import { analyzeWorkforceProfiles, type WorkforceAssetProfile } from "@/lib/workforceProfile";
import { addDataset, combineDatasets, emptyWorkspace, validateWorkspace, type Workspace } from "@/lib/operations";
import { readWorkspace, saveWorkspace } from "@/lib/operationsStorage";
import OperationsConsole from "./OperationsConsole";
import OperationalAIPanel from "./OperationalAIPanel";
import PeriodPicker from "./PeriodPicker";
import PulsoSidebar, { type PulsoViewKey } from "./PulsoSidebar";
import ResizableSplit from "./ResizableSplit";
import "./hyster.css";

const fmt = (value: number | null | undefined) => value == null ? "n/d" : Math.round(value).toLocaleString("pt-BR");
const pct = (value: number | null | undefined) => value == null ? "n/d" : `${fmt(value)}%`;
const ratio = (numerator: number | undefined, denominator: number | undefined) => numerator != null && denominator != null && denominator > 0 ? numerator / denominator * 100 : undefined;
const between = (value: string, start: string, end: string) => value >= start && value <= end;
const clampPct = (value: number | null | undefined) => Math.max(0, Math.min(100, value ?? 0));

type AssistMode = "summary" | "productivity" | "impacts" | "compare";
type FleetSort = "attention" | "work" | "idle" | "impacts";

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

function mergeMetrics(rows: WorkforceMetrics[]) {
  const merged: WorkforceMetrics = {};
  for (const key of workforceMetricKeys) {
    const values = rows.flatMap((row) => row[key] == null ? [] : [row[key] as number]);
    if (values.length) merged[key] = values.reduce((sum, value) => sum + value, 0);
  }
  return merged;
}

function workforceContext(data: HysterData, assetId = "all", cardCode = "all") {
  if (!data.workforce) return undefined;
  const cards = data.workforce.cards.filter((card) =>
    card.cardQuality === "complete" && (cardCode === "all" || card.cardCode === cardCode)
  );
  const slices = cards.flatMap((card) => card.assets.filter((asset) => assetId === "all" || asset.assetId === assetId));
  if (!slices.length) return undefined;

  const metrics = mergeMetrics(slices.map((slice) => slice.metrics));
  const marchHours = metrics.forwardHours != null && metrics.reverseHours != null
    ? metrics.forwardHours + metrics.reverseHours
    : undefined;

  return {
    metrics,
    usageCount: slices.reduce((sum, slice) => sum + slice.usageCount, 0),
    periodStart: data.workforce.periodStart,
    periodEnd: data.workforce.periodEnd,
    keyHours: metrics.keyHours,
    workPct: ratio(metrics.workHours, metrics.keyHours),
    idlePct: ratio(metrics.idleHours, metrics.keyHours),
    hydraulicPct: ratio(metrics.hydraulicHours, metrics.keyHours),
    motionPct: ratio(metrics.motionHours, metrics.keyHours),
    marchPct: ratio(marchHours, metrics.keyHours),
    forwardShare: ratio(metrics.forwardHours, marchHours),
    reverseShare: ratio(metrics.reverseHours, marchHours)
  };
}

function plainInsight(insight: OperationalAIInsight) {
  if (insight.category === "safety") return `${insight.relatedEvents.impacts} impacto(s) em contexto fora do padrão.`;
  if (insight.category === "reliability") return `${insight.relatedEvents.faults} registro(s) de falha concentrados no dia.`;
  if (insight.category === "multivariate") return "Vários sinais mudaram juntos de forma pouco comum.";
  const phrases: string[] = [];
  if (insight.evidence.some((item) => item.metric === "idlePct" && item.zScore > 0)) phrases.push("tempo ocioso acima do habitual");
  if (insight.evidence.some((item) => item.metric === "waitPct" && item.zScore > 0)) phrases.push("espera acima do habitual");
  if (insight.evidence.some((item) => item.metric === "workPct" && item.zScore < 0)) phrases.push("trabalho abaixo do habitual");
  return phrases.length ? phrases.join(" e ") : "Comportamento diferente do histórico.";
}

function profileHeadline(profile?: WorkforceAssetProfile) {
  const signal = profile?.signals[0];
  if (!signal) return "Sem destaque no perfil agregado";
  const direction = signal.value >= signal.fleetMean ? "acima" : "abaixo";
  return `${signal.label}: ${fmt(signal.value)}${signal.unit === "%" ? "%" : ` ${signal.unit}`} · ${direction} da frota`;
}

function metricFromProfile(profile: WorkforceAssetProfile | undefined, metric: WorkforceMetricKey) {
  return profile?.metrics.find((item) => item.metric === metric);
}

function viewTitle(view: PulsoViewKey) {
  if (view === "investigate") return "Investigar";
  if (view === "actions") return "Ações";
  if (view === "base") return "Base";
  return "Visão geral";
}

export default function HysterDashboard() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [view, setView] = useState<PulsoViewKey>("overview");
  const [suggestion, setSuggestion] = useState<{ assetId: string; title: string }>();
  const [asset, setAsset] = useState("all");
  const [card, setCard] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState("");
  const [focusInsightId, setFocusInsightId] = useState<string>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [expandedAsset, setExpandedAsset] = useState<string>();
  const [selectedAssetId, setSelectedAssetId] = useState<string>();
  const [assistMode, setAssistMode] = useState<AssistMode>("summary");
  const [fleetSort, setFleetSort] = useState<FleetSort>("attention");

  const data = useMemo(() => combineDatasets(workspace.datasets), [workspace.datasets]);
  const fullReport = useMemo(() => data ? analyzeHyster(data) : null, [data]);
  const ai = useMemo(() => data ? analyzeOperationalAI(data) : null, [data]);
  const workforceProfiles = useMemo(() => data ? analyzeWorkforceProfiles(data, card === "all" ? undefined : card) : undefined, [data, card]);

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
    return <main className="pageShell hyster emptyShell">
      <section className="emptyState">
        <div className="emptyIcon"><Database size={26} /></div>
        <span className="sectionEyebrow">PULSO · COPILOTO OPERACIONAL AI</span>
        <h2>Importe a base operacional</h2>
        <p>Uma única importação alimenta a visão executiva, investigação, contexto operacional e ações.</p>
        {error && <div className="inlineAlert" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}
        <label className="primaryUpload">Importar JSON<input disabled={!ready || busy} aria-label="Selecionar base operacional JSON" type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label>
      </section>
    </main>;
  }

  const activeFrom = dateFrom || data.periodStart;
  const activeTo = dateTo || data.periodEnd;
  const cards = [...new Set([
    ...(data.workforce?.cards.flatMap((row) => row.cardCode ? [row.cardCode] : []) ?? []),
    ...data.events.flatMap((event) => event.cardCode ? [event.cardCode] : [])
  ])].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  const filteredDaily = data.daily.filter((row) => between(row.date, activeFrom, activeTo) && (asset === "all" || row.assetId === asset));
  const filteredEvents = data.events.filter((event) =>
    between(event.date, activeFrom, activeTo) &&
    (asset === "all" || event.assetId === asset) &&
    (card === "all" || event.cardCode === card)
  );
  const totals = dailyTotals(filteredDaily);
  const workforceScope = workforceContext(data, asset, card);
  const cardScoped = card !== "all";
  const displayedWorkPct = cardScoped ? workforceScope?.workPct : totals.workPct;
  const displayedIdlePct = cardScoped ? workforceScope?.idlePct : totals.idlePct;
  const impacts = filteredEvents.filter((event) => event.type === "Impacto").length;
  const faults = filteredEvents.filter((event) => event.type === "Falha do sistema").length;
  const openOrders = workspace.orders.filter((order) =>
    (order.status === "open" || order.status === "in_progress") &&
    (asset === "all" || order.assetId === asset)
  ).length;

  const filteredAI = ai.insights.filter((insight) =>
    between(insight.date, activeFrom, activeTo) &&
    (asset === "all" || insight.assetId === asset) &&
    (card === "all" || insight.relatedCardCodes.includes(card))
  );
  const highInsights = filteredAI.filter((insight) => insight.priority === "high").length;

  const profileMap = new Map((workforceProfiles?.profiles ?? []).map((profile) => [profile.assetId, profile]));
  const rawFleetRows = data.assets
    .filter((item) => asset === "all" || item.assetId === asset)
    .filter((item) => {
      if (card === "all") return true;
      return !!workforceContext(data, item.assetId, card) || data.events.some((event) => event.assetId === item.assetId && event.cardCode === card);
    })
    .map((item) => {
      const rows = data.daily.filter((row) => row.assetId === item.assetId && between(row.date, activeFrom, activeTo));
      const assetTotals = dailyTotals(rows);
      const assetEvents = data.events.filter((event) =>
        event.assetId === item.assetId &&
        between(event.date, activeFrom, activeTo) &&
        (card === "all" || event.cardCode === card)
      );
      const wf = workforceContext(data, item.assetId, card);
      const profile = profileMap.get(item.assetId);
      return {
        assetId: item.assetId,
        workPct: cardScoped ? wf?.workPct : assetTotals.workPct,
        idlePct: cardScoped ? wf?.idlePct : assetTotals.idlePct,
        hydraulicPct: wf?.hydraulicPct,
        motionPct: wf?.motionPct,
        marchPct: wf?.marchPct,
        forwardShare: wf?.forwardShare,
        reverseShare: wf?.reverseShare,
        faults: assetEvents.filter((event) => event.type === "Falha do sistema").length,
        impacts: assetEvents.filter((event) => event.type === "Impacto").length,
        profile
      };
    });

  const fleetRows = [...rawFleetRows].sort((a, b) => {
    if (fleetSort === "work") return (b.workPct ?? -1) - (a.workPct ?? -1);
    if (fleetSort === "idle") return (b.idlePct ?? -1) - (a.idlePct ?? -1);
    if (fleetSort === "impacts") return b.impacts - a.impacts || b.faults - a.faults;
    const risk = (row: typeof a) => row.impacts * 100 + row.faults * 10 + (row.idlePct ?? 0);
    return risk(b) - risk(a);
  });

  const selectedFleet = fleetRows.find((row) => row.assetId === selectedAssetId) ?? fleetRows[0];
  const selectedInsight = selectedFleet
    ? filteredAI.find((insight) => insight.assetId === selectedFleet.assetId) ?? filteredAI[0]
    : filteredAI[0];

  const topImpact = [...fleetRows].sort((a, b) => b.impacts - a.impacts || b.faults - a.faults)[0];
  const lowestWork = [...fleetRows].filter((row) => row.workPct != null).sort((a, b) => (a.workPct ?? 0) - (b.workPct ?? 0))[0];
  const highestIdle = [...fleetRows].filter((row) => row.idlePct != null).sort((a, b) => (b.idlePct ?? 0) - (a.idlePct ?? 0))[0];

  function assistantCopy() {
    if (assistMode === "productivity") {
      const row = selectedFleet ?? lowestWork;
      if (!row) return "Não há dados suficientes neste recorte para interpretar atividade operacional.";
      const parts = [
        row.workPct != null ? `trabalho em ${pct(row.workPct)} da chave` : "",
        row.hydraulicPct != null ? `hidráulica em ${pct(row.hydraulicPct)} da chave no agregado disponível` : "",
        row.motionPct != null ? `movimento em ${pct(row.motionPct)} da chave no agregado disponível` : ""
      ].filter(Boolean);
      return `${row.assetId}: ${parts.join(", ")}. Sem demanda/produção equivalente, o Pulso trata isso como atividade registrada e não conclui perda de produtividade.`;
    }
    if (assistMode === "impacts") {
      if (!topImpact || topImpact.impacts === 0) return "Nenhum impacto foi registrado no contexto atual. Isso não substitui inspeções ou rotinas de segurança.";
      return `${topImpact.assetId} concentra ${topImpact.impacts} impacto(s) no filtro atual. O evento merece contexto de rota, piso, carga e condição do equipamento antes de qualquer conclusão.`;
    }
    if (assistMode === "compare") {
      if (!lowestWork || !highestIdle) return "Selecione um contexto com mais de um equipamento para comparar o comportamento da frota.";
      return `Na comparação descritiva, ${lowestWork.assetId} tem menor trabalho/chave (${pct(lowestWork.workPct)}) e ${highestIdle.assetId} maior ociosidade/chave (${pct(highestIdle.idlePct)}). Use a investigação para entender o contexto; isso não é ranking de operador.`;
    }
    if (selectedInsight) return `${selectedInsight.assetId}: ${plainInsight(selectedInsight)} O Pulso separou este contexto para reduzir o tempo gasto procurando onde olhar primeiro.`;
    return filteredAI.length
      ? `O Pulso encontrou ${filteredAI.length} situação(ões) para revisão, sendo ${highInsights} de alta atenção.`
      : "Nenhum sinal foi priorizado pelo motor neste filtro. Continue usando a rotina operacional e as evidências disponíveis.";
  }

  const workforcePeriodDifferent = !!data.workforce && (activeFrom !== data.workforce.periodStart || activeTo !== data.workforce.periodEnd);

  const kpis = [
    { label: "Trabalho / chave", value: pct(displayedWorkPct), meter: displayedWorkPct, detail: cardScoped ? "agregado do cartão" : `${fmt(totals.work)} h no período`, icon: <Gauge size={18} /> },
    { label: "Hidráulica / chave", value: pct(workforceScope?.hydraulicPct), meter: workforceScope?.hydraulicPct, detail: "atividade hidráulica registrada", icon: <Droplets size={18} /> },
    { label: "Movimento / chave", value: pct(workforceScope?.motionPct), meter: workforceScope?.motionPct, detail: "tempo em movimento", icon: <Move size={18} /> },
    { label: "Marcha / chave", value: pct(workforceScope?.marchPct), meter: workforceScope?.marchPct, detail: workforceScope?.forwardShare != null && workforceScope.reverseShare != null ? `${fmt(workforceScope.forwardShare)}% frente · ${fmt(workforceScope.reverseShare)}% ré` : "frente/ré indisponível", icon: <ArrowLeftRight size={18} /> },
    { label: "Ociosidade / chave", value: pct(displayedIdlePct), meter: displayedIdlePct, detail: cardScoped ? "agregado do cartão" : `${fmt(totals.idle)} h no período`, icon: <PauseCircle size={18} /> },
    { label: "Impactos", value: fmt(impacts), detail: `${faults} falha(s) · ${openOrders} ação(ões) aberta(s)`, icon: <ShieldAlert size={18} />, attention: impacts > 0 }
  ];

  return <main className={`pageShell hyster appShell ${sidebarCollapsed ? "sidebarCollapsed" : ""}`}>
    <PulsoSidebar
      view={view}
      onChange={setView}
      attentionCount={highInsights}
      collapsed={sidebarCollapsed}
      onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
    />

    <div className="pulsoMain">
      <header className="pulsoTopbar">
        <div>
          <span className="topbarKicker">PULSO · COPILOTO OPERACIONAL AI</span>
          <h1>{viewTitle(view)}</h1>
        </div>
        <div className="topbarMeta">
          <span className="sourceBadge">Operação real</span>
          <span><Truck size={15} /> {data.assets.length} equipamentos</span>
          <span>{data.periodStart} → {data.periodEnd}</span>
          <button className="iconAction" onClick={() => setView("base")} aria-label="Gerenciar base"><Settings2 size={18} /></button>
        </div>
      </header>

      {error && <div className="inlineAlert appAlert" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}

      {(view === "overview" || view === "investigate") && <section className="contextToolbar" aria-label="Filtros do contexto operacional">
        <PeriodPicker
          min={data.periodStart}
          max={data.periodEnd}
          from={activeFrom}
          to={activeTo}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
        />
        <label className="toolbarField"><span>Equipamento</span><select value={asset} onChange={(event) => { setAsset(event.target.value); setSelectedAssetId(undefined); }}><option value="all">Toda a frota</option>{data.assets.map((item) => <option key={item.assetId}>{item.assetId}</option>)}</select></label>
        <label className="toolbarField"><span>Operador (cartão)</span><select value={card} onChange={(event) => { setCard(event.target.value); setSelectedAssetId(undefined); }}><option value="all">Todos os cartões</option>{cards.map((code) => <option value={code} key={code}>Cartão {code}</option>)}</select></label>
        <button className="toolbarReset" type="button" onClick={() => { setAsset("all"); setCard("all"); setDateFrom(data.periodStart); setDateTo(data.periodEnd); setSelectedAssetId(undefined); }}>Limpar filtros</button>
        <div className="contextSummary"><strong>{asset === "all" ? "Toda a frota" : asset}</strong><span>{card === "all" ? "todos os cartões" : `cartão ${card}`}</span></div>
      </section>}

      {workforcePeriodDifferent && (view === "overview" || view === "investigate") && <div className="scopeBanner">
        <AlertTriangle size={15} />
        <span>Hidráulica, movimento, marcha e demais indicadores por cartão/equipamento são agregados de <strong>{data.workforce?.periodStart} → {data.workforce?.periodEnd}</strong>. O Pulso não distribui esses totais artificialmente pelo intervalo escolhido.</span>
      </div>}

      {view === "overview" && <section className="overviewPage">
        <section className="kpiRibbon">
          {kpis.map((item) => <article key={item.label} className={item.attention ? "attention" : ""}>
            <div className="kpiTop"><span className="kpiIcon">{item.icon}</span><span>{item.label}</span></div>
            <strong>{item.value}</strong>
            {item.meter != null && <div className="kpiMeter" aria-hidden="true"><span style={{ width: `${clampPct(item.meter)}%` }} /></div>}
            <small>{item.detail}</small>
          </article>)}
        </section>

        <div className="overviewTitleRow">
          <div><span className="sectionEyebrow">CONTEXTO OPERACIONAL</span><h2>Entenda a operação em um único lugar</h2><p>Selecione um equipamento para cruzar desempenho, hidráulica, movimento, impactos, sinais da IA e próximas ações.</p></div>
          <div className="sortControl"><span>Ordenar frota</span><select value={fleetSort} onChange={(event) => setFleetSort(event.target.value as FleetSort)}><option value="attention">Atenção</option><option value="work">Trabalho/chave</option><option value="idle">Ociosidade</option><option value="impacts">Impactos</option></select></div>
        </div>

        <ResizableSplit
          className="operationsCopilotSplit"
          left={<section className="fleetWorkspace">
            <div className="fleetGridHeader">
              <div><strong>Equipamentos</strong><span>{fleetRows.length} no contexto selecionado</span></div>
              {data.workforce && <span className="scopeChip">perfil agregado · {data.workforce.periodStart} → {data.workforce.periodEnd}</span>}
            </div>
            <div className="fleetDataGrid">
              <table>
                <thead><tr><th>Equipamento</th><th>Trabalho</th><th>Hidráulica</th><th>Movimento</th><th>Marcha</th><th>Ocioso</th><th>Impactos</th><th></th></tr></thead>
                <tbody>{fleetRows.map((row) => {
                  const isSelected = selectedFleet?.assetId === row.assetId;
                  const isExpanded = expandedAsset === row.assetId;
                  const highSpeed = metricFromProfile(row.profile, "highSpeedHours");
                  const lift = metricFromProfile(row.profile, "liftHours");
                  return <>{/* keyed fragment is avoided to keep table markup simple */}
                    <tr key={row.assetId} className={isSelected ? "selectedRow" : ""} onClick={() => setSelectedAssetId(row.assetId)}>
                      <th><button className="assetSelect" type="button" onClick={(event) => { event.stopPropagation(); setSelectedAssetId(row.assetId); }}>{row.assetId}</button></th>
                      <td>{pct(row.workPct)}</td>
                      <td>{pct(row.hydraulicPct)}</td>
                      <td>{pct(row.motionPct)}</td>
                      <td>{pct(row.marchPct)}</td>
                      <td>{pct(row.idlePct)}</td>
                      <td><span className={row.impacts ? "impactCount active" : "impactCount"}>{row.impacts}</span></td>
                      <td><button className="expandRow" type="button" aria-expanded={isExpanded} onClick={(event) => { event.stopPropagation(); setExpandedAsset(isExpanded ? undefined : row.assetId); }}><ChevronDown size={16} /></button></td>
                    </tr>
                    {isExpanded && <tr key={`${row.assetId}-expanded`} className="expandedFleetRow"><td colSpan={8}>
                      <div className="expandedFleetContent">
                        <div><span>Frente / ré</span><strong>{row.forwardShare == null || row.reverseShare == null ? "n/d" : `${fmt(row.forwardShare)}% / ${fmt(row.reverseShare)}%`}</strong></div>
                        <div><span>Elevação</span><strong>{lift ? `${fmt(lift.value)}${lift.unit}` : "n/d"}</strong></div>
                        <div><span>Alta velocidade</span><strong>{highSpeed ? `${fmt(highSpeed.value)}${highSpeed.unit}` : "n/d"}</strong></div>
                        <div><span>Falhas</span><strong>{row.faults}</strong></div>
                        <div className="expandedNarrative"><span>Leitura do perfil</span><strong>{profileHeadline(row.profile)}</strong></div>
                        <button className="rowAction" type="button" onClick={() => { setAsset(row.assetId); setView("investigate"); }}>Investigar equipamento</button>
                      </div>
                    </td></tr>}
                  </>;
                })}</tbody>
              </table>
            </div>

            <div className="priorityCompact">
              <div className="sectionHeading"><div><span className="sectionEyebrow">PRIORIDADES</span><h3>O que merece atenção</h3></div><button className="textAction" type="button" onClick={() => setView("investigate")}>Ver todas</button></div>
              <div className="priorityChips">
                {filteredAI.slice(0, 4).map((insight) => <button key={insight.id} type="button" onClick={() => { setFocusInsightId(insight.id); setSelectedAssetId(insight.assetId); }}>
                  <span className={`priorityPill ${insight.priority}`}>{insight.priority === "high" ? "Alta" : "Atenção"}</span>
                  <strong>{insight.assetId}</strong>
                  <span>{plainInsight(insight)}</span>
                </button>)}
                {!filteredAI.length && <div className="quietState">Nenhum sinal priorizado neste contexto.</div>}
              </div>
            </div>
          </section>}
          right={<aside className="copilotDock">
            <div className="copilotDockHeader">
              <div className="copilotGlyph"><Sparkles size={20} /></div>
              <div><span className="sectionEyebrow">POTENCIALIZE COM O PULSO</span><h3>{selectedFleet ? selectedFleet.assetId : "Sua operação"}</h3></div>
            </div>

            <div className="copilotSuggestions" aria-label="Atalhos de análise">
              <button className={assistMode === "summary" ? "active" : ""} type="button" onClick={() => setAssistMode("summary")}>Resumo</button>
              <button className={assistMode === "productivity" ? "active" : ""} type="button" onClick={() => setAssistMode("productivity")}>Produtividade</button>
              <button className={assistMode === "impacts" ? "active" : ""} type="button" onClick={() => { setAssistMode("impacts"); if (topImpact) setSelectedAssetId(topImpact.assetId); }}>Impactos</button>
              <button className={assistMode === "compare" ? "active" : ""} type="button" onClick={() => setAssistMode("compare")}>Comparar ativos</button>
            </div>

            <article className="copilotReading">
              <span>Leitura operacional</span>
              <p>{assistantCopy()}</p>
            </article>

            {selectedFleet && <div className="copilotFacts">
              <div><span>Trabalho</span><strong>{pct(selectedFleet.workPct)}</strong></div>
              <div><span>Hidráulica</span><strong>{pct(selectedFleet.hydraulicPct)}</strong></div>
              <div><span>Movimento</span><strong>{pct(selectedFleet.motionPct)}</strong></div>
              <div><span>Impactos</span><strong>{selectedFleet.impacts}</strong></div>
            </div>}

            {selectedInsight && <article className="copilotSignal">
              <span className={`priorityPill ${selectedInsight.priority}`}>{selectedInsight.priority === "high" ? "Alta atenção" : "Atenção"}</span>
              <strong>{plainInsight(selectedInsight)}</strong>
              <small>O Pulso usa estatística e contexto para priorizar onde vale investigar; a decisão continua humana.</small>
            </article>}

            <div className="copilotActions">
              <button className="primaryAction" type="button" disabled={!selectedInsight} onClick={() => selectedInsight && openInsight(selectedInsight)}><BrainCircuit size={17} /> Aprofundar com IA</button>
              {selectedInsight && <button className="secondaryAction" type="button" onClick={() => registerAIAction(selectedInsight)}><ClipboardCheck size={17} /> Registrar ação</button>}
            </div>
          </aside>}
        />
      </section>}

      {view === "investigate" && <section className="contentSection investigatePage">
        <div className="pageIntro compact"><div><span className="sectionEyebrow">INVESTIGAR</span><h2>Do sinal à decisão</h2><p>O Pulso traduz a detecção técnica para linguagem de operação e mantém as evidências disponíveis para auditoria.</p></div></div>
        <OperationalAIPanel
          data={data}
          assetFilter={asset}
          cardFilter={card}
          dateFrom={activeFrom}
          dateTo={activeTo}
          initialInsightId={focusInsightId}
          orders={workspace.orders}
          inputs={workspace.inputs}
          onRegisterAction={registerAIAction}
        />
      </section>}

      {view === "actions" && <section className="contentSection">
        <div className="pageIntro compact"><div><span className="sectionEyebrow">AÇÕES</span><h2>Registre a decisão e acompanhe o resultado</h2><p>Investigações e intervenções continuam sob responsabilidade humana.</p></div></div>
        <OperationsConsole tab="maintenance" workspace={workspace} data={data} save={save} busy={busy} suggestion={suggestion} />
      </section>}

      {view === "base" && <section className="contentSection basePage">
        <div className="pageIntro compact"><div><span className="sectionEyebrow">BASE</span><h2>Dados e qualidade</h2><p>Administração da base fica separada do fluxo de gestão.</p></div></div>
        <section className="baseGrid">
          <article className="surfaceCard baseActions"><h3>Base operacional</h3><p><strong>{data.periodStart} → {data.periodEnd}</strong><br />{data.assets.length} equipamentos · {data.sources.length} fontes · schema v{data.schemaVersion}</p><label className="primaryUpload">Importar nova base JSON<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label><button className="secondaryAction" disabled={!ready || busy} onClick={backup}>Exportar backup</button><label className="secondaryUpload">Restaurar backup<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void restore(event.target.files?.[0])} /></label><small role="status">{!ready ? "Recuperando…" : busy ? "Salvando…" : saved}</small></article>
          <article className="surfaceCard"><h3>Qualidade</h3><ul className="qualityList"><li><strong>{fullReport.quality.waitAboveIdle}</strong><span>espera maior que tempo ocioso</span></li><li><strong>{fullReport.quality.nonAdditive}</strong><span>contadores não aditivos</span></li><li><strong>{fullReport.quality.rowsOmitted ?? "n/d"}</strong><span>equipamento-dias ausentes</span></li><li><strong>{data.dataQuality?.eventExportCriticalOnly ? "sim" : "não"}</strong><span>eventos filtrados para críticos</span></li><li><strong>{data.maintenanceAvailable ? "sim" : "não"}</strong><span>manutenção detalhada</span></li></ul></article>
        </section>
        <article className="surfaceCard"><h3>Fontes</h3><div className="sourceList">{data.sources.map((source) => <details key={source.sha256}><summary>{source.file}</summary><code>{source.sha256}</code><p>{source.sheets.map((sheet) => `${sheet.name} · ${sheet.rows} linhas${sheet.range ? ` · ${sheet.range}` : ""}`).join(" · ")}</p></details>)}</div></article>
      </section>}
    </div>
  </main>;
}
