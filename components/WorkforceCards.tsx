"use client";

import { useMemo, useState } from "react";
import type { HysterData, WorkforceMetricKey, WorkforceMetrics } from "@/lib/hyster";
import { followUp, statusLabels, type Workspace } from "@/lib/operations";

const fmt = (value: number | null | undefined, suffix = "") => value == null
  ? "Não disponível"
  : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }) + suffix;

const metricRows: { key: WorkforceMetricKey; label: string; unit: string }[] = [
  { key: "serviceHours", label: "Medidor principal", unit: " h" },
  { key: "driveHours", label: "Motor / tração", unit: " h" },
  { key: "hydraulicMeterHours", label: "Medidor hidráulico", unit: " h" },
  { key: "tractionMeterHours", label: "Medidor de tração", unit: " h" },
  { key: "distanceKm", label: "Distância", unit: " km" },
  { key: "monitoredHours", label: "Monitorado", unit: " h" },
  { key: "keyHours", label: "Chave ligada", unit: " h" },
  { key: "presenceHours", label: "Presença", unit: " h" },
  { key: "motionHours", label: "Movimento", unit: " h" },
  { key: "hydraulicHours", label: "Função hidráulica", unit: " h" },
  { key: "workHours", label: "Trabalho", unit: " h" },
  { key: "liftHours", label: "Elevação", unit: " h" },
  { key: "lowerHours", label: "Descida", unit: " h" },
  { key: "highSpeedHours", label: "Alta velocidade", unit: " h" },
  { key: "reverseHours", label: "Marcha ré", unit: " h" },
  { key: "forwardHours", label: "Marcha à frente", unit: " h" },
  { key: "idleHours", label: "Ociosidade", unit: " h" }
];

function metricValue(metrics: WorkforceMetrics | undefined, key: WorkforceMetricKey) {
  return metrics?.[key];
}

type Props = { data: HysterData; workspace: Workspace };

