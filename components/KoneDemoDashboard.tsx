"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Box,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Factory,
  Fuel,
  Gauge,
  HardHat,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  Truck,
  Weight,
  Wrench
} from "lucide-react";
import type { KoneDemoInsight, KoneDemoRecord, DemoShift } from "@/lib/koneDemo";
import PeriodPicker from "./PeriodPicker";
import PulsoSidebar, { type PulsoViewKey } from "./PulsoSidebar";
import ResizableSplit from "./ResizableSplit";
import "./hyster.css";
import "./kone-demo.css";

type Payload = {
  mode: "demo";
  generatedAt: string;
  scenario: {
    name: string;
    providerReference: string;
    fleetSize: number;
    truckCapacityT: number;
    baleWeightT: number;
    balesPerLoadedMovement: number;
    tonnesPerLoadedMovement: number;
    businessRule: string;
    shifts: Array<{ code: DemoShift; start: string; end: string }>;
    granularity: { pulsoNormalized: string; providerNative: string };
  };
  source: {
    provider: string;
    product: string;
    dataNature: string;
    disclaimer: string;
    publicCapabilities: string[];
    unsupportedInPublicReferenceUsed: string[];
  };
  periodStart: string;
  periodEnd: string;
  records: KoneDemoRecord[];
  insights: KoneDemoInsight[];
  fleet: Array<{
    assetId: string;
    capacity: string;
    insights: number;
    summary: Summary;
  }>;
  summary: Summary;
};

type Summary = {
  runningHours: number;
  drivingHours: number;
  idleHours: number;
  idlePct: number | null;
  totalLoadLiftedT: number;
  balesMoved: number;
  loadedMovements: number;
  tonnesPerDrivingHour: number | null;
  fuelLiters: number;
  fuelPerTonne: number | null;
  distanceKm: number;
  avgSpeedKmh: number;
  highSpeedSharePct: number;
  emptyTravelPct: number;
  shocks: number;
  overloads: number;
  minMaintenanceHoursRemaining: number | null;
};

type AssistMode = "summary" | "productivity" | "safety" | "maintenance";

const fmt = (value: number | null | undefined, digits = 0) =>
  value == null
    ? "n/d"
    : value.toLocaleString("pt-BR", { maximumFractionDigits: digits, minimumFractionDigits: digits });

const pct = (value: number | null | undefined) => value == null ? "n/d" : `${fmt(value)}%`;

function aggregate(records: KoneDemoRecord[]): Summary {
  const runningHours = records.reduce((sum, row) => sum + row.runningHours, 0);
  const drivingHours = records.reduce((sum, row) => sum + row.drivingHours, 0);
  const idleHours = records.reduce((sum, row) => sum + row.idleHours, 0);
  const totalLoadLiftedT = records.reduce((sum, row) => sum + row.totalLoadLiftedT, 0);
  const fuelLiters = records.reduce((sum, row) => sum + row.fuelLiters, 0);
  const distanceKm = records.reduce((sum, row) => sum + row.distanceKm, 0);
  const shocks = records.reduce((sum, row) => sum + row.shocks, 0);
  const overloads = records.reduce((sum, row) => sum + row.overloads, 0);
  const avgSpeedKmh = drivingHours > 0
    ? records.reduce((sum, row) => sum + row.avgSpeedKmh * row.drivingHours, 0) / drivingHours
    : 0;
  const highSpeedSharePct = drivingHours > 0
    ? records.reduce((sum, row) => sum + row.highSpeedSharePct * row.drivingHours, 0) / drivingHours
    : 0;
  const emptyTravelPct = drivingHours > 0
    ? records.reduce((sum, row) => sum + row.emptyTravelPct * row.drivingHours, 0) / drivingHours
    : 0;
  const minMaintenanceHoursRemaining = records.length ? Math.min(...records.map((row) => row.maintenanceHoursRemaining)) : null;

  return {
    runningHours,
    drivingHours,
    idleHours,
    idlePct: runningHours > 0 ? idleHours / runningHours * 100 : null,
    totalLoadLiftedT,
    balesMoved: totalLoadLiftedT / 2,
    loadedMovements: totalLoadLiftedT / 4,
    tonnesPerDrivingHour: drivingHours > 0 ? totalLoadLiftedT / drivingHours : null,
    fuelLiters,
    fuelPerTonne: totalLoadLiftedT > 0 ? fuelLiters / totalLoadLiftedT : null,
    distanceKm,
    avgSpeedKmh,
    highSpeedSharePct,
    emptyTravelPct,
    shocks,
    overloads,
    minMaintenanceHoursRemaining
  };
}

