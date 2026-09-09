# Copiloto Operacional AI — Tech4Change Grupo 26

MVP de uma camada de inteligência sobre telemetria industrial. A solução aprende o comportamento histórico de empilhadeiras, identifica desvios estatísticos, usa um detector multivariado como segunda opinião e transforma sinais técnicos em explicações e recomendações para operadores e gestores.

> **A máquina gera os dados. A IA encontra o padrão. O ser humano decide.**

## Problema

Frotas e equipamentos conectados geram muitos dados, mas dashboards tradicionais ainda exigem que alguém descubra manualmente:

- o que está acontecendo;
- se o problema está no equipamento, processo ou operação;
- qual é o impacto;
- qual ação deve ser priorizada.

O MVP demonstra uma abordagem de *human augmentation*: a inteligência organiza evidências e hipóteses sem automatizar decisões disciplinares ou técnicas críticas.

## Caso demonstrativo

Usamos empilhadeiras como cenário e conceitos de telemetria publicamente documentados pela Konecranes TRUCONNECT. Os valores deste repositório são **100% sintéticos** e o schema é **normalizado pelo MVP**; ele não deve ser apresentado como payload literal da API Konecranes.

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
30 dias de histórico sintético
            ↓
Agregação por ativo + turno
            ↓
Baseline automático (média + desvio padrão)
            ↓
Z-score por métrica ───────────────┐
            ↓                      │
Detecção explicável                │
                                   ├→ Fusão de confiança → Insight
Isolation Forest multivariado ─────┘
            ↓
Ranking + evidências + recomendação
            ↓
Visão Gestor / Visão Operador
```

O motor gera **720 turnos históricos** na demonstração: 8 ativos × 3 turnos × 30 dias. O baseline não é informado manualmente ao detector.

## Camada 1 — baseline e z-score

Para cada turno avaliado, o motor procura registros históricos do **mesmo ativo e do mesmo turno**, usa até 21 amostras anteriores e calcula:

```text
z-score = (valor atual - média histórica) / desvio padrão
```

A janela de avaliação é separada da janela usada para formar o baseline. Isso evita que uma anomalia persistente contamine rapidamente o próprio comportamento considerado “normal”.

O z-score responde principalmente:

> **Qual variável saiu do padrão e quanto ela desviou?**

## Camada 2 — Isolation Forest

O MVP também implementa um **Isolation Forest determinístico** em TypeScript, sem dependência externa de ML.

Para cada insight estatístico elegível:

1. seleciona somente turnos históricos comparáveis do mesmo ativo + turno;
2. usa consumo, idle, deslocamento vazio, velocidade, temperatura, impactos e sobrecarga como vetor multivariado;
3. constrói 96 árvores de isolamento com subamostras de até 16 turnos;
4. calcula o anomaly score do turno atual;
5. compara o score com os próprios turnos históricos e gera um **percentil de raridade**.

O Isolation Forest responde:

> **Essa combinação inteira de comportamento também parece rara, mesmo olhando todas as variáveis juntas?**

O dashboard classifica a concordância como forte, moderada ou fraca. Isso não substitui a explicação do z-score; funciona como segunda opinião.

## Fusão dos detectores

O score exibido combina:

- **80%** camada estatística explicável;
- **20%** suporte multivariado do Isolation Forest.

A manutenção programada permanece fora dessa fusão: o contador de manutenção continua sendo uma regra operacional explícita e não é apresentado como previsão de falha por ML.

## O que a análise consegue diferenciar

### 1. Ineficiência operacional — FLT-017 / OP-042

Consumo e tempo ocioso ficam acima do baseline do mesmo ativo/turno, com concentração em um operador e sem anomalia térmica equivalente.

### 2. Possível degradação mecânica — FLT-023

Consumo e temperatura sobem simultaneamente em diferentes turnos e operadores, e o detector multivariado verifica se a combinação também foge do histórico.

### 3. Eventos de impacto — FLT-031 / OP-007

Impactos e velocidade média ficam muito acima do histórico comparável.

### 4. Sobrecarga — FLT-012 / OP-015

Eventos de sobrecarga fogem do comportamento histórico do mesmo ativo e turno.

### 5. Manutenção preventiva — FLT-044

O contador entra na janela de planejamento. Esse caso não é apresentado como previsão estatística de falha.

## Auditabilidade

Cada insight pode mostrar:

- valor atual;
- média aprendida;
- desvio padrão;
- z-score em σ;
- quantidade de amostras usadas;
- score do Isolation Forest;
- percentil multivariado;
- nível de concordância entre os detectores;
- score final de fusão;
- causa provável;
- recomendação sujeita a validação humana.

Assim o sistema consegue responder tanto **“qual dado desviou?”** quanto **“o padrão completo também é estranho?”**.

## API do MVP

### `GET /api/telemetry`

Executa o pipeline completo e retorna:

- metadados da análise estatística;
- metadados do Isolation Forest;
- pesos da fusão;
- frota e status calculado;
- insights ordenados;
- evidências estatísticas e multivariadas;
- disclaimer de origem dos dados.

## Validação contínua

O GitHub Actions executa:

```text
npm install
npm run build
npm run start
GET /api/telemetry
validação do contrato híbrido
```

O smoke test falha se o endpoint não subir, se os insights esperados não forem produzidos ou se a evidência multivariada estiver ausente.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

O slice de telemetria não exige chave de API.

## Arquitetura alvo

```text
Fabricantes / fontes de telemetria
            ↓
         Adapter
            ↓
    Schema normalizado
            ↓
Baseline + z-score + Isolation Forest
            ↓
       Insight Engine
            ↓
 IA generativa explicativa
            ↓
 Operador + Gestor + CMMS
```

## Evolução de IA

Concluído:

- [x] histórico sintético de 30 dias;
- [x] baseline automático por ativo/turno;
- [x] z-score por métrica;
- [x] Isolation Forest multivariado;
- [x] percentil de raridade contra histórico comparável;
- [x] fusão estatística + ML;
- [x] evidências auditáveis na interface;
- [x] smoke test do pipeline no CI.

Próximos passos:

1. substituir o gerador interno pelo CSV normalizado/adapter de uma fonte de dados;
2. usar modelo generativo somente para transformar evidências estruturadas em explicação clara;
3. adicionar feedback pós-recomendação para medir evolução do operador;
4. criar adapter real para a fonte de telemetria disponível.

## Guardrails

- insight não é diagnóstico definitivo;
- nenhuma decisão disciplinar é automática;
- Isolation Forest detecta raridade, não causalidade;
- concordância entre modelos aumenta evidência, mas não prova causa;
- condição de rota, piso, processo, planejamento e máquina deve ser considerada;
- `operator_id` é opcional e pode depender de integração externa;
- sinais disponíveis variam conforme equipamento, configuração e assinatura do provedor;
- o baseline não deve incorporar automaticamente períodos suspeitos sem validação.

## Referências públicas usadas na modelagem

- Konecranes TRUCONNECT Remote Monitoring for Lift Trucks;
- Konecranes TRUCONNECT for Lift Trucks brochure;
- Konecranes Developer Portal / Cloud API onboarding;
- TRUCONNECT Ports Data API.

As referências validam **conceitos de telemetria e viabilidade de integração**, não reproduzem contrato proprietário de produção.
