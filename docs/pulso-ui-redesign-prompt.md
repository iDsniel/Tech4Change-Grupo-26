# Prompt de execução — redesign do Pulso

Use este prompt para aplicar a nova arquitetura visual/UX sem recriar funcionalidades já existentes.

---

Continue o desenvolvimento do **Pulso — Copiloto Operacional AI** no repositório `iDsniel/Tech4Change-Grupo-26`, partindo da `main` atual após os PRs **#12, #13 e #14**.

Leia primeiro `DESIGN.md`, `README.md`, `docs/hyster-real-data.md`, `docs/workforce-kpi.md` e os testes existentes.

## Objetivo

Refazer somente a **experiência visual, arquitetura de informação e navegação** da visão real Hyster/Workforce para que o Pulso pareça um produto de gestão operacional moderno, claro e acionável.

O problema atual não é falta de dados nem falta de funcionalidades. O problema é que a página está escura, densa, técnica demais e organizada por módulos internos do sistema, dificultando a leitura executiva e a tomada de decisão.

Não reinicie o projeto e não recrie fluxos já implementados.

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

Preserve contratos, cálculos, validações e comportamento existentes, incluindo:

- importação do JSON Hyster/Workforce;
- `schemaVersion: 3`;
- códigos completos dos cartões como string;
- exclusão dos nomes dos operadores;
- indicadores Workforce;
- histórico diário por equipamento;
- eventos Hyster;
- baseline e regras de desvio existentes;
- ordens e histórico das ordens;
- acompanhamento antes/depois;
- IndexedDB;
- backup/restauração;
- reimportação idempotente;
- separação entre histórico 2023, operação 2026 e demo sintética;
- guardrails de causalidade e responsabilidade individual;
- testes existentes.

Não faça migração para backend autenticado nesta etapa.

Não altere fórmulas ou domínio apenas para facilitar o redesign.

## Nova navegação principal

Substitua a navegação atual por:

1. **Resumo**
2. **Frota**
3. **Desvios**
4. **Cartões**
5. **Ordens**
6. **Base**

### Remova da navegação principal

- `Dashboard 2023`
- importação JSON
- exportação de backup
- restauração
- `Apontamentos` como aba independente, salvo se algum fluxo existente depender tecnicamente disso

O Dashboard 2023 não é um produto atual. Ele foi fornecido apenas como referência de como a operação visualizava os dados anteriormente.

Mantenha os dados históricos de 2023 preservados e acessíveis somente em:

`Base > Referência histórica`

ou em uma seção colapsável equivalente.

Não apague o importador nem os dados históricos.

## Tema visual

Implemente o tema claro definido em `DESIGN.md` como padrão.

Direção:

- fundo geral `#F7F8FA`;
- cards brancos;
- bordas sutis;
- texto escuro;
- teal como identidade do Pulso;
- verde/âmbar/laranja/vermelho apenas para estado operacional;
- bastante espaço em branco;
- menos caixas competindo visualmente;
- sem glow, neon ou glassmorphism generalizado.

A UI deve lembrar um produto corporativo de operação/analytics moderno, não um terminal, ferramenta de desenvolvedor ou dashboard gamer.

Use os princípios do Carbon Design System para hierarquia, acessibilidade, tabelas, filtros, estados e visualização de dados. Use `DESIGN.md` como contrato local de estilo.

Não copie assets, logos, fontes ou identidade proprietária de terceiros.

## Cabeçalho

Reduza o hero atual.

Criar cabeçalho compacto com:

- `Pulso`
- `Copiloto Operacional AI`
- período ativo
- quantidade de equipamentos
- fonte de dados ativa quando útil
- acesso discreto à área `Base`

Remover da primeira dobra:

- explicações de persistência;
- importação;
- backup;
- restauração;
- link chamativo para demo sintética.

A demo sintética pode permanecer acessível por link secundário fora do fluxo principal.

## Página Resumo

Criar uma visão executiva real.

### Primeira linha

Exibir 4–6 KPIs prioritários:

