"use client";

import { useEffect, useMemo, useState } from "react";
import { analyzeHyster, validateHyster } from "@/lib/hyster";
import { analyzeOperationalAI, type OperationalAIInsight } from "@/lib/operationalAI";
import { addDataset, combineDatasets, emptyWorkspace, validateWorkspace, type Workspace } from "@/lib/operations";
import { readWorkspace, saveWorkspace } from "@/lib/operationsStorage";
import OperationsConsole, { type OperationsTab } from "./OperationsConsole";
import WorkforceCards from "./WorkforceCards";
import OperationalAIPanel from "./OperationalAIPanel";
import "./hyster.css";

const fmt = (value: number | null | undefined, digits = 2) => value == null ? "Sem dados" : value.toLocaleString("pt-BR", { maximumFractionDigits: digits });

type DashboardTab = OperationsTab | "ai";

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
  const [tab, setTab] = useState<DashboardTab>("overview");
  const [suggestion, setSuggestion] = useState<{ assetId: string; title: string }>();
  const [month, setMonth] = useState("all");
  const [asset, setAsset] = useState("all");
  const [error, setError] = useState("");

  const data = useMemo(() => combineDatasets(workspace.datasets), [workspace.datasets]);
  const report = useMemo(() => data ? analyzeHyster(data, month, asset) : null, [data, month, asset]);
  const ai = useMemo(() => data ? analyzeOperationalAI(data) : null, [data]);
  const filteredAI = useMemo(() => ai?.insights.filter((insight) =>
    (asset === "all" || insight.assetId === asset) && (month === "all" || insight.date.startsWith(month))
  ) ?? [], [ai, asset, month]);

  useEffect(() => {
    readWorkspace()
      .then((loaded) => {
        setWorkspace(loaded);
        setReady(true);
        setSaved("Histórico recuperado deste navegador.");
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
      if (containsHistoricalDataset(raw)) throw new Error("Este backup contém uma base histórica que não faz parte do Pulso atual.");
      const restored = validateWorkspace(raw);
      if (!window.confirm("Restaurar este backup substituirá o histórico e os apontamentos deste navegador. Exporte o backup atual antes de continuar.")) return;
      await save(restored);
      setError("");
      setMonth("all");
      setAsset("all");
    } catch (cause) {
      setError((cause as Error).message);
    }
  }

  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Limite de 20 MB por arquivo.");
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      if (containsHistoricalDataset(raw)) throw new Error("Esta base contém referência histórica fora da operação atual. Gere novamente o pacote apenas com o período operacional.");
      const parsed = validateHyster(raw);
      await save(addDataset(workspace, parsed));
      setMonth("all");
      setAsset("all");
      setTab("overview");
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Arquivo inválido");
    }
  }

  function registerAIAction(insight: OperationalAIInsight) {
    setSuggestion({ assetId: insight.assetId, title: `Investigar ${insight.title.toLowerCase()} · ${insight.date}` });
    setTab("maintenance");
  }

  const latest = workspace.datasets.at(-1);
  const openOrders = workspace.orders.filter((order) => order.status === "open" || order.status === "in_progress").length;

  return <main className="pageShell hyster">
    <header className="hero">
      <div>
        <div className="eyebrow">COPILOTO OPERACIONAL AI · PULSO</div>
        <h1>Pulso <span>da operação</span></h1>
        <p>Dados reais → padrão → evidência → explicação → decisão humana.</p>
      </div>
    </header>

    <section className="trustBanner">
      <div>
        <strong>Uma base operacional, uma camada de inteligência.</strong>
        <p>Importe um único JSON. O Pulso cruza utilização, eventos, indicadores por cartão e gestão operacional; o motor AI aprende o histórico do próprio equipamento, aplica z-score e Isolation Forest e prioriza o que merece investigação.</p>
        <div className="hysterFilters">
          <label className="hysterUpload">Importar base operacional JSON<input disabled={!ready || busy} aria-label="Selecionar base operacional JSON" type="file" accept=".json,application/json" onChange={(event) => void importFile(event.target.files?.[0])} /></label>
          <button disabled={!ready || busy} onClick={backup}>Exportar backup da gestão</button>
          <label className="hysterUpload">Restaurar backup<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={(event) => void restore(event.target.files?.[0])} /></label>
        </div>
        <p role="status">{!ready ? "Recuperando histórico…" : busy ? "Salvando…" : saved}</p>
        <small>Persistência local ao navegador nesta etapa. O motor não inventa métricas ausentes, diagnóstico, economia ou responsabilidade individual.</small>
      </div>
    </section>

    {error && <p role="alert">{error}</p>}

    {!data && <article className="detailCard">
      <h2>Importe a operação para gerar os insights</h2>
      <p>Use o pacote Pulso-base-operacao.json. Após a validação do contrato, a mesma importação alimenta gestão, cartões, eventos, baseline estatístico, Isolation Forest, explicação e abertura de ação.</p>
    </article>}

    {data && report && ai && <>
      <nav className="opsTabs" aria-label="Módulos de gestão">
        {([
          ["overview", "Operação"],
          ["ai", "Desvios AI"],
          ["cards", "Cartões e eventos"],
          ["maintenance", "Ordens e manutenção"],
          ["inputs", "Apontamentos"]
        ] as [DashboardTab, string][]).map(([value, label]) => <button key={value} aria-pressed={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>)}
      </nav>

      {(tab === "overview" || tab === "ai") && <div className="hysterFilters">
        <label>Mês<select value={month} onChange={(event) => setMonth(event.target.value)}><option value="all">Todo o período</option>{report.months.map((item) => <option key={item.month}>{item.month}</option>)}</select></label>
        <label>Equipamento<select value={asset} onChange={(event) => setAsset(event.target.value)}><option value="all">Toda a frota</option>{data.assets.map((item) => <option key={item.assetId}>{item.assetId}</option>)}</select></label>
        <span>{data.periodStart} a {data.periodEnd} · {data.assets.length} equipamentos · dados reais importados</span>
      </div>}

      {tab === "cards" && <WorkforceCards data={data} workspace={workspace} />}
      {(tab === "maintenance" || tab === "inputs") && <OperationsConsole key={tab} tab={tab} workspace={workspace} data={data} save={save} busy={busy} suggestion={suggestion} />}
      {tab === "ai" && <OperationalAIPanel data={data} assetFilter={asset} monthFilter={month} onRegisterAction={registerAIAction} />}

      {tab === "overview" && <>
        <section className="kpiGrid">
          {[
            ["Chave ligada", `${fmt(report.totals.key)} h`, "série diária"],
            ["Trabalho registrado", `${fmt(report.totals.work)} h`, `${fmt(report.totals.workPct)}% da chave`],
            ["Ociosidade / chave", `${fmt(report.totals.idlePct)}%`, `${fmt(report.totals.idle)} h registradas`],
            ["Insights AI", String(filteredAI.length), `${filteredAI.filter((item) => item.priority === "high").length} de alta atenção`],
            ["Ordens abertas", String(openOrders), "decisão e execução humanas"]
          ].map(([label, value, context]) => <article className="kpiCard" key={label}><div><span>{label}</span><strong>{value}</strong><small>{context}</small></div></article>)}
        </section>

        <section className="detailCard">
          <h2>Resumo da operação</h2>
          <p>{report.totals.records} registros equipamento-dia · {report.types["Falha do sistema"] ?? 0} registros de falha · {report.types["Impacto"] ?? 0} impactos · {report.types["Status de caminhão"] ?? 0} registros de status.</p>
          <p>O motor AI encontrou {filteredAI.length} contextos priorizados no filtro. A força da evidência combina desvio estatístico e raridade multivariada; não representa probabilidade de pane.</p>
          <button className="opsAction" onClick={() => setTab("ai")}>Investigar prioridades com o Pulso AI</button>
        </section>

        <section className="detailGrid">
          <article className="detailCard">
            <h2>Distribuição de uso</h2>
            <div className="hysterTable"><table><thead><tr><th>Ativo</th><th>Chave (h)</th><th>Ocioso (h)</th><th>Ocioso/chave</th><th>Falhas</th><th>Impactos</th></tr></thead><tbody>
              {report.assets.map((item) => <tr key={item.assetId}><th>{item.assetId}</th><td>{fmt(item.key)}</td><td>{fmt(item.idle)}</td><td>{fmt(item.idlePct)}%</td><td>{item.faults}</td><td>{item.impacts}</td></tr>)}
            </tbody></table></div>
            <p>Diferenças de uso pedem contexto de escala, demanda e função. Não indicam, sozinhas, causa ou excesso de frota.</p>
          </article>

          <article className="detailCard">
            <h2>Evolução mensal</h2>
            <p>Comparação dos meses para o equipamento selecionado.</p>
            {report.months.map((item) => <div className="hysterMonth" key={item.month}><span>{item.month} · {fmt(item.key)} h de chave</span><meter aria-label={`Ociosidade ${item.month}`} min={0} max={100} value={item.idlePct ?? 0} /><strong>{fmt(item.idlePct)}% ocioso/chave</strong></div>)}
            <p>Razões calculadas pelas somas de horas, não pela média simples dos percentuais.</p>
          </article>
        </section>

        <section className="detailCard">
          <h2>Telemetria complementar do período</h2>
          <p>Presença no filtro diário: {fmt(report.daily.reduce((sum, row) => sum + row.presenceHours, 0))} h. Movimento, hidráulica e elevação abaixo pertencem ao período completo da extração mais recente e não são distribuídos artificialmente pelo filtro mensal.</p>
          <div className="hysterTable"><table><thead><tr><th>Equipamento</th><th>Período</th><th>Movimento (h)</th><th>Hidráulica (h)</th><th>Elevação (h)</th></tr></thead><tbody>
            {latest?.kpi.filter((item) => asset === "all" || item.assetId === asset).map((item) => <tr key={item.assetId}><th>{item.assetId}</th><td>{latest.periodStart} a {latest.periodEnd}</td><td>{item.motionHours === undefined ? "Não disponível" : fmt(item.motionHours)}</td><td>{item.hydraulicHours === undefined ? "Não disponível" : fmt(item.hydraulicHours)}</td><td>{item.liftHours === undefined ? "Não disponível" : fmt(item.liftHours)}</td></tr>)}
          </tbody></table></div>
          <p>Distância, frente/ré, descida, alta velocidade, usos e demais totais por cartão permanecem na granularidade original cartão-período.</p>
        </section>

        <section className="detailCard">
          <h2>Como a IA usa os dados reais</h2>
          <p><strong>Baseline:</strong> mesmo equipamento, até 28 dias anteriores, mínimo de 10 dias com pelo menos 1 h de chave.</p>
          <p><strong>z-score:</strong> procura desvios explicáveis em trabalho/chave, ociosidade/chave, espera/chave e recorrência de eventos.</p>
          <p><strong>Isolation Forest:</strong> usa o mesmo núcleo do motor da demo para verificar se a combinação de chave, trabalho, ociosidade, espera, falhas e impactos também é rara no histórico do ativo.</p>
          <p><strong>Cartões:</strong> entram como contexto de evidência; indicadores agregados por cartão não geram ranking nem score individual.</p>
        </section>

        <section className="detailCard">
          <h2>Qualidade e limites da base</h2>
          <ul>
            <li>{report.quality.waitAboveIdle} registros com espera maior que ociosidade; os contadores não devem ser tratados como partição perfeita do tempo.</li>
            <li>{report.quality.nonAdditive} registros com trabalho + ociosidade acima da chave por mais de 0,03 h.</li>
            <li>Dias ausentes permanecem desconhecidos. O motor não preenche lacunas com zero.</li>
            <li>Combustível: {data.fuel.every((item) => item.reportedLiters === 0) ? "relatório zerado; não entra como evidência de consumo" : "registros disponíveis; validar cobertura"}.</li>
            <li>Custos: {data.costs.some((item) => item.reportedTotal === null) ? "totais ausentes; não há cálculo de economia" : "registros disponíveis; validar cobertura e moeda"}.</li>
            <li>Manutenção: {data.maintenanceAvailable ? "fonte disponível; validar detalhes antes de concluir condição" : "sem registros de manutenção na base atual"}.</li>
            <li>Indicadores por cartão: {data.workforce ? `${data.workforce.periodStart} a ${data.workforce.periodEnd}; agregados no período e sem nomes` : "não disponíveis nesta base"}.</li>
          </ul>
          <details><summary>Rastreabilidade das fontes</summary>{data.sources.map((source) => <p key={source.sha256}><strong>{source.file}</strong><br /><small>SHA-256: {source.sha256}</small></p>)}</details>
        </section>

        <details className="detailCard"><summary>Histórico de importações · {workspace.datasets.length} extrações</summary>{workspace.datasets.map((dataset, index) => <p key={`${dataset.operationId ?? index}-${dataset.periodStart}`}>{dataset.periodStart} a {dataset.periodEnd} · {dataset.daily.length} registros diários · {dataset.events.length} eventos · schema {dataset.schemaVersion}{dataset.workforce ? " · indicadores por cartão" : ""}</p>)}</details>
      </>}

      <footer className="dataFooter"><p>Pulso · a máquina gera os dados, a IA encontra o padrão, o ser humano decide. Sem nomes, ranking individual, diagnóstico automático ou referência de 2023.</p></footer>
    </>}
  </main>;
}
