import { validateHyster, totals, type HysterData } from "./hyster.ts";

export type OrderStatus = "open" | "in_progress" | "completed" | "cancelled";
export type WorkOrder = {
  id: string; assetId: string; title: string; kind: "preventive" | "corrective" | "operational";
  priority: "normal" | "high"; team: string; dueDate: string; status: OrderStatus;
  openedAt: string; completedAt: string | null; note: string;
  history: { at: string; status: OrderStatus; note: string }[];
};
export type DailyInput = {
  id: string; assetId: string; date: string; plannedHours: number | null; downtimeHours: number | null;
  fuelQuantity: number | null; fuelUnit: "L" | "kg"; costBRL: number | null;
  production: number | null; productionUnit: "t" | "movimentos"; note: string;
};
export type Workspace = { version: 1; datasets: HysterData[]; orders: WorkOrder[]; inputs: DailyInput[] };
export const emptyWorkspace = (): Workspace => ({ version: 1, datasets: [], orders: [], inputs: [] });
export const statusLabels: Record<OrderStatus, string> = { open: "Aberta", in_progress: "Em andamento", completed: "Concluída", cancelled: "Cancelada" };
const validDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const nonNegative = (n: number | null) => n === null || (typeof n === "number" && Number.isFinite(n) && n >= 0);
export function validateInput(r: DailyInput) {
  if (!r || typeof r.id !== "string" || !/^EP\d{2,6}$/.test(r.assetId) || !validDate(r.date) || ![r.plannedHours, r.downtimeHours, r.fuelQuantity, r.costBRL, r.production].every(nonNegative) || !["L", "kg"].includes(r.fuelUnit) || !["t", "movimentos"].includes(r.productionUnit) || typeof r.note !== "string") throw new Error("Apontamento inválido.");
  if ((r.plannedHours ?? 0) > 24 || (r.downtimeHours ?? 0) > 24 || (r.downtimeHours !== null && (r.plannedHours === null || r.downtimeHours > r.plannedHours))) throw new Error("Parada deve estar dentro das horas planejadas do dia (máximo 24 h).");
  if ([r.plannedHours, r.downtimeHours, r.fuelQuantity, r.costBRL, r.production].every(v => v === null)) throw new Error("Informe ao menos uma medida.");
  return r;
}
export function validateOrder(r: WorkOrder) {
  if (!r || typeof r.id !== "string" || !/^EP\d{2,6}$/.test(r.assetId) || typeof r.title !== "string" || !r.title.trim() || r.title.length > 200 || !["preventive", "corrective", "operational"].includes(r.kind) || !["normal", "high"].includes(r.priority) || typeof r.team !== "string" || !r.team.trim() || !validDate(r.dueDate) || !Object.hasOwn(statusLabels, r.status) || !Number.isFinite(Date.parse(r.openedAt)) || typeof r.note !== "string" || !Array.isArray(r.history)) throw new Error("Ordem inválida.");
  if ((r.status === "completed") !== (r.completedAt !== null) || (r.completedAt !== null && !validDate(r.completedAt))) throw new Error("Informe a data real de conclusão.");
  if (r.history.some(h => !h || !Number.isFinite(Date.parse(h.at)) || !Object.hasOwn(statusLabels, h.status) || typeof h.note !== "string")) throw new Error("Histórico da ordem inválido.");
  return r;
}
export function validateWorkspace(value: unknown): Workspace {
  const w = value as Workspace;
  if (!w || w.version !== 1 || !Array.isArray(w.datasets) || !Array.isArray(w.orders) || !Array.isArray(w.inputs)) throw new Error("Backup inválido.");
  if (w.datasets.length > 24 || w.orders.length > 10000 || w.inputs.length > 50000) throw new Error("Limite do workspace excedido.");
  w.datasets.forEach(validateHyster); w.orders.forEach(validateOrder); w.inputs.forEach(validateInput);
  const operationIds = new Set(w.datasets.map(d => d.operationId ?? "legacy-v1"));
  if (operationIds.size > 1) throw new Error("Bases de operações diferentes não podem compartilhar o mesmo histórico.");
  const ids = new Set(w.datasets.flatMap(d => d.assets.map(a => a.assetId)));
  if ([...w.orders, ...w.inputs].some(r => !ids.has(r.assetId))) throw new Error("Equipamento não cadastrado.");
  for (const keys of [w.orders.map(o => o.id), w.inputs.map(i => i.id), w.inputs.map(i => `${i.assetId}:${i.date}`)]) if (new Set(keys).size !== keys.length) throw new Error("Registros duplicados no backup.");
  return w;
}
export function addDataset(workspace: Workspace, incoming: HysterData): Workspace {
  validateHyster(incoming);
  if (workspace.datasets.length && (workspace.datasets[0].operationId ?? "legacy-v1") !== (incoming.operationId ?? "legacy-v1")) throw new Error("Identidade da operação diferente. Exporte o backup e use um workspace separado; bases v1 precisam ser reconvertidas.");
  // A re-export of the same period replaces that batch without duplicating history.
  const datasets = workspace.datasets.filter(d => d.periodStart !== incoming.periodStart || d.periodEnd !== incoming.periodEnd);
  return validateWorkspace({ ...workspace, datasets: [...datasets, incoming] });
}
export function combineDatasets(datasets: HysterData[]): HysterData | null {
  if (!datasets.length) return null;
  const latest = datasets[datasets.length - 1];
  const daily = new Map<string, HysterData["daily"][number]>();
  const assets = new Map<string, HysterData["assets"][number]>();
  // New exports replace the event ledger within their explicit reporting window,
  // retaining repeated events from the source rather than guessing which are duplicates.
  let events: HysterData["events"] = [];
  for (const d of datasets) {
    d.assets.forEach(a => assets.set(a.assetId, a));
    const scoped = new Set(d.assets.map(a => a.assetId));
    for (const [key, r] of daily) if (scoped.has(r.assetId) && r.date >= d.periodStart && r.date <= d.periodEnd) daily.delete(key);
    d.daily.forEach(r => daily.set(`${r.assetId}:${r.date}`, r));
    events = events.filter(e => !scoped.has(e.assetId) || e.date < d.periodStart || e.date > d.periodEnd).concat(d.events);
  }
  return { ...latest, assets: [...assets.values()], daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)), events,
    periodStart: datasets.map(d => d.periodStart).sort()[0], periodEnd: datasets.map(d => d.periodEnd).sort().at(-1)!,
    // Aggregated counters cannot be added safely across overlapping exports.
    kpi: datasets.length === 1 ? latest.kpi : [],
    sources: [...new Map(datasets.flatMap(d => d.sources).map(s => [s.sha256, s])).values()],
    legacy: [...datasets].reverse().find(d => d.legacy)?.legacy };
}
export function inputSummary(rows: DailyInput[]) {
  const covered = rows.filter(r => r.plannedHours !== null && r.plannedHours > 0 && r.downtimeHours !== null);
  const planned = covered.reduce((s, r) => s + r.plannedHours!, 0), downtime = covered.reduce((s, r) => s + r.downtimeHours!, 0);
  return { covered: covered.length, availability: planned ? (planned - downtime) / planned * 100 : null,
    fuelL: rows.filter(r => r.fuelUnit === "L" && r.fuelQuantity !== null).reduce((s, r) => s + r.fuelQuantity!, 0),
    fuelKg: rows.filter(r => r.fuelUnit === "kg" && r.fuelQuantity !== null).reduce((s, r) => s + r.fuelQuantity!, 0),
    cost: rows.reduce((s, r) => s + (r.costBRL ?? 0), 0),
    tonnes: rows.filter(r => r.productionUnit === "t").reduce((s, r) => s + (r.production ?? 0), 0),
    movements: rows.filter(r => r.productionUnit === "movimentos").reduce((s, r) => s + (r.production ?? 0), 0) };
}
export function followUp(data: HysterData, order: WorkOrder) {
  if (!order.completedAt) return null;
  const date = Date.parse(order.completedAt);
  const before = data.daily.filter(r => r.assetId === order.assetId && Date.parse(r.date) < date && Date.parse(r.date) >= date - 14 * 86400000);
  const after = data.daily.filter(r => r.assetId === order.assetId && Date.parse(r.date) > date && Date.parse(r.date) <= date + 14 * 86400000);
  const b = totals(before), a = totals(after);
  return { before: b, after: a, delta: before.length >= 5 && after.length >= 5 && b.idlePct !== null && a.idlePct !== null ? a.idlePct - b.idlePct : null };
}
