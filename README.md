# Copiloto Operacional AI — Tech4Change Grupo 26

MVP de uma camada de inteligência sobre telemetria industrial. A solução recebe dados de fontes diferentes, normaliza tudo em um contrato interno comum, aprende o comportamento histórico dos ativos, identifica desvios estatísticos, usa Isolation Forest como segunda opinião e transforma sinais técnicos em explicações e recomendações para operadores e gestores.

> **A máquina gera os dados. A IA encontra o padrão. O ser humano decide.**

## Problema

Frotas e equipamentos conectados geram muitos dados, mas dashboards tradicionais ainda exigem que alguém descubra manualmente:

- o que está acontecendo;
- se o problema está no equipamento, processo ou operação;
- qual é o impacto;
- qual ação deve ser priorizada.

O MVP demonstra *human augmentation*: a inteligência organiza evidências e hipóteses sem automatizar decisões disciplinares ou técnicas críticas.

## Arquitetura atual

```text
CSV normalizado ───────────────┐
                              │
Konecranes mock provider ─────┼→ Adapter → HistoricalShiftRecord[]
                              │
Futuros fornecedores ─────────┘
                                      ↓
                           telemetry-shift-v1
                                      ↓
                           Baseline + z-score
                                      ↓
                             Isolation Forest
                                      ↓
                             Fusão de evidência
                                      ↓
                         Insight + recomendação
                                      ↓
                           Gestor / Operador
```

A parte importante é que **o motor não conhece Konecranes, CSV ou qualquer outro fornecedor**. Cada integração termina no mesmo tipo normalizado e a partir daí o pipeline é único.

## Caso demonstrativo

Usamos empilhadeiras como cenário e conceitos de telemetria publicamente documentados pela Konecranes TRUCONNECT. Os valores do dataset são **100% sintéticos**.

O contrato `konecranes-truconnect-mock-v1` criado neste repositório é **nosso contrato de demonstração inspirado em conceitos públicos**. Ele **não é** e não deve ser apresentado como payload literal ou contrato proprietário oficial da Konecranes.

Sinais usados pelo motor:

- consumo de combustível;
- tempo em marcha lenta;
- deslocamento vazio;
- velocidade média;
- temperatura;
- impactos;
- sobrecarga;
- contador de manutenção;
- ativo, turno e associação opcional ao operador.

## Fonte 1 — CSV normalizado

A demo padrão lê `data/telemetry-demo.csv`, com **720 turnos históricos**: 8 ativos × 3 turnos × 30 dias.

### Contrato `telemetry-shift-v1`

Cabeçalho obrigatório:

```csv
date,asset_id,operator_id,shift,fuel_liters,idle_pct,empty_travel_pct,avg_speed_kmh,max_coolant_c,shocks,overloads,maintenance_hours_remaining
```

Regras principais:

- `date`: `YYYY-MM-DD`;
- `asset_id`: obrigatório;
- `operator_id`: opcional; vazio vira `UNASSIGNED`;
- `shift`: `A`, `B` ou `C`;
- percentuais: `0..100`;
- `shocks` e `overloads`: inteiros não negativos;
- não pode existir duplicidade de `date + asset_id + shift`;
- limite atual: 2 MB e 50.000 linhas.

Erros de contrato retornam HTTP **422**.

### API

`GET /api/telemetry`

Lê o CSV demo e executa o pipeline completo.

`POST /api/telemetry`

Aceita `text/csv` ou `application/csv`:

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: text/csv" \
  --data-binary @data/telemetry-demo.csv
```

## Fonte 2 — adapter Konecranes mock

Endpoint:

`POST /api/telemetry/providers/konecranes`

Aceita `application/json` no contrato interno de demonstração `konecranes-truconnect-mock-v1`.

Exemplo mínimo em `docs/examples/konecranes-truconnect-mock.sample.json`:

```json
{
  "contractVersion": "konecranes-truconnect-mock-v1",
  "provider": "konecranes",
  "sourceSystem": "truconnect-mock",
  "assets": [
    {
      "assetId": "FLT-017",
      "capacityTonnes": 16,
      "measurements": [
        {
          "periodStart": "2026-09-02T16:00:00Z",
          "shiftCode": "C",
          "operatorRef": "OP-042",
          "fuelConsumedLiters": 65.4,
          "idleRatio": 0.34,
          "emptyTravelRatio": 0.52,
          "averageTravelSpeedKmh": 12.1,
          "maxEngineCoolantC": 87.6,
          "shockEvents": 0,
          "overloadEvents": 0,
          "maintenanceHoursRemaining": 118.5
        }
      ]
    }
  ]
}
```

O adapter converte esse formato para `telemetry-shift-v1`/`HistoricalShiftRecord[]` antes que qualquer dado alcance o motor de análise.

Mapeamento principal:

| Provider mock | Normalizado |
|---|---|
| `periodStart` | `date` |
| `assetId` | `assetId` |
| `operatorRef` | `operatorId` |
| `shiftCode` | `shift` |
| `fuelConsumedLiters` | `fuelLiters` |
| `idleRatio` | `idlePct` |
| `emptyTravelRatio` | `emptyTravelPct` |
| `averageTravelSpeedKmh` | `avgSpeedKmh` |
| `maxEngineCoolantC` | `maxCoolantC` |
| `shockEvents` | `shocks` |
| `overloadEvents` | `overloads` |
| `maintenanceHoursRemaining` | `maintenanceHoursRemaining` |

Além dos registros, o adapter preserva metadados como capacidade do ativo para a camada de apresentação.

## Pipeline compartilhado

`lib/telemetryPipeline.ts` concentra o processamento comum. Tanto o CSV quanto o provider adapter chamam exatamente a mesma função:

```text
HistoricalShiftRecord[]
        ↓
