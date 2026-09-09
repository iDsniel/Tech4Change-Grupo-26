import type { EnrichedInsight } from "@/lib/isolationForest";

export const EXPLANATION_SCHEMA_VERSION = "telemetry-explanation-v1";

export type ExplanationContent = {
  headline: string;
  explanation: string;
  whyItMatters: string;
  uncertainty: string;
};

export type ExplanationResult = {
  schemaVersion: typeof EXPLANATION_SCHEMA_VERSION;
  mode: "generative" | "deterministic";
  insightId: string;
  model?: string;
  explanation: ExplanationContent;
  guardrails: {
    evidenceBound: true;
    noAutomaticDecision: true;
    noRootCauseClaim: true;
    fallbackAvailable: true;
  };
};

export type ExplanationEvidencePacket = {
  insightId: string;
  assetId: string;
  operatorId?: string;
  category: EnrichedInsight["category"];
  severity: EnrichedInsight["severity"];
  fusionScore: number;
  engineHypothesis: string;
  engineRecommendedAction: string;
  statisticalEvidence: Array<{
    metric: string;
    label: string;
    current: number;
    mean: number;
    stdDev: number;
    zScore: number;
    unit: string;
  }>;
  multivariate: {
    applicable: boolean;
    agreement: EnrichedInsight["multivariate"]["agreement"];
    anomalyScore?: number;
    peakPercentile?: number;
    explanation: string;
  };
};

const MAX_FIELD_LENGTH = 700;
const UNSUPPORTED_CERTAINTY = /\b(causa confirmada|diagnóstico confirmado|comprovadamente|certeza de|garante que|sem dúvida)\b/i;

function compact(value: string, maxLength = MAX_FIELD_LENGTH) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function buildEvidencePacket(insight: EnrichedInsight): ExplanationEvidencePacket {
  return {
    insightId: insight.id,
    assetId: insight.assetId,
    operatorId: insight.operatorId,
    category: insight.category,
    severity: insight.severity,
    fusionScore: insight.score,
    engineHypothesis: insight.probableCause,
    engineRecommendedAction: insight.recommendedAction,
    statisticalEvidence: (insight.analysis?.statisticalEvidence ?? []).map((item) => ({
      metric: item.metric,
      label: item.label,
      current: item.current,
      mean: item.mean,
      stdDev: item.stdDev,
      zScore: item.zScore,
      unit: item.unit
    })),
    multivariate: {
      applicable: insight.multivariate.applicable,
      agreement: insight.multivariate.agreement,
      anomalyScore: insight.multivariate.anomalyScore,
      peakPercentile: insight.multivariate.peakPercentile,
      explanation: insight.multivariate.explanation
    }
  };
}

export function deterministicExplanation(insight: EnrichedInsight): ExplanationContent {
  const topEvidence = [...(insight.analysis?.statisticalEvidence ?? [])]
    .sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore))
    .slice(0, 2);

  const evidenceText = topEvidence.length
    ? topEvidence
        .map((item) => `${item.label} ${item.current} ${item.unit}, baseline ${item.mean} ± ${item.stdDev}, desvio ${item.zScore >= 0 ? "+" : ""}${item.zScore}σ`)
        .join("; ")
    : insight.evidence.slice(0, 2).join("; ");

  const multivariateText = insight.multivariate.applicable
    ? ` A segunda opinião multivariada teve concordância ${insight.multivariate.agreement}${
        insight.multivariate.peakPercentile !== undefined
          ? ` e percentil máximo de ${Math.round(insight.multivariate.peakPercentile * 100)}%`
          : ""
      }.`
    : " A camada multivariada não é aplicada a este tipo de insight.";

  return {
    headline: compact(`${insight.assetId}: ${insight.title}`, 180),
    explanation: compact(`${insight.probableCause} Evidências principais: ${evidenceText}.${multivariateText}`),
    whyItMatters: compact(`O insight recebeu score de fusão ${insight.score}/100. A próxima ação definida pelo motor é: ${insight.recommendedAction}`),
    uncertainty: "Esta leitura é uma hipótese apoiada pelas evidências disponíveis. Ela não prova causalidade, não substitui inspeção técnica e não autoriza decisão disciplinar automática."
  };
}

function isExplanationContent(value: unknown): value is ExplanationContent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const keys: Array<keyof ExplanationContent> = ["headline", "explanation", "whyItMatters", "uncertainty"];
  if (!keys.every((key) => typeof candidate[key] === "string" && String(candidate[key]).trim().length > 0)) return false;
  if (keys.some((key) => String(candidate[key]).length > MAX_FIELD_LENGTH)) return false;
  const combined = keys.map((key) => String(candidate[key])).join(" ");
  if (UNSUPPORTED_CERTAINTY.test(combined)) return false;
  const uncertainty = String(candidate.uncertainty).toLowerCase();
  if (!uncertainty.includes("hipótese") && !uncertainty.includes("não prova") && !uncertainty.includes("incerteza")) return false;
  return true;
}

export function parseGeneratedExplanation(raw: string): ExplanationContent | undefined {
  const cleaned = raw.trim().replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (!isExplanationContent(parsed)) return undefined;
    return {
      headline: compact(parsed.headline, 180),
      explanation: compact(parsed.explanation),
      whyItMatters: compact(parsed.whyItMatters),
      uncertainty: compact(parsed.uncertainty)
    };
  } catch {
    return undefined;
  }
}

export function explanationResult(
  insight: EnrichedInsight,
  explanation: ExplanationContent,
  options: { mode: "generative" | "deterministic"; model?: string }
): ExplanationResult {
  return {
    schemaVersion: EXPLANATION_SCHEMA_VERSION,
    mode: options.mode,
    insightId: insight.id,
    model: options.model,
    explanation,
    guardrails: {
      evidenceBound: true,
      noAutomaticDecision: true,
      noRootCauseClaim: true,
      fallbackAvailable: true
    }
  };
}
