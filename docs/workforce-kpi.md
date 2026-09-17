# Indicadores por cartão no Pulso

O `Workforce KPI Report` integra a **mesma base operacional** do Pulso. A experiência continua:

`relatórios Hyster → 1 JSON operacional → Pulso → análise e contexto`

## Identidade e privacidade

O Pulso preserva o **código do cartão como texto**. O nome do operador mostrado no XLSX não é persistido pelo importador v4.

- zeros à esquerda existentes na fonte são preservados;
- o Pulso não inventa padding para conciliar outra fonte;
- cartão sem código extraível fica `cardCode: null` e `cardQuality: incomplete`;
- código repetido vira `cardQuality: ambiguous` e não é agregado automaticamente;
- associação cartão-evento fornece contexto, não autoria, responsabilidade ou causa.

## Granularidade

A granularidade do Workforce é `card-period`.

Existem dois níveis preservados:

1. cartão × período;
2. cartão × equipamento × período.

Filtros diários/mensais não rateiam esses números. O Pulso só mostra o total ou as médias que a própria Hyster reportou para o intervalo original.

## Médias nativas

Cada família pode conter:

```json
{
  "metrics": {
    "distanceKm": 46.7
  },
  "statistics": {
    "distanceKm": {
      "sourceLabel": "Odometer",
      "unit": "km",
      "dailyAverage": 0.8,
      "monthlyAverage": 15.6,
      "total": 46.7
    }
  }
}
```

`dailyAverage` e `monthlyAverage` são valores calculados/reportados pelo Hyster Tracker. O Pulso não conhece o denominador interno usado pelo fornecedor e **não transforma essas médias em linhas fictícias por dia ou mês**.

## 29 famílias de métricas do schema v4

- `serviceHours` — medidor principal;
- `driveHours` — motor/tração;
- `hydraulicMeterHours` — medidor hidráulico;
- `tractionMeterHours` — transmissão/tração;
- `distanceKm` — distância;
- `monitoredHours` — duração monitorada;
- `keyHours` — chave ligada;
- `presenceHours` — presença;
- `motionHours` — movimento;
- `hydraulicHours` — função hidráulica;
- `workHours` — trabalho;
- `liftHours` — elevação;
- `lowerHours` — descida;
- `auxiliaryHydraulicHours` — hidráulica auxiliar;
- `lowSpeedHours` — baixa velocidade;
- `mediumSpeedHours` — média velocidade;
- `highSpeedHours` — alta velocidade;
- `lowLevelOverspeedHours` — overspeed nível baixo;
- `highLevelOverspeedHours` — overspeed nível alto;
- `reverseHours` — ré;
- `forwardHours` — frente;
- `seatBeltViolationHours` — violação de cinto;
- `idleHours` — ociosidade;
- `containerCount` — contêineres;
- `energyFuelUsedLiters` — energia/combustível;
- `ladenHours` — carregado;
- `unladenHours` — descarregado;
- `workingUnladenHours` — trabalho descarregado;
- `unladenDurationHours` — duração descarregado.

Campo suportado pela fonte mas zerado continua zero. Campo ausente permanece ausente.

## Disponibilidade de métricas

`metricAvailability` registra para cada família:

- label de origem;
- unidade;
- quantidade de cartões com valor diferente de zero;
- quantidade total de cartões;
- total somado entre cartões pai.

Isso permite que o Pulso diga “métrica disponível, mas zerada neste período” em vez de tratá-la como inexistente.

## Uso na interface

No contexto de um cartão, a visão pode mostrar:

- total do período;
- média diária Hyster;
- média mensal Hyster;
- distância;
- trabalho/ociosidade;
- perfil de velocidade e overspeed;
- hidráulica e hidráulica auxiliar;
- frente/ré;
- carga/descarregado;
- sinais de segurança quando disponíveis.

Nenhuma dessas métricas gera ranking disciplinar de pessoas.

## Uso pela IA

O motor de anomalia diária não mistura `card-period` com `asset-day`. Métricas Workforce entram no Operational Context Engine apenas como contexto agregado do equipamento/período.

A camada enviada para interpretação por IA remove identidade de cartão/operador e inclui caveats explícitos de granularidade. Isso permite usar velocidade, overspeed, hidráulica ou carga para enriquecer hipóteses sem alegar que a métrica ocorreu no mesmo dia do insight.

## Importação

```bash
python scripts/import_hyster.py /caminho/exports \
  --workforce /caminho/workforceKPITier7.xlsx \
  --output .data/Pulso-base-operacao.json
```

O importador valida o layout esperado, as 29 famílias e seus blocos de três colunas (`Daily Averages`, `Monthly Averages`, `Total Usage`). Alteração inesperada de layout falha explicitamente em vez de deslocar colunas silenciosamente.

Dados reais e arquivos XLSX/JSON permanecem fora do repositório público.