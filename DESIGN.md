# Pulso — DESIGN.md

Este arquivo é o contrato visual e de UX do **Pulso — Copiloto Operacional AI**.

O Pulso deve ser um produto de gestão operacional claro, confiável e acionável. A interface não existe para exibir o máximo possível de métricas; ela existe para ajudar o usuário a entender a operação, priorizar investigação, agir e acompanhar o resultado.

> **A máquina gera os dados. A IA encontra o padrão. O ser humano decide.**

## Escopo de dados do produto

A experiência real usa somente a operação carregada no JSON operacional atual.

Para a amostra do Tech4Change, o período é **01/06/2026 a 31/08/2026**.

O dashboard antigo usado durante a descoberta do produto não integra o Pulso. Não deve existir navegação, card, seção, persistência ou importação de dados históricos externos ao período operacional carregado.

A demo sintética permanece separada da operação real.

## Referências de design

### Carbon Design System

Usar como referência para:

- hierarquia de informação;
- estrutura de produto corporativo;
- tabelas e filtros;
- acessibilidade;
- estados e feedback;
- visualização de dados;
- progressão de resumo para detalhe.

Não é obrigatório instalar Carbon React.

### awesome-design-md

Usar este `DESIGN.md` como contrato explícito de UI/UX. Não estilizar telas ad hoc a cada feature.

Podem inspirar a direção visual produtos enterprise limpos como Linear, Notion, Stripe, Intercom e IBM, sem copiar identidade, fontes ou assets proprietários.

## Direção visual

**Light-first.**

O Pulso deve parecer:

- industrial sem ser pesado;
- técnico sem parecer ferramenta de desenvolvedor;
- executivo sem esconder evidência;
- moderno sem excesso de efeitos;
- confiável antes de parecer futurista.

### Tokens principais

- App background: `#F7F8FA`
- Surface primary: `#FFFFFF`
- Surface secondary: `#F3F5F7`
- Border subtle: `#E5E7EB`
- Border strong: `#D1D5DB`
- Text primary: `#111827`
- Text secondary: `#4B5563`
- Text muted: `#6B7280`
- Pulso teal: `#0F766E`
- Pulso teal hover: `#115E59`
- Pulso teal soft: `#CCFBF1`
- Informational: `#1D4ED8`
- Success: `#15803D`
- Attention: `#B45309`
- High: `#C2410C`
- Critical: `#B91C1C`

Cor semântica indica estado, prioridade ou exceção. Não usar cores fortes apenas como decoração.

## Tipografia

- Page title: 30–36px / 700
- Section title: 22–24px / 650–700
- Card title: 16–18px / 600
- KPI value: 28–36px / 650–700
- Body: 14–16px / 400
- Supporting text: 12–14px / 400

Preferir sans-serif neutra e numerais tabulares para KPIs/tabelas.

## Espaçamento e forma

Base de 4px.

- 8px para conteúdo relacionado;
- 16px para padding interno mínimo;
- 24px entre blocos;
- 32px entre seções;
- 48px entre mudanças grandes de contexto.

Raios:

- controles: 6–8px;
- cards: 10–12px;
- painéis: 12px.

Evitar sombras grandes e glassmorphism generalizado.

## Arquitetura principal

Navegação orientada à gestão:

1. **Resumo**
2. **Frota**
3. **Desvios**
4. **Cartões**
5. **Ordens**
6. **Base**

Não usar como navegação principal:

- importação;
- backup;
- restauração;
- apontamentos isolados, salvo necessidade operacional comprovada;
- qualquer dashboard ou referência fora da operação atual.

## Cabeçalho

Compacto, com:

- Pulso;
- `Copiloto Operacional AI`;
- período ativo;
- quantidade de equipamentos;
- acesso discreto à Base.

Não ocupar a primeira dobra com instruções administrativas.

## Página Resumo

A home deve responder rapidamente:

1. Como a operação está?
2. O que mudou?
3. O que exige atenção?
4. Qual ação está pendente?

### KPIs

Exibir 4–6 KPIs prioritários:

- chave ligada;
- trabalho registrado;
- ociosidade/chave;
- desvios ativos;
- ordens abertas;
- ordens vencidas quando houver.

Não inventar meta, benchmark, economia ou tendência.

### Prioridades agora

Mostrar no máximo 3–5 itens com:

- ativo/cartão relacionado;
- data/período;
- o que mudou;
- evidência principal;
- ação sugerida;
- CTA para investigar ou abrir ordem.

### Evolução

Usar linha, barras ou small multiples apenas quando a granularidade sustentar a série.

Não transformar total agregado de cartão em série mensal/diária.

### Execução

Resumo de ordens:

- abertas;
- em andamento;
- vencidas;
- concluídas recentemente;
- aguardando acompanhamento.

## Página Frota

Tabela comparativa com:

- equipamento;
- chave;
- trabalho;
- ociosidade;
- ociosidade/chave;
- falhas;
- impactos;
- ordens abertas;
- estado de atenção quando sustentado por regra.

No detalhe do equipamento:

- KPIs;
- evolução;
- eventos;
- desvios;
- ordens;
- antes/depois;
- cartões relacionados quando houver vínculo explícito.

