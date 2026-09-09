# Copiloto Operacional AI — Tech4Change Grupo 26

MVP de uma camada de inteligência sobre telemetria industrial. A solução aprende o comportamento histórico de empilhadeiras, identifica desvios estatísticos e transforma sinais técnicos em explicações e recomendações para operadores e gestores.

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
Z-score por métrica
            ↓
Detecção + agrupamento de eventos
            ↓
Ranking de anomalias
            ↓
Evidências + hipótese + recomendação
            ↓
Visão Gestor / Visão Operador
```

O motor gera **720 turnos históricos** na demonstração: 8 ativos × 3 turnos × 30 dias. O baseline não é informado manualmente ao detector.

### Como o baseline funciona

Para cada turno avaliado, o motor procura registros históricos do **mesmo ativo e do mesmo turno**, usa até 21 amostras anteriores e calcula:

```text
média histórica
+ desvio padrão
+ z-score = (valor atual - média) / desvio padrão
```

No dataset de demonstração, a janela de avaliação é separada da janela usada para formar o baseline. Isso evita que uma anomalia persistente contamine rapidamente o próprio comportamento considerado “normal”. Em produção, a atualização do baseline deve ocorrer apenas com períodos validados como normais ou por estratégia robusta equivalente.

Para métricas discretas que normalmente ficam em zero, como impactos e sobrecargas, o MVP aplica um piso mínimo de desvio padrão para evitar divisão por zero e manter o score interpretável.

## O que a análise consegue diferenciar

### 1. Ineficiência operacional — FLT-017 / OP-042

O sistema detecta consumo e tempo ocioso simultaneamente acima do baseline do mesmo ativo/turno, com concentração em um operador e sem anomalia térmica equivalente.

**Hipótese priorizada:** fluxo operacional, espera ou comportamento de condução.

### 2. Possível degradação mecânica — FLT-023

Consumo e temperatura sobem simultaneamente em diferentes turnos e operadores.

**Hipótese priorizada:** problema associado ao ativo, e não a uma pessoa específica.

### 3. Eventos de impacto — FLT-031 / OP-007

Impactos e velocidade média ficam muito acima do histórico comparável.

### 4. Sobrecarga — FLT-012 / OP-015

Eventos de sobrecarga fogem do comportamento histórico do mesmo ativo e turno.

### 5. Manutenção preventiva — FLT-044

O contador entra na janela de planejamento. Esse caso permanece uma regra operacional explícita, e não é apresentado como previsão estatística de falha.

## Auditabilidade

Cada insight pode mostrar:

- valor atual;
- média aprendida;
- desvio padrão;
- quantidade de amostras usadas;
- z-score em σ;
- período em que o padrão apareceu;
- score de prioridade;
- causa provável;
- recomendação sujeita a validação humana.

Isso permite responder ao jurado **“por que o sistema considerou isso anormal?”** sem depender de uma caixa-preta.

## API do MVP

### `GET /api/telemetry`

Executa o pipeline completo da demo e retorna:

- metodologia da análise;
- número de registros analisados;
- frota e status calculado;
- resumo da operação;
- insights ordenados por criticidade/score;
- evidências estatísticas;
- disclaimer de origem dos dados.

O endpoint de entrada externa do slice anterior foi removido temporariamente. A próxima integração deve entrar por um adapter normalizado para que dados reais recebam validação de contrato antes de alimentar o motor estatístico.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

O slice de telemetria não exige chave de API para funcionar.

## Arquitetura alvo

```text
Konecranes / Toyota / Hyster / Yale / Jungheinrich / outros
                           ↓
                        Adapter
                           ↓
                   Schema normalizado
                           ↓
                  Baseline estatístico
                           ↓
             Z-score + detector multivariado
                           ↓
                    Insight Engine
                           ↓
              IA generativa explicativa
                           ↓
              Operador + Gestor + CMMS
```

## Evolução de IA

Concluído neste slice:

- [x] histórico sintético de 30 dias;
- [x] baseline automático por ativo/turno;
- [x] z-score por métrica;
- [x] ranking e agrupamento de anomalias;
- [x] evidências auditáveis na interface.

Próximos passos:

1. substituir o gerador interno pelo CSV normalizado/adapter de uma fonte de dados;
2. adicionar detector multivariado (ex.: Isolation Forest) como segunda opinião ao z-score;
3. usar modelo generativo somente para transformar evidências estruturadas em explicação clara;
4. adicionar feedback pós-recomendação para medir evolução do operador;
5. criar adapter real para a fonte de telemetria disponível.

## Guardrails

- insight não é diagnóstico definitivo;
- nenhuma decisão disciplinar é automática;
- condição de rota, piso, processo, planejamento e máquina deve ser considerada;
- `operator_id` é opcional e pode depender de integração externa;
- dados e códigos de diagnóstico demo não representam códigos reais do fabricante;
- sinais disponíveis variam conforme equipamento, configuração e assinatura do provedor de telemetria;
- o baseline não deve incorporar automaticamente períodos suspeitos sem validação.

## Referências públicas usadas na modelagem

- Konecranes TRUCONNECT Remote Monitoring for Lift Trucks;
- Konecranes TRUCONNECT for Lift Trucks brochure;
- Konecranes Developer Portal / Cloud API onboarding;
- TRUCONNECT Ports Data API.

O objetivo das referências é validar **conceitos de telemetria e viabilidade de integração**, não reproduzir um contrato proprietário de produção.
