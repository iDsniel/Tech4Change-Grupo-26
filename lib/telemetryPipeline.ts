import { fuseWithIsolationForest, type EnrichedInsight } from "@/lib/isolationForest";
import { analyzeHistoricalTelemetry, type HistoricalShiftRecord, type Severity } from "@/lib/telemetry";

export type FleetStatus = Severity | "healthy";
export type FleetAsset = { assetId: string; capacity: string; status: FleetStatus };
export type AssetMetadata = { assetId: string; capacity?: string };

export type TelemetrySourceDescriptor = {
  mode: "demo" | "external";
  type: "normalized-csv" | "provider-adapter";
  name: string;
  vendorReference: string;
  disclaimer: string;
  provider?: string;
  ingestion: Record<string, unknown>;
};

const severityOrder: Record<Severity, number> = { critical: 3, high: 2, attention: 1 };

function round(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function fleetFromHistory(
  history: HistoricalShiftRecord[],
  insights: EnrichedInsight[],
  assetMetadata: AssetMetadata[] = []
): FleetAsset[] {
  const capacityByAsset = new Map(assetMetadata.map((asset) => [asset.assetId, asset.capacity ?? "n/d"]));

  return [...new Set(history.map((record) => record.assetId))]
    .sort()
    .map((assetId) => {
      const relevant = insights
        .filter((insight) => insight.assetId === assetId)
        .sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity] || b.score - a.score);
      const status: FleetStatus = relevant[0]?.severity ?? "healthy";
      return { assetId, capacity: capacityByAsset.get(assetId) ?? "n/d", status };
    });
}

export function runTelemetryPipeline(
  history: HistoricalShiftRecord[],
  source: TelemetrySourceDescriptor,
  assetMetadata: AssetMetadata[] = []
) {
  const statistical = analyzeHistoricalTelemetry(history);
  const multivariate = fuseWithIsolationForest(history, statistical.insights, statistical.analysis);
  const fleet = fleetFromHistory(history, multivariate.insights, assetMetadata);

  return {
    mode: source.mode,
    generatedAt: new Date().toISOString(),
    source: {
      type: source.type,
      name: source.name,
      provider: source.provider,
      vendorReference: source.vendorReference,
      disclaimer: source.disclaimer,
      ingestion: source.ingestion
    },
    analysis: {
      statistical: statistical.analysis,
      multivariate: multivariate.analysis,
      fusion: {
        statisticalWeight: 0.8,
        multivariateWeight: 0.2,
        principle: "O z-score explica quais métricas desviaram; o Isolation Forest funciona como segunda opinião sobre a combinação multivariada."
      }
    },
    fleet,
    summary: {
      assets: fleet.length,
      healthyAssets: fleet.filter((asset) => asset.status === "healthy").length,
      activeInsights: multivariate.insights.length,
      criticalInsights: multivariate.insights.filter((insight) => insight.severity === "critical").length,
      potentialSavingsLitersPerShift: round(
        multivariate.insights.reduce((total, insight) => total + (insight.potentialSavingsLitersPerShift ?? 0), 0),
        1
      )
    },
    insights: multivariate.insights
  };
}
