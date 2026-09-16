# Pulso — DESIGN.md

Este arquivo é o contrato visual e de UX do **Pulso — Copiloto Operacional AI**. Toda evolução da interface deve seguir estas regras antes de adicionar novos estilos ou componentes.

O objetivo é transformar o Pulso de um painel técnico escuro e denso em um **produto de gestão operacional claro, confiável, acionável e fácil de ler**, sem perder rastreabilidade, profundidade analítica ou os guardrails já implementados.

## 1. Princípio central

> **A máquina gera os dados. A IA encontra o padrão. O ser humano decide.**

A interface deve refletir essa ordem.

O usuário não abre o Pulso para admirar gráficos. Ele abre para responder rapidamente:

1. Como a operação está?
2. O que mudou?
3. O que exige atenção agora?
4. Qual equipamento, cartão ou processo está relacionado?
5. Que evidências sustentam o alerta?
6. Qual ação deve ser validada?
7. O que aconteceu depois da ação?

A UI deve priorizar resposta e decisão, não navegação por estruturas internas do sistema.

---

# 2. Referências de design

## Carbon Design System

Usar como referência para:

- estrutura de produto corporativo;
- hierarquia de informação;
- tabelas e filtros;
- estados e feedback;
- acessibilidade;
- semântica de cor;
- componentes reutilizáveis;
- dashboards e visualização de dados;
- progressão de visão resumida para detalhe.

Não é obrigatório instalar Carbon React. O importante é preservar os princípios de produto e consistência antes de adicionar dependências.

## awesome-design-md

Usar o conceito de `DESIGN.md` como contrato explícito para agentes e desenvolvedores. A interface deve seguir regras, tokens e padrões definidos aqui, em vez de receber estilização ad hoc a cada feature.

Podem ser usados como inspiração sistemas com estética enterprise limpa, como Linear, Notion, Stripe, Intercom e IBM, sem copiar fontes, ilustrações, marcas ou assets proprietários.

## Direção visual própria do Pulso

O Pulso deve parecer:

- industrial sem ser pesado;
- técnico sem parecer ferramenta de desenvolvedor;
- executivo sem esconder evidência;
- moderno sem excesso de efeitos;
- confiável antes de parecer futurista.

---

# 3. Direção visual obrigatória

## Tema padrão

**Light-first.**

O tema claro é o padrão do Pulso nesta fase.

Não usar canvas preto como experiência principal.

### Canvas

- App background: `#F7F8FA`
- Surface primary: `#FFFFFF`
- Surface secondary: `#F3F5F7`
- Surface elevated: `#FFFFFF`
- Border subtle: `#E5E7EB`
- Border strong: `#D1D5DB`

### Texto

- Primary: `#111827`
- Secondary: `#4B5563`
- Muted: `#6B7280`
- Disabled: `#9CA3AF`

### Identidade do produto

- Pulso teal: `#0F766E`
- Pulso teal hover: `#115E59`
- Pulso teal soft: `#CCFBF1`
- Pulso cyan detail: `#0891B2`

### Semântica operacional

- Success / normal: `#15803D`
- Success soft: `#DCFCE7`
- Attention: `#B45309`
- Attention soft: `#FEF3C7`
- High: `#C2410C`
- High soft: `#FFEDD5`
- Critical: `#B91C1C`
- Critical soft: `#FEE2E2`
- Informational: `#1D4ED8`
- Informational soft: `#DBEAFE`

Cor semântica não deve ser usada como decoração. Deve indicar estado, prioridade, tendência ou exceção.

---

# 4. Tipografia

Usar a stack de sistema já disponível no projeto ou uma sans-serif neutra equivalente.

## Escala

- Page title: 30–36px / 700
- Section title: 22–24px / 650–700
- Card title: 16–18px / 600
- KPI value: 28–36px / 650–700
- Body: 14–16px / 400
- Supporting text: 12–14px / 400
- Eyebrow / metadata: 11–12px / 600, uppercase apenas quando necessário

Não usar tipografia monoespaçada como linguagem principal do produto.

Usar numerais tabulares quando disponível para KPIs e tabelas.

---

# 5. Espaçamento e forma

## Grid

Basear espaçamento em múltiplos de 4px.

Preferências:

- 4px: micro espaço
- 8px: conteúdo relacionado
- 12px: controles compactos
- 16px: padding interno mínimo
- 24px: separação entre blocos
- 32px: separação entre seções
- 48px: grandes mudanças de contexto

## Raio

- Inputs/buttons: 6–8px
- Cards: 10–12px
- Painéis principais: 12px
- Pills: apenas badges e estados

## Sombras

Usar somente quando necessário para elevação contextual.

Preferir:

