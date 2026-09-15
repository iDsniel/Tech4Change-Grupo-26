# Plano de execução — Tech4Change 2026

Atualizado em 15/09/2026.

## Objetivo

Levar o **Copiloto Operacional AI** para a entrega de 20/09 com uma narrativa coerente com o tema **“Potencializando o Ser Humano com IA”** e com evidências suficientes para sustentar os cinco critérios de avaliação do Tech4Change: aderência ao tema, viabilidade técnica/mercadológica, sustentabilidade, inovação e validação com usuários/clientes.

> **A máquina gera os dados. A IA encontra o padrão. O ser humano decide.**

## Definição do produto

O Copiloto Operacional AI é uma camada de inteligência sobre telemetria industrial. Ele normaliza dados de diferentes fontes, aprende o comportamento histórico de cada ativo/contexto operacional, identifica desvios, cruza evidências estatísticas e multivariadas, explica o que merece atenção e recomenda uma próxima ação — sem retirar a decisão do operador ou gestor.

O produto proprietário é o **software e o motor de decisão assistida**. Konecranes/TRUCONNECT é uma fonte de dados demonstrativa, não uma dependência arquitetural obrigatória.

## Status real do MVP

### Concluído

- ingestão de telemetria por CSV;
- contrato normalizado `telemetry-shift-v1`;
- dataset sintético com 720 turnos;
- adapter de provider inspirado em conceitos públicos do TRUCONNECT;
- pipeline desacoplado do fornecedor;
- baseline por ativo + turno;
- z-score explicável;
- Isolation Forest multivariado;
- fusão 80% estatística + 20% multivariada;
- detecção de eficiência, segurança, mecânica e manutenção;
- dashboard para gestor;
- visão contextual para operador sem ranking individual;
- explicação generativa com fallback determinístico;
- feedback/intervenção para fechar o human-in-the-loop;
- CI com build, security gate, smoke tests e equivalência CSV × provider adapter;
- guardrails explícitos contra diagnóstico definitivo e decisão automática.

### Não é necessário para a entrega de 20/09

- streaming em tempo real;
- banco de produção;
- integração direta com ERP/CMMS;
- contrato proprietário oficial do TRUCONNECT;
- modelo treinado pela equipe;
- previsão de falha com promessa preditiva;
- decisão disciplinar ou operacional automatizada.

## Lacunas prioritárias até 20/09

### P0 — validar a dor com pessoas reais

Precisamos transformar “parece um bom problema” em evidência.

Meta mínima: **5 entrevistas curtas** com pelo menos dois perfis diferentes:

- gestor/supervisor de operação ou manutenção;
- técnico, operador ou analista que utiliza dashboards/telemetria no dia a dia.

Registrar respostas anonimizadas em uma planilha ou documento e extrair números simples para o pitch.

### P0 — validar o fluxo do MVP

Cada entrevistado deve ver o fluxo demonstrativo por 3–5 minutos e responder:

1. Qual parte desse fluxo resolveria algo que hoje dá trabalho?
2. Qual insight você gostaria de receber primeiro?
3. O que faria você desconfiar de uma recomendação da IA?
4. É importante mostrar a evidência que levou à recomendação?
5. A decisão final deve ficar com quem?
6. Se o sistema reduzisse tempo de análise/reação, isso teria valor para sua operação?

Indicadores de validação sugeridos:

- % que reconhece a dor;
- % que considera evidência/explicabilidade indispensável;
- % que usaria o copiloto em uma rotina real;
- principal KPI desejado;
- principal objeção.

### P1 — evidência de integração realista

Não apresentar o contrato mock como API oficial.

A documentação pública da Konecranes confirma que:

- existem Cloud APIs para integrar dados de equipamentos aos sistemas do cliente;
- TRUCONNECT disponibiliza dados/KPIs de operação e manutenção conforme pacote contratado;
- a API usa assinatura e autenticação, e o acesso de produção depende de acordo/subscrição de dados;
- TRUCONNECT para lift trucks publica conceitos como horas de uso, distância, velocidade, consumo, modos de operação, carga, sobrecarga, impactos e contador de manutenção.

Referências públicas:

- https://developer.konecranes.com/
- https://developer.konecranes.com/get-started
- https://developer.konecranes.com/product-truconnect
- https://www.konecranes.com/sites/default/files/2024-08/truconnect_api_2024.pdf
- https://www.konecranes.com/sites/default/files/download/optimize_your_lift_truck_operations_and_maintenance.pdf

### P1 — demo fechada e repetível

A demo precisa funcionar sem internet externa e sem chave de LLM. A camada generativa pode enriquecer a apresentação quando configurada, mas o fallback determinístico deve preservar o fluxo completo.

Roteiro de demo:

1. abrir dashboard com frota saudável + insights priorizados;
2. selecionar `FLT-017` e mostrar desvio de consumo/idle/deslocamento vazio;
3. mostrar evidência estatística e segunda opinião do Isolation Forest;
4. mostrar recomendação com decisão humana;
5. alternar para visão do operador e reforçar “sem ranking individual”;
6. registrar feedback/intervenção;
7. concluir com a tese de acompanhamento pós-ação.

## Roteiro de entrevistas

### Abertura

“Estamos validando um problema, não vendendo uma solução. Quero entender como vocês usam dados de equipamentos para tomar decisões operacionais.”

### Perguntas de descoberta