- Chave ligada
- Trabalho registrado
- Ociosidade/chave
- Desvios ativos
- Ordens abertas
- Ordens vencidas, se houver

Não invente benchmark, meta ou tendência.

Se não existir dado suficiente para comparação, não exiba variação.

### Prioridades agora

Criar um bloco imediatamente abaixo dos KPIs com no máximo 3–5 prioridades.

Cada prioridade deve mostrar:

- ativo;
- data/período;
- métrica que desviou;
- valor atual;
- baseline ou referência válida;
- CTA `Investigar` ou `Abrir ordem`.

### Evolução

Substituir a apresentação atual por visualização temporal mais clara.

Preferir linha ou barras para:

- chave ligada por mês;
- ociosidade/chave por mês;
- eventos quando fizer sentido.

Não gerar séries mensais para Workforce, pois o arquivo Workforce atual é agregado para o período jun–ago/2026.

### Ordens

Adicionar resumo executivo das ordens:

- abertas;
- em andamento;
- vencidas;
- concluídas recentemente;
- aguardando acompanhamento.

### Qualidade da base

Mostrar apenas um resumo compacto na home.

Detalhes completos ficam em `Base`.

## Página Frota

Criar visão comparativa da frota.

Tabela principal com:

- equipamento;
- chave;
- trabalho;
- ociosidade;
- ociosidade/chave;
- falhas;
- impactos;
- ordens abertas;
- estado de atenção quando sustentado por regra existente.

Adicionar barras inline ou sparklines apenas se ajudarem leitura.

Ao selecionar um equipamento, mostrar detalhe com:

- KPIs;
- evolução mensal;
- desvios;
- eventos;
- ordens;
- acompanhamento antes/depois;
- cartões relacionados quando houver vínculo explícito.

Não tratar ordenação da tabela como ranking humano.

## Página Desvios

Transformar o bloco atual `Desvios para investigar` + `Copiloto · evidência e próxima ação` em uma experiência principal.

Desktop:

- lista de desvios à esquerda;
- investigação detalhada à direita.

O painel detalhado deve ter quatro blocos visuais:

1. **O que aconteceu**
2. **Evidências**
3. **O que validar**
4. **Próxima ação**

Mostrar origem e regra estatística sem enterrar tudo em parágrafo corrido.

Manter explicitamente:

- desvio não identifica causa;
- não atribui responsabilidade;
- não é previsão calibrada de pane.

## Página Cartões

Usar o bloco Workforce já integrado.

Criar:

- busca por código;
- lista resumida;
- painel/drawer de detalhe.

No detalhe mostrar somente indicadores disponíveis:

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

Preservar zeros à esquerda.

Nunca exibir nome do operador.

Mostrar aviso discreto:

`A associação do cartão com equipamento ou evento não comprova responsabilidade individual.`

Não inventar série mensal a partir do total trimestral Workforce.

## Página Ordens

Consolidar a gestão existente em uma página mais clara.

Topo:

- abertas;
- em andamento;
- vencidas;
- concluídas.

Corpo:

- ativo;
- título;
- tipo;
- prioridade;
- equipe;
- prazo;
- status;
- origem/contexto;
- acompanhamento pós-ação.

No pós-ação, destacar claramente:

- antes;
- depois;
- número de registros;
- diferença;
- texto `comparação descritiva; não comprova causalidade`.

## Página Base

Mover para cá tudo que hoje ocupa a primeira dobra mas é administrativo.

Criar seções:

### Dados carregados

- período;
- ativos;
- fontes;
- hashes;
- cobertura.

### Importação

- importar JSON;
- mensagens de validação;
- comportamento de substituição de períodos.

### Backup local

- exportar;
- restaurar;
- aviso de persistência local.

### Qualidade dos dados

- campos ausentes;
- dias ausentes;
- combustível zerado;
- custos ausentes;
- manutenção indisponível;
- códigos incompletos/ambíguos;
- demais inconsistências já detectadas.

### Referência histórica 2023

Mover para cá a visão antiga atualmente exposta em `Dashboard 2023`.