- borda sutil;
- contraste de superfície;
- espaçamento;
- hierarquia tipográfica.

Evitar sombras grandes e glassmorphism em cards de dados.

---

# 6. Arquitetura principal de navegação

A navegação do produto deve ser orientada à gestão.

## Navegação primária

1. **Resumo**
2. **Frota**
3. **Desvios**
4. **Cartões**
5. **Ordens**
6. **Base**

### Não usar como item de navegação principal

- Dashboard 2023
- Demonstrativo histórico
- Importação
- Backup
- Restauração
- Apontamentos como módulo isolado, salvo necessidade operacional comprovada

Esses elementos pertencem a contexto, suporte ou administração.

---

# 7. Cabeçalho global

O cabeçalho deve ser compacto.

## Deve mostrar

- Pulso
- subtítulo: `Copiloto Operacional AI`
- período ativo
- quantidade de equipamentos
- origem principal da base quando aplicável
- ação discreta para abrir `Base / Dados`

## Não deve ocupar a primeira dobra com

- texto institucional longo;
- instruções de importação;
- backup/restauração;
- links de demonstração em destaque;
- frases repetitivas sobre persistência local.

A administração da base deve ficar na área `Base`.

---

# 8. Página Resumo

A página principal deve ser executiva e acionável.

## Primeira dobra

### Linha 1 — Saúde operacional

Exibir 4 a 6 KPIs, selecionados por decisão e não por disponibilidade técnica.

Prioridade atual:

1. Chave ligada
2. Trabalho registrado
3. Ociosidade / chave
4. Desvios ativos
5. Ordens abertas
6. Ordens vencidas, quando houver

Não exibir métrica sem contexto apenas para preencher espaço.

### KPI card

Cada card deve conter:

- nome claro;
- valor principal;
- unidade;
- contexto curto;
- tendência ou comparação somente quando sustentada pelos dados;
- estado semântico somente quando existe regra explícita.

Não inventar meta, benchmark, economia ou tendência.

## Linha 2 — Prioridades agora

Bloco principal da home.

Mostrar no máximo 3 a 5 itens prioritários.

Cada item deve responder:

- ativo/cartão envolvido;
- data/período;
- o que mudou;
- evidência principal;
- ação sugerida;
- CTA para investigar ou abrir ordem.

## Linha 3 — Evolução

Mostrar tendência operacional do período com gráfico legível.

Preferir:

- linha;
- barra;
- small multiples;
- comparação direta entre meses.

Evitar gauges, donuts e pizzas quando barra ou linha responderem melhor.

## Linha 4 — Execução

Resumo de ordens:

- abertas;
- em andamento;
- vencidas;
- concluídas recentemente;
- ações aguardando acompanhamento.

## Linha 5 — Qualidade da base

Exibir pequeno resumo de cobertura e limitações.

Não competir visualmente com os indicadores operacionais.

---

# 9. Página Frota

Objetivo: comparar equipamentos e navegar do agregado ao detalhe.

## Visão de frota

Usar tabela analítica com suporte visual.

Colunas prioritárias:

- equipamento;
- chave ligada;
- trabalho;
- ociosidade;
- ociosidade/chave;
- eventos de falha;
- impactos;
- ordens abertas;
- status de atenção, se sustentado por regra.

Adicionar barras inline ou sparklines quando ajudarem comparação.

Não transformar ordenação em ranking de desempenho humano.

## Detalhe do equipamento

Mostrar:

- KPIs do período;
- evolução mensal;
- eventos;
- desvios;
- ordens relacionadas;
- antes/depois de ações concluídas;
- Workforce relacionado quando houver vínculo explícito.

---

# 10. Página Desvios

Este é o núcleo do Copiloto.

## Layout recomendado

Desktop:

- esquerda: lista priorizada de desvios;
- direita: painel de investigação.

Mobile:

- lista;
- detalhe em navegação subsequente ou drawer.

## Card de desvio

Mostrar:

- ativo;
- data;
- métrica principal;
- valor atual;
- baseline;
- intensidade do desvio;
- estado: `Investigar`, `Em análise`, `Ação aberta`, `Acompanhando` quando suportado pelo fluxo.

## Painel de investigação

Separar visualmente em quatro blocos:

### O que aconteceu

Descrição factual do sinal.

### Evidências

Mostrar:

- valor atual;
- baseline;
- amostras;
- origem;
- regra aplicada;
- eventos relacionados quando houver.

### O que validar

Hipóteses de investigação, sempre como hipóteses.

### Próxima ação

- abrir ordem;
- registrar investigação;
- navegar para ativo;
- acompanhar indicador.

Nunca apresentar hipótese como diagnóstico.

---

# 11. Página Cartões

Objetivo: acompanhar uso e eventos por código de cartão sem criar linguagem de vigilância.

