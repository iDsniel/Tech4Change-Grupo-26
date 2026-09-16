import { operationalExplanationPacket, type OperationalAIInsight, type OperationalEvidence } from "@/lib/operationalAI";

export type OperationalExplanationPacket = ReturnType<typeof operationalExplanationPacket>;

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
  return value as OperationalExplanationPacket;
}

export function deterministicOperationalExplanation(insight: OperationalAIInsight | OperationalExplanationPacket): OperationalExplanation {
  const evidence = insight.evidence.map((item) => `${item.label} ${item.current} ${item.unit} vs. referência ${item.mean} (${item.zScore >= 0 ? "+" : ""}${item.zScore}σ)`).join("; ");
  return {
    headline: insight.title,
    explanation: evidence ? `${insight.summary} Evidências: ${evidence}. ${insight.multivariate.explanation}` : `${insight.summary} ${insight.multivariate.explanation}`,
    whyItMatters: `O Pulso priorizou este contexto para investigação e recomenda: ${insight.recommendation}`,
    uncertainty: insight.uncertainty
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
    if (!normalized.includes("hipótese") && !normalized.includes("não prova") && !normalized.includes("incerteza") && !normalized.includes("não comprova")) return undefined;
    return { headline, explanation, whyItMatters, uncertainty };
  } catch {
    return undefined;
  }
}
