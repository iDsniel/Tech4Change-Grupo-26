# Prompt de execução — redesign do Pulso

Continue o desenvolvimento do **Pulso — Copiloto Operacional AI** no repositório `iDsniel/Tech4Change-Grupo-26`, partindo da `main` atual.

Leia primeiro `DESIGN.md`, `docs/DECISION-2026-current-data-only.md`, `docs/pulso-base-unificada.md`, `docs/hyster-real-data.md`, `docs/workforce-kpi.md` e os testes existentes.

## Decisão de produto obrigatória

O dashboard de 2023 foi usado apenas como referência de descoberta para entender quais indicadores a operação acompanhava.

**Ele não faz parte do Pulso.**

Portanto:

- não exiba Dashboard 2023;
- não crie seção de referência histórica;
- não preserve dados de 2023 no workspace;
- não importe dados de 2023;
- não inclua `legacy`, `historical2023` ou equivalente no contrato/JSON operacional;
- não use 2023 como baseline, comparação ou fonte do produto.

Para a amostra atual do Tech4Change, o pacote operacional contém somente dados de **01/06/2026 a 31/08/2026**.

## Objetivo

Refazer somente a **experiência visual, arquitetura de informação e navegação** da operação atual para que o Pulso pareça um produto de gestão operacional moderno, claro e acionável.

Não reinicie o projeto e não recrie funcionalidades já implementadas.

## Regra principal

> A máquina gera os dados. A IA encontra o padrão. O ser humano decide.

A interface deve responder, nesta ordem:

1. Como a operação está?
2. O que mudou?
3. O que exige atenção agora?
4. Quais evidências sustentam isso?
5. Qual ação deve ser validada?
6. O que aconteceu depois da ação?

## Preserve integralmente

Preserve contratos, cálculos, validações e comportamento existentes da operação atual, incluindo:

- uma única importação JSON operacional;
- `schemaVersion: 3`;
- telemetria e série diária por equipamento;
- indicadores agregados por cartão;
- eventos;
- códigos completos dos cartões como string;
- exclusão de nomes dos operadores;
- baseline e regras de desvio;
- ordens e histórico das ordens;
- acompanhamento antes/depois;
- IndexedDB;
- backup/restauração;
- reimportação idempotente;
- guardrails de causalidade e responsabilidade individual;
- separação entre operação real e demo sintética;
- testes existentes.

Não faça migração para backend autenticado nesta etapa.

## Uma única base operacional

Não apresente Hyster e Workforce como dois produtos, duas bases ou duas importações.

A experiência do usuário deve ser:

`1 JSON operacional → Pulso → todos os insights`

O pacote reúne, quando disponíveis:

- cadastro de ativos;
- utilização diária;
- indicadores por cartão;
- eventos;
- KPI consolidado;
- status;
- combustível;
- custos;
- manutenção;
- rastreabilidade das fontes.

O nome interno `workforce` pode permanecer temporariamente no schema por compatibilidade técnica, mas a UI deve falar em **indicadores por cartão**.

## Nova navegação principal

1. **Resumo**
2. **Frota**
3. **Desvios**
4. **Cartões**
5. **Ordens**
6. **Base**

Não criar item, página, card ou submenu para 2023.

## Tema visual

Implemente o tema claro definido em `DESIGN.md` como padrão.

Direção:

- fundo `#F7F8FA`;
- cards brancos;
- bordas sutis;
- texto escuro;
- teal como identidade do Pulso;
- verde/âmbar/laranja/vermelho apenas para estado operacional;
- bastante espaço em branco;
- sem glow, neon ou glassmorphism generalizado.

Use princípios do Carbon Design System para hierarquia, acessibilidade, tabelas, filtros, estados e visualização de dados.

## Cabeçalho

Criar cabeçalho compacto com:

- `Pulso`;
- `Copiloto Operacional AI`;
- período ativo;
- quantidade de equipamentos;
- acesso discreto à área `Base`.

Remover da primeira dobra:

- importação;
- backup;
- restauração;
- explicações longas de persistência;
- links chamativos da demo sintética.

## Página Resumo

Exibir 4–6 KPIs prioritários, sem inventar metas ou benchmarks:

- chave ligada;
- trabalho registrado;
- ociosidade/chave;
- desvios ativos;
- ordens abertas;
- ordens vencidas, quando houver.

Criar bloco **Prioridades agora** com no máximo 3–5 itens, contendo:

