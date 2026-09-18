"use client";
import { useState } from "react";
import type { HysterData } from "@/lib/hyster";
import { followUp, inputSummary, statusLabels, validateInput, validateOrder, type DailyInput, type WorkOrder, type Workspace, type OrderStatus } from "@/lib/operations";

export type OperationsTab = "overview" | "cards" | "maintenance" | "inputs";
const f = (n: number | null | undefined, suffix = "") => n == null ? "Não disponível" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + suffix;
const today = () => new Date().toLocaleDateString("en-CA");
type Props = { tab: OperationsTab; data: HysterData; workspace: Workspace; save: (w: Workspace) => Promise<void>; busy: boolean; suggestion?: { assetId: string; title: string } };

export default function OperationsConsole({ tab, data, workspace, save, busy, suggestion }: Props) {
  const [asset, setAsset] = useState("all"), [month, setMonth] = useState("all");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<DailyInput | null>(null);
  const [orderFilter, setOrderFilter] = useState("all");
  const months = [...new Set([...data.daily.map(r => r.date.slice(0, 7)), ...workspace.inputs.map(r => r.date.slice(0, 7))])].sort();
  const matching = (r: { assetId: string; date: string }) => (asset === "all" || r.assetId === asset) && (month === "all" || r.date.startsWith(month));

  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const at = new Date().toISOString();
    try {
      const order = validateOrder({
        id: crypto.randomUUID(),
        assetId: String(fields.get("assetId")),
        title: String(fields.get("title")),
        kind: String(fields.get("kind")) as WorkOrder["kind"],
        priority: String(fields.get("priority")) as WorkOrder["priority"],
        team: String(fields.get("team")),
        dueDate: String(fields.get("dueDate")),
        status: "open",
        openedAt: at,
        completedAt: null,
        note: String(fields.get("note")),
        history: [{ at, status: "open", note: "Ordem registrada" }]
      });
      await save({ ...workspace, orders: [...workspace.orders, order] });
      setError("");
      form.reset();
    } catch (e) { setError((e as Error).message); }
  }

  async function transition(event: React.FormEvent<HTMLFormElement>, order: WorkOrder) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const status = String(fields.get("status")) as OrderStatus;
    try {
      const note = String(fields.get("note"));
      if (!note.trim()) throw new Error("Descreva a execução ou o motivo da mudança.");
      const updated = validateOrder({
        ...order,
        status,
        completedAt: status === "completed" ? String(fields.get("completedAt")) : null,
        history: [...order.history, { at: new Date().toISOString(), status, note }]
      });
      if (updated.completedAt && updated.completedAt > today()) throw new Error("Conclusão não pode estar no futuro.");
      await save({ ...workspace, orders: workspace.orders.map(o => o.id === order.id ? updated : o) });
      setError("");
    } catch (e) { setError((e as Error).message); }
  }

  async function submitInput(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const number = (key: string) => fields.get(key) === "" ? null : Number(fields.get(key));
    try {
      const row = validateInput({
        id: editing?.id ?? crypto.randomUUID(),
        assetId: String(fields.get("assetId")),
        date: String(fields.get("date")),
        plannedHours: number("plannedHours"),
        downtimeHours: number("downtimeHours"),
        fuelQuantity: number("fuelQuantity"),
        fuelUnit: String(fields.get("fuelUnit")) as "L" | "kg",
        costBRL: number("costBRL"),
        production: number("production"),
        productionUnit: String(fields.get("productionUnit")) as "t" | "movimentos" | "pallets",
        usageContext: String(fields.get("usageContext") || "unknown") as DailyInput["usageContext"],
        note: String(fields.get("note"))
      });
      if (workspace.inputs.some(r => r.assetId === row.assetId && r.date === row.date && r.id !== row.id)) throw new Error("Já existe um apontamento para esse equipamento/dia. Use Editar.");
      await save({ ...workspace, inputs: [...workspace.inputs.filter(r => r.id !== row.id), row] });
      setEditing(null);
      setError("");
    } catch (e) { setError((e as Error).message); }
  }

  const filters = <div className="hysterFilters">
    <label>Equipamento<select value={asset} onChange={e => setAsset(e.target.value)}><option value="all">Toda a frota</option>{data.assets.map(a => <option key={a.assetId}>{a.assetId}</option>)}</select></label>
    <label>Mês<select value={month} onChange={e => setMonth(e.target.value)}><option value="all">Todos</option>{months.map(m => <option key={m}>{m}</option>)}</select></label>
  </div>;
  const assetField = (value?: string) => <label>Equipamento<select name="assetId" defaultValue={value ?? data.assets[0]?.assetId}>{data.assets.map(a => <option key={a.assetId}>{a.assetId}</option>)}</select></label>;

  if (tab === "maintenance") {
    const orders = workspace.orders.filter(o => (asset === "all" || o.assetId === asset) && (orderFilter === "all" || o.status === orderFilter));
    return <>
      <section className="detailCard">
        <h2>Gestão de operação e manutenção</h2>
        <p>Registre uma investigação, preventiva, corretiva ou melhoria operacional. As ordens dependem de validação humana e não são criadas automaticamente a partir de eventos.</p>
        {error && <p role="alert">{error}</p>}
        <form className="opsForm" onSubmit={submitOrder} key={suggestion?.title ?? "new"}>
          {assetField(suggestion?.assetId)}
          <label>Tipo<select name="kind"><option value="corrective">Corretiva / investigação</option><option value="preventive">Preventiva</option><option value="operational">Melhoria operacional</option></select></label>
          <label>Título<input name="title" required maxLength={200} defaultValue={suggestion?.title} /></label>
          <label>Equipe responsável<input name="team" required placeholder="Ex.: Manutenção mecânica" /></label>
          <label>Prazo<input type="date" name="dueDate" required /></label>
          <label>Prioridade<select name="priority"><option value="normal">Normal</option><option value="high">Alta</option></select></label>
          <label className="opsWide">Contexto e ação proposta<textarea name="note" maxLength={2000} /></label>
          <button disabled={busy}>Registrar ordem</button>
        </form>
      </section>
      <section className="detailCard">
        <h2>Fila e acompanhamento</h2>
        <div className="hysterFilters">
          <label>Equipamento<select value={asset} onChange={e => setAsset(e.target.value)}><option value="all">Toda a frota</option>{data.assets.map(a => <option key={a.assetId}>{a.assetId}</option>)}</select></label>
          <label>Situação<select value={orderFilter} onChange={e => setOrderFilter(e.target.value)}><option value="all">Todas</option>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        </div>
        {orders.length === 0 && <p>Nenhuma ordem registrada neste filtro.</p>}
        {orders.map(o => {
          const follow = followUp(data, o);
          const late = ["open", "in_progress"].includes(o.status) && o.dueDate < today();
          return <article className="opsOrder" key={o.id}>
            <h3>{o.assetId} · {o.title}</h3>
            <p>{statusLabels[o.status]}{late ? " · Prazo vencido" : ""} · {o.priority === "high" ? "Alta prioridade" : "Prioridade normal"} · {o.team} · Prazo: {o.dueDate}</p>
            <p>{o.note}</p>
            <form className="opsForm" onSubmit={e => void transition(e, o)}>
              <label>Situação<select name="status" defaultValue={o.status}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <label>Data real de conclusão<input type="date" name="completedAt" defaultValue={o.completedAt ?? ""} max={today()} /></label>
              <label>Execução / justificativa<input name="note" required maxLength={2000} /></label>
              <button disabled={busy}>Salvar andamento</button>
            </form>
            {follow && <p><strong>Acompanhamento após a ação:</strong> ociosidade/chave antes {f(follow.before.idlePct, "%")} ({follow.before.records} dias), depois {f(follow.after.idlePct, "%")} ({follow.after.records} dias). {follow.delta === null ? "Aguardando pelo menos 5 registros antes e depois, nas janelas de 14 dias." : `Variação: ${f(follow.delta)} pontos percentuais. Comparação descritiva, sem comprovação causal; valide a demanda.`}</p>}
            <details><summary>Histórico da ordem</summary>{o.history.map((h, i) => <p key={i}>{h.at} · {statusLabels[h.status]} · {h.note}</p>)}</details>
          </article>;
        })}
      </section>
    </>;
  }

  if (tab === "inputs") {
    const rows = workspace.inputs.filter(matching), summary = inputSummary(rows);
    return <>
      <section className="detailCard">
        <h2>Outros dados da operação</h2>
        <p>Apontamento diário por equipamento: calendário, parada dentro do horário planejado, abastecimento, custo e produção. Campo vazio significa não informado; zero deve ser informado explicitamente.</p>
        {error && <p role="alert">{error}</p>}
        <form className="opsForm" key={editing?.id ?? `new-${workspace.inputs.length}`} onSubmit={submitInput}>
          {assetField(editing?.assetId)}
          <label>Dia<input type="date" name="date" required defaultValue={editing?.date} /></label>
          {[["plannedHours", "Horas planejadas"], ["downtimeHours", "Horas de parada no período planejado"], ["fuelQuantity", "Quantidade abastecida"], ["costBRL", "Custo realizado (R$)"], ["production", "Volume produzido / movimentado"]].map(([name, label]) => <label key={name}>{label}<input name={name} type="number" min="0" step="0.01" defaultValue={editing?.[name as keyof DailyInput] as number ?? ""} /></label>)}
          <label>Unidade do combustível<select name="fuelUnit" defaultValue={editing?.fuelUnit ?? "L"}><option>L</option><option>kg</option></select></label>
          <label>Unidade da produção<select name="productionUnit" defaultValue={editing?.productionUnit ?? "pallets"}><option value="pallets">pallets</option><option value="t">t</option><option value="movimentos">movimentos</option></select></label>
          <label>Contexto do uso<select name="usageContext" defaultValue={editing?.usageContext ?? "unknown"}><option value="unknown">Não informado</option><option value="production">Produção / movimentação</option><option value="maintenance">Manutenção</option><option value="mixed">Misto</option></select></label>
          <label className="opsWide">Fonte / observação<textarea name="note" defaultValue={editing?.note} maxLength={2000} /></label>
          <button disabled={busy}>{editing ? "Salvar alteração" : "Registrar apontamento"}</button>
          {editing && <button type="button" onClick={() => setEditing(null)}>Cancelar edição</button>}
        </form>
      </section>
      <section className="detailCard">
        <h2>Indicadores complementares</h2>
        {filters}
        <p>Disponibilidade nos {summary.covered} equipamento-dias com planejamento e parada informados: <strong>{f(summary.availability, "%")}</strong>. Não representa dias sem apontamento.</p>
        <p>Abastecimentos informados: {f(summary.fuelL)} L e {f(summary.fuelKg)} kg · Custos informados: R$ {f(summary.cost)} · Produção informada: {f(summary.pallets)} pallets, {f(summary.tonnes)} t e {f(summary.movements)} movimentos.</p>
        <div className="hysterTable"><table><thead><tr><th>Dia</th><th>Ativo</th><th>Planejado</th><th>Parada</th><th>Abastecimento</th><th>Custo R$</th><th>Produção</th><th>Contexto</th><th>Ação</th></tr></thead><tbody>{[...rows].sort((a, b) => b.date.localeCompare(a.date)).map(r => <tr key={r.id}><td>{r.date}</td><td>{r.assetId}</td><td>{f(r.plannedHours, " h")}</td><td>{f(r.downtimeHours, " h")}</td><td>{f(r.fuelQuantity, ` ${r.fuelUnit}`)}</td><td>{f(r.costBRL)}</td><td>{f(r.production, ` ${r.productionUnit}`)}</td><td>{r.usageContext === "maintenance" ? "Manutenção" : r.usageContext === "production" ? "Produção" : r.usageContext === "mixed" ? "Misto" : "Não informado"}</td><td><button onClick={() => setEditing(r)}>Editar</button></td></tr>)}</tbody></table></div>
      </section>
    </>;
  }

  return null;
}