export default function WorkforceCards({ data, workspace }: Props) {
  const [asset, setAsset] = useState("all");
  const [month, setMonth] = useState("all");
  const [card, setCard] = useState("all");
  const workforce = data.workforce;
  const months = [...new Set(data.daily.map(row => row.date.slice(0, 7)))].sort();

  const workforceCodes = workforce?.cards.flatMap(row => row.cardCode ? [row.cardCode] : []) ?? [];
  const eventCodes = data.events.flatMap(event => event.cardCode ? [event.cardCode] : []);
  const codes = [...new Set([...workforceCodes, ...eventCodes])].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const workforceCodeSet = new Set(workforceCodes);
  const eventCodeSet = new Set(eventCodes);
  const eventOnlyCodes = [...eventCodeSet].filter(code => !workforceCodeSet.has(code)).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const workforceOnlyCodes = [...workforceCodeSet].filter(code => !eventCodeSet.has(code)).sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
  const qualityRows = workforce?.cards.filter(row => row.cardQuality !== "complete") ?? [];

  const filteredEvents = useMemo(() => data.events.filter(event =>
    (asset === "all" || event.assetId === asset) &&
    (month === "all" || event.date.startsWith(month)) &&
    (card === "all" || event.cardCode === card)), [data.events, asset, month, card]);

  const workforceMatches = card === "all" ? [] : workforce?.cards.filter(row => row.cardCode === card) ?? [];
  const workforceCard = workforceMatches.length === 1 ? workforceMatches[0] : undefined;
  const workforceAsset = asset === "all" ? undefined : workforceCard?.assets.find(row => row.assetId === asset);
  const selectedMetrics = asset === "all" ? workforceCard?.metrics : workforceAsset?.metrics;
  const selectedUsageCount = asset === "all" ? workforceCard?.usageCount : workforceAsset?.usageCount;

  const cardEventsAcrossPeriod = card === "all" ? [] : data.events.filter(event =>
    event.cardCode === card && (asset === "all" || event.assetId === asset));
  const eventEvolution = months.map(period => {
    const rows = cardEventsAcrossPeriod.filter(event => event.date.startsWith(period));
    return { period, total: rows.length, impacts: rows.filter(event => event.type === "Impacto").length, failures: rows.filter(event => event.type === "Falha do sistema").length };
  });

  const relatedAssetIds = new Set<string>();
  if (workforceCard) {
    if (asset !== "all") {
      if (workforceCard.assets.some(row => row.assetId === asset)) relatedAssetIds.add(asset);
    } else workforceCard.assets.forEach(row => relatedAssetIds.add(row.assetId));
  }
  const relatedOrders = [...workspace.orders]
    .filter(order => relatedAssetIds.has(order.assetId))
    .sort((a, b) => b.openedAt.localeCompare(a.openedAt));

  return <>
    <section className="detailCard">
      <h2>Acompanhamento por cartão</h2>
      <p>A mesma base operacional reúne telemetria, eventos e indicadores agregados por cartão. Nomes não entram no contrato. Eventos são evidências de associação, não prova de responsabilidade individual.</p>
      <div className="hysterFilters">
        <label>Equipamento<select value={asset} onChange={event => setAsset(event.target.value)}><option value="all">Toda a frota</option>{data.assets.map(item => <option key={item.assetId}>{item.assetId}</option>)}</select></label>
        <label>Mês dos eventos<select value={month} onChange={event => setMonth(event.target.value)}><option value="all">Todo o período</option>{months.map(item => <option key={item}>{item}</option>)}</select></label>
        <label>Cartão<select value={card} onChange={event => setCard(event.target.value)}><option value="all">Todos os cartões</option>{codes.map(code => <option value={code} key={code}>Cartão {code}</option>)}</select></label>
      </div>
      {workforce ? <p><strong>Indicadores por cartão:</strong> {workforce.periodStart} a {workforce.periodEnd} · granularidade cartão-período · unidade métrica. Os totais do período não são repartidos artificialmente por mês ou dia.</p> : <p>Esta base operacional não contém indicadores agregados por cartão. Gere novamente o pacote unificado com todas as fontes do período.</p>}
      {month !== "all" && workforceCard && <p><strong>Atenção à granularidade:</strong> o filtro {month} afeta somente os eventos abaixo. Os contadores do cartão permanecem referentes a {workforce?.periodStart} a {workforce?.periodEnd}.</p>}
      <section className="kpiGrid">
        <article className="kpiCard"><div><span>Cartões com indicadores</span><strong>{workforce?.cards.length ?? 0}</strong><small>registros agregados do período, sem nomes</small></div></article>
        <article className="kpiCard"><div><span>Eventos no filtro</span><strong>{filteredEvents.length}</strong><small>{filteredEvents.filter(event => event.type === "Impacto").length} impactos · {filteredEvents.filter(event => event.type === "Falha do sistema").length} falhas registradas</small></div></article>
        <article className="kpiCard"><div><span>Códigos sem indicadores</span><strong>{eventOnlyCodes.length}</strong><small>presentes em eventos, sem correspondência exata nos indicadores por cartão</small></div></article>
        <article className="kpiCard"><div><span>Códigos a revisar</span><strong>{qualityRows.length}</strong><small>incompletos ou ambíguos na origem</small></div></article>
      </section>
      {(eventOnlyCodes.length > 0 || workforceOnlyCodes.length > 0 || qualityRows.length > 0) && <details>
        <summary>Conciliação de códigos</summary>
        {eventOnlyCodes.length > 0 && <p>Somente em eventos: {eventOnlyCodes.join(", ")}. Sem indicadores agregados correspondentes, o Pulso não infere equivalência.</p>}
        {workforceOnlyCodes.length > 0 && <p>Somente nos indicadores por cartão: {workforceOnlyCodes.join(", ")}. Ausência de evento não significa ausência de uso.</p>}
        {qualityRows.length > 0 && <p>Linhas a revisar: {qualityRows.map(row => `linha ${row.sourceRow} (${row.cardQuality})`).join(", ")}.</p>}
        <p>Códigos são tratados como texto e nunca recebem preenchimento automático. Se uma origem exportar cartão como número, zeros à esquerda não podem ser reconstruídos com segurança.</p>
      </details>}
    </section>

    {card !== "all" && <section className="detailGrid">
      <article className="detailCard">
        <h2>Indicadores do cartão {card}</h2>
        {workforceMatches.length > 1 && <p>Código duplicado na origem dos indicadores por cartão. As linhas estão marcadas como ambíguas e não são agregadas automaticamente.</p>}
        {workforceMatches.length === 0 && <p>Não há recorte agregado para este código. A visão abaixo permanece limitada aos eventos existentes.</p>}
        {workforceCard && asset !== "all" && !workforceAsset && <p>O cartão não possui recorte para {asset}; nenhum total foi inferido a partir do equipamento.</p>}
        {workforceCard && (asset === "all" || workforceAsset) && <>
          <p><strong>{asset === "all" ? "Total do cartão" : `Recorte ${asset}`}:</strong> {selectedUsageCount ?? 0} usos registrados na origem. Linha {asset === "all" ? workforceCard.sourceRow : workforceAsset?.sourceRow}.</p>
          <div className="hysterTable"><table><thead><tr><th>Indicador</th><th>Total da fonte</th></tr></thead><tbody>
            {metricRows.map(row => <tr key={row.key}><th>{row.label}</th><td>{fmt(metricValue(selectedMetrics, row.key), row.unit)}</td></tr>)}
          </tbody></table></div>
          <p>Os indicadores são contadores agregados do período da origem. Não são diagnóstico, produtividade individual, ranking ou atribuição de causa.</p>
        </>}
      </article>
      <article className="detailCard">
        <h2>Evidência e próxima ação</h2>
        <p>No filtro atual há {filteredEvents.length} eventos associados ao código {card}, incluindo {filteredEvents.filter(event => event.type === "Impacto").length} impactos e {filteredEvents.filter(event => event.type === "Falha do sistema").length} registros de falha.</p>
        {workforceCard ? <p>Use horas, distância, movimento, hidráulica, elevação/descida, frente/ré, alta velocidade, usos e ociosidade como contexto para investigar o processo e o equipamento. Compare com demanda, turno, condição da rota e manutenção antes de decidir qualquer ação.</p> : <p>Sem indicadores agregados correspondentes, não há base para inferir horas, distância ou perfil de uso deste cartão.</p>}
        <p>Uma ordem deve ser aberta para o equipamento somente após validação operacional. A associação do cartão a um evento ou ativo não comprova responsabilidade individual.</p>
        {workforce?.warnings.map(warning => <small key={warning}>· {warning}<br /></small>)}
      </article>
    </section>}

    {workforceCard && asset === "all" && <section className="detailCard">
      <h2>Equipamentos associados ao cartão</h2>
      <p>Os recortes por equipamento pertencem ao total do cartão e não são registros adicionais. Não some esta tabela ao total do cartão.</p>
      <div className="hysterTable"><table><thead><tr><th>Ativo</th><th>Usos</th><th>Distância</th><th>Chave</th><th>Movimento</th><th>Hidráulica</th><th>Trabalho</th><th>Ociosidade</th></tr></thead><tbody>{workforceCard.assets.map(row => <tr key={row.assetId}>
        <th>{row.assetId}</th><td>{row.usageCount}</td><td>{fmt(row.metrics.distanceKm, " km")}</td><td>{fmt(row.metrics.keyHours, " h")}</td><td>{fmt(row.metrics.motionHours, " h")}</td><td>{fmt(row.metrics.hydraulicHours, " h")}</td><td>{fmt(row.metrics.workHours, " h")}</td><td>{fmt(row.metrics.idleHours, " h")}</td>
      </tr>)}</tbody></table></div>
    </section>}

    {card !== "all" && <section className="detailCard">
      <h2>Evolução temporal disponível</h2>
      <p>Os indicadores do cartão fornecem um único total para todo o período. Por isso, a evolução mensal abaixo usa somente os eventos com o código selecionado; horas e distância do período não são distribuídas artificialmente.</p>
      <div className="hysterTable"><table><thead><tr><th>Mês</th><th>Eventos</th><th>Impactos</th><th>Falhas registradas</th></tr></thead><tbody>{eventEvolution.map(row => <tr key={row.period}><th>{row.period}</th><td>{row.total}</td><td>{row.impacts}</td><td>{row.failures}</td></tr>)}</tbody></table></div>
    </section>}

    {card !== "all" && workforceCard && <section className="detailCard">
      <h2>Ordens e acompanhamento pós-ação</h2>
      <p>As ordens abaixo pertencem aos equipamentos associados ao cartão; isso cria contexto operacional, não responsabilidade individual. O antes/depois continua calculado apenas com a série diária do equipamento.</p>
      {relatedOrders.length === 0 && <p>Nenhuma ordem registrada para os equipamentos associados neste recorte.</p>}
      {relatedOrders.slice(0, 20).map(order => {
        const follow = followUp(data, order);
        return <article className="opsOrder" key={order.id}><h3>{order.assetId} · {order.title}</h3><p>{statusLabels[order.status]} · {order.team} · prazo {order.dueDate}</p>{follow && <p>Ociosidade/chave antes: {fmt(follow.before.idlePct, "%")} ({follow.before.records} dias) · depois: {fmt(follow.after.idlePct, "%")} ({follow.after.records} dias). {follow.delta === null ? "Amostra insuficiente para comparar as janelas." : `Variação descritiva: ${fmt(follow.delta)} p.p.; não comprova causalidade.`}</p>}</article>;
      })}
    </section>}

    <section className="detailCard">
      <h2>Eventos associados ao filtro</h2>
      <p>{filteredEvents.length} registros · {filteredEvents.filter(event => event.type === "Impacto").length} impactos · {filteredEvents.filter(event => event.type === "Falha do sistema").length} registros de falha. Associação ao cartão não comprova responsabilidade.</p>
      <div className="hysterTable"><table><thead><tr><th>Data/hora</th><th>Equipamento</th><th>Cartão</th><th>Tipo</th><th>Linha de origem</th></tr></thead><tbody>{[...filteredEvents].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`)).slice(0, 200).map((event, index) => <tr key={`${event.sourceRow}-${index}`}><td>{event.date} {event.time}</td><td>{event.assetId}</td><td>{event.cardCode ?? "Não disponível"}</td><td>{event.type}</td><td>{event.sourceRow}</td></tr>)}</tbody></table></div>
      <p>Exibindo até 200 eventos mais recentes. Totais consideram todos os registros do filtro.</p>
    </section>
  </>;
}
