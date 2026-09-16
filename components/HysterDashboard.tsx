"use client";
import { useEffect, useMemo, useState } from "react";
import { analyzeHyster, validateHyster, type HysterData } from "@/lib/hyster";
import { addDataset, combineDatasets, emptyWorkspace, validateWorkspace, type Workspace } from "@/lib/operations";
import { readWorkspace, saveWorkspace } from "@/lib/operationsStorage";
import OperationsConsole, { type OperationsTab } from "./OperationsConsole";
import WorkforceCards from "./WorkforceCards";
import "./hyster.css";

const fmt = (v: number | null, digits = 2) => v === null ? "Sem dados" : v.toLocaleString("pt-BR", { maximumFractionDigits: digits });
const containsHistoricalDataset = (value: unknown) => {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  if ("legacy" in record || "historical2023" in record) return true;
  const datasets = Array.isArray(record.datasets) ? record.datasets : [];
  return datasets.some(item => !!item && typeof item === "object" && ("legacy" in (item as Record<string, unknown>) || "historical2023" in (item as Record<string, unknown>)));
};

export default function HysterDashboard() {
  const [workspace, setWorkspace] = useState<Workspace>(emptyWorkspace);
  const [ready, setReady] = useState(false), [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState("");
  const [tab, setTab] = useState<OperationsTab>("overview");
  const [suggestion, setSuggestion] = useState<{ assetId: string; title: string }>();
  const data = useMemo(() => combineDatasets(workspace.datasets), [workspace.datasets]);
  const [month, setMonth] = useState("all"), [asset, setAsset] = useState("all"), [error, setError] = useState("");
  const [selected, setSelected] = useState(0);
  useEffect(() => { readWorkspace().then(w => { setWorkspace(w); setReady(true); setSaved("Histórico recuperado deste navegador."); }).catch(e => { setError(e.message); setReady(true); }); }, []);
  async function save(w: Workspace) {
    setBusy(true);
    try { await saveWorkspace(w); setWorkspace(w); setSaved("Alterações salvas neste navegador."); }
    finally { setBusy(false); }
  }
  function backup() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(workspace)], { type: "application/json" }));
    const a = document.createElement("a"); a.href = url; a.download = `Pulso-gestao-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click(); URL.revokeObjectURL(url);
  }
  async function restore(file?: File) {
    if (!file) return;
    try {
      if (file.size > 50 * 1024 * 1024) throw new Error("Backup excede 50 MB.");
      const raw = JSON.parse(await file.text());
      if (containsHistoricalDataset(raw)) throw new Error("Este backup contém uma base histórica que não faz parte do Pulso atual.");
      const w = validateWorkspace(raw);
      if (!window.confirm("Restaurar este backup substituirá o histórico e os apontamentos deste navegador. Exporte o backup atual antes de continuar.")) return;
      await save(w); setError(""); setMonth("all"); setAsset("all"); setSelected(0);
    } catch (e) { setError((e as Error).message); }
  }
  const report = useMemo(() => data ? analyzeHyster(data, month, asset) : null, [data, month, asset]);
  const deviation = report?.deviations[selected];
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Limite de 20 MB por arquivo.");
      const raw = JSON.parse(await file.text()) as Record<string, unknown>;
      if (containsHistoricalDataset(raw)) throw new Error("Esta base contém referência histórica fora da operação atual. Gere novamente o pacote apenas com o período operacional.");
      const parsed = validateHyster(raw);
      await save(addDataset(workspace, parsed)); setMonth("all"); setAsset("all"); setSelected(0); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Arquivo inválido"); }
  }
  return <main className="pageShell hyster">
    <header className="hero"><div><div className="eyebrow">COPILOTO OPERACIONAL AI · PULSO</div><h1>Pulso <span>da operação</span></h1><p>Histórico real. Evidências para investigar. Decisão humana.</p></div><a href="/">Demonstração sintética →</a></header>
    <section className="trustBanner"><div><strong>Gestão da operação · histórico e acompanhamento</strong><p>Importe um único pacote operacional para carregar telemetria, eventos, indicadores por cartão e demais fontes do período. Os dados e apontamentos ficam salvos neste navegador; novas extrações atualizam períodos repetidos sem duplicar o histórico.</p><div className="hysterFilters"><label className="hysterUpload">Importar base operacional JSON<input disabled={!ready || busy} aria-label="Selecionar base operacional JSON" type="file" accept=".json,application/json" onChange={e => void importFile(e.target.files?.[0])} /></label><button disabled={!ready || busy} onClick={backup}>Exportar backup da gestão</button><label className="hysterUpload">Restaurar backup<input disabled={!ready || busy} type="file" accept=".json,application/json" onChange={e => void restore(e.target.files?.[0])} /></label></div><p role="status">{!ready ? "Recuperando histórico…" : busy ? "Salvando…" : saved}</p><small>Dados locais a este navegador e endereço. Exporte backup para outro computador; esta versão ainda não sincroniza vários usuários.</small></div></section>
    {error && <p role="alert">{error}</p>}
    {!data && <article className="detailCard"><h2>Uma importação, uma visão da operação</h2><p>Importe o arquivo unificado Pulso-base-operacao.json. Para novas extrações, gere novamente o mesmo pacote a partir dos relatórios do período.</p><p>A base operacional reúne utilização diária, indicadores agregados por cartão, eventos, cadastro, KPI consolidado, custos, combustível, manutenção e qualidade das fontes disponíveis. O Pulso usa essas evidências em conjunto, respeitando a granularidade original de cada medida.</p></article>}
    {data && report && <>
      <nav className="opsTabs" aria-label="Módulos de gestão">{([["overview", "Operação"], ["cards", "Cartões e eventos"], ["maintenance", "Ordens e manutenção"], ["inputs", "Apontamentos"]] as [OperationsTab, string][]).map(([value, label]) => <button key={value} aria-pressed={tab === value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>{label}</button>)}</nav>
      {tab === "cards" ? <WorkforceCards data={data} workspace={workspace} /> : <OperationsConsole key={tab} tab={tab} workspace={workspace} data={data} save={save} busy={busy} suggestion={suggestion} />}
      {tab === "overview" && <>
      <div className="hysterFilters"><label>Mês<select value={month} onChange={e => { setMonth(e.target.value); setSelected(0); }}><option value="all">Todo o período</option>{report.months.map(m => <option key={m.month}>{m.month}</option>)}</select></label><label>Equipamento<select value={asset} onChange={e => { setAsset(e.target.value); setSelected(0); }}><option value="all">Toda a frota</option>{data.assets.map(a => <option key={a.assetId}>{a.assetId}</option>)}</select></label><span>{data.periodStart} a {data.periodEnd} · histórico diário · sem conexão em tempo real</span></div>
      <section className="kpiGrid">{[["Chave ligada", `${fmt(report.totals.key)} h`], ["Trabalho registrado", `${fmt(report.totals.work)} h`], ["Ociosidade registrada", `${fmt(report.totals.idle)} h`], ["Ociosidade / chave", `${fmt(report.totals.idlePct)}%`]].map(([label, value]) => <article className="kpiCard" key={label}><div><span>{label}</span><strong>{value}</strong></div></article>)}</section>
      <section className="detailCard"><h2>Leitura do período</h2><p>{report.totals.records} registros equipamento-dia · {report.types["Falha do sistema"] ?? 0} registros de falha de sistema · {report.types["Impacto"] ?? 0} impactos · {report.types["Status de caminhão"] ?? 0} registros de status.</p><p>Eventos repetidos não equivalem a panes independentes. A marcação “crítica” do fornecedor não determina a prioridade do Pulso.</p></section>
      <section className="detailGrid"><article className="detailCard"><h2>Distribuição de uso</h2><div className="hysterTable"><table><thead><tr><th>Ativo</th><th>Chave (h)</th><th>Ocioso (h)</th><th>Ocioso/chave</th><th>Falhas</th><th>Impactos</th></tr></thead><tbody>{report.assets.map(a => <tr key={a.assetId}><th>{a.assetId}</th><td>{fmt(a.key)}</td><td>{fmt(a.idle)}</td><td>{fmt(a.idlePct)}%</td><td>{a.faults}</td><td>{a.impacts}</td></tr>)}</tbody></table></div><p>Diferenças de uso pedem contexto de escala, demanda e função. Não indicam, sozinhas, excesso de frota.</p></article>
      <article className="detailCard"><h2>Evolução mensal</h2><p>Comparação dos meses para o equipamento selecionado.</p>{report.months.map(m => <div className="hysterMonth" key={m.month}><span>{m.month} · {fmt(m.key)} h de chave</span><meter aria-label={`Ociosidade ${m.month}`} min={0} max={100} value={m.idlePct ?? 0} /><strong>{fmt(m.idlePct)}% ocioso/chave</strong></div>)}<p>Razões calculadas pelas somas de horas; não pela média de percentuais arredondados.</p></article></section>
      <section className="detailCard"><h2>Indicadores operacionais preservados</h2><p>Presença no filtro diário: {fmt(report.daily.reduce((s, r) => s + r.presenceHours, 0))} h. Trabalho/chave: {fmt(report.totals.workPct)}%. Movimento, hidráulica e elevação abaixo pertencem ao período completo da extração mais recente, e não ao filtro mensal.</p><div className="hysterTable"><table><thead><tr><th>Equipamento</th><th>Período</th><th>Movimento (h)</th><th>Hidráulica (h)</th><th>Elevação (h)</th></tr></thead><tbody>{workspace.datasets.at(-1)?.kpi.filter(k => asset === "all" || k.assetId === asset).map(k => <tr key={k.assetId}><th>{k.assetId}</th><td>{workspace.datasets.at(-1)?.periodStart} a {workspace.datasets.at(-1)?.periodEnd}</td><td>{k.motionHours === undefined ? "Não disponível" : fmt(k.motionHours)}</td><td>{k.hydraulicHours === undefined ? "Não disponível" : fmt(k.hydraulicHours)}</td><td>{k.liftHours === undefined ? "Não disponível" : fmt(k.liftHours)}</td></tr>)}</tbody></table></div><p>A mesma base operacional também contém distância, frente/ré, descida, alta velocidade, usos e demais contadores por cartão. Esses totais permanecem na granularidade original do período e não são distribuídos pelo filtro mensal.</p></section>
      <section className="workspace"><aside className="insightsPane"><h2>Desvios para investigar</h2><p>Comparação com o próprio equipamento nos 28 dias anteriores, pelo menos 10 registros com ≥ 1 h de chave. Sinal: z ≥ 2 e aumento ≥ 10 pontos percentuais.</p><div className="insightList">{report.deviations.map((d, i) => <button className={`insightCard ${i === selected ? "selected" : ""}`} key={`${d.assetId}-${d.date}`} onClick={() => setSelected(i)}><div><strong>{d.assetId} · {d.date}</strong><p>{fmt(d.current)}% ocioso/chave · {fmt(d.z)}σ</p></div></button>)}</div>{!report.deviations.length && <p>Nenhum sinal com esses critérios. Isso não certifica a saúde dos equipamentos.</p>}</aside>
      <article className="detailPane"><h2>Copiloto · evidência e próxima ação</h2>{deviation ? <><h3>{deviation.assetId} · {deviation.date}</h3><p>Ociosidade/chave de {fmt(deviation.current)}%, contra média histórica diária de {fmt(deviation.baseline)}% em {deviation.samples} registros anteriores. Foram {fmt(deviation.idleHours)} h ociosas no dia.</p><p><strong>Investigar:</strong> confira espera por carga, abastecimento, liberação de área, escala e condição do equipamento. O desvio não identifica a causa e não atribui responsabilidade ao operador.</p><p><strong>Validar uma ação:</strong> registre a causa com a operação e acompanhe ociosidade/chave em dias com demanda comparável. Registre a ação no módulo de manutenção para acompanhar os indicadores antes e depois, sem atribuir causalidade automática.</p><small>Fonte: DailyFleetUtilization.xlsx, Folha2, linha {deviation.sourceRow}. Baseline exclusivamente anterior ao dia analisado. Regra estatística exploratória; sem previsão de pane ou probabilidade calibrada.</small>{deviation && <button className="opsAction" onClick={() => { setSuggestion({ assetId: deviation.assetId, title: `Investigar ociosidade · ${deviation.date}` }); setTab("maintenance"); }}>Registrar ação para {deviation.assetId}</button>}</> : <p>Selecione um desvio para examinar a evidência.</p>}<hr /><h3>Investigação de eventos</h3>{report.assets.filter(a => a.faults || a.impacts).map(a => <p key={a.assetId}><strong>{a.assetId}:</strong> {a.faults} registros de falha e {a.impacts} impactos. {a.impacts ? "Revisar os impactos com segurança e manutenção. " : ""}Consultar códigos, recorrência e ordens de serviço antes de concluir a causa.</p>)}</article></section>
      <section className="detailCard"><h2>Qualidade e limites da base</h2><ul><li>{report.quality.waitAboveIdle} registros com espera maior que ociosidade; não usar “espera/ociosidade” como fração do tempo ocioso.</li><li>{report.quality.nonAdditive} registros com trabalho + ociosidade acima da chave por mais de 0,03 h. Os contadores não formam uma partição consistente.</li><li>Dias ausentes não são preenchidos com zero. Sem calendário planejado, não calculamos disponibilidade ou utilização da capacidade.</li><li>Combustível: {data.fuel.every(f => f.reportedLiters === 0) ? "relatório zerado; consumo não validado" : "registros disponíveis; validar medição"}. Sem estimativa automática de litros, CO₂ ou economia.</li><li>Custos: {data.costs.some(c => c.reportedTotal === null) ? "totais ausentes; custo não validado" : "registros disponíveis; validar moeda e cobertura"}. Manutenção: {data.maintenanceAvailable ? "registros na origem; requer integração detalhada" : "relatório sem registros"}.</li><li>Indicadores por cartão: {data.workforce ? `${data.workforce.periodStart} a ${data.workforce.periodEnd}, agregado por cartão-período; nomes removidos` : "não disponíveis nesta base"}.</li></ul><details><summary>Conciliação do período completo</summary>{workspace.datasets.length > 1 && <p>Há múltiplas extrações: o KPI consolidado abaixo não foi somado. Consulte os períodos no histórico de importações.</p>}<p>Diário: {fmt(data.daily.reduce((s, r) => s + r.keyHours, 0))} h de chave. KPI consolidado: {data.kpi.length ? fmt(data.kpi.reduce((s, r) => s + r.keyHours, 0)) : "Não consolidado"} h. Horímetro de serviço: {data.kpi.length ? fmt(data.kpi.reduce((s, r) => s + r.serviceHours, 0)) : "Não consolidado"} h — contador diferente da chave.</p>{data.currentStatus.length > 0 && <p>Snapshot de status presente no pacote: {data.currentStatus.map(s => `${s.assetId}: ${s.status} (${s.lastAccess})`).join("; ")}.</p>}</details><details><summary>Rastreabilidade dos arquivos</summary>{data.sources.map(s => <p key={s.sha256}><strong>{s.file}</strong><br /><small>SHA-256: {s.sha256}</small></p>)}</details></section>

      <details className="detailCard"><summary>Histórico de importações · {workspace.datasets.length} extrações</summary>{workspace.datasets.map((d, i) => <p key={i}>{d.periodStart} a {d.periodEnd} · {d.daily.length} registros diários · {d.events.length} eventos · versão {d.schemaVersion}{d.workforce ? " · indicadores por cartão" : ""}</p>)}<p>Os contadores agregados não são somados entre extrações sobrepostas. Concilie cada período com a respectiva extração.</p></details>
      </>}
      <footer className="dataFooter"><p>Pulso · operação, manutenção e acompanhamento evolutivo. Identificação por código do cartão, sem nomes e sem ranking individual.</p></footer>
    </>}
  </main>;
}