Identificar claramente:

`Referência histórica de agosto/2023 — preservada para comparação de cobertura de informação, não para comparação direta de desempenho.`

### Persistência compartilhada

Apenas documentar:

- backend autenticado;
- banco central;
- autorização por operação;
- multiusuário;
- auditoria;
- backup central.

Não implementar.

## Apontamentos

Preserve toda a funcionalidade existente de apontamentos.

Em vez de mantê-la obrigatoriamente como aba principal, integre-a onde fizer mais sentido:

- `Base`, se for administração de dado manual;
- `Frota > detalhe do equipamento`, se for contexto operacional;
- `Ordens`, se o apontamento estiver diretamente ligado à execução.

Não remova dados ou capacidade de edição.

## Visualização de dados

Preferir:

- barras horizontais para comparação;
- linhas para evolução temporal;
- sparklines para tendência compacta;
- tabelas para precisão;
- badges para status.

Evitar:

- pizza/donut sem necessidade;
- gauge decorativo;
- radar;
- 3D;
- excesso de gradiente;
- barras `<meter>` com aparência nativa sem refinamento visual.

## Tabelas

Melhorar leitura com:

- header sticky quando aplicável;
- números alinhados à direita;
- divisores leves;
- hover discreto;
- ordenação clara;
- busca/filtro;
- espaço suficiente entre linhas;
- ação contextual no fim da linha.

## Responsividade

Validar pelo menos:

- 1366×768;
- 1440×900;
- mobile ~390px.

Não usar hover como único modo de interação.

## Acessibilidade

Preserve ou melhore:

- foco visível;
- navegação por teclado;
- labels;
- contraste AA;
- headings semânticos;
- tabelas semânticas;
- `aria` quando necessário;
- `prefers-reduced-motion`.

## Não fazer

- não recriar importadores;
- não trocar IndexedDB nesta etapa;
- não iniciar backend;
- não alterar o contrato Workforce sem necessidade;
- não alterar cálculos para facilitar UI;
- não misturar demo sintética com operação real;
- não remover dados históricos;
- não criar ranking de operadores;
- não atribuir responsabilidade a cartão;
- não inventar economia;
- não inventar diagnóstico;
- não distribuir total Workforce trimestral por mês/dia;
- não adicionar um framework grande apenas por estética;
- não reconstruir componentes que podem ser reaproveitados/refatorados.

## Estratégia de implementação

1. Faça inventário dos componentes atuais e marque `reutilizar`, `refatorar` ou `mover`.
2. Não altere domínio no primeiro passo.
3. Reestruture navegação e layout.
4. Aplique tokens do `DESIGN.md`.
5. Reaproveite dados existentes para os novos blocos.
6. Só crie componente novo quando não houver equivalente razoável.
7. Corrija regressões visuais e de acessibilidade.
8. Atualize documentação se a navegação mudar.
9. Execute todos os testes.
10. Faça PR com screenshots antes/depois, se o ambiente permitir.

## Critérios de aceite

A entrega só está pronta quando:

- o gestor entende o estado da operação em menos de 10 segundos;
- a home mostra prioridades antes de detalhes técnicos;
- importação/backup não ocupam a primeira dobra;
- Dashboard 2023 não aparece na navegação principal;
- existe fluxo claro `desvio → evidência → ação → acompanhamento`;
- visão por cartão usa Workforce sem inventar granularidade;
- não há nomes de operadores;
- dados reais continuam fora do GitHub público;
- persistência continua local;
- `npm run test:hyster` passa;
- `npm run lint` passa;
- `npm run build` passa;
- CI fica verde.

## Entrega no GitHub

Crie uma branch de feature a partir da `main` atual.

Implemente o redesign.

Abra um PR para `main` descrevendo:

- arquitetura de informação anterior × nova;
- componentes reaproveitados;
- componentes movidos;
- alterações visuais;
- preservação das regras de dados;
- testes executados;
- limitações restantes.

Não faça merge antes do CI ficar completamente aprovado.

Após CI verde, incorpore à `main`.
