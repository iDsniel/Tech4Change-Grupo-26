export type InsightCategory = "efficiency" | "mechanical" | "safety" | "maintenance";
export type Severity = "attention" | "high" | "critical";

export type TelemetryWindow = {
  assetId: string;
  operatorId?: string;
  shift: "A" | "B" | "C";
  period: string;
  affectedOperators: number;
  baseline: {
    fuelLiters: number;
    idlePct: number;
    emptyTravelPct: number;
    maxCoolantC: number;
    shocks: number;
    overloads: number;
  };
  current: {
    fuelLiters: number;
    idlePct: number;
    emptyTravelPct: number;
    maxCoolantC: number;
    shocks: number;
    overloads: number;
    maintenanceHoursRemaining: number;
  };
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
};

export const demoFleet = [
  { assetId: "FLT-012", capacity: "16 t", status: "attention" },
  { assetId: "FLT-017", capacity: "16 t", status: "attention" },
  { assetId: "FLT-023", capacity: "18 t", status: "critical" },
  { assetId: "FLT-031", capacity: "25 t", status: "high" },
  { assetId: "FLT-044", capacity: "25 t", status: "attention" },
  { assetId: "FLT-052", capacity: "18 t", status: "healthy" },
  { assetId: "FLT-058", capacity: "16 t", status: "healthy" },
  { assetId: "FLT-064", capacity: "33 t", status: "healthy" }
] as const;

export const demoTelemetryWindows: TelemetryWindow[] = [
  {
    assetId: "FLT-017",
    operatorId: "OP-042",
    shift: "C",
    period: "02–05 set 2026",
    affectedOperators: 1,
    baseline: { fuelLiters: 31.4, idlePct: 22, emptyTravelPct: 37, maxCoolantC: 89, shocks: 0, overloads: 0 },
    current: { fuelLiters: 34.4, idlePct: 32, emptyTravelPct: 49, maxCoolantC: 90, shocks: 0, overloads: 0, maintenanceHoursRemaining: 118 }
  },
  {
    assetId: "FLT-023",
    shift: "B",
    period: "04–09 set 2026",
    affectedOperators: 5,
    baseline: { fuelLiters: 34.1, idlePct: 23, emptyTravelPct: 39, maxCoolantC: 91, shocks: 0, overloads: 0 },
    current: { fuelLiters: 39.7, idlePct: 24, emptyTravelPct: 40, maxCoolantC: 108, shocks: 0, overloads: 0, maintenanceHoursRemaining: 83 }
  },
  {
    assetId: "FLT-031",
    operatorId: "OP-007",
    shift: "B",
    period: "28 ago–03 set 2026",
    affectedOperators: 1,
    baseline: { fuelLiters: 42.8, idlePct: 21, emptyTravelPct: 35, maxCoolantC: 88, shocks: 0, overloads: 0 },
    current: { fuelLiters: 44.1, idlePct: 22, emptyTravelPct: 36, maxCoolantC: 89, shocks: 5, overloads: 0, maintenanceHoursRemaining: 132 }
  },
  {
    assetId: "FLT-012",
    operatorId: "OP-015",
    shift: "A",
    period: "06–07 set 2026",
    affectedOperators: 1,
    baseline: { fuelLiters: 30.8, idlePct: 20, emptyTravelPct: 36, maxCoolantC: 87, shocks: 0, overloads: 0 },
    current: { fuelLiters: 31.2, idlePct: 21, emptyTravelPct: 36, maxCoolantC: 88, shocks: 0, overloads: 3, maintenanceHoursRemaining: 96 }
  },
  {
    assetId: "FLT-044",
    shift: "A",
    period: "01–09 set 2026",
    affectedOperators: 4,
    baseline: { fuelLiters: 40.2, idlePct: 22, emptyTravelPct: 38, maxCoolantC: 90, shocks: 0, overloads: 0 },
    current: { fuelLiters: 40.8, idlePct: 23, emptyTravelPct: 39, maxCoolantC: 91, shocks: 0, overloads: 0, maintenanceHoursRemaining: 18 }
  }
];

