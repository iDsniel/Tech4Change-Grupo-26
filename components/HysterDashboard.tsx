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
  Truck
} from "lucide-react";
import {
  analyzeHyster,
  validateHyster,
  workforceMetricKeys,
  workforceMetricLabels,
  workforceStatistic,
  type HysterData,
  type WorkforceMetricKey,
  type WorkforceMetrics
} from "@/lib/hyster";
import { analyzeOperationalAI, type OperationalAIInsight } from "@/lib/operationalAI";
import { addDataset, combineDatasets, emptyWorkspace, validateWorkspace, type Workspace } from "@/lib/operations";
import { readWorkspace, saveWorkspace } from "@/lib/operationsStorage";
import OperationsConsole from "./OperationsConsole";
import OperationalAIPanel from "./OperationalAIPanel";
import "./hyster.css";

const fmt = (value: number | null | undefined, digits = 2) => value == null ? "n/d" : value.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const ratio = (numerator: number | undefined, denominator: number | undefined) => numerator != null && denominator != null && denominator > 0 ? numerator / denominator * 100 : undefined;
const between = (value: string, start: string, end: string) => value >= start && value <= end;

type ViewKey = "overview" | "investigate" | "actions" | "base";
type WorkforceContext = { metrics: WorkforceMetrics; usageCount: number; coverage: number; warning?: string };

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

function mergeMetrics(rows: WorkforceMetrics[]) {
  const metrics: WorkforceMetrics = {};
  for (const key of workforceMetricKeys) {
    const values = rows.flatMap((row) => row[key] == null ? [] : [row[key] as number]);
    if (values.length) metrics[key] = values.reduce((sum, value) => sum + value, 0);
  }
  return metrics;
}

function workforceContext(data: HysterData, assetId: string, cardCode: string): WorkforceContext | undefined {
  const workforce = data.workforce;
  if (!workforce) return undefined;

  if (cardCode !== "all") {
    const matches = workforce.cards.filter((row) => row.cardCode === cardCode);
    if (matches.length !== 1 || matches[0].cardQuality !== "complete") {
      return { metrics: {}, usageCount: 0, coverage: 0, warning: "Código incompleto, ambíguo ou duplicado na origem; o Pulso não agrega esses totais automaticamente." };
    }
    const selectedCard = matches[0];
    if (assetId === "all") return { metrics: selectedCard.metrics, usageCount: selectedCard.usageCount, coverage: 1 };
    const selectedAsset = selectedCard.assets.find((row) => row.assetId === assetId);
    if (!selectedAsset) return { metrics: {}, usageCount: 0, coverage: 0, warning: `O cartão ${cardCode} não possui recorte agregado para ${assetId}.` };
    return { metrics: selectedAsset.metrics, usageCount: selectedAsset.usageCount, coverage: 1 };
  }

  const complete = workforce.cards.filter((row) => row.cardQuality === "complete");
  if (assetId === "all") {
    return { metrics: mergeMetrics(complete.map((row) => row.metrics)), usageCount: complete.reduce((sum, row) => sum + row.usageCount, 0), coverage: complete.length };
  }
  const assets = complete.flatMap((row) => row.assets.filter((entry) => entry.assetId === assetId));
  return { metrics: mergeMetrics(assets.map((row) => row.metrics)), usageCount: assets.reduce((sum, row) => sum + row.usageCount, 0), coverage: assets.length };
}

function dailyTotals(rows: HysterData["daily"]) {
  const total = (key: "keyHours" | "workHours" | "idleHours" | "waitHours") => rows.reduce((sum, row) => sum + row[key], 0);
  const key = total("keyHours");
  const work = total("workHours");
  const idle = total("idleHours");
  const wait = total("waitHours");
  return { key, work, idle, wait, workPct: ratio(work, key), idlePct: ratio(idle, key), waitPct: ratio(wait, key), records: rows.length };
}

