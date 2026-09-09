# Feedback loop pós-recomendação

## Objetivo

Fechar o ciclo entre **detectar → orientar → observar → medir**.

O motor não considera uma recomendação bem-sucedida apenas porque ela foi emitida. Depois que uma ação é registrada, o MVP acompanha turnos comparáveis e mede se os sinais associados ao insight se aproximaram novamente do baseline histórico.

```text
Anomalia detectada
      ↓
Recomendação
      ↓
Ação registrada
      ↓
Próximos turnos comparáveis
      ↓
Distância ao baseline antes × depois
      ↓
Convergindo / estável / piorando / dados insuficientes
```

## Contrato

Versão: `telemetry-feedback-v1`.

As intervenções demo ficam em `data/interventions-demo.json`. Cada registro contém:

- `id`;
- `insightId`;
- `appliedAt`;
- `targetTurns`;
- `actionType`;
- `actorRole`;
- `note`.

Esses registros são fixtures auditáveis para a demonstração. Persistência real de intervenções fica para uma etapa posterior.

## Comparação contextual

A comparação principal usa **mesmo ativo + mesmo turno**. O operador, quando conhecido, é uma referência secundária e é contabilizado separadamente.

Essa escolha evita afirmar que uma mudança pertence exclusivamente ao operador quando rota, carga, máquina, fila ou processo podem ter mudado.

## Métrica de convergência

Para cada evidência estatística do insight original:

```text
z_antes = |z-score do turno anômalo|
z_depois = |(média pós-ação - média do baseline) / desvio padrão do baseline|
```

Convergência por métrica:

```text
((z_antes - z_depois) / z_antes) × 100
```

O score agregado é a média da distância absoluta em sigma das métricas acompanhadas antes e depois.

Estados:

- `improved`: pelo menos 2 turnos, convergência >= 35% e distância média final <= 1,25σ;
- `stable`: houve acompanhamento, mas o retorno ao baseline ainda não é claro;
- `worsened`: a distância média aumentou mais de 10%;
- `insufficient-data`: menos de 2 turnos comparáveis;
- `not-applicable`: exemplo: manutenção programada sem evidência estatística comportamental.

## Impacto

Quando combustível e idle participam do insight, o MVP também calcula:

- redução de litros por turno entre o turno anômalo e a média pós-ação;
- redução em pontos percentuais de idle;
- combustível potencialmente evitado nos turnos observados.

Essas medidas são descritivas da janela observada, não uma garantia de economia futura.

## API

`GET /api/telemetry/feedback`

Retorna todas as intervenções registradas e seus resultados.

`GET /api/telemetry/feedback?insightId=FLT-017-efficiency-OP-042`

Retorna o feedback do insight selecionado.

Insights válidos sem intervenção registrada retornam `tracked: false`. Insight inexistente retorna HTTP 404.

## Guardrails

Toda avaliação retorna explicitamente:

- `associationNotCausation: true`;
- `noAutomaticDisciplinaryDecision: true`;
- `contextMustBeValidated: true`;
- `operatorComparisonIsSecondary: true`.

O feedback loop mede **associação temporal e convergência ao baseline**. Ele não prova causalidade e não deve ser usado isoladamente para decisões disciplinares.

## Demo atual

O dataset registra três intervenções pós-anomalia:

1. eficiência / idle na FLT-017;
2. impactos na FLT-031;
3. sobrecarga na FLT-012.

O CI exige que o cenário de eficiência tenha turnos pós-ação suficientes e demonstre convergência positiva ao baseline.