1. Quando um equipamento começa a se comportar diferente, como vocês percebem hoje?
2. Quais dashboards, alarmes ou relatórios vocês consultam?
3. Quem normalmente precisa interpretar esses dados?
4. Quanto tempo leva entre perceber um desvio e decidir o que fazer?
5. É comum ter muitos alertas sem saber o que priorizar?
6. Existem casos em que o dado mostra “o que aconteceu”, mas não deixa claro “o que merece atenção”?
7. Quais decisões exigem combinar várias métricas ao mesmo tempo?
8. Qual o impacto de detectar tarde um problema de eficiência, segurança ou manutenção?
9. O que faria você confiar ou não confiar em um insight de IA?
10. Você aceitaria uma IA sugerindo prioridade/ação se ela mostrasse as evidências e mantivesse a decisão com o humano?

### Não perguntar

Evitar perguntas enviesadas como “você usaria nosso produto?” antes de entender a dor.

## Hipóteses a confirmar

- dashboards atuais exigem interpretação manual;
- alertas isolados não priorizam contexto;
- gestores valorizam explicabilidade e evidência;
- operadores rejeitam ranking punitivo, mas aceitam coaching contextual;
- reduzir tempo de análise e priorização possui valor operacional;
- uma arquitetura multi-provider é comercialmente mais atraente que uma solução presa a um OEM.

## Modelo de negócio para o pitch

Hipótese inicial B2B SaaS:

- cobrança por ativo conectado ou faixa de ativos;
- plano base: ingestão + baseline + insights + dashboard;
- plano avançado: integrações, histórico/persistência, workflows e IA generativa;
- implantação/integração como serviço opcional.

Não colocar preço definitivo sem validação. Para a entrega, defender **modelo de monetização e unidade de cobrança**, não uma tabela de preços inventada.

## Diferencial

O produto não é mais um dashboard e não é um chatbot genérico.

### Dashboard tradicional

Mostra métricas para o humano interpretar.

### Alarme tradicional

Dispara quando uma regra fixa ultrapassa limite.

### Copiloto Operacional AI

Aprende contexto histórico, cruza sinais, prioriza o que mudou, explica por que merece atenção, sugere a próxima ação e mede o que ocorreu depois — mantendo o humano responsável pela decisão.

## Pitch de até 5 minutos

### 0:00–0:40 — Dor

“Equipamentos conectados geram cada vez mais dados. O problema deixou de ser coletar informação. O problema é transformar centenas de sinais em uma decisão rápida e confiável.”

Mostrar o contraste: muitos KPIs/dashboards versus uma pergunta simples do gestor: **o que merece minha atenção agora?**

### 0:40–1:20 — Solução

Apresentar o Copiloto Operacional AI e a frase central:

> A máquina gera os dados. A IA encontra o padrão. O ser humano decide.

Explicar a arquitetura em uma linha: telemetria → baseline → anomalia → explicação → recomendação → decisão humana → feedback.

### 1:20–2:40 — Demo

Demonstrar um caso realista de eficiência e um caso de segurança/manutenção.

Não explicar algoritmo por algoritmo. Mostrar evidência → insight → ação.

### 2:40–3:20 — IA e inovação

Explicar por que existem duas camadas:

- z-score: “qual métrica saiu do padrão?”;
- Isolation Forest: “a combinação completa também é rara?”;
- IA generativa: traduz evidências estruturadas para linguagem operacional, sem inventar diagnóstico.

### 3:20–4:00 — Mercado e viabilidade

Mostrar que Cloud APIs e telemetria industrial já existem. O Copiloto entra como camada independente de OEM, integrável a múltiplas fontes.

Modelo B2B SaaS por ativo/faixa de ativos + integrações.

### 4:00–4:35 — Validação

Mostrar resultados das entrevistas: dor reconhecida, principal KPI, exigência de explicabilidade, objeções e intenção de testar.

Nunca substituir validação real por números fictícios.

### 4:35–5:00 — Fechamento

“Não queremos retirar o humano da operação. Queremos dar a ele a capacidade de perceber padrões que seriam inviáveis de acompanhar manualmente e chegar à decisão com mais contexto, velocidade e confiança.”

## Cronograma 15–20/09

### 15/09

- congelar conceito oficial;
- revisar MVP e CI;
- iniciar entrevistas;
- preparar evidências públicas da viabilidade de integração.

### 16/09

- completar pelo menos 5 entrevistas;
- consolidar achados;
- corrigir somente falhas P0 da demo.

### 17/09

- feature freeze;
- ensaiar demo completa;
- fechar narrativa e dados de validação.

### 18/09

- montar pitch deck final;
- roteiro falado cronometrado;
- gravar primeira versão do vídeo.

### 19/09

- revisar vídeo e deck;
- corrigir apenas erros de clareza, áudio, tempo ou estabilidade;
- validar todos os links.

### 20/09

- revisão final;
- upload com antecedência;
- não introduzir feature nova.

## Critério de pronto para entrega

- [ ] MVP abre e demonstra sem dependência externa obrigatória;
- [ ] todos os cenários da demo têm evidência reproduzível;
- [ ] CI verde no commit final;
- [ ] nenhuma afirmação de integração proprietária sem evidência;
- [ ] pelo menos 5 validações reais registradas;
- [ ] deck cobre dor, solução, modelo de negócio e validação;
- [ ] vídeo tem no máximo 5 minutos;
- [ ] link do vídeo testado em janela anônima;
- [ ] pitch explica claramente onde está a IA e onde permanece a decisão humana.