Não transformar ordenação em ranking humano.

## Página Desvios

Núcleo do Copiloto.

Desktop:

- lista à esquerda;
- investigação à direita.

Cada caso deve organizar:

### O que aconteceu
Descrição factual.

### Evidências
- valor atual;
- baseline;
- amostras;
- origem;
- regra aplicada;
- eventos relacionados.

### O que validar
Hipóteses, nunca diagnóstico automático.

### Próxima ação
- abrir ordem;
- registrar investigação;
- navegar para ativo;
- acompanhar indicador.

## Página Cartões

Objetivo: acompanhar uso e eventos por código sem criar linguagem de vigilância.

> **Associação de cartão com equipamento ou evento não comprova responsabilidade individual.**

Mostrar somente indicadores disponíveis:

- código completo;
- qualidade do código;
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
- ordens relacionadas ao equipamento.

Preservar zeros à esquerda quando presentes na origem.

Não exibir nomes de operador, score individual ou ranking de cartões.

## Página Ordens

Topo:

- abertas;
- em andamento;
- vencidas;
- concluídas.

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

Pós-ação deve mostrar janela antes/depois, cobertura e a mensagem:

`comparação descritiva; não comprova causalidade`.

## Página Base

Concentra funções administrativas e rastreabilidade.

### Dados carregados
- período;
- ativos;
- fontes;
- hashes;
- cobertura.

### Importação
- um único controle de base operacional JSON;
- feedback de validação;
- substituição segura de períodos repetidos.

### Backup local
- exportar;
- restaurar;
- aviso de persistência local.

### Qualidade
- dias ausentes;
- campos indisponíveis;
- relatórios zerados;
- inconsistências;
- códigos incompletos/ambíguos.

### Roadmap de persistência
Apenas documentação: backend autenticado, banco central, multiusuário, autorização, auditoria e backup central. Não implementar nesta fase.

## Visualização de dados

Preferir:

- barras horizontais;
- linhas;
- tabelas;
- sparklines;
- badges semânticos.

Evitar:

- pizza/donut com muitas categorias;
- gauge decorativo;
- radar;
- 3D;
- animação contínua;
- gradientes excessivos.

Regras:

- eixo e unidade claros;
- não truncar escala de forma enganosa;
- não usar cor como única codificação;
- não interpolar ausência como zero;
- não ratear total agregado de cartão.

## Tabelas

- header sticky em tabelas longas;
- números alinhados à direita;
- divisores leves;
- filtros próximos;
- busca quando útil;
- ações no fim da linha;
- densidade legível.

## Estados e mensagens

Empty state deve explicar o que falta e o que fazer.

Warnings devem ser específicos e acionáveis.

Erros devem ser humanos, com detalhe técnico secundário quando útil.

## Linguagem

Preferir:

- `Desvio para investigar`;
- `Evidência observada`;
- `Hipótese para validação`;
- `Ação recomendada`;
- `Comparação descritiva`;
- `Dados insuficientes`.

Evitar:

- `Erro do operador`;
- `Operador problemático`;
- `Causa confirmada` sem prova;
- `Economia estimada` sem dado;
- `Risco de pane` sem modelo calibrado.

## Responsividade

Validar:

- 1366×768;
- 1440×900;
- tablet;
- mobile ~390px.

Desktop é prioridade do MVP.

## Acessibilidade

Obrigatório:

- contraste AA;
- foco visível;
- teclado;
- labels reais;
- headings semânticos;
- tabelas semânticas;
- não depender apenas de cor;
- `prefers-reduced-motion`.

## Preservação funcional

Uma revisão visual nunca deve alterar silenciosamente:

- cálculo de ociosidade;
- baseline;
- z-score;
- reconciliação de períodos;
- código do cartão;
- guardrails de causalidade;
- persistência local;
- comportamento de ordens;
- indicadores por cartão;
- separação real × sintético.

## Não fazer

- não recriar funcionalidades prontas;
- não voltar para dark como padrão;
- não mostrar dados fora da operação atual;
- não colocar importação/backup na primeira dobra;
- não criar ranking individual;
- não atribuir responsabilidade por associação;
- não inventar metas, diagnóstico ou economia;
- não ratear totais agregados;
- não misturar demo sintética com dados reais.

## Definition of Done

A UI está pronta quando:

1. um gestor entende a situação geral em menos de 10 segundos;
2. a principal prioridade fica visível rapidamente;
3. a origem do dado é recuperável;
4. existe fluxo claro `desvio → evidência → ação → acompanhamento`;
5. funções administrativas não competem com a operação;
6. visão por cartão não sugere culpa individual;
7. a UI funciona nas resoluções-alvo;
8. teclado e foco funcionam;
9. nenhum cálculo foi alterado sem teste;
10. não existe referência de dados históricos externos à operação atual;
11. `npm run test:hyster`, `npm run lint` e `npm run build` ficam verdes.

## Referências

- Carbon Design System: https://carbondesignsystem.com/
- Carbon data visualization: https://carbondesignsystem.com/data-visualization/
- awesome-design-md: https://github.com/voltagent/awesome-design-md