## Regra fundamental

> Associação de cartão com equipamento ou evento não comprova responsabilidade individual.

Essa mensagem deve existir na interface de forma discreta porém visível.

## Conteúdo

- código completo do cartão;
- qualidade do código: completo, incompleto, ambíguo;
- período do Workforce;
- usos;
- distância;
- chave;
- presença;
- movimento;
- hidráulica;
- trabalho;
- elevação;
- descida;
- alta velocidade;
- frente/ré;
- ociosidade;
- equipamentos associados;
- eventos associados;
- ordens relacionadas ao equipamento, nunca automaticamente ao indivíduo.

## Visual

Evitar tabela gigantesca como primeira experiência.

Preferir:

- busca por cartão;
- lista resumida;
- drawer/painel de detalhe;
- agrupamento por categorias de indicador.

Não exibir nomes de operador.

---

# 12. Página Ordens

Objetivo: transformar insight em acompanhamento operacional.

## Topo

KPIs:

- abertas;
- em andamento;
- vencidas;
- concluídas no período.

## Corpo

Usar tabela ou board simples, sem transformar o sistema em ferramenta de projeto genérica.

Campos prioritários:

- ativo;
- título;
- tipo;
- prioridade;
- equipe;
- prazo;
- situação;
- origem/contexto;
- acompanhamento pós-ação.

## Pós-ação

Deve destacar:

- janela antes;
- janela depois;
- métrica observada;
- diferença;
- cobertura de dados;
- texto explícito: `comparação descritiva; não comprova causalidade`.

---

# 13. Página Base

Essa página concentra funções administrativas e rastreabilidade.

## Seções

### Dados carregados

- período;
- quantidade de ativos;
- fontes;
- hashes;
- data da importação;
- cobertura.

### Importação

- importar extração JSON;
- feedback de validação;
- conflitos/substituição de período.

### Backup local

- exportar backup;
- restaurar backup;
- aviso de escopo local.

### Qualidade

- dias ausentes;
- campos indisponíveis;
- relatórios zerados;
- inconsistências conhecidas;
- códigos incompletos/ambíguos.

### Roadmap de persistência

Mostrar apenas como documentação:

- backend autenticado;
- banco central;
- multiusuário;
- autorização por operação;
- auditoria;
- concorrência;
- backup central.

Não iniciar migração nesta fase.

---

# 14. Dashboard 2023

O dashboard de 2023 é **referência histórica**, não um módulo atual do produto.

## Tratamento correto

- remover da navegação primária;
- manter os dados preservados internamente;
- disponibilizar apenas em `Base > Referência histórica` ou seção colapsável equivalente;
- usar para explicar como a operação visualizava os dados antes;
- nunca misturar com a série atual;
- nunca usá-lo como baseline de 2026;
- nunca sugerir que suas fórmulas antigas são verdade operacional atual.

A interface pode apresentar um texto do tipo:

> `Referência histórica de agosto/2023 — preservada para comparação de cobertura de informação, não para comparação direta de desempenho.`

---

# 15. Data visualization

## Preferir

- barras horizontais para comparação de ativos;
- linhas para evolução temporal;
- áreas apenas quando volume acumulado fizer sentido;
- tabelas para precisão;
- sparklines para tendência compacta;
- heatmaps somente com escala explícita;
- badges para estado.

## Evitar

- pizza/donut para muitas categorias;
- gauge decorativo;
- radar chart;
- gráficos 3D;
- animação contínua;
- excesso de gradientes;
- arco semicircular para KPI simples.

## Regras

- eixo e unidade sempre claros;
- não truncar escala de forma enganosa;
- não usar cor como única codificação;
- manter tooltip e legenda quando necessário;
- não criar série mensal a partir de total trimestral Workforce;
- não interpolar ausência de dado como zero.

---

# 16. Tabelas

Tabelas são parte central do produto, mas precisam ser escaneáveis.

## Regras

- header sticky em tabelas longas;
- alinhamento numérico à direita;
- primeira coluna fixa quando útil;
- zebra muito sutil ou divisores leves;
- ordenação clara;
- filtros acima da tabela;
- busca quando houver muitos cartões;
- ações de linha no final;
- paginação ou virtualização quando necessário.

Não usar fonte excessivamente pequena para aumentar densidade.

---

# 17. Filtros

Filtros devem ficar próximos do conteúdo afetado.

## Padrão

- período;
- equipamento;
- cartão;
- status;
- prioridade.

O usuário deve sempre conseguir identificar o filtro ativo.

Usar `Todos` como estado explícito.

Evitar repetir os mesmos filtros em múltiplos blocos da mesma página sem sincronização.

---

# 18. Estados e mensagens

## Empty state

