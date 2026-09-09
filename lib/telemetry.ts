export type InsightCategory = "efficiency" | "mechanical" | "safety" | "maintenance";
export type Severity = "attention" | "high" | "critical";
export type Shift = "A" | "B" | "C";

export type HistoricalShiftRecord = {
  date: string;
  assetId: string;
  operatorId: string;
  shift: Shift;
  fuelLiters: number;
  idlePct: number;
  emptyTravelPct: number;
  avgSpeedKmh: number;
  maxCoolantC: number;
  shocks: number;
  overloads: number;
  maintenanceHoursRemaining: number;
};

export type StatisticalEvidence = {
  metric: "fuelLiters" | "idlePct" | "emptyTravelPct" | "avgSpeedKmh" | "maxCoolantC" | "shocks" | "overloads";
  label: string;
  current: number;
  mean: number;
  stdDev: number;
  zScore: number;
  unit: string;
};

export type Insight = {
  id: string;
  assetId: string;
  operatorId?: string;
  category: InsightCategory;
  severity: Severity;
  title: string;
  summary: string;
  evidence: string[];
  probableCause: string;
  recommendedAction: string;
  humanMessage: string;
  potentialSavingsLitersPerShift?: number;
  score: number;
  analysis?: {
    method: "rolling-zscore";
    baselineSamples: number;
    lookbackDays: number;
    maxAbsZ: number;
    period: string;
    statisticalEvidence: StatisticalEvidence[];
  };
};

type MetricKey = StatisticalEvidence["metric"];
type MetricStats = { mean: number; stdDev: number; samples: number };
type Baseline = Record<MetricKey, MetricStats>;

type CandidateKind = "efficiency" | "mechanical" | "shocks" | "overload" | "maintenance";
type Candidate = {
  kind: CandidateKind;
  row: HistoricalShiftRecord;
  baseline: Baseline;
  evidence: StatisticalEvidence[];
  score: number;
};

const LOOKBACK_DAYS = 21;
const MIN_BASELINE_SAMPLES = 10;
const EVALUATION_START = "2026-08-28";

export const demoFleet = [
  { assetId: "FLT-012", capacity: "16 t" },
  { assetId: "FLT-017", capacity: "16 t" },
  { assetId: "FLT-023", capacity: "18 t" },
  { assetId: "FLT-031", capacity: "25 t" },
  { assetId: "FLT-044", capacity: "25 t" },
  { assetId: "FLT-052", capacity: "18 t" },
  { assetId: "FLT-058", capacity: "16 t" },
  { assetId: "FLT-064", capacity: "33 t" }
] as const;

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mean(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function stdDev(values: number[], avg = mean(values)) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

const metricFloor: Record<MetricKey, number> = {
  fuelLiters: 0.75,
  idlePct: 1.0,
  emptyTravelPct: 1.5,
  avgSpeedKmh: 0.45,
  maxCoolantC: 0.8,
  shocks: 0.5,
  overloads: 0.5
};

function metricStats(history: HistoricalShiftRecord[], metric: MetricKey): MetricStats {
  const values = history.map((row) => row[metric]);
  const avg = mean(values);
  return { mean: avg, stdDev: Math.max(stdDev(values, avg), metricFloor[metric]), samples: values.length };
}

function buildBaseline(history: HistoricalShiftRecord[]): Baseline {
  return {
    fuelLiters: metricStats(history, "fuelLiters"),
    idlePct: metricStats(history, "idlePct"),
    emptyTravelPct: metricStats(history, "emptyTravelPct"),
    avgSpeedKmh: metricStats(history, "avgSpeedKmh"),
    maxCoolantC: metricStats(history, "maxCoolantC"),
    shocks: metricStats(history, "shocks"),
    overloads: metricStats(history, "overloads")
  };
}

const metricMeta: Record<MetricKey, { label: string; unit: string }> = {
  fuelLiters: { label: "Combustível", unit: "L/turno" },
  idlePct: { label: "Tempo ocioso", unit: "%" },
  emptyTravelPct: { label: "Deslocamento vazio", unit: "%" },
  avgSpeedKmh: { label: "Velocidade média", unit: "km/h" },
  maxCoolantC: { label: "Temperatura máxima", unit: "°C" },
  shocks: { label: "Impactos", unit: "eventos" },
  overloads: { label: "Sobrecargas", unit: "eventos" }
};

function evidenceFor(row: HistoricalShiftRecord, baseline: Baseline, metric: MetricKey): StatisticalEvidence {
  const stats = baseline[metric];
  const zScore = (row[metric] - stats.mean) / stats.stdDev;
  return {
    metric,
    label: metricMeta[metric].label,
    current: round(row[metric], 2),
    mean: round(stats.mean, 2),
    stdDev: round(stats.stdDev, 2),
    zScore: round(zScore, 2),
    unit: metricMeta[metric].unit
  };
}

function evidenceMap(row: HistoricalShiftRecord, baseline: Baseline) {
  const metrics: MetricKey[] = ["fuelLiters", "idlePct", "emptyTravelPct", "avgSpeedKmh", "maxCoolantC", "shocks", "overloads"];
  return Object.fromEntries(metrics.map((metric) => [metric, evidenceFor(row, baseline, metric)])) as Record<MetricKey, StatisticalEvidence>;
}

function recentBaseline(history: HistoricalShiftRecord[], row: HistoricalShiftRecord) {
  const peers = history
    .filter((candidate) => candidate.assetId === row.assetId && candidate.shift === row.shift && candidate.date < row.date && candidate.date < EVALUATION_START)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-LOOKBACK_DAYS);
  if (peers.length < MIN_BASELINE_SAMPLES) return undefined;
  return buildBaseline(peers);
}

