import { operationalExplanationPacket, type OperationalAIInsight, type OperationalEvidence } from "./operationalAI.ts";
import { validateOperationalContext, type OperationalContext } from "./operationalContext.ts";

export type OperationalExplanationPacket = ReturnType<typeof operationalExplanationPacket> & { context?: OperationalContext };

export type OperationalExplanation = {
  headline: string;
  explanation: string;
  whyItMatters: string;
  uncertainty: string;
};

const ALLOWED_CATEGORIES = new Set(["efficiency", "reliability", "safety", "multivariate"]);
const ALLOWED_PRIORITIES = new Set(["attention", "high"]);
const ALLOWED_METRICS = new Set(["keyHours", "workPct", "idlePct", "waitPct", "faultEvents", "impactEvents"]);
const ALLOWED_AGREEMENTS = new Set(["strong", "moderate", "weak"]);
const categoricalClaims = ["causa confirmada", "diagnóstico confirmado", "certeza de", "comprovadamente causado", "responsável pelo evento"];

function finite(value: unknown) {
  return typeof value === "number" && Number.isFinite(value);
}

function shortString(value: unknown, max: number) {
  return typeof value === "string" && value.length > 0 && value.length <= max;
}

function validEvidence(value: unknown): value is OperationalEvidence {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return ALLOWED_METRICS.has(String(item.metric)) && shortString(item.label, 80) && shortString(item.unit, 24) &&
    finite(item.current) && finite(item.mean) && finite(item.stdDev) && finite(item.zScore);
}

export function validateOperationalExplanationPacket(value: unknown): OperationalExplanationPacket {
  if (!value || typeof value !== "object") throw new Error("Pacote de explicação inválido.");
  const packet = value as Record<string, unknown>;
  if (packet.schemaVersion !== "pulso-operational-explanation-v1" || !/^EP\d{2,6}$/.test(String(packet.assetId)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(packet.date))) throw new Error("Identidade da evidência inválida.");
  if (!ALLOWED_CATEGORIES.has(String(packet.category)) || !ALLOWED_PRIORITIES.has(String(packet.priority))) throw new Error("Classificação da evidência inválida.");
  if (!shortString(packet.title, 180) || !shortString(packet.summary, 1200) || !shortString(packet.recommendation, 1200) || !shortString(packet.uncertainty, 800)) throw new Error("Texto da evidência inválido.");
  if (!finite(packet.evidenceStrength) || Number(packet.evidenceStrength) < 0 || Number(packet.evidenceStrength) > 100 || !Number.isInteger(packet.baselineSamples) || !Number.isInteger(packet.lookbackDays)) throw new Error("Metadados da evidência inválidos.");
  if (!Array.isArray(packet.evidence) || packet.evidence.length > 6 || !packet.evidence.every(validEvidence)) throw new Error("Evidências estatísticas inválidas.");
  const multi = packet.multivariate as Record<string, unknown> | undefined;
  if (!multi || multi.method !== "isolation-forest" || !ALLOWED_AGREEMENTS.has(String(multi.agreement)) || !finite(multi.anomalyScore) || !finite(multi.percentile) || Number(multi.percentile) < 0 || Number(multi.percentile) > 1 || !Number.isInteger(multi.trees) || !Number.isInteger(multi.sampleSize) || !Array.isArray(multi.features) || !multi.features.every((item) => ALLOWED_METRICS.has(String(item))) || !shortString(multi.explanation, 800)) throw new Error("Evidência multivariada inválida.");
  const events = packet.relatedEvents as Record<string, unknown> | undefined;
  if (!events || !Number.isInteger(events.faults) || Number(events.faults) < 0 || !Number.isInteger(events.impacts) || Number(events.impacts) < 0) throw new Error("Contexto de eventos inválido.");
  if (packet.context !== undefined) {
    const context = validateOperationalContext(packet.context);
    if (context.assetId !== packet.assetId || context.date !== packet.date) throw new Error("Contexto operacional não corresponde à evidência.");
  }
  return value as OperationalExplanationPacket;
}

function plainFacts(insight: OperationalAIInsight | OperationalExplanationPacket) {
  const facts: string[] = [];
  const idle = insight.evidence.find((item) => item.metric === "idlePct" && item.zScore > 0);
  const wait = insight.evidence.find((item) => item.metric === "waitPct" && item.zScore > 0);
  const work = insight.evidence.find((item) => item.metric === "workPct" && item.zScore < 0);
  const faults = insight.relatedEvents.faults;
  const impacts = insight.relatedEvents.impacts;
  if (idle) facts.push(`tempo ocioso em ${Math.round(idle.current)}% contra ${Math.round(idle.mean)}% no histórico`);
  if (wait) facts.push(`espera em ${Math.round(wait.current)}% contra ${Math.round(wait.mean)}% no histórico`);
  if (work) facts.push(`trabalho em ${Math.round(work.current)}% contra ${Math.round(work.mean)}% no histórico`);
  if (impacts) facts.push(`${impacts} impacto(s) registrado(s)`);
  if (faults) facts.push(`${faults} registro(s) de falha`);
  return facts;
}