analyzeHistoricalTelemetry()
        ↓
fuseWithIsolationForest()
        ↓
frota + resumo + insights
```

Essa separação é o que permite adicionar Toyota, Hyster, Yale, Jungheinrich ou outra origem sem reescrever o motor.

## Camada 1 — baseline e z-score

Para cada turno avaliado, o motor procura registros históricos do **mesmo ativo e mesmo turno**, usa até 21 amostras anteriores e calcula:

```text
z-score = (valor atual - média histórica) / desvio padrão
```

O z-score responde:

> **Qual variável saiu do padrão e quanto ela desviou?**

## Camada 2 — Isolation Forest

O MVP implementa um **Isolation Forest determinístico** em TypeScript.

Ele avalia simultaneamente:

- combustível;
- idle;
- deslocamento vazio;
- velocidade;
- temperatura;
- impactos;
- sobrecarga.

O Isolation Forest responde:

> **Essa combinação inteira também é rara no histórico?**

## Fusão

O score exibido combina:

- **80%** camada estatística explicável;
- **20%** suporte multivariado do Isolation Forest.

Manutenção programada permanece uma regra operacional explícita e não é apresentada como previsão de falha por ML.

## Cenários detectados na demo

1. **FLT-017 / OP-042 — ineficiência operacional:** consumo + idle + deslocamento vazio acima do padrão.
2. **FLT-023 — possível degradação mecânica:** consumo + temperatura sobem em vários turnos e operadores.
3. **FLT-031 / OP-007 — impactos:** impactos e velocidade fogem do histórico comparável.
4. **FLT-012 / OP-015 — sobrecarga:** eventos de sobrecarga fora do comportamento normal.
5. **FLT-044 — manutenção:** contador entra na janela de planejamento.

## Validação contínua

O GitHub Actions executa:

```text
npm install
npm audit --audit-level=high
npm run build
npm run start
        ↓
GET /api/telemetry
        ↓
valida CSV + 720 registros + motor híbrido
        ↓
POST /api/telemetry
        ↓
valida ingestão CSV externa
        ↓
converte o CSV para o contrato Konecranes mock
        ↓
POST /api/telemetry/providers/konecranes
        ↓
valida 720 registros normalizados
        ↓
compara os IDs dos insights com a análise via CSV
        ↓
exige os mesmos resultados do mesmo motor
```

O CI também testa payloads inválidos e exige HTTP **422**.

Essa comparação de resultados é a principal prova de desacoplamento: **duas fontes diferentes precisam produzir os mesmos insights quando representam os mesmos dados**.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

O slice de telemetria não exige chave de API.

## Evolução

Concluído:

- [x] dataset sintético de 30 dias em CSV;
- [x] contrato normalizado `telemetry-shift-v1`;
- [x] adapter CSV;
- [x] ingestão externa por CSV;
- [x] pipeline comum independente da fonte;
- [x] adapter Konecranes mock;
- [x] preservação de metadados de ativos;
- [x] baseline automático;
- [x] z-score;
- [x] Isolation Forest;
- [x] fusão estatística + ML;
- [x] teste de equivalência CSV × provider adapter no CI;
- [x] security gate + build + smoke test.

Próximos passos:

1. remover definitivamente o gerador legado de telemetria que não participa mais do runtime;
2. aproximar o adapter de uma integração real quando houver acesso ao contrato/credenciais do fornecedor;
3. adicionar uma camada de IA generativa somente para explicar evidências estruturadas;
4. adicionar feedback pós-recomendação para medir evolução;
5. integrar persistência/banco ou streaming em vez de processar todo o histórico por request.

## Guardrails

- insight não é diagnóstico definitivo;
- nenhuma decisão disciplinar é automática;
- Isolation Forest detecta raridade, não causalidade;
- concordância entre modelos aumenta evidência, mas não prova causa;
- condição de rota, piso, processo, planejamento e máquina deve ser considerada;
- `operator_id` pode depender de integração externa;
- sinais disponíveis variam conforme equipamento, configuração e assinatura do provedor;
- o baseline não deve incorporar automaticamente períodos suspeitos sem validação;
- payloads de fornecedor só alimentam o motor depois da normalização e validação;
- `konecranes-truconnect-mock-v1` é contrato de demonstração do projeto, não contrato proprietário oficial.

## Referências públicas usadas na modelagem

- Konecranes TRUCONNECT Remote Monitoring for Lift Trucks;
- Konecranes TRUCONNECT for Lift Trucks brochure;
- Konecranes Developer Portal / Cloud API onboarding;
- TRUCONNECT Ports Data API.

As referências validam **conceitos de telemetria e viabilidade de integração**, não reproduzem contrato proprietário de produção.
