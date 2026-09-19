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
- 2 fardos por ciclo produtivo;
- 4 t por ciclo produtivo;
- turnos A 07:00–15:00, B 15:00–23:00, C 23:00–07:00.

O ciclo operacional sintético usado pelo Pulso representa:

1. aproximação vazia até a carga;
2. ajuste/engate da carga;
3. transferência carregada;
4. posicionamento e depósito.

Esses tempos de fase são uma **camada de processo da demo**, não campos que este projeto atribui à Konecranes. Todos os valores operacionais gerados são sintéticos.

## Como o motor evoluiu

A base da demo agora cobre **seis meses completos**:

- 01/03/2026 a 31/07/2026: baseline de aprendizado;
- 01/08/2026 a 31/08/2026: holdout de avaliação;
- 6 equipamentos × 3 turnos × 184 dias = 3.312 registros asset-shift;
- 2.754 registros ficam no baseline;
- 558 registros ficam fora do baseline para demonstrar detecção.

Neste MVP, “treino” significa **aprender o comportamento histórico de referência**. Não existe um classificador supervisionado treinado com rótulos humanos.

Fluxo:

```
telemetria OEM-like + contexto de processo
→ contrato normalizado asset-shift
→ baseline robusto por ativo + turno
→ mediana + MAD por métrica
→ decomposição do ciclo produtivo
→ Isolation Forest como segunda opinião multivariada
→ contexto de produtividade / segurança / manutenção
→ interpretação em linguagem humana
→ próxima verificação
→ decisão humana
```

Agosto não é usado para construir o baseline dos insights mostrados na demo.

### Produtividade e ciclo

O motor cruza:

- total load lifted;
- ciclos produtivos concluídos;
- toneladas por hora de máquina;
- ciclos por hora de máquina;
- tempo médio do ciclo;
- aproximação vazia;
- coleta/engate;
- transferência carregada;
- depósito;
- ociosidade;
- deslocamento vazio;
- combustível por tonelada.

Como cada ciclo produtivo carrega 4 t:

- ciclos produtivos = toneladas concluídas / 4;
- fardos = toneladas concluídas / 2.

Na demo, os tempos das quatro fases pertencem à camada sintética de processo do Pulso. O ganho conceitual é que o motor deixa de apenas dizer **“produziu menos”** e passa a localizar **qual parte do ciclo mudou mais em relação ao baseline**.

### Segurança

O motor cruza apenas sinais suportados no cenário Konecranes:

- traveling speed;
- faixa alta normalizada da demo;
- shock sensors;
- overloads.

Alta velocidade não é tratada automaticamente como violação. Overload e shocks só aparecem quando registrados na telemetria sintética.

### Manutenção e impacto da indisponibilidade

O motor usa:

- next maintenance counter;
- diagnostic alerts;
- engine/transmission context;
- downtime sintético do processo;
- baseline de t/h do mesmo ativo/turno;
- demanda planejada sintética do turno;
- throughput observado da frota.

Quando existe indisponibilidade, o Pulso separa:

1. **capacidade temporariamente indisponível** = t/h de baseline × horas paradas;
2. **capacidade absorvida pela frota**;
3. **impacto operacional residual em toneladas**.

A demo não converte esse impacto em dinheiro porque não possui um R$/t financeiro válido.

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


## Cenários de avaliação do holdout

O mês de agosto contém cenários determinísticos não usados para formar o baseline apresentado:

- **KLT-02 · contexto de manutenção:** baixa carga não deve virar alerta de produtividade porque o uso está identificado como manutenção;
- **KLT-03 · gargalo de fluxo:** aumenta principalmente o tempo de aproximação vazia, além de ociosidade/deslocamento vazio; o motor deve localizar essa fase como maior deterioração;
- **KLT-04 · segurança:** velocidade e faixa alta mudam junto com impactos; a saída deve priorizar revisão sem atribuir culpa;
- **KLT-05 · indisponibilidade:** parada de 2,5 h com compensação parcial pelas demais máquinas; o Pulso deve separar capacidade indisponível, absorção da frota e impacto operacional residual.

Esses rótulos são usados para **testar a demo**; eles não entram como features do motor.
