# Validação de usuário — 16/09/2026

## Feedback observado

A validação indicou que a interface ainda exigia conhecimento excessivo de onde cada informação estava localizada e expunha linguagem estatística antes da interpretação operacional.

Pontos levantados pelo usuário:

- uso da função hidráulica é um indicador central para entender produtividade e distinguir equipamento ligado de atividade operacional;
- utilização de marcha e distribuição frente/ré são relevantes para leitura do uso;
- impactos precisam aparecer como indicador explícito de segurança/evento;
- navegação por Frota, Cartões e Desvios criava custo de descoberta;
- a visão por cartão estava difícil de interpretar;
- o usuário pensa primeiro em um contexto: período + equipamento + operador/cartão;
- z-score, desvio padrão, percentil e Isolation Forest são úteis para auditoria técnica, mas não para a primeira leitura;
- o valor da IA está em interpretar dados e orientar investigação, não em apenas exibir a técnica usada para detectar o desvio.

## Decisão de produto

A arquitetura passa a ser **context-first**.

Filtros globais:

1. período personalizado;
2. equipamento;
3. operador representado somente pelo código do cartão.

A mesma seleção governa a visão executiva e a fila de investigação.

A navegação principal é reduzida para:

- Visão geral;
- Investigar;
- Ações;
- Base.

Frota e cartões deixam de ser destinos independentes e passam a ser dimensões do contexto selecionado.

## Primeira camada da interface

KPIs prioritários:

- trabalho/chave;
- hidráulica/chave, quando disponível;
- marcha/chave e frente/ré, quando disponíveis;
- ociosidade/chave;
- impactos;
- ações abertas.

O Pulso deve responder em linguagem simples:

- o que os dados estão dizendo;
- o que mudou;
- por que vale olhar;
- o que verificar primeiro;
- qual ação humana pode ser registrada.

## Segunda camada técnica

z-score, média, desvio padrão, baseline, percentil e Isolation Forest permanecem disponíveis em **Detalhes técnicos da detecção** para auditoria e análise avançada.

Eles não devem competir com a interpretação gerencial.

## Granularidade e honestidade dos dados

Os indicadores Workforce por cartão possuem granularidade cartão-período. Portanto:

- o filtro de data recorta séries diárias, eventos e insights AI;
- totais de hidráulica, marcha, distância e demais contadores agregados não são rateados artificialmente pelo período escolhido;
- quando o filtro de datas não coincide com o período completo da fonte agregada, a interface deve informar claramente o escopo do indicador;
- códigos incompletos, duplicados ou ambíguos continuam sem agregação automática.

## Princípio de IA

> A técnica detecta. O Pulso interpreta. O humano decide.

A camada generativa deve evitar jargão estatístico na resposta principal e traduzir a evidência para linguagem operacional, sem inventar causa, diagnóstico, economia ou responsabilidade individual.
