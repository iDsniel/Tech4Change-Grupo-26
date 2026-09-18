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

A granularidade atual do Workforce é **mensal real** (`card-month`).

Cada arquivo representa um mês fechado e preserva dois níveis:

1. cartão × mês;
2. cartão × equipamento × mês.

Para a base atual existem três períodos independentes: junho, julho e agosto/2026. O mesmo cartão pode aparecer em meses diferentes sem ser considerado duplicado.

O Pulso pode somar meses inteiros quando o filtro cobre mais de um mês. Se o usuário selecionar apenas parte de um mês, o indicador mensal continua identificado pelo mês completo; ele não é rateado artificialmente por dia.

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

## 29 famílias de métricas do schema v5

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

O motor de anomalia diária continua no grão `asset-day`. O Operational Context Engine procura o **mês que contém a data do insight** e anexa a telemetria Workforce daquele equipamento como `asset-month`.

Assim, um insight de 10/07 pode usar hidráulica, movimento, marcha, elevação/descida e velocidade de **julho**, mas nunca afirmar que o total mensal ocorreu especificamente em 10/07.

A camada enviada para interpretação por IA remove identidade de cartão/operador e inclui caveats explícitos de granularidade.

## Importação

```bash
python scripts/import_hyster.py /caminho/exports \
  --workforce /caminho/workforceKPITier7-jun.xlsx \
              /caminho/workforceKPITier7-jul.xlsx \
              /caminho/workforceKPITier7-ago.xlsx \
  --output .data/Pulso-base-operacao.json
```

O importador aceita os rótulos inglês/português usados pelo Hyster, valida os 29 blocos de três colunas (média diária, média mensal e uso total), impede meses sobrepostos e grava cada exportação no período real de origem. Alteração inesperada de layout falha explicitamente em vez de deslocar colunas silenciosamente.

Dados reais e arquivos XLSX/JSON permanecem fora do repositório público.