function candidateScore(evidence: StatisticalEvidence[], support = 0) {
  const top = [...evidence].sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore)).slice(0, 3);
  const statistical = top.reduce((sum, item) => sum + Math.min(4.5, Math.abs(item.zScore)), 0) * 8;
  return Math.round(clamp(35 + statistical + support, 0, 100));
}

function detectCandidate(row: HistoricalShiftRecord, baseline: Baseline): Candidate[] {
  const e = evidenceMap(row, baseline);
  const candidates: Candidate[] = [];

  if (e.fuelLiters.zScore >= 2.2 && e.idlePct.zScore >= 2.2 && e.maxCoolantC.zScore < 2.0) {
    const selected = [e.fuelLiters, e.idlePct, e.emptyTravelPct];
    candidates.push({ kind: "efficiency", row, baseline, evidence: selected, score: candidateScore(selected, 5) });
  }

  if (e.fuelLiters.zScore >= 2.0 && e.maxCoolantC.zScore >= 2.5) {
    const selected = [e.fuelLiters, e.maxCoolantC, e.idlePct];
    candidates.push({ kind: "mechanical", row, baseline, evidence: selected, score: candidateScore(selected, 12) });
  }

  if (row.shocks >= 2 && e.shocks.zScore >= 2.5) {
    const selected = [e.shocks, e.avgSpeedKmh];
    candidates.push({ kind: "shocks", row, baseline, evidence: selected, score: candidateScore(selected, 10) });
  }

  if (row.overloads >= 1 && e.overloads.zScore >= 2.0) {
    const selected = [e.overloads];
    candidates.push({ kind: "overload", row, baseline, evidence: selected, score: candidateScore(selected, 18) });
  }

  if (row.maintenanceHoursRemaining <= 24) {
    candidates.push({ kind: "maintenance", row, baseline, evidence: [], score: Math.round(clamp(100 - row.maintenanceHoursRemaining * 1.8, 55, 96)) });
  }

  return candidates;
}

function periodLabel(rows: HistoricalShiftRecord[]) {
  const dates = rows.map((row) => row.date).sort();
  return dates[0] === dates[dates.length - 1] ? dates[0] : `${dates[0]} → ${dates[dates.length - 1]}`;
}

function formatStat(item: StatisticalEvidence) {
  const sign = item.zScore >= 0 ? "+" : "";
  return `${item.label}: ${item.current} ${item.unit} vs. ${item.mean} ± ${item.stdDev} (${sign}${item.zScore}σ)`;
}

