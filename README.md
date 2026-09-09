# Copiloto Operacional AI — Tech4Change Grupo 26

MVP de uma camada de inteligência sobre telemetria industrial. A solução recebe telemetria em um contrato normalizado, aprende o comportamento histórico dos ativos, identifica desvios estatísticos, usa um detector multivariado como segunda opinião e transforma sinais técnicos em explicações e recomendações para operadores e gestores.

> **A máquina gera os dados. A IA encontra o padrão. O ser humano decide.**

## Problema

Frotas e equipamentos conectados geram muitos dados, mas dashboards tradicionais ainda exigem que alguém descubra manualmente:

- o que está acontecendo;
- se o problema está no equipamento, processo ou operação;
- qual é o impacto;
- qual ação deve ser priorizada.

O MVP demonstra *human augmentation*: a inteligência organiza evidências e hipóteses sem automatizar decisões disciplinares ou técnicas críticas.

## Caso demonstrativo

Usamos empilhadeiras como cenário e conceitos de telemetria publicamente documentados pela Konecranes TRUCONNECT. Os valores do dataset de demonstração são **100% sintéticos** e o schema é **normalizado pelo MVP**; ele não deve ser apresentado como payload literal da API de qualquer fabricante.

Sinais utilizados:

- consumo de combustível;
- tempo em marcha lenta;
- deslocamento vazio;
- velocidade média;
- temperatura;
- impactos;
- sobrecarga;
- contador de manutenção;
- ativo, turno e associação opcional ao operador.

## Vertical slice atual

```text
CSV / fonte externa
       ↓
Telemetry Adapter
       ↓
Contrato telemetry-shift-v1
       ↓
Validação de schema, tipos, ranges e duplicidade
       ↓
HistoricalShiftRecord[]
       ↓
Baseline + z-score ───────────────┐
       ↓                          │
Detecção explicável               ├→ Fusão → Insight
                                  │
Isolation Forest multivariado ────┘
       ↓
Ranking + evidências + recomendação
       ↓
Visão Gestor / Visão Operador
```

A demo agora lê **`data/telemetry-demo.csv`**. O arquivo contém **720 turnos históricos**: 8 ativos × 3 turnos × 30 dias. O motor não precisa gerar esses 720 registros em runtime para executar a demonstração.

## Contrato normalizado — `telemetry-shift-v1`

O adapter aceita CSV UTF-8 com o cabeçalho exato:

```csv
date,asset_id,operator_id,shift,fuel_liters,idle_pct,empty_travel_pct,avg_speed_kmh,max_coolant_c,shocks,overloads,maintenance_hours_remaining
```

### Regras principais

- `date`: `YYYY-MM-DD`;
- `asset_id`: obrigatório;
- `operator_id`: pode ficar vazio; o adapter normaliza como `UNASSIGNED`;
- `shift`: `A`, `B` ou `C`;
- percentuais: `0..100`;
- métricas numéricas: precisam ser finitas e respeitar ranges de segurança do contrato;
- `shocks` e `overloads`: inteiros não negativos;
- não pode existir mais de um registro para `date + asset_id + shift`;
- limite atual de ingestão: 2 MB e 50.000 linhas.

Erros de contrato retornam HTTP **422** com a linha, campo e motivo da falha. O parser limita a resposta aos primeiros 20 problemas para evitar payloads excessivos.

## API do MVP

### `GET /api/telemetry`

Lê `data/telemetry-demo.csv`, valida o contrato e executa o pipeline completo.

A resposta inclui:

- origem e versão do schema;
- quantidade de linhas, ativos e operadores ingeridos;
- período do dataset;
- metadados da análise estatística;
- metadados do Isolation Forest;
- pesos da fusão;
- frota e status calculado;
- insights ordenados;
- evidências estatísticas e multivariadas.

### `POST /api/telemetry`

Aceita um dataset externo com `Content-Type: text/csv` ou `application/csv`.

Exemplo:

```bash
curl -X POST http://localhost:3000/api/telemetry \
  -H "Content-Type: text/csv" \
  --data-binary @data/telemetry-demo.csv
```

O CSV passa pelo **mesmo adapter e pelo mesmo motor** da demo. Isso cria o ponto de entrada para futuros adapters de Konecranes, Toyota, Hyster, Yale, Jungheinrich, banco de dados ou streaming: cada integração precisa apenas converter sua origem para `telemetry-shift-v1`.

## Camada 1 — baseline e z-score

Para cada turno avaliado, o motor procura registros históricos do **mesmo ativo e do mesmo turno**, usa até 21 amostras anteriores e calcula:

```text
z-score = (valor atual - média histórica) / desvio padrão
```

A janela de avaliação é separada da janela usada para formar o baseline. Isso evita que uma anomalia persistente contamine rapidamente o comportamento considerado normal.

O z-score responde:

> **Qual variável saiu do padrão e quanto ela desviou?**

## Camada 2 — Isolation Forest