function plainInsight(insight: OperationalAIInsight) {
  if (insight.category === "safety") return `${insight.relatedEvents.impacts} impacto(s) registrado(s) neste contexto. O evento merece revisão antes de qualquer conclusão.`;
  if (insight.category === "reliability") return `${insight.relatedEvents.faults} registro(s) de falha apareceram no mesmo dia, em um comportamento diferente do habitual deste equipamento.`;
  if (insight.category === "multivariate") return "Vários sinais operacionais mudaram juntos de uma forma pouco comum para este equipamento.";
  const phrases: string[] = [];
  if (insight.evidence.some((item) => item.metric === "idlePct" && item.zScore > 0)) phrases.push("ociosidade acima do habitual");
  if (insight.evidence.some((item) => item.metric === "waitPct" && item.zScore > 0)) phrases.push("espera acima do habitual");
  if (insight.evidence.some((item) => item.metric === "workPct" && item.zScore < 0)) phrases.push("trabalho abaixo do habitual");
  return phrases.length ? `O Pulso encontrou ${phrases.join(" e ")} para este equipamento.` : "O comportamento do equipamento ficou diferente do seu padrão habitual.";
}

function whyItMatters(insight: OperationalAIInsight) {
  if (insight.category === "safety") return "Impactos podem sinalizar condição de rota, piso, carga, condução ou equipamento e precisam de contexto para serem interpretados.";
  if (insight.category === "reliability") return "Recorrência de falhas pode afetar disponibilidade; vale confrontar os registros com inspeção e histórico de manutenção.";
  return "A diferença pode vir de demanda, fila, rota, liberação de área ou condição do equipamento. O objetivo é direcionar a investigação, não apontar culpados.";
}

function simpleOrientation(insight: OperationalAIInsight) {
  if (insight.category === "safety") return "Revise o evento com operação e segurança. Confira rota, piso, carga e condição do equipamento antes de concluir a causa.";
  if (insight.category === "reliability") return "Confira se a falha se repetiu, consulte manutenção e valide em campo antes de abrir uma corretiva.";
  if (insight.category === "multivariate") return "Converse com a operação para entender o que mudou no dia e acompanhe os próximos turnos comparáveis.";
  return "Valide demanda, filas, abastecimento, liberação de área e condição do equipamento. Se o comportamento persistir, registre uma ação para acompanhamento.";
}