function insightFromGroup(kind: CandidateKind, group: Candidate[]): Insight {
  const representative = [...group].sort((a, b) => b.score - a.score)[0];
  const affectedOperators = new Set(group.map((item) => item.row.operatorId));
  const period = periodLabel(group.map((item) => item.row));
  const maxAbsZ = Math.max(0, ...group.flatMap((item) => item.evidence.map((metric) => Math.abs(metric.zScore))));
  const baselineSamples = representative.baseline.fuelLiters.samples;
  const sharedAnalysis = {
    method: "rolling-zscore" as const,
    baselineSamples,
    lookbackDays: LOOKBACK_DAYS,
    maxAbsZ: round(maxAbsZ, 2),
    period,
    statisticalEvidence: representative.evidence
  };

  if (kind === "efficiency") {
    const fuel = representative.evidence.find((item) => item.metric === "fuelLiters")!;
    const idle = representative.evidence.find((item) => item.metric === "idlePct")!;
    const excessFuel = Math.max(0, representative.row.fuelLiters - representative.baseline.fuelLiters.mean);
    const score = Math.max(...group.map((item) => item.score));
    return {
      id: `${representative.row.assetId}-efficiency-${representative.row.operatorId}`,
      assetId: representative.row.assetId,
      operatorId: representative.row.operatorId,
      category: "efficiency",
      severity: "high",
      title: "Ineficiência fora do padrão histórico",
      summary: `Consumo e idle desviaram simultaneamente do comportamento aprendido do ativo/turno (${fuel.zScore >= 0 ? "+" : ""}${fuel.zScore}σ e ${idle.zScore >= 0 ? "+" : ""}${idle.zScore}σ).`,
      evidence: [
        ...representative.evidence.map(formatStat),
        `${group.length} turno(s) anômalo(s) no período; concentração em ${representative.row.operatorId}`
      ],
      probableCause: "O desvio está concentrado no mesmo contexto de ativo, turno e operador, enquanto a temperatura permanece dentro do comportamento esperado. A hipótese prioritária é fluxo operacional/tempo de espera, não falha mecânica.",
      recommendedAction: "Revisar períodos de espera e deslocamentos sem carga com o operador e acompanhar os próximos 3 turnos. Se o desvio desaparecer, registrar a melhoria; se persistir, ampliar a investigação.",
      humanMessage: "Seu turno foi comparado com o histórico da mesma máquina e do mesmo turno. O objetivo é mostrar onde pequenas mudanças podem reduzir desperdício, sem julgamento automático.",
      potentialSavingsLitersPerShift: round(excessFuel, 1),
      score,
      analysis: sharedAnalysis
    };
  }

  if (kind === "mechanical") {
    const fuel = representative.evidence.find((item) => item.metric === "fuelLiters")!;
    const temperature = representative.evidence.find((item) => item.metric === "maxCoolantC")!;
    const score = Math.max(...group.map((item) => item.score));
    return {
      id: `${representative.row.assetId}-mechanical`,
      assetId: representative.row.assetId,
      category: "mechanical",
      severity: Math.max(...group.map((item) => item.row.maxCoolantC)) >= 105 ? "critical" : "high",
      title: "Padrão compatível com degradação do ativo",
      summary: `Combustível e temperatura saíram do baseline ao mesmo tempo (${fuel.zScore >= 0 ? "+" : ""}${fuel.zScore}σ e ${temperature.zScore >= 0 ? "+" : ""}${temperature.zScore}σ).`,
      evidence: [
        ...representative.evidence.map(formatStat),
        `${affectedOperators.size} operador(es) afetados no período ${period}`
      ],
      probableCause: "O padrão aparece em múltiplos operadores/turnos e combina aumento de consumo com temperatura elevada. Isso reduz a hipótese de comportamento individual e aumenta a prioridade de inspeção do ativo.",
      recommendedAction: "Abrir inspeção técnica do sistema térmico/drivetrain e acompanhar consumo e temperatura até a avaliação de manutenção.",
      humanMessage: "A análise separa sinais da máquina de sinais de condução para evitar atribuir ao operador um desvio que pode vir do equipamento.",
      score,
      analysis: sharedAnalysis
    };
  }

  if (kind === "shocks") {
    const shocks = representative.evidence.find((item) => item.metric === "shocks")!;
    const score = Math.max(...group.map((item) => item.score));
    return {
      id: `${representative.row.assetId}-shocks-${representative.row.operatorId}`,
      assetId: representative.row.assetId,
      operatorId: representative.row.operatorId,
      category: "safety",
      severity: "high",
      title: "Impactos muito acima do baseline",
      summary: `${representative.row.shocks} impactos no turno (${shocks.zScore >= 0 ? "+" : ""}${shocks.zScore}σ em relação ao histórico comparável).`,
      evidence: [...representative.evidence.map(formatStat), `${group.length} ocorrência(s) anômala(s) no período ${period}`],
      probableCause: "A concentração por operador e o aumento de velocidade média justificam investigar técnica de condução, rota, piso e contexto da tarefa antes de qualquer conclusão disciplinar.",
      recommendedAction: "Revisar os eventos com o operador, checar condições da rota e reforçar condução segura. Acompanhar a tendência após a orientação.",
      humanMessage: "O alerta serve para prevenir acidentes e entender o contexto. Ele não deve ser usado isoladamente para punição.",
      score,
      analysis: sharedAnalysis
    };
  }

  if (kind === "overload") {
    const overload = representative.evidence.find((item) => item.metric === "overloads")!;
    const score = Math.max(...group.map((item) => item.score));
    return {
      id: `${representative.row.assetId}-overload-${representative.row.operatorId}`,
      assetId: representative.row.assetId,
      operatorId: representative.row.operatorId,
      category: "safety",
      severity: "high",
      title: "Sobrecarga fora do comportamento normal",
      summary: `${representative.row.overloads} evento(s) de sobrecarga no turno, desvio de ${overload.zScore >= 0 ? "+" : ""}${overload.zScore}σ.`,
      evidence: [...representative.evidence.map(formatStat), `Período detectado: ${period}`],
      probableCause: "O evento foge do histórico da mesma máquina/turno. É necessário validar planejamento da tarefa, escolha do equipamento, informação de carga e procedimento operacional.",
      recommendedAction: "Reforçar limite de carga e confirmar se o equipamento selecionado é adequado para a tarefa antes de repetir a movimentação.",
      humanMessage: "Antes de atribuir a causa ao operador, valide também planejamento, equipamento e informação de carga disponível.",
      score,
      analysis: sharedAnalysis
    };
  }

  const remaining = Math.min(...group.map((item) => item.row.maintenanceHoursRemaining));
  const score = Math.max(...group.map((item) => item.score));
  return {
    id: `${representative.row.assetId}-maintenance`,
    assetId: representative.row.assetId,
    category: "maintenance",
    severity: remaining <= 8 ? "critical" : "attention",
    title: "Manutenção entrou na janela de planejamento",
    summary: `O contador chegou a ${round(remaining, 1)} h restantes no período analisado.`,
    evidence: [
      `Menor contador observado: ${round(remaining, 1)} h restantes`,
      `Baseline estatístico calculado com ${baselineSamples} turnos anteriores do mesmo ativo/turno`,
      `Período detectado: ${period}`
    ],
    probableCause: "Este insight vem do contador de manutenção, não de inferência sobre falha. A análise estatística continua disponível para verificar se surgiram sinais anormais associados.",
    recommendedAction: "Programar a parada antes de zerar o contador e revisar se existem diagnósticos ou desvios de temperatura/consumo associados.",
    humanMessage: "Planejar a parada com antecedência reduz improviso e ajuda a evitar manutenção corretiva.",
    score,
    analysis: sharedAnalysis
  };
}

