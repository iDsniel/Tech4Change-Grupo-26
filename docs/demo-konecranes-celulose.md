# Demo Konecranes · operação simulada de celulose

Esta demo mostra como o Pulso adapta a mesma arquitetura usada com Hyster a uma fonte com outro conjunto de sinais.

## O que vem da documentação pública da Konecranes

A referência principal para lift trucks descreve TRUCONNECT com dados de:

- machine status;
- driving hours;
- traveling distance;
- traveling speed;
- fuel consumption;
- running modes;
- total load lifted;
- load spectrum;
- override / overloads;
- shock sensors;
- drop in engine oil pressure;
- engine coolant / transmission issues;
- next maintenance counter;
- drivetrain / truck diagnostics.

Fontes públicas usadas:

- https://www.konecranes.com/sites/default/files/download/optimize_your_lift_truck_operations_and_maintenance.pdf
- https://www.konecranes.com/sites/default/files/download/konecranes_brochure_truconnect_for_lift_trucks_en.pdf
- https://www.konecranes.com/sites/default/files/download/konecranes_brochure_lifttrucks_flt_en_2015_8809008-1.pdf
- https://marketing.konecranes.com/acton/fs/blocks/showLandingPage/a/35190/p/p-06b6/t/page/fm/1
- https://developer.konecranes.com/product-truconnect

A documentação pública usada **não especifica a resolução nativa por turno** dessas variáveis. Por isso a demo usa `asset-shift` como contrato normalizado sintético do Pulso e deixa isso explícito na UI.

Também não foram encontrados, nessas referências, indicadores públicos de:

- participação frente/ré;
- participação de função hidráulica.

Esses sinais são usados no adaptador Hyster quando existem na fonte, mas não são inventados para o cenário Konecranes.

## Premissas do processo simulado

A operação da demo é de celulose:

- 6 empilhadeiras;
- capacidade nominal: 16 t por equipamento;
- cada fardo: 2 t;
- 2 fardos por movimento produtivo;
- 4 t por movimento produtivo;
- turnos A 07:00–15:00, B 15:00–23:00, C 23:00–07:00.

Todos os valores operacionais gerados são **sintéticos**. As premissas acima pertencem ao cenário da demo, não à Konecranes.

## Como o motor reutiliza a arquitetura do Pulso

Fluxo:

```
telemetria simulada
→ normalização por ativo/turno
→ baseline do mesmo ativo + turno
→ z-score por métrica
→ Isolation Forest como segunda opinião multivariada
→ Operational Context
→ interpretação em linguagem humana
→ próxima verificação
→ decisão humana
```

### Produtividade

O motor cruza:

- total load lifted;
- toneladas por hora em deslocamento;
- ociosidade;
- deslocamento vazio;
- combustível por tonelada.

Como cada movimento produtivo do cenário carrega 4 t:

- movimentos produtivos = toneladas / 4;
- fardos = toneladas / 2.

Essas duas conversões são determinísticas a partir da premissa da operação simulada.

### Segurança

O motor cruza apenas sinais suportados no cenário Konecranes:

- traveling speed;
- faixa alta normalizada da demo;
- shock sensors;
- overloads.

Alta velocidade não é tratada automaticamente como violação. Overload e shocks só aparecem quando registrados na telemetria sintética.

### Manutenção

O motor usa:

- next maintenance counter;
- diagnostic alerts;
- engine/transmission context.

Isso serve para priorizar planejamento e verificação, nunca para declarar pane futura.

## Contexto de manutenção da operação

O cenário inclui um caso em que uma empilhadeira é usada pela manutenção. Nesse recorte, baixa tonelagem não gera automaticamente alerta de produtividade.

A mesma regra deve valer no produto real: o contexto do trabalho precisa ser conhecido antes de classificar atividade como perda de produtividade.

## Por que a UI não é fixa por fabricante

O padrão visual continua:

- contexto global no topo;
- KPIs executivos;
- grid de frota;
- painel “Potencialize com o Pulso”;
- investigação;
- detalhes técnicos.

Mas os indicadores mudam conforme o adapter:

### Hyster

Pode mostrar, quando disponível:

- função hidráulica;
- movimento;
- marcha frente/ré;
- velocidade;
- impactos;
- cartão;
- eventos.

### Konecranes demo

Mostra:

- carga total levantada;
- fardos e movimentos equivalentes do processo;
- t/h;
- consumo L/t;
- running modes;
- deslocamento vazio;
- traveling speed;
- shocks / overloads;
- maintenance counter;
- diagnostics.

O valor do Pulso está na camada comum de contexto e decisão, não em replicar a mesma lista de métricas em todos os OEMs.