Explicar:

- o que está ausente;
- por que isso importa;
- o que o usuário pode fazer.

Exemplo:

`Nenhum Workforce KPI carregado para este período. Importe uma extração em Base para habilitar indicadores por cartão.`

## Warning

Deve ser específico e acionável.

## Error

Mostrar mensagem humana e, quando útil, detalhe técnico secundário.

## Loading

Preferir skeleton ou estado simples. Não usar animações chamativas.

---

# 19. Conteúdo e linguagem

## Tom

- direto;
- técnico quando necessário;
- sem jargão gratuito;
- sem linguagem de julgamento;
- sem afirmar causalidade não comprovada.

## Preferir

- `Desvio para investigar`
- `Evidência observada`
- `Hipótese para validação`
- `Ação recomendada`
- `Comparação descritiva`
- `Dados insuficientes`

## Evitar

- `Operador problemático`
- `Erro do operador`
- `Causa confirmada` sem prova
- `Economia estimada` sem dado
- `Risco de pane` sem modelo calibrado
- `Performance ruim` baseado apenas em associação de cartão

---

# 20. Responsividade

## Desktop

- largura útil máxima: 1440–1600px;
- grid 12 colunas;
- cards executivos em 4–6 colunas conforme conteúdo;
- investigação com master-detail.

## Tablet

- KPIs em 2 colunas;
- tabelas com scroll horizontal controlado;
- filtros empilhados quando necessário.

## Mobile

- 1 coluna;
- KPIs resumidos;
- detalhe em drawer/página;
- ações com área mínima de toque adequada;
- nenhuma função essencial dependente de hover.

---

# 21. Acessibilidade

Obrigatório:

- contraste AA;
- foco visível;
- navegação por teclado;
- labels reais em inputs;
- `aria-label` quando necessário;
- semântica de headings correta;
- não depender apenas de cor;
- `prefers-reduced-motion` respeitado;
- tabelas com cabeçalhos semânticos;
- mensagens de status acessíveis.

---

# 22. Microinterações

Permitido:

- hover discreto;
- transição de 120–180ms;
- realce de linha selecionada;
- expansão suave de detalhe;
- feedback imediato de ação.

Não permitido:

- partículas;
- neon;
- glow persistente;
- parallax;
- glassmorphism generalizado;
- animação que dificulte leitura;
- efeitos WebGL no dashboard.

---

# 23. Regras de preservação funcional

Uma revisão visual nunca deve alterar silenciosamente:

- cálculo de ociosidade;
- baseline;
- z-score;
- reconciliação de períodos;
- regras de importação;
- IDs da operação;
- código do cartão;
- guardrails de causalidade;
- persistência local;
- separação 2023 / atual / sintético;
- comportamento de ordens;
- dados de Workforce;
- validações existentes.

Refatorar apresentação não autoriza refatorar domínio sem necessidade.

---

# 24. Do / Don't

## Do

- mostrar primeiro o que exige atenção;
- usar espaço em branco para hierarquia;
- resumir antes de detalhar;
- conectar insight a ação;
- conectar ação a acompanhamento;
- usar cores semânticas com parcimônia;
- mostrar fonte e limitação;
- manter dados administrativos fora da home;
- preservar o código do cartão sem nomes.

## Don't

- reconstruir funcionalidades já prontas;
- criar dashboard escuro como padrão;
- manter `Dashboard 2023` como aba principal;
- colocar importação/backup na primeira dobra;
- mostrar dezenas de métricas com o mesmo peso;
- criar ranking de operadores;
- transformar associação de cartão em responsabilidade;
- inventar metas ou economia;
- distribuir total trimestral Workforce por mês/dia;
- misturar demo sintética com dados reais;
- usar UI bonita para esconder ausência de evidência.

---

# 25. Definition of Done visual

Uma entrega de UI do Pulso só está pronta quando:

1. um gestor entende a situação geral em menos de 10 segundos;
2. a principal prioridade fica visível sem scroll excessivo;
3. a origem do dado é recuperável;
4. existe caminho claro de desvio → evidência → ação → acompanhamento;
5. funções administrativas não competem com a operação;
6. a visão por cartão não sugere culpa individual;
7. a interface funciona em 1366×768, 1440p e mobile;
8. teclado e foco continuam funcionais;
9. nenhum cálculo ou contrato foi alterado sem teste;
10. `npm run test:hyster`, `npm run lint` e `npm run build` continuam verdes.

---

# 26. Referências

- Carbon Design System: https://carbondesignsystem.com/
- Carbon dashboards/data visualization: https://carbondesignsystem.com/data-visualization/
- awesome-design-md: https://github.com/voltagent/awesome-design-md
- Projeto Pulso: este repositório e seus contratos atuais
