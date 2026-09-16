# Operational Context Engine

O Operational Context Engine (OCE) é a camada entre a detecção estatística/ML e a explicação em linguagem natural do Pulso.

## Objetivo

A detecção responde **"o que saiu do comportamento habitual?"**. O OCE organiza **"que outros fatos disponíveis ajudam o humano a interpretar esse sinal?"** sem transformar correlação em diagnóstico.

Fluxo:

`JSON operacional → normalização → z-score + Isolation Forest → Operational Context Engine → explicação → decisão humana`

## Contexto montado

Para cada insight priorizado o OCE cria um pacote estruturado com:

- telemetria diária exata do equipamento: chave, presença, trabalho, ociosidade e espera;
- falhas, impactos e demais tipos de evento do mesmo equipamento/dia;
- telemetria agregada disponível por equipamento: hidráulica, movimento, elevação/descida, alta velocidade, frente/ré, distância e demais contadores presentes;
- granularidade e período explícitos para cada bloco;
- disponibilidade ou ausência de demanda/produção, planejamento, parada e manutenção detalhada;
- contexto estruturado de ações/apontamentos quando fornecido ao engine;
- limitações que a camada generativa deve respeitar.

## Regra temporal

Os dados diários são identificados como `asset-day`.

Os indicadores provenientes do bloco agregado por cartão/equipamento são consolidados sem identidade individual e identificados como `asset-period`. Eles **não** são rateados ou apresentados como se pertencessem ao dia do insight.

Exemplo válido:

> No agregado de 01/06 a 31/08, hidráulica representou 42% das horas de chave.

Exemplo inválido:

> Em 10/07, a hidráulica foi 42%.

quando a origem só fornece o total do trimestre.

## Privacidade e human-in-the-loop

O pacote enviado à camada de explicação não inclui:

- código de cartão;
- nome de operador;
- notas livres de apontamentos;
- título/notas livres de ordens.

O engine inclui somente fatos estruturados necessários para interpretação. Associação com eventos não comprova responsabilidade individual.

## Interpretação

A IA generativa recebe a evidência detectada e o contexto estruturado. O prompt obriga o modelo a:

- separar fato, interpretação plausível e informação ausente;
- respeitar a granularidade de cada indicador;
- não afirmar perda de produtividade quando demanda/produção não estiver disponível;
- usar hidráulica, movimento e marcha como contexto operacional, não como causalidade;
- não prever pane;
- não diagnosticar causa raiz;
- não atribuir responsabilidade a operador/cartão;
- explicar em linguagem operacional, sem expor jargão estatístico na primeira camada.

Sem `OPENAI_API_KEY`, a mesma estrutura alimenta o fallback determinístico, mantendo o produto funcional e auditável.

## Persistência e trânsito dos dados

O JSON completo continua armazenado localmente no IndexedDB do navegador. Para a explicação generativa, apenas o pacote reduzido de evidência + contexto do insight selecionado é enviado ao endpoint `/api/operations/explain`. Se houver chave OpenAI configurada no servidor, esse pacote reduzido é encaminhado ao modelo. O JSON operacional completo não é enviado pelo fluxo de explicação.

## Próximas extensões

O OCE já aceita `orders` e `inputs` estruturados. A UI atual utiliza automaticamente telemetria e eventos; a conexão completa de ações/apontamentos ao pacote de interpretação pode ser ampliada sem alterar o contrato central. Dados futuros com maior valor contextual incluem demanda planejada/realizada, motivo estruturado de paradas, rota/área, atividade planejada e manutenção por componente.