function contextSentence(packet: OperationalAIInsight | OperationalExplanationPacket) {
  if (!("context" in packet) || !packet.context) return "";
  const context = packet.context;
  const pieces: string[] = [];
  const aggregate = context.aggregateTelemetry;
  if (aggregate?.ratios.hydraulicPct != null) pieces.push(`hidráulica ${Math.round(aggregate.ratios.hydraulicPct)}% da chave`);
  if (aggregate?.ratios.motionPct != null) pieces.push(`movimento ${Math.round(aggregate.ratios.motionPct)}% da chave`);
  if (aggregate?.ratios.marchPct != null) pieces.push(`marcha ${Math.round(aggregate.ratios.marchPct)}% da chave`);
  const input = context.management.sameDayInput;
  if (input?.production != null) pieces.push(`produção apontada no dia ${Math.round(input.production)} ${input.productionUnit}`);
  if (!pieces.length) return "";
  const aggregateLabel = aggregate
    ? aggregate.granularity === "asset-month"
      ? ` No mês ${aggregate.periodStart.slice(0, 7)}, ${pieces.filter((item) => !item.startsWith("produção")).join(", ")}.`
      : ` No agregado disponível de ${aggregate.periodStart} a ${aggregate.periodEnd}, ${pieces.filter((item) => !item.startsWith("produção")).join(", ")}.`
    : "";
  const dailyLabel = input?.production != null ? ` No mesmo dia, houve apontamento de produção de ${Math.round(input.production)} ${input.productionUnit}.` : "";
  return `${aggregateLabel}${dailyLabel}`;
}

export function deterministicOperationalExplanation(insight: OperationalAIInsight | OperationalExplanationPacket): OperationalExplanation {
  const facts = plainFacts(insight);
  const context = "context" in insight ? insight.context : undefined;
  const explanation = facts.length
    ? `Neste contexto, ${facts.join("; ")}. O Pulso destacou a situação porque ela se afastou do comportamento habitual do próprio equipamento.${contextSentence(insight)}`
    : `O Pulso encontrou uma combinação de sinais diferente do comportamento habitual deste equipamento e separou o contexto para revisão.${contextSentence(insight)}`;

  let whyItMatters = "Essa diferença pode ajudar a encontrar mais rápido onde vale investigar antes de decidir uma ação.";
  if (insight.category === "safety") whyItMatters = "Impactos precisam ser contextualizados com rota, piso, carga e condição do equipamento antes de qualquer conclusão.";
  if (insight.category === "reliability") whyItMatters = "Falhas concentradas podem afetar disponibilidade e merecem confronto com inspeção e histórico de manutenção.";
  if (context && !context.availability.demandOrProduction && insight.category === "efficiency") whyItMatters = "Sem dado de demanda ou produção do dia, o Pulso não consegue separar automaticamente baixa atividade de baixa demanda; a leitura serve para direcionar a verificação humana.";

  const scopeWarning = context?.aggregateTelemetry
    ? context.aggregateTelemetry.granularity === "asset-month"
      ? " Indicadores de hidráulica, movimento e marcha são contexto mensal, não evidência diária."
      : " Indicadores de hidráulica, movimento e marcha são contexto agregado do período, não evidência diária."
    : "";

  return {
    headline: insight.category === "safety" ? "Impacto merece revisão" : insight.category === "reliability" ? "Falhas pedem verificação" : "Comportamento diferente do habitual",
    explanation,
    whyItMatters,
    uncertainty: `Esta leitura é um indício para investigação e não comprova causa, falha futura ou responsabilidade individual.${scopeWarning}`
  };
}

function clean(value: unknown, max: number) {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  if (!text || text.length > max) return undefined;
  const normalized = text.toLowerCase();
  if (categoricalClaims.some((claim) => normalized.includes(claim))) return undefined;
  return text;
}

export function parseOperationalGeneratedExplanation(raw: string): OperationalExplanation | undefined {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const headline = clean(value.headline, 180);
    const explanation = clean(value.explanation, 1200);
    const whyItMatters = clean(value.whyItMatters, 900);
    const uncertainty = clean(value.uncertainty, 700);
    if (!headline || !explanation || !whyItMatters || !uncertainty) return undefined;
    const normalized = uncertainty.toLowerCase();
    if (!normalized.includes("hipótese") && !normalized.includes("indício") && !normalized.includes("não prova") && !normalized.includes("incerteza") && !normalized.includes("não comprova")) return undefined;
    return { headline, explanation, whyItMatters, uncertainty };
  } catch {
    return undefined;
  }
}