function viewTitle(view: PulsoViewKey) {
  if (view === "investigate") return "Investigar";
  if (view === "actions") return "Ações";
  if (view === "base") return "Fonte e capacidades";
  return "Visão geral";
}

function categoryLabel(category: KoneDemoInsight["category"]) {
  if (category === "productivity") return "Produtividade";
  if (category === "safety") return "Segurança";
  return "Manutenção";
}

function priorityLabel(priority: KoneDemoInsight["priority"]) {
  return priority === "high" ? "Alta atenção" : "Atenção";
}

export default function KoneDemoDashboard() {
  const [data, setData] = useState<Payload>();
  const [error, setError] = useState("");
  const [view, setView] = useState<PulsoViewKey>("overview");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [asset, setAsset] = useState("all");
  const [shift, setShift] = useState<"all" | DemoShift>("all");
  const [selectedAsset, setSelectedAsset] = useState<string>();
  const [selectedInsightId, setSelectedInsightId] = useState<string>();
  const [assistMode, setAssistMode] = useState<AssistMode>("summary");
  const [generated, setGenerated] = useState<string>();

  useEffect(() => {
    fetch("/api/demo/kone")
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a demo.");
        return response.json() as Promise<Payload>;
      })
      .then((payload) => {
        setData(payload);
        setDateFrom(payload.periodStart);
        setDateTo(payload.periodEnd);
        setSelectedAsset(payload.fleet[0]?.assetId);
        setSelectedInsightId(payload.insights[0]?.id);
      })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  const filteredRecords = useMemo(() => {
    if (!data) return [];
    return data.records.filter((row) =>
      row.date >= dateFrom &&
      row.date <= dateTo &&
      (asset === "all" || row.assetId === asset) &&
      (shift === "all" || row.shift === shift)
    );
  }, [data, dateFrom, dateTo, asset, shift]);

  const summary = useMemo(() => aggregate(filteredRecords), [filteredRecords]);

  const filteredInsights = useMemo(() => {
    if (!data) return [];
    return data.insights.filter((insight) =>
      insight.date >= dateFrom &&
      insight.date <= dateTo &&
      (asset === "all" || insight.assetId === asset) &&
      (shift === "all" || insight.shift === shift)
    );
  }, [data, dateFrom, dateTo, asset, shift]);

  const fleetRows = useMemo(() => {
    if (!data) return [];
    return data.fleet
      .filter((item) => asset === "all" || item.assetId === asset)
      .map((item) => {
        const rows = filteredRecords.filter((row) => row.assetId === item.assetId);
        return {
          assetId: item.assetId,
          capacity: item.capacity,
          summary: aggregate(rows),
          productionRows: rows.filter((row) => row.usageContext === "production").length,
          maintenanceRows: rows.filter((row) => row.usageContext === "maintenance").length,
          insightCount: filteredInsights.filter((insight) => insight.assetId === item.assetId).length
        };
      })
      .sort((a, b) => b.insightCount - a.insightCount || (b.summary.shocks ?? 0) - (a.summary.shocks ?? 0));
  }, [data, asset, filteredRecords, filteredInsights]);

  const currentAsset = fleetRows.find((item) => item.assetId === selectedAsset) ?? fleetRows[0];
  const currentInsight = filteredInsights.find((item) => item.id === selectedInsightId)
    ?? filteredInsights.find((item) => item.assetId === currentAsset?.assetId)
    ?? filteredInsights[0];

  useEffect(() => {
    if (!currentAsset && fleetRows[0]) setSelectedAsset(fleetRows[0].assetId);
  }, [currentAsset, fleetRows]);

  useEffect(() => {
    if (currentInsight) setSelectedInsightId(currentInsight.id);
  }, [currentAsset?.assetId]);

  useEffect(() => {
    if (!currentInsight) {
      setGenerated(undefined);
      return;
    }
    const controller = new AbortController();
    setGenerated(undefined);
    fetch("/api/demo/kone/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ insight: currentInsight }),
      signal: controller.signal
    })
      .then(async (response) => {
        if (!response.ok) return undefined;
        return response.json() as Promise<{ explanation?: string }>;
      })
      .then((result) => setGenerated(result?.explanation))
      .catch(() => undefined);
    return () => controller.abort();
  }, [currentInsight?.id]);

  if (error) {
    return <main className="koneDemo loadingPage"><AlertTriangle size={28} /><h1>Demo indisponível</h1><p>{error}</p></main>;
  }
  if (!data) {
    return <main className="koneDemo loadingPage"><BrainCircuit className="pulse" size={30} /><h1>Preparando cenário de celulose…</h1><p>Gerando telemetria sintética e contexto operacional.</p></main>;
  }

  function assistantCopy() {
    if (!currentAsset) return "Selecione um equipamento.";
    const s = currentAsset.summary;
    if (assistMode === "productivity") {
      return `${currentAsset.assetId} movimentou ${fmt(s.totalLoadLiftedT)} t (${fmt(s.balesMoved)} fardos) no contexto filtrado, com ${fmt(s.tonnesPerDrivingHour, 1)} t por hora em deslocamento e ${fmt(s.fuelPerTonne, 2)} L/t. A demo usa 2 fardos de 2 t por movimento produtivo; o Pulso compara o resultado com o histórico do mesmo ativo/turno antes de sugerir investigação.`;
    }
    if (assistMode === "safety") {
      return `${currentAsset.assetId} registrou ${s.shocks} impacto(s), velocidade média de ${fmt(s.avgSpeedKmh, 1)} km/h e ${fmt(s.highSpeedSharePct)}% do deslocamento na faixa alta normalizada da demo. Frente/ré não aparece porque essa variável não está listada na referência pública Konecranes usada para este cenário.`;
    }
    if (assistMode === "maintenance") {
      return `O menor contador de próxima manutenção de ${currentAsset.assetId} no filtro está em ${fmt(s.minMaintenanceHoursRemaining)} h. Alertas de diagnóstico e o contador são tratados como sinais para planejamento, não como diagnóstico automático de falha.`;
    }
    if (currentInsight) return `${currentInsight.assetId}: ${currentInsight.whatHappened} ${currentInsight.whyItMatters}`;
    return `${currentAsset.assetId} está sem sinal priorizado no recorte atual. O Pulso continua mostrando carga, consumo, modos de uso, velocidade e manutenção para acompanhamento.`;
  }

  const kpis = [
    { label: "Carga movimentada", value: `${fmt(summary.totalLoadLiftedT)} t`, detail: `${fmt(summary.balesMoved)} fardos · ${fmt(summary.loadedMovements)} movimentos`, icon: <Weight size={18} /> },
    { label: "Produtividade", value: `${fmt(summary.tonnesPerDrivingHour, 1)} t/h`, detail: "toneladas por hora em deslocamento", icon: <PackageCheck size={18} /> },
    { label: "Combustível", value: `${fmt(summary.fuelPerTonne, 2)} L/t`, detail: `${fmt(summary.fuelLiters)} L no período`, icon: <Fuel size={18} /> },
    { label: "Tempo ocioso", value: pct(summary.idlePct), detail: `${fmt(summary.idleHours, 1)} h em idle`, icon: <Clock3 size={18} /> },
    { label: "Deslocamento vazio", value: pct(summary.emptyTravelPct), detail: "sobre tempo em deslocamento", icon: <Truck size={18} /> },
    { label: "Impactos", value: fmt(summary.shocks), detail: `${summary.overloads} sobrecarga(s)`, icon: <ShieldAlert size={18} />, attention: summary.shocks > 0 }
  ];

  return <main className={`hyster appShell koneDemo ${sidebarCollapsed ? "sidebarCollapsed" : ""}`}>
    <PulsoSidebar
      view={view}
      onChange={setView}
      attentionCount={filteredInsights.filter((item) => item.priority === "high").length}
      collapsed={sidebarCollapsed}
      onToggleCollapsed={() => setSidebarCollapsed((value) => !value)}
    />

    <div className="pulsoMain">
      <header className="pulsoTopbar">
        <div>
          <span className="topbarKicker">PULSO · DEMO MULTI-OEM</span>
          <h1>{viewTitle(view)}</h1>
        </div>
        <div className="topbarMeta">
          <span className="sourceBadge">Konecranes · simulado</span>
          <span><Factory size={15} /> celulose</span>
          <span><Truck size={15} /> {data.scenario.fleetSize} × 16 t</span>
          <span>{data.periodStart} → {data.periodEnd}</span>
        </div>
      </header>

      {(view === "overview" || view === "investigate") && <section className="contextToolbar">
        <PeriodPicker
          min={data.periodStart}
          max={data.periodEnd}
          from={dateFrom}
          to={dateTo}
          onChange={(from, to) => { setDateFrom(from); setDateTo(to); }}
        />
        <label className="toolbarField"><span>Equipamento</span><select value={asset} onChange={(event) => { setAsset(event.target.value); setSelectedAsset(event.target.value === "all" ? data.fleet[0]?.assetId : event.target.value); }}><option value="all">Toda a frota</option>{data.fleet.map((item) => <option key={item.assetId} value={item.assetId}>{item.assetId}</option>)}</select></label>
        <label className="toolbarField"><span>Turno</span><select value={shift} onChange={(event) => setShift(event.target.value as "all" | DemoShift)}><option value="all">A + B + C</option>{data.scenario.shifts.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.start}–{item.end}</option>)}</select></label>
        <button className="toolbarReset" type="button" onClick={() => { setAsset("all"); setShift("all"); setDateFrom(data.periodStart); setDateTo(data.periodEnd); }}>Limpar filtros</button>
        <div className="contextSummary"><strong>{asset === "all" ? "Toda a frota" : asset}</strong><span>{shift === "all" ? "todos os turnos" : `turno ${shift}`}</span></div>
      </section>}

      {view === "overview" && <section className="overviewPage">
        <section className="demoAssumptionBar">
          <div><Box size={18} /><span><strong>2 t por fardo</strong> · 2 fardos por movimento · <strong>4 t/movimento</strong></span></div>
          <div><Truck size={18} /><span>empilhadeira 16 t · garfo · operação principal de celulose</span></div>
          <small>Premissas sintéticas da demo, não dados do fabricante.</small>
        </section>

        <section className="kpiRibbon">
          {kpis.map((item) => <article key={item.label} className={item.attention ? "attention" : ""}>
            <div className="kpiTop"><span className="kpiIcon">{item.icon}</span><span>{item.label}</span></div>
            <strong>{item.value}</strong>
            <div className="kpiMeter empty" />
            <small>{item.detail}</small>
          </article>)}
        </section>

        <div className="overviewTitleRow">
          <div><span className="sectionEyebrow">CONTEXTO OPERACIONAL</span><h2>O mesmo Pulso, métricas do fornecedor disponível</h2><p>A UI preserva o padrão de gestão do Hyster, mas troca os indicadores conforme as capacidades do adaptador Konecranes.</p></div>
          <span className="scopeChip">Pulso normalizado · asset-shift</span>
        </div>

        <ResizableSplit
          className="operationsCopilotSplit"
          left={<section className="fleetWorkspace">
            <div className="fleetGridHeader"><div><strong>Frota de celulose</strong><span>{fleetRows.length} equipamentos no filtro</span></div><span className="scopeChip">{data.source.product}</span></div>
            <div className="fleetDataGrid demoFleetGrid">
              <table>
                <thead><tr><th>Equipamento</th><th>Carga</th><th>t/h</th><th>L/t</th><th>Vazio</th><th>Velocidade</th><th>Impactos</th><th>Manut.</th></tr></thead>
                <tbody>{fleetRows.map((row) => <tr key={row.assetId} className={currentAsset?.assetId === row.assetId ? "selectedRow" : ""} onClick={() => setSelectedAsset(row.assetId)}>
                  <th><button className="assetSelect" type="button" onClick={(event) => { event.stopPropagation(); setSelectedAsset(row.assetId); }}>{row.assetId}</button><small>{row.capacity}</small></th>
                  <td>{fmt(row.summary.totalLoadLiftedT)} t</td>
                  <td>{fmt(row.summary.tonnesPerDrivingHour, 1)}</td>
                  <td>{fmt(row.summary.fuelPerTonne, 2)}</td>
                  <td>{pct(row.summary.emptyTravelPct)}</td>
                  <td>{fmt(row.summary.avgSpeedKmh, 1)} km/h</td>
                  <td><span className={row.summary.shocks ? "impactCount active" : "impactCount"}>{row.summary.shocks}</span></td>
                  <td>{fmt(row.summary.minMaintenanceHoursRemaining)} h</td>
                </tr>)}</tbody>
              </table>
            </div>

            <div className="priorityCompact">
              <div className="sectionHeading"><div><span className="sectionEyebrow">PONTOS DE ATENÇÃO</span><h3>O que merece investigação</h3></div><button className="textAction" type="button" onClick={() => setView("investigate")}>Ver detalhes</button></div>
              <div className="priorityChips">
                {filteredInsights.slice(0, 4).map((insight) => <button key={insight.id} type="button" onClick={() => { setSelectedAsset(insight.assetId); setSelectedInsightId(insight.id); }}>
                  <span className={`priorityPill ${insight.priority}`}>{priorityLabel(insight.priority)}</span>
                  <strong>{insight.assetId}</strong>
                  <span>{insight.headline}</span>
                </button>)}
                {!filteredInsights.length && <div className="quietState">Nenhum sinal priorizado neste contexto.</div>}
              </div>
            </div>
          </section>}
          right={<aside className="copilotDock">
            <div className="copilotDockHeader"><div className="copilotGlyph"><Sparkles size={20} /></div><div><span className="sectionEyebrow">POTENCIALIZE COM O PULSO</span><h3>{currentAsset?.assetId ?? "Frota"}</h3></div></div>
            <div className="copilotSuggestions">
              <button className={assistMode === "summary" ? "active" : ""} type="button" onClick={() => setAssistMode("summary")}>Resumo</button>
              <button className={assistMode === "productivity" ? "active" : ""} type="button" onClick={() => setAssistMode("productivity")}>Produtividade</button>
              <button className={assistMode === "safety" ? "active" : ""} type="button" onClick={() => setAssistMode("safety")}>Segurança</button>
              <button className={assistMode === "maintenance" ? "active" : ""} type="button" onClick={() => setAssistMode("maintenance")}>Manutenção</button>
            </div>
            <article className="copilotReading"><span>Leitura operacional</span><p>{generated || assistantCopy()}</p></article>
            {currentAsset && <div className="copilotFacts">
              <div><span>Carga</span><strong>{fmt(currentAsset.summary.totalLoadLiftedT)} t</strong></div>
              <div><span>Produtividade</span><strong>{fmt(currentAsset.summary.tonnesPerDrivingHour, 1)} t/h</strong></div>
              <div><span>Combustível</span><strong>{fmt(currentAsset.summary.fuelPerTonne, 2)} L/t</strong></div>
              <div><span>Velocidade</span><strong>{fmt(currentAsset.summary.avgSpeedKmh, 1)} km/h</strong></div>
            </div>}
            {currentInsight && <article className="copilotSignal">
              <span className={`priorityPill ${currentInsight.priority}`}>{priorityLabel(currentInsight.priority)}</span>
              <strong>{currentInsight.headline}</strong>
              <small>{currentInsight.context}</small>
            </article>}
            <div className="copilotActions">
              <button className="primaryAction" type="button" disabled={!currentInsight} onClick={() => setView("investigate")}><BrainCircuit size={17} /> Aprofundar investigação</button>
            </div>
          </aside>}
        />
      </section>}

      {view === "investigate" && <section className="contentSection investigatePage demoInvestigate">
        <div className="pageIntro compact"><div><span className="sectionEyebrow">INVESTIGAR</span><h2>Contexto antes da conclusão</h2><p>O motor usa baseline do mesmo ativo/turno, segunda opinião multivariada e regras de granularidade antes de orientar o humano.</p></div></div>
        <div className="demoInvestigationGrid">
          <aside className="demoInsightQueue">
            {filteredInsights.map((insight) => <button key={insight.id} className={currentInsight?.id === insight.id ? "active" : ""} type="button" onClick={() => { setSelectedInsightId(insight.id); setSelectedAsset(insight.assetId); }}>
              <span className={`priorityPill ${insight.priority}`}>{priorityLabel(insight.priority)}</span>
              <strong>{insight.assetId} · turno {insight.shift}</strong>
              <span>{categoryLabel(insight.category)} · {insight.headline}</span>
            </button>)}
            {!filteredInsights.length && <div className="quietState">Nenhum sinal no filtro.</div>}
          </aside>
          <article className="demoInsightDetail">
            {!currentInsight && <div className="quietState large">Selecione outro período ou equipamento.</div>}
            {currentInsight && <>
              <div className="detailTopline"><span className={`priorityPill ${currentInsight.priority}`}>{priorityLabel(currentInsight.priority)}</span><span>{currentInsight.assetId} · {currentInsight.date} · turno {currentInsight.shift}</span></div>
              <h2>{currentInsight.headline}</h2>
              <article className="copilotExplanation"><div className="cardTitle"><Sparkles size={18} /> Leitura do Pulso</div><p>{generated || currentInsight.whatHappened}</p><p><strong>Por que importa:</strong> {currentInsight.whyItMatters}</p></article>
              <div className="demoEvidenceGrid">
                <article className="contextEvidence"><div className="cardTitle"><Factory size={18} /> Contexto do processo</div><p>{currentInsight.context}</p><p><small>{data.scenario.businessRule}</small></p></article>
                <article className="contextEvidence"><div className="cardTitle"><HardHat size={18} /> O que verificar</div><ul>{currentInsight.verify.map((item) => <li key={item}>{item}</li>)}</ul></article>
              </div>
              <details className="technicalDetails"><summary><Gauge size={17} /> Detalhes técnicos da detecção</summary>
                <div className="hysterTable"><table><thead><tr><th>Métrica</th><th>Atual</th><th>Histórico</th><th>Desvio</th></tr></thead><tbody>{currentInsight.technical.evidence.map((item) => <tr key={item.label}><th>{item.label}</th><td>{fmt(item.current, 2)} {item.unit}</td><td>{fmt(item.mean, 2)} {item.unit}</td><td>{item.zScore > 0 ? "+" : ""}{fmt(item.zScore, 2)}σ</td></tr>)}</tbody></table></div>
                <p><small>{currentInsight.technical.baselineSamples} registros comparáveis em até {currentInsight.technical.lookbackDays} dias · segunda opinião Isolation Forest: {currentInsight.technical.isolationForestPercentile == null ? "não aplicável" : `${fmt(currentInsight.technical.isolationForestPercentile)}º percentil`}.</small></p>
              </details>
            </>}
          </article>
        </div>
      </section>}

      {view === "actions" && <section className="contentSection demoActions">
        <div className="pageIntro compact"><div><span className="sectionEyebrow">AÇÕES</span><h2>Da evidência para a rotina</h2><p>A demo não executa ações automaticamente. Mostra quais verificações o humano pode registrar no fluxo real do Pulso.</p></div></div>
        <div className="demoActionCards">{filteredInsights.map((insight) => <article key={insight.id} className="surfaceCard">
          <div className="cardTitle"><CheckCircle2 size={17} /> {insight.assetId} · {categoryLabel(insight.category)}</div>
          <h3>{insight.headline}</h3>
          <p>{insight.verify.join(" → ")}</p>
          <small>Decisão, inspeção e registro continuam humanos.</small>
        </article>)}</div>
      </section>}

      {view === "base" && <section className="contentSection demoSource">
        <div className="pageIntro compact"><div><span className="sectionEyebrow">FONTE E CAPACIDADES</span><h2>Adaptador por semântica, não por tela fixa</h2><p>O Pulso mantém a mesma experiência e muda os indicadores conforme o que cada fonte realmente entrega.</p></div></div>
        <div className="baseGrid">
          <article className="surfaceCard"><h3>Konecranes · referência pública usada</h3><ul className="demoCapabilityList">{data.source.publicCapabilities.map((item) => <li key={item}><CheckCircle2 size={15} /> {item}</li>)}</ul></article>
          <article className="surfaceCard"><h3>Não inventado nesta demo</h3><ul className="demoCapabilityList muted">{data.source.unsupportedInPublicReferenceUsed.map((item) => <li key={item}><AlertTriangle size={15} /> {item}</li>)}</ul><p><small>Se outro adaptador fornecer essas dimensões — como no Hyster — a UI pode mostrá-las sem mudar a arquitetura do produto.</small></p></article>
        </div>
        <article className="surfaceCard demoProvenance"><h3>Granularidade</h3><p><strong>Pulso demo:</strong> {data.scenario.granularity.pulsoNormalized}.</p><p><strong>Konecranes:</strong> {data.scenario.granularity.providerNative}</p><p>{data.source.disclaimer}</p></article>
      </section>}
    </div>
  </main>;
}