export function analyzeHistoricalTelemetry(history: HistoricalShiftRecord[]) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date) || a.assetId.localeCompare(b.assetId) || a.shift.localeCompare(b.shift));
  const candidates: Candidate[] = [];

  for (const row of sorted) {
    if (row.date < EVALUATION_START) continue;
    const baseline = recentBaseline(sorted, row);
    if (!baseline) continue;
    candidates.push(...detectCandidate(row, baseline));
  }

  const groups = new Map<string, Candidate[]>();
  for (const candidate of candidates) {
    const operatorScoped = candidate.kind === "efficiency" || candidate.kind === "shocks" || candidate.kind === "overload";
    const key = `${candidate.row.assetId}:${candidate.kind}:${operatorScoped ? candidate.row.operatorId : "asset"}`;
    const group = groups.get(key) ?? [];
    group.push(candidate);
    groups.set(key, group);
  }

  const insights = [...groups.entries()]
    .map(([key, group]) => insightFromGroup(key.split(":")[1] as CandidateKind, group))
    .sort((a, b) => {
      const severityOrder: Record<Severity, number> = { critical: 3, high: 2, attention: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity] || b.score - a.score;
    });

  return {
    insights,
    analysis: {
      method: "rolling-zscore" as const,
      historyDays: 30,
      lookbackDays: LOOKBACK_DAYS,
      minBaselineSamples: MIN_BASELINE_SAMPLES,
      evaluationStart: EVALUATION_START,
      recordsAnalyzed: sorted.length,
      candidateEvents: candidates.length
    }
  };
}