O MVP implementa um **Isolation Forest determinístico** em TypeScript, sem dependência externa de ML.

Para cada insight estatístico elegível:

1. seleciona turnos históricos comparáveis do mesmo ativo + turno;
2. usa combustível, idle, deslocamento vazio, velocidade, temperatura, impactos e sobrecarga como vetor;
3. constrói 96 árvores de isolamento com subamostras de até 16 turnos;
4. calcula o anomaly score;
5. compara esse score com os próprios turnos históricos e gera um **percentil de raridade**.

O Isolation Forest responde:

> **Essa combinação inteira de comportamento também é rara no histórico?**

## Fusão dos detectores

O score exibido combina:

- **80%** camada estatística explicável;
- **20%** suporte multivariado do Isolation Forest.

A manutenção programada permanece fora dessa fusão: o contador de manutenção é uma regra operacional explícita e não é apresentado como previsão de falha por ML.

## Cenários detectados na demo

1. **FLT-017 / OP-042 — ineficiência operacional:** consumo + idle + deslocamento vazio acima do padrão.
2. **FLT-023 — possível degradação mecânica:** consumo + temperatura sobem em vários turnos e operadores.
3. **FLT-031 / OP-007 — impactos:** impactos e velocidade fogem do histórico comparável.
4. **FLT-012 / OP-015 — sobrecarga:** eventos de sobrecarga fora do comportamento normal.
5. **FLT-044 — manutenção:** contador entra na janela de planejamento.

## Auditabilidade

Cada insight pode mostrar:

- valor atual;
- média e desvio padrão aprendidos;
- z-score em σ;
- quantidade de amostras usadas;
- score do Isolation Forest;
- percentil multivariado;
- nível de concordância;
- score final;
- causa provável;
- recomendação sujeita à validação humana.

Assim o sistema consegue responder tanto **“qual dado desviou?”** quanto **“o padrão completo também é estranho?”**.

## Validação contínua

O GitHub Actions executa:

```text
npm install
npm audit --audit-level=high
npm run build
npm run start
GET /api/telemetry
  ↓
valida schema telemetry-shift-v1 + 720 linhas + motor híbrido
  ↓
POST /api/telemetry com o CSV normalizado
  ↓
valida resposta externa e insights
  ↓
POST de CSV inválido
  ↓
exige HTTP 422
```

O PR falha se houver vulnerabilidade `high/critical`, erro de build, falha de leitura do CSV, alteração indevida no número de registros, quebra do motor estatístico/ML ou ausência da validação de contrato.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

O slice de telemetria não exige chave de API.

## Arquitetura alvo

```text
Konecranes / Toyota / Hyster / Yale / Jungheinrich / outros
                           ↓
                   Adapter do fornecedor
                           ↓
                    telemetry-shift-v1
                           ↓
             Baseline + z-score + Isolation Forest
                           ↓
                      Insight Engine
                           ↓
               IA generativa explicativa
                           ↓
                Operador + Gestor + CMMS
```

## Evolução

Concluído:

- [x] dataset sintético de 30 dias versionado em CSV;
- [x] contrato normalizado `telemetry-shift-v1`;
- [x] parser e validação de CSV;
- [x] ingestão do CSV demo via filesystem;
- [x] ingestão de CSV externo via `POST /api/telemetry`;
- [x] baseline automático por ativo/turno;
- [x] z-score por métrica;
- [x] Isolation Forest multivariado;
- [x] percentil de raridade;
- [x] fusão estatística + ML;
- [x] security gate + build + smoke test no CI.

Próximos passos:

1. remover o gerador legado que permaneceu apenas como código de apoio e consolidar fixtures no CSV;
2. criar um adapter de fornecedor real ou mock de API usando o mesmo contrato;
3. usar modelo generativo somente para transformar evidências estruturadas em explicação clara;
4. adicionar feedback pós-recomendação para medir evolução do operador;
5. integrar uma fonte real de telemetria quando credenciais/dados estiverem disponíveis.

## Guardrails

- insight não é diagnóstico definitivo;
- nenhuma decisão disciplinar é automática;
- Isolation Forest detecta raridade, não causalidade;
- concordância entre modelos aumenta evidência, mas não prova causa;
- condição de rota, piso, processo, planejamento e máquina deve ser considerada;
- `operator_id` pode depender de integração externa;
- sinais disponíveis variam conforme equipamento, configuração e assinatura do provedor;
- o baseline não deve incorporar automaticamente períodos suspeitos sem validação;
- datasets externos precisam passar pelo contrato antes de alimentar o motor.

## Referências públicas usadas na modelagem

- Konecranes TRUCONNECT Remote Monitoring for Lift Trucks;
- Konecranes TRUCONNECT for Lift Trucks brochure;
- Konecranes Developer Portal / Cloud API onboarding;
- TRUCONNECT Ports Data API.

As referências validam **conceitos de telemetria e viabilidade de integração**, não reproduzem contrato proprietário de produção.