- ativo/cartão relacionado;
- data/período;
- evidência principal;
- valor atual;
- baseline válido quando houver;
- CTA `Investigar` ou `Abrir ordem`.

Criar evolução mensal apenas com dados que realmente têm granularidade mensal/diária. **Não distribua totais agregados por cartão artificialmente por mês ou dia.**

## Página Frota

Tabela principal:

- equipamento;
- chave;
- trabalho;
- ociosidade;
- ociosidade/chave;
- falhas;
- impactos;
- ordens abertas;
- estado de atenção quando sustentado por regra existente.

No detalhe do equipamento:

- KPIs;
- evolução;
- desvios;
- eventos;
- ordens;
- acompanhamento antes/depois;
- cartões relacionados quando houver vínculo explícito.

## Página Desvios

Desktop:

- lista de desvios à esquerda;
- investigação detalhada à direita.

Detalhe em quatro blocos:

1. **O que aconteceu**
2. **Evidências**
3. **O que validar**
4. **Próxima ação**

Manter explicitamente:

- desvio não identifica causa;
- associação não atribui responsabilidade;
- sinal não é previsão calibrada de pane.

## Página Cartões

Criar busca/lista/detalhe por código.

Mostrar somente indicadores disponíveis:

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
- frente;
- ré;
- ociosidade;
- equipamentos relacionados;
- eventos relacionados;
- qualidade do código.

Preservar zeros à esquerda quando existirem na origem.

Nunca exibir nome do operador.

Mostrar aviso discreto:

`A associação do cartão com equipamento ou evento não comprova responsabilidade individual.`

## Página Ordens

Topo:

- abertas;
- em andamento;
- vencidas;
- concluídas.

No pós-ação destacar:

- antes;
- depois;
- número de registros;
- diferença;
- texto `comparação descritiva; não comprova causalidade`.

## Página Base

Concentrar funções administrativas:

### Dados carregados
- período;
- ativos;
- fontes;
- hashes;
- cobertura.

### Importação
- um único controle `Importar base operacional JSON`;
- mensagens de validação;
- substituição segura de períodos repetidos.

### Backup local
- exportar;
- restaurar;
- aviso de persistência local.

### Qualidade
- campos ausentes;
- dias ausentes;
- combustível zerado;
- custos ausentes;
- manutenção indisponível;
- códigos incompletos/ambíguos;
- inconsistências existentes.

### Persistência compartilhada
Apenas documentar backend autenticado/multiusuário. Não implementar agora.

## Apontamentos

Preserve toda a funcionalidade existente. Reposicione onde fizer mais sentido para gestão, sem perder dados nem edição.

## Visualização de dados

Preferir:

- barras horizontais;
- linhas;
- sparklines;
- tabelas;
- badges semânticos.

Evitar:

- pizza/donut sem necessidade;
- gauges decorativos;
- radar;
- 3D;
- excesso de gradiente;
- barras nativas pouco refinadas.

## Regras de dados

Não:

- inventar indicador;
- inventar economia;
- inventar diagnóstico;
- inventar causalidade;
- preencher ausência com zero;
- ratear total agregado por cartão;
- misturar dados sintéticos e reais;
- importar ou mostrar dados de 2023.

## Qualidade

Antes de concluir:

1. execute `npm install`;
2. execute `npm run test:hyster`;
3. execute `npm run lint`;
4. execute `npm run build`;
5. valide a importação do JSON único;
6. valide os indicadores por cartão;
7. valide códigos como string e sem nomes;
8. valide persistência e backup;
9. confirme que não existe qualquer referência de 2023 na UI;
10. confirme que o pacote operacional não contém `legacy`;
11. valide responsividade desktop;
12. valide CI.

## Critério de aceite

A entrega está pronta quando um gestor consegue abrir o Pulso e, em menos de 30 segundos:

- entender como está a operação;
- identificar onde existe atenção;
- selecionar um desvio;
- compreender a evidência;
- registrar uma ação;
- navegar para equipamento/cartão relacionado;
- encontrar as ordens;
- acessar administração da base sem ela poluir a home.

O produto deve trabalhar exclusivamente com a operação atual importada. O dashboard usado como referência de descoberta em 2023 não faz parte do produto.

## Git

Crie branch específica a partir da `main`, implemente o redesign, execute testes/build, abra PR e incorpore à `main` somente após CI verde.