function pctDelta(current: number, baseline: number) {
  return baseline === 0 ? 0 : ((current - baseline) / baseline) * 100;
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}

export function analyzeTelemetry(windows: TelemetryWindow[] = demoTelemetryWindows): Insight[] {
  const insights: Insight[] = [];

  for (const row of windows) {
    const fuelDelta = pctDelta(row.current.fuelLiters, row.baseline.fuelLiters);
    const idleDelta = row.current.idlePct - row.baseline.idlePct;
    const emptyDelta = row.current.emptyTravelPct - row.baseline.emptyTravelPct;

    if (fuelDelta >= 8 && idleDelta >= 6 && row.affectedOperators <= 1) {
      const excessFuel = Math.max(0, row.current.fuelLiters - row.baseline.fuelLiters);
      insights.push({
        id: `${row.assetId}-efficiency`,
        assetId: row.assetId,
        operatorId: row.operatorId,
        category: "efficiency",
        severity: fuelDelta >= 15 ? "high" : "attention",
        title: "Ineficiência concentrada na operação",
        summary: `Consumo ${round(fuelDelta)}% acima do baseline, com aumento de ${round(idleDelta)} p.p. no tempo ocioso.`,
        evidence: [
          `Combustível: ${row.baseline.fuelLiters} L → ${row.current.fuelLiters} L/turno`,
          `Idle: ${row.baseline.idlePct}% → ${row.current.idlePct}%`,
          `Deslocamento vazio: ${row.baseline.emptyTravelPct}% → ${row.current.emptyTravelPct}%`,
          `Padrão concentrado em ${row.operatorId ?? "um operador"}`
        ],
        probableCause: "O desvio acompanha um operador/turno e não aparece como tendência geral do ativo. A hipótese prioritária é comportamento operacional ou fluxo de espera, não falha mecânica.",
        recommendedAction: "Fazer coaching curto de eco-driving e revisar os períodos de espera e deslocamentos sem carga. Acompanhar os próximos 3 turnos para confirmar melhora.",
        humanMessage: "Você não está sendo avaliado por uma única ocorrência. O copiloto compara seu turno com o histórico e mostra onde pequenas mudanças podem reduzir desperdício.",
        potentialSavingsLitersPerShift: round(excessFuel),
        score: Math.min(100, Math.round(55 + fuelDelta + idleDelta * 2 + emptyDelta))
      });
    }

    if (fuelDelta >= 10 && row.current.maxCoolantC >= 100 && row.affectedOperators >= 3) {
      insights.push({
        id: `${row.assetId}-mechanical`,
        assetId: row.assetId,
        category: "mechanical",
        severity: row.current.maxCoolantC >= 105 ? "critical" : "high",
        title: "Possível degradação mecânica",
        summary: `Consumo ${round(fuelDelta)}% acima do baseline e temperatura máxima de ${row.current.maxCoolantC} °C em múltiplos operadores.`,
        evidence: [
          `${row.affectedOperators} operadores afetados na mesma janela`,
          `Combustível: ${row.baseline.fuelLiters} L → ${row.current.fuelLiters} L/turno`,
          `Temperatura: ${row.baseline.maxCoolantC} °C → ${row.current.maxCoolantC} °C`,
          `Idle praticamente estável: ${row.baseline.idlePct}% → ${row.current.idlePct}%`
        ],
        probableCause: "Como o padrão persiste com vários operadores e o idle não mudou materialmente, a hipótese comportamental perde força. O ativo deve ser inspecionado antes de responsabilizar o operador.",
        recommendedAction: "Abrir inspeção técnica do sistema térmico/drivetrain e acompanhar temperatura e consumo até a avaliação de manutenção.",
        humanMessage: "A IA separa sinais do equipamento de sinais de condução para evitar atribuir ao operador um problema que pode ser da máquina.",
        score: Math.min(100, Math.round(70 + fuelDelta + (row.current.maxCoolantC - 100) * 2))
      });
    }

    if (row.current.shocks >= 3) {
      insights.push({
        id: `${row.assetId}-shocks`,
        assetId: row.assetId,
        operatorId: row.operatorId,
        category: "safety",
        severity: row.current.shocks >= 5 ? "high" : "attention",
        title: "Aumento de eventos de impacto",
        summary: `${row.current.shocks} impactos registrados no período, acima do padrão histórico do ativo.`,
        evidence: [
          `Impactos baseline: ${row.baseline.shocks}`,
          `Impactos atuais: ${row.current.shocks}`,
          `Janela: ${row.period}`,
          `Concentração: ${row.operatorId ?? "operação"}`
        ],
        probableCause: "A concentração temporal e por operador sugere investigar velocidade, rota, piso e técnica de condução antes de qualquer conclusão disciplinar.",
        recommendedAction: "Revisar os eventos com o operador e o mapa de circulação, checar condições da rota e reforçar condução segura.",
        humanMessage: "O objetivo do alerta é prevenir acidente e ajudar a corrigir o contexto, não punir automaticamente quem estava operando.",
        score: Math.min(100, 55 + row.current.shocks * 8)
      });
    }

    if (row.current.overloads >= 1) {
      insights.push({
        id: `${row.assetId}-overload`,
        assetId: row.assetId,
        operatorId: row.operatorId,
        category: "safety",
        severity: "high",
        title: "Tentativas de sobrecarga",
        summary: `${row.current.overloads} eventos de sobrecarga detectados no período.`,
        evidence: [
          `Sobrecargas baseline: ${row.baseline.overloads}`,
          `Sobrecargas atuais: ${row.current.overloads}`,
          `Janela: ${row.period}`
        ],
        probableCause: "Há uso fora do padrão de carga. É necessário validar se a origem é seleção de equipamento, planejamento da tarefa ou procedimento operacional.",
        recommendedAction: "Reforçar limite de carga, revisar a tarefa e confirmar se o equipamento selecionado é adequado para o peso movimentado.",
        humanMessage: "Antes de atribuir causa ao operador, valide também planejamento, escolha do equipamento e informação de carga disponível.",
        score: Math.min(100, 65 + row.current.overloads * 10)
      });
    }

    if (row.current.maintenanceHoursRemaining <= 24) {
      insights.push({
        id: `${row.assetId}-maintenance`,
        assetId: row.assetId,
        category: "maintenance",
        severity: row.current.maintenanceHoursRemaining <= 8 ? "critical" : "attention",
        title: "Manutenção próxima do vencimento",
        summary: `Restam ${row.current.maintenanceHoursRemaining} horas para a próxima manutenção programada.`,
        evidence: [
          `Contador: ${row.current.maintenanceHoursRemaining} h restantes`,
          `Janela analisada: ${row.period}`,
          `Sinal presente em ${row.affectedOperators} operadores, portanto não individualizado`
        ],
        probableCause: "O contador de manutenção entrou na janela de planejamento. Este insight é preventivo e não indica, sozinho, falha do equipamento.",
        recommendedAction: "Programar a parada antes de zerar o contador e verificar se existem diagnósticos adicionais associados ao ativo.",
        humanMessage: "Planejar a parada com antecedência reduz improviso e evita que manutenção preventiva vire corretiva.",
        score: Math.max(50, 100 - row.current.maintenanceHoursRemaining * 2)
      });
    }
  }

  const order: Record<Severity, number> = { critical: 3, high: 2, attention: 1 };
  return insights.sort((a, b) => order[b.severity] - order[a.severity] || b.score - a.score);
}

export function fleetSummary(insights: Insight[] = analyzeTelemetry()) {
  return {
    assets: demoFleet.length,
    healthyAssets: demoFleet.filter((asset) => asset.status === "healthy").length,
    activeInsights: insights.length,
    criticalInsights: insights.filter((insight) => insight.severity === "critical").length,
    potentialSavingsLitersPerShift: round(insights.reduce((total, insight) => total + (insight.potentialSavingsLitersPerShift ?? 0), 0))
  };
}