function metricDailyAverage(data: HysterData, card: string, asset: string, metric: WorkforceMetricKey) {
  if (card === "all") return undefined;
  return workforceStatistic(data, card, metric, asset)?.dailyAverage;
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
    setView("investigate");
  }

  if (!data || !fullReport || !ai) {
    return <main className="pageShell hyster">
      <header className="pulsoHeader">
        <div className="pulsoBrand"><div className="pulsoMark"><Sparkles size={20} /></div><div><span>Copiloto Operacional AI</span><h1>Pulso</h1></div></div>
        <div className="pulsoHeaderMeta"><span className="sourceBadge muted">Aguardando base</span><a className="demoLink" href="/">Ver demo sintética</a></div>
      </header>
      {error && <div className="inlineAlert" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}
      <section className="emptyState">
        <div className="emptyIcon"><Database size={26} /></div><span className="sectionEyebrow">COMEÇAR</span><h2>Carregue a operação para ativar o Pulso</h2>
        <p>Uma única base alimenta indicadores, cartões, eventos, ordens e a camada de IA.</p>
        <label className="primaryUpload">Importar base operacional JSON<input disabled={!ready || busy} aria-label="Selecionar base operacional JSON" type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label>
        <small>{!ready ? "Recuperando dados locais…" : busy ? "Salvando…" : "Persistência local ao navegador nesta etapa."}</small>
      </section>
    </main>;
  }

  const activeFrom = dateFrom || data.periodStart;
  const activeTo = dateTo || data.periodEnd;
  const cardNames = new Map(data.workforce?.cards.flatMap((row) => row.cardCode ? [[row.cardCode, row.operatorName ?? ""] as const] : []) ?? []);
  const cards = [...new Set([
    ...(data.workforce?.cards.flatMap((row) => row.cardCode ? [row.cardCode] : []) ?? []),
    ...data.events.flatMap((event) => event.cardCode ? [event.cardCode] : [])
  ])].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

  const filteredDaily = data.daily.filter((row) => between(row.date, activeFrom, activeTo) && (asset === "all" || row.assetId === asset));
  const filteredEvents = data.events.filter((event) => between(event.date, activeFrom, activeTo) && (asset === "all" || event.assetId === asset) && (card === "all" || event.cardCode === card));
  const totals = dailyTotals(filteredDaily);
  const workforce = workforceContext(data, asset, card);
  const wfMetrics = workforce?.metrics ?? {};
  const workforceScopeIsExact = !!data.workforce && activeFrom === data.workforce.periodStart && activeTo === data.workforce.periodEnd;
  const scopedByCard = card !== "all";

  const displayedKey = scopedByCard && wfMetrics.keyHours != null ? wfMetrics.keyHours : totals.key;
  const displayedWork = scopedByCard && wfMetrics.workHours != null ? wfMetrics.workHours : totals.work;
  const displayedIdle = scopedByCard && wfMetrics.idleHours != null ? wfMetrics.idleHours : totals.idle;
  const workPct = ratio(displayedWork, displayedKey);
  const idlePct = ratio(displayedIdle, displayedKey);
  const hydraulicPct = ratio(wfMetrics.hydraulicHours, wfMetrics.keyHours);
  const auxiliaryHydraulicPct = ratio(wfMetrics.auxiliaryHydraulicHours, wfMetrics.keyHours);
  const highSpeedPct = ratio(wfMetrics.highSpeedHours, wfMetrics.keyHours);
  const lowOverspeedPct = ratio(wfMetrics.lowLevelOverspeedHours, wfMetrics.keyHours);
  const highOverspeedPct = ratio(wfMetrics.highLevelOverspeedHours, wfMetrics.keyHours);
  const marchHours = wfMetrics.forwardHours != null && wfMetrics.reverseHours != null ? wfMetrics.forwardHours + wfMetrics.reverseHours : undefined;
  const marchPct = ratio(marchHours, wfMetrics.keyHours);
  const forwardShare = ratio(wfMetrics.forwardHours, marchHours);
  const reverseShare = ratio(wfMetrics.reverseHours, marchHours);
  const loadedShare = ratio(wfMetrics.ladenHours, wfMetrics.ladenHours != null && wfMetrics.unladenHours != null ? wfMetrics.ladenHours + wfMetrics.unladenHours : undefined);
  const impacts = filteredEvents.filter((event) => event.type === "Impacto").length;
  const faults = filteredEvents.filter((event) => event.type === "Falha do sistema").length;

  const dailyAverageDistance = metricDailyAverage(data, card, asset, "distanceKm");
  const dailyAverageWork = metricDailyAverage(data, card, asset, "workHours");
  const dailyAverageHighSpeed = metricDailyAverage(data, card, asset, "highSpeedHours");
  const dailyAverageIdle = metricDailyAverage(data, card, asset, "idleHours");

  const filteredAI = ai.insights.filter((insight) => between(insight.date, activeFrom, activeTo) && (asset === "all" || insight.assetId === asset) && (card === "all" || insight.relatedCardCodes.includes(card)));
  const highInsights = filteredAI.filter((insight) => insight.priority === "high").length;
  const summarySelected = filteredAI.find((item) => item.id === focusInsightId) ?? filteredAI[0];
  const today = new Date().toISOString().slice(0, 10);
  const openOrders = workspace.orders.filter((order) => (order.status === "open" || order.status === "in_progress") && (asset === "all" || order.assetId === asset));
  const overdueOrders = openOrders.filter((order) => order.dueDate < today).length;
  const aggregateScope = data.workforce ? `${data.workforce.periodStart} → ${data.workforce.periodEnd}` : "sem indicadores agregados por cartão";

  const fleetRows = data.assets
    .filter((item) => asset === "all" || item.assetId === asset)
    .filter((item) => {
      if (card === "all") return true;
      const workforceHit = data.workforce?.cards.some((row) => row.cardCode === card && row.assets.some((entry) => entry.assetId === item.assetId));
      const eventHit = data.events.some((event) => event.cardCode === card && event.assetId === item.assetId);
      return !!workforceHit || eventHit;
    })
    .map((item) => {
      const rows = data.daily.filter((row) => row.assetId === item.assetId && between(row.date, activeFrom, activeTo));
      const assetTotals = dailyTotals(rows);
      const wf = workforceContext(data, item.assetId, card);
      const metrics = wf?.metrics ?? {};
      const assetEvents = data.events.filter((event) => event.assetId === item.assetId && between(event.date, activeFrom, activeTo) && (card === "all" || event.cardCode === card));
      const key = card !== "all" && metrics.keyHours != null ? metrics.keyHours : assetTotals.key;
      const work = card !== "all" && metrics.workHours != null ? metrics.workHours : assetTotals.work;
      const idle = card !== "all" && metrics.idleHours != null ? metrics.idleHours : assetTotals.idle;
      const assetMarch = metrics.forwardHours != null && metrics.reverseHours != null ? metrics.forwardHours + metrics.reverseHours : undefined;
      return {
        assetId: item.assetId,
        workPct: ratio(work, key),
        hydraulicPct: ratio(metrics.hydraulicHours, metrics.keyHours),
        marchPct: ratio(assetMarch, metrics.keyHours),
        highSpeedPct: ratio(metrics.highSpeedHours, metrics.keyHours),
        idlePct: ratio(idle, key),
        impacts: assetEvents.filter((event) => event.type === "Impacto").length,
        faults: assetEvents.filter((event) => event.type === "Falha do sistema").length
      };
    });

  const productivitySentence = workPct == null
    ? "Não há base suficiente para calcular trabalho/chave neste recorte."
    : `Trabalho registrado em ${fmt(workPct)}% da chave${hydraulicPct != null ? `; uso hidráulico em ${fmt(hydraulicPct)}% da chave no agregado disponível` : ""}.`;
  const movementSentence = marchPct == null
    ? "A origem não permite calcular uso de marcha neste contexto."
    : `Marcha registrada em ${fmt(marchPct)}% da chave${forwardShare != null && reverseShare != null ? `, com ${fmt(forwardShare)}% à frente e ${fmt(reverseShare)}% em ré` : ""}${highSpeedPct != null ? `; alta velocidade em ${fmt(highSpeedPct)}% da chave` : ""}.`;
  const safetySentence = impacts === 0 ? "Nenhum impacto foi registrado no filtro atual." : `${impacts} impacto(s) foram registrados no filtro atual e devem ser contextualizados antes de qualquer conclusão.`;

  return <main className="pageShell hyster">
    <header className="pulsoHeader">
      <div className="pulsoBrand"><div className="pulsoMark"><Sparkles size={20} /></div><div><span>Copiloto Operacional AI</span><h1>Pulso</h1></div></div>
      <div className="pulsoHeaderMeta"><span className="sourceBadge">Dados reais · schema v{data.schemaVersion}</span><span><CalendarRange size={15} /> {data.periodStart} → {data.periodEnd}</span><span><Truck size={15} /> {data.assets.length} equipamentos</span><a className="demoLink" href="/">Ver demo sintética</a><button className="iconAction" onClick={() => setView("base")} aria-label="Gerenciar base"><Settings2 size={18} /></button></div>
    </header>

    {error && <div className="inlineAlert" role="alert"><AlertTriangle size={18} /><span>{error}</span></div>}

    <nav className="productNav" aria-label="Navegação do Pulso">{navItems.map((item) => <button key={item.key} aria-current={view === item.key ? "page" : undefined} className={view === item.key ? "active" : ""} onClick={() => setView(item.key)}>{item.icon}<span>{item.label}</span>{item.key === "investigate" && highInsights > 0 && <em>{highInsights}</em>}</button>)}</nav>

    {(view === "overview" || view === "investigate") && <section className="globalFilters" aria-label="Filtros do contexto operacional">
      <div className="filterLead"><span className="sectionEyebrow">CONTEXTO</span><strong>{asset === "all" ? "Toda a frota" : asset}{card === "all" ? "" : ` · cartão ${card}`}</strong><small>{activeFrom} → {activeTo}</small></div>
      <div className="filterFields">
        <label>De<input type="date" min={data.periodStart} max={data.periodEnd} value={activeFrom} onChange={(event) => { const value = event.target.value; setDateFrom(value); if (value > activeTo) setDateTo(value); }} /></label>
        <label>Até<input type="date" min={data.periodStart} max={data.periodEnd} value={activeTo} onChange={(event) => { const value = event.target.value; setDateTo(value); if (value < activeFrom) setDateFrom(value); }} /></label>
        <label>Equipamento<select value={asset} onChange={(event) => setAsset(event.target.value)}><option value="all">Toda a frota</option>{data.assets.map((item) => <option key={item.assetId}>{item.assetId}</option>)}</select></label>
        <label>Operador (cartão)<select value={card} onChange={(event) => setCard(event.target.value)}><option value="all">Todos os cartões</option>{cards.map((code) => <option value={code} key={code}>Cartão {code}{cardNames.get(code) ? ` · ${cardNames.get(code)}` : ""}</option>)}</select></label>
        <button className="secondaryAction" onClick={() => { setAsset("all"); setCard("all"); setDateFrom(data.periodStart); setDateTo(data.periodEnd); }}>Limpar filtros</button>
      </div>
      {data.workforce && !workforceScopeIsExact && <div className="scopeNotice"><Gauge size={16} /><span>Hidráulica, velocidade, marcha e demais totais por cartão são agregados de <strong>{aggregateScope}</strong>; o Pulso não rateia esses valores pelo intervalo escolhido.</span></div>}
      {scopedByCard && data.workforce && <div className="scopeNotice"><Gauge size={16} /><span>As médias diária e mensal abaixo são as médias reportadas pela Hyster. Elas servem como referência e <strong>não são uma série diária reconstruída</strong>.</span></div>}
      {workforce?.warning && <div className="scopeNotice warning"><AlertTriangle size={16} /><span>{workforce.warning}</span></div>}
    </section>}

    {view === "overview" && <section className="executivePage">
      <div className="pageIntro"><div><span className="sectionEyebrow">VISÃO EXECUTIVA</span><h2>Entenda a operação antes de abrir os detalhes</h2><p>O Pulso transforma contadores e eventos em uma leitura operacional simples. Estatística e modelos ficam em segundo plano; a decisão continua humana.</p></div><button className="secondaryAction" onClick={() => setView("investigate")}><BrainCircuit size={17} /> Ver o que investigar</button></div>

      <section className="executiveKpis">
        <article><span>Trabalho / chave</span><strong>{workPct == null ? "n/d" : `${fmt(workPct)}%`}</strong><small>{scopedByCard ? `cartão ${card} · ${aggregateScope}` : `${fmt(displayedWork)} h de trabalho`}</small></article>
        <article className="productivityKpi"><span>Hidráulica / chave</span><strong>{hydraulicPct == null ? "n/d" : `${fmt(hydraulicPct)}%`}</strong><small>{hydraulicPct == null ? "indicador não disponível" : "atividade hidráulica registrada"}</small></article>
        <article><span>Marcha / chave</span><strong>{marchPct == null ? "n/d" : `${fmt(marchPct)}%`}</strong><small>{forwardShare != null && reverseShare != null ? `${fmt(forwardShare)}% frente · ${fmt(reverseShare)}% ré` : "frente/ré não disponível"}</small></article>
        <article><span>Ociosidade / chave</span><strong>{idlePct == null ? "n/d" : `${fmt(idlePct)}%`}</strong><small>{scopedByCard && dailyAverageIdle != null ? `média Hyster ${fmt(dailyAverageIdle)} h/dia` : `${fmt(displayedIdle)} h registradas`}</small></article>
        <article className={impacts ? "impactKpi" : ""}><span>Impactos</span><strong>{impacts}</strong><small>{faults} registro(s) de falha no mesmo filtro</small></article>
        <article><span>Ações abertas</span><strong>{openOrders.length}</strong><small>{overdueOrders ? `${overdueOrders} vencida(s)` : "nenhuma vencida"}</small></article>
      </section>

      <article className="surfaceCard fleetOverview"><div className="sectionHeading"><div><span className="sectionEyebrow">PERFIL OPERACIONAL HYSTER</span><h3>Novas métricas preservadas da origem</h3></div><span className="scopeChip">{scopedByCard ? `Cartão ${card}` : aggregateScope}</span></div><div className="hysterTable fleetTable"><table><thead><tr><th>Indicador</th><th>Total / proporção</th><th>Média diária Hyster</th><th>Leitura</th></tr></thead><tbody>
        <tr><th>{workforceMetricLabels.distanceKm}</th><td>{wfMetrics.distanceKm == null ? "n/d" : `${fmt(wfMetrics.distanceKm)} km`}</td><td>{dailyAverageDistance == null ? "—" : `${fmt(dailyAverageDistance)} km/dia`}</td><td>Intensidade de deslocamento no período agregado.</td></tr>
        <tr><th>{workforceMetricLabels.highSpeedHours}</th><td>{highSpeedPct == null ? "n/d" : `${fmt(highSpeedPct)}% da chave`}</td><td>{dailyAverageHighSpeed == null ? "—" : `${fmt(dailyAverageHighSpeed)} h/dia`}</td><td>Contexto de exposição a alta velocidade; não é classificação do operador.</td></tr>
        <tr><th>{workforceMetricLabels.lowLevelOverspeedHours}</th><td>{lowOverspeedPct == null ? "n/d" : `${fmt(lowOverspeedPct)}% da chave`}</td><td>{metricDailyAverage(data, card, asset, "lowLevelOverspeedHours") == null ? "—" : `${fmt(metricDailyAverage(data, card, asset, "lowLevelOverspeedHours"))} h/dia`}</td><td>{highOverspeedPct != null ? `Overspeed alto: ${fmt(highOverspeedPct)}% da chave.` : "Overspeed alto não disponível."}</td></tr>
        <tr><th>{workforceMetricLabels.auxiliaryHydraulicHours}</th><td>{auxiliaryHydraulicPct == null ? "n/d" : `${fmt(auxiliaryHydraulicPct)}% da chave`}</td><td>{metricDailyAverage(data, card, asset, "auxiliaryHydraulicHours") == null ? "—" : `${fmt(metricDailyAverage(data, card, asset, "auxiliaryHydraulicHours"))} h/dia`}</td><td>Ajuda a caracterizar o tipo de atividade realizada.</td></tr>
        <tr><th>Carga / descarregado</th><td>{loadedShare == null ? "n/d" : `${fmt(loadedShare)}% carregado`}</td><td>—</td><td>{wfMetrics.ladenHours === 0 ? "Sensor/indicador de carga está zerado nesta base; tratar como indisponível até validação." : `${fmt(wfMetrics.ladenHours)} h carregado · ${fmt(wfMetrics.unladenHours)} h descarregado`}</td></tr>
        <tr><th>{workforceMetricLabels.seatBeltViolationHours}</th><td>{wfMetrics.seatBeltViolationHours == null ? "n/d" : `${fmt(wfMetrics.seatBeltViolationHours)} h`}</td><td>{metricDailyAverage(data, card, asset, "seatBeltViolationHours") == null ? "—" : `${fmt(metricDailyAverage(data, card, asset, "seatBeltViolationHours"))} h/dia`}</td><td>{data.workforce?.metricAvailability?.seatBeltViolationHours?.cardsWithNonZero === 0 ? "Métrica disponível no contrato, mas zerada para todos os cartões deste período." : "Sinal de segurança para investigação contextual."}</td></tr>
      </tbody></table></div></article>

      <section className="interpretationCard">
        <div className="interpretationHeader"><div><span className="sectionEyebrow">LEITURA DO PULSO</span><h3>O que esses dados estão dizendo</h3></div><Sparkles size={22} /></div>
        <div className="interpretationGrid">
          <article><span>Produtividade</span><p>{productivitySentence}{scopedByCard && dailyAverageWork != null ? ` A média reportada pela Hyster é ${fmt(dailyAverageWork)} h de trabalho/dia.` : ""}</p></article>
          <article><span>Movimento</span><p>{movementSentence}</p></article>
          <article><span>Segurança e eventos</span><p>{safetySentence}{data.dataQuality?.eventExportCriticalOnly ? " A exportação de eventos está filtrada para Crítica = Sim, portanto não representa todo o universo de eventos." : ""}</p></article>
          <article><span>Prioridade</span><p>{filteredAI.length ? `O Pulso separou ${filteredAI.length} situação(ões) para revisão; ${highInsights} exigem atenção maior.` : "Nenhuma situação foi priorizada pelo motor neste recorte. Isso não substitui inspeção ou rotina operacional."}</p></article>
        </div>
      </section>

      <section className="priorityWorkspace humanFirst">
        <aside className="priorityListPane"><div className="sectionHeading"><div><span className="sectionEyebrow">PRIORIDADES</span><h3>O que merece atenção agora</h3></div><Gauge size={22} /></div><div className="priorityList">
          {filteredAI.slice(0, 5).map((insight) => <button key={insight.id} className={summarySelected?.id === insight.id ? "selected" : ""} onClick={() => setFocusInsightId(insight.id)}><span className={`priorityPill ${insight.priority}`}>{insight.priority === "high" ? "Alta" : "Atenção"}</span><div><strong>{insight.assetId} · {insight.date}</strong><p>{plainInsight(insight)}</p><small>{insight.relatedCardCodes.length ? `Cartão(ões): ${insight.relatedCardCodes.join(", ")}` : "Sem cartão associado no evento"}</small></div><ChevronRight size={17} /></button>)}
          {!filteredAI.length && <div className="quietState">Nenhuma situação foi priorizada neste filtro.</div>}
        </div></aside>
        <article className="priorityDetailPane">{summarySelected ? <><div className="detailTopline"><span className={`priorityPill ${summarySelected.priority}`}>{summarySelected.priority === "high" ? "Alta atenção" : "Atenção"}</span><span>{summarySelected.assetId} · {summarySelected.date}</span></div><h3>{plainInsight(summarySelected)}</h3><div className="humanGuidance"><article><span>Por que importa</span><p>{whyItMatters(summarySelected)}</p></article><article><span>O que verificar</span><p>{simpleOrientation(summarySelected)}</p></article></div><div className="detailActions"><button className="primaryAction" onClick={() => openInsight(summarySelected)}>Entender esta situação</button><button className="secondaryAction" onClick={() => registerAIAction(summarySelected)}>Registrar ação</button></div><small className="guardrailCopy">A leitura ajuda a priorizar investigação; não comprova causa nem responsabilidade individual.</small></> : <div className="quietState large">Selecione uma situação para ver a orientação do Pulso.</div>}</article>
      </section>

      <article className="surfaceCard fleetOverview"><div className="sectionHeading"><div><span className="sectionEyebrow">COMPARAÇÃO</span><h3>Equipamentos no contexto selecionado</h3></div><span className="scopeChip">Hidráulica, velocidade e marcha: {aggregateScope}</span></div><div className="hysterTable fleetTable"><table><thead><tr><th>Equipamento</th><th>Trabalho/chave</th><th>Hidráulica/chave</th><th>Marcha/chave</th><th>Alta velocidade</th><th>Ociosidade/chave</th><th>Impactos</th><th>Falhas</th><th></th></tr></thead><tbody>{fleetRows.map((row) => <tr key={row.assetId}><th>{row.assetId}</th><td>{row.workPct == null ? "n/d" : `${fmt(row.workPct)}%`}</td><td>{row.hydraulicPct == null ? "n/d" : `${fmt(row.hydraulicPct)}%`}</td><td>{row.marchPct == null ? "n/d" : `${fmt(row.marchPct)}%`}</td><td>{row.highSpeedPct == null ? "n/d" : `${fmt(row.highSpeedPct)}%`}</td><td>{row.idlePct == null ? "n/d" : `${fmt(row.idlePct)}%`}</td><td>{row.impacts}</td><td>{row.faults}</td><td><button className="rowAction" onClick={() => { setAsset(row.assetId); setView("investigate"); }}>Investigar</button></td></tr>)}</tbody></table></div></article>
    </section>}

    {view === "investigate" && <section className="contentSection"><div className="pageIntro"><div><span className="sectionEyebrow">INVESTIGAR</span><h2>Do sinal à decisão, sem jargão na primeira leitura</h2><p>O Pulso explica o que mudou, por que merece atenção e o que vale verificar. Os detalhes estatísticos ficam disponíveis apenas quando necessários.</p></div></div><OperationalAIPanel data={data} assetFilter={asset} cardFilter={card} dateFrom={activeFrom} dateTo={activeTo} initialInsightId={focusInsightId} onRegisterAction={registerAIAction} /></section>}

    {view === "actions" && <section className="contentSection"><div className="pageIntro"><div><span className="sectionEyebrow">AÇÕES</span><h2>Registre a decisão e acompanhe o resultado</h2><p>Transforme uma evidência validada em investigação, manutenção ou melhoria operacional. O Pulso não abre ação automaticamente.</p></div></div><OperationsConsole tab="maintenance" workspace={workspace} data={data} save={save} busy={busy} suggestion={suggestion} /></section>}

    {view === "base" && <section className="contentSection basePage"><div className="pageIntro"><div><span className="sectionEyebrow">BASE</span><h2>Dados, qualidade e persistência</h2><p>Importação e funções administrativas ficam fora da visão executiva.</p></div></div><section className="baseGrid"><article className="surfaceCard baseActions"><h3>Base operacional</h3><p><strong>{data.periodStart} → {data.periodEnd}</strong><br />{data.assets.length} equipamentos · {data.sources.length} fontes registradas · schema v{data.schemaVersion}</p><label className="primaryUpload">Importar nova base JSON<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label><button className="secondaryAction" disabled={!ready || busy} onClick={backup}>Exportar backup</button><label className="secondaryUpload">Restaurar backup<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void restore(event.target.files?.[0])} /></label><small role="status">{!ready ? "Recuperando…" : busy ? "Salvando…" : saved}</small></article><article className="surfaceCard"><h3>Qualidade observada</h3><ul className="qualityList"><li><strong>{fullReport.quality.waitAboveIdle}</strong><span>registros com espera maior que ociosidade</span></li><li><strong>{fullReport.quality.nonAdditive}</strong><span>registros com contadores não aditivos</span></li><li><strong>{fullReport.quality.rowsOmitted ?? "n/d"}</strong><span>equipamento-dias ausentes no Daily Fleet</span></li><li><strong>{data.dataQuality?.eventExportCriticalOnly ? "sim" : "não"}</strong><span>histórico de eventos filtrado apenas para críticos</span></li><li><strong>{data.fuel.every((item) => item.reportedLiters === 0) ? "n/d" : "ok"}</strong><span>combustível validado</span></li><li><strong>{data.maintenanceAvailable ? "sim" : "não"}</strong><span>manutenção detalhada na origem</span></li></ul><p className="mutedCopy">O Pulso não preenche dias ausentes, não inventa economia, não transforma ausência em zero e não reconstrói série diária a partir de médias Hyster.</p></article></section><article className="surfaceCard"><h3>Fontes da operação</h3><div className="sourceList">{data.sources.map((source) => <details key={source.sha256}><summary>{source.file}</summary><code>{source.sha256}</code><p>{source.sheets.map((sheet) => `${sheet.name} · ${sheet.rows} linhas${sheet.range ? ` · ${sheet.range}` : ""}`).join(" · ")}</p></details>)}</div></article><article className="surfaceCard"><h3>Dados complementares e apontamentos</h3><p>Planejamento, parada, combustível, custo e produção inseridos pela gestão continuam locais neste navegador.</p><OperationsConsole tab="inputs" workspace={workspace} data={data} save={save} busy={busy} /></article></section>}
  </main>;
}