# Pulso — operação e manutenção com dados Hyster

## Executar e importar

```bash
python -m pip install -r scripts/requirements-hyster.txt
python scripts/import_hyster.py /caminho/relatorios \
  --workforce /caminho/workforceKPITier7.xlsx \
  --legacy /caminho/dashboard-historico.xlsx \
  --output .data/hyster.json
npm install
npm run dev
```

Abra `http://localhost:3000/hyster` e importe `.data/hyster.json`. `--workforce` e `--legacy` são opcionais; Workforce adiciona o KPI atual por cartão e `--legacy` preserva o dashboard histórico inspecionado. O JSON pronto dispensa Python no computador de apresentação. As bases v1/v2 continuam legíveis, mas o bloco Workforce exige `schemaVersion: 3`. Uma reexportação do mesmo período substitui o lote anterior sem duplicar o histórico.

Veja também [contrato, privacidade e granularidade do Workforce KPI](workforce-kpi.md).

## Módulos

| Módulo | Comportamento |
| --- | --- |
| Operação | Horas, razões ponderadas, comparação mensal, presença, movimento, hidráulica e elevação; sinais estatísticos por equipamento |
| Cartões e eventos | Consulta por código do cartão, equipamento e mês; KPI Workforce agregado no período, equipamentos associados na fonte, eventos e evolução temporal disponível; sem nomes e sem ranking individual |
| Ordens e manutenção | Preventiva, corretiva/investigação e melhoria operacional; equipe, prazo, prioridade, situação, histórico e conclusão real |
| Apontamentos | Totais por equipamento/dia de horas planejadas, parada no período planejado, abastecimento em L ou kg, custo em R$ e produção em t ou movimentos |
| Dashboard 2023 | Visão geral e individual, métricas brutas, cálculos da Base dados e quadro estático Auxiliar Oficial preservados com origem e ressalvas |

Um desvio pode abrir o formulário de ordem com equipamento e contexto preenchidos. A criação e o encerramento dependem de ação humana. Após a conclusão, compare a razão ociosidade/chave nas janelas de 14 dias anteriores e posteriores, excluindo o dia da ação. Só há variação calculada com pelo menos cinco registros observados em cada lado. Essa comparação não prova causalidade nem normaliza demanda.

No módulo de cartões, ordens são exibidas apenas como contexto dos equipamentos presentes nas linhas filhas do Workforce. O antes/depois continua baseado na série diária do equipamento: o total trimestral do cartão nunca é convertido em série temporal nem usado para atribuir efeito ao operador.

Apontamentos são totais diários, não lançamentos individuais de abastecimento. Há uma linha por equipamento/dia; use Editar para corrigir. Disponibilidade considera apenas dias com horas planejadas > 0 e parada informada dentro desse planejamento. Nunca preencher ausência com zero, misturar kg com L ou toneladas com movimentos.

## Histórico e persistência

IndexedDB salva bases, ordens e apontamentos no navegador e na origem atual. Reabrir a página recupera o workspace. Exportar backup inclui todo esse estado; Restaurar valida o arquivo e avisa que substituirá o estado local. Exporte antes de mudar de computador, navegador, porta ou limpar os dados do site.

Esta entrega continua local, de um usuário: não há sincronização, login, multiempresa no servidor ou gestão de concorrência entre abas/usuários. A API SQLite da demonstração sintética permanece separada. A migração para backend autenticado está documentada como roadmap em `docs/workforce-kpi.md` e não faz parte deste slice.

Uma nova extração do mesmo período substitui aquela importação. Em períodos sobrepostos, a extração importada por último substitui os dias e eventos dos equipamentos daquele recorte, inclusive dias agora ausentes. Eventos repetidos na origem são preservados; não são deduplicados como se fossem panes. Importações de operações com identificadores diferentes são recusadas. Os contadores agregados não são somados entre períodos sobrepostos; a tabela de movimento/hidráulica/elevação mostra o intervalo explícito da extração mais recente.

## Workforce KPI atual

O importador valida as abas `Main Page` e `Workforce KPI Report`, o agrupamento por operador, unidade métrica, período e cabeçalhos usados. Somente os valores **Total Usage** dos contadores explicitamente mapeados entram no contrato.

A linha pai fornece o código do cartão e o total do período. As linhas filhas por equipamento ficam aninhadas no cartão e não são somadas novamente ao total. Nomes, números de série e nomes de equipamento não são persistidos. O código do cartão é texto: zeros à esquerda presentes na fonte são preservados e o Pulso não tenta adivinhar padding ausente em outra fonte.

O bloco pode conter, quando disponíveis: usos, medidor principal, motor/tração, medidores hidráulico e de tração, distância, monitorado, chave, presença, movimento, função hidráulica, trabalho, elevação, descida, alta velocidade, frente, ré e ociosidade. Campo ausente permanece ausente e zero informado pela origem continua zero.

A granularidade é `card-period`. O filtro mensal afeta o ledger de eventos e as séries diárias, mas nunca reparte horas, distância ou demais totais Workforce por mês ou dia. Isso evita falsa precisão.

## Preservação do dashboard original

As nove abas foram inspecionadas: duas visíveis (DashBoard Individual e Visão Geral) e sete ocultas (Main Page, Impactos, Relatório KPI de força de traba, Planilha1, Base dados, Auxiliar Oficial e Auxiliar Visual).

| Informação anterior | Tratamento no Pulso |
| --- | --- |
| Horas de chave, presença, trabalho, movimento, hidráulica, elevação, descida e ociosidade | Preservadas como contadores históricos; contadores disponíveis da extração atual aparecem também na operação e no recorte Workforce |
| Partidas/usos, distância, frente/ré e alta velocidade | Preservados no histórico e incorporados ao recorte Workforce atual quando fornecidos pela fonte |
| Uso efetivo, utilização, km/h, hidráulica parada/em movimento, abertura/fechamento e ociosidade dentro/fora | Valores calculados em cache preservados por linha; sem esconder erros ou alterar silenciosamente a fórmula |
| Visão geral | Razões recalculadas pelas somas; não usa média simples de percentuais para representar a frota |
| Impactos e grupo do Auxiliar Oficial | Valores estáticos preservados e identificados; não confundidos com o livro de eventos |
| Combustível do Auxiliar Visual | Valor manual em kg preservado separadamente, sem conversão para L nem integração ao consumo atual |
| Cartões truncados ou repetidos | Não completar códigos; linha identificada como incompleta ou ambígua; não agregar como identidade individual confirmada |

O cabeçalho Main Page refere-se a setembro/2022; o relatório KPI refere-se a agosto/2023. Impactos contém eventos de 2022. A localidade também diverge entre metadados e identificação usual do arquivo. Por isso, essa base fica como arquivo histórico separado, sem ser unida automaticamente à série atual, nem usada como baseline de 2026.

## Semântica e qualidade

- Diário: datas MM/DD/YYYY na origem, equipamento herdado do bloco; dias ausentes desconhecidos. Razões pela soma de horas. Trabalho/chave não mede produtividade física.
- Eventos: tipo, cartão e referência de linha; crítico na origem não determina prioridade. Cartão associado não comprova responsabilidade. Não atribuir horas diárias do equipamento ao cartão do evento.
- Workforce: cartão-período, com total e recortes por equipamento; não somar linha pai com linhas filhas e não distribuir total do período por mês/dia.
- Códigos de cartão: igualdade textual exata entre fontes. Códigos incompletos/ambíguos são sinalizados; equivalências numéricas ou zeros à esquerda não são inferidos.
- Não assumir trabalho + ociosidade = chave nem somar movimento e hidráulica como tempos exclusivos. Os contadores podem se sobrepor.
- KPI agregado: médias mensais não são uma série mensal. Horímetro de serviço é diferente do tempo de chave.
- Status/cadastro: snapshot separado do histórico. Ativo agora não prova disponibilidade anterior.
- Combustível zerado, custos ausentes e manutenção sem registros não comprovam consumo zero, custo zero ou manutenção em dia.
- Baseline exploratório: mesmo equipamento, 28 dias anteriores, mínimo de dez registros com chave ≥ 1 h; média e desvio amostral da razão diária; sinal com z ≥ 2 e aumento ≥ 10 pontos percentuais. A data avaliada e o futuro nunca entram na referência; variância zero não gera z artificial.
- A visão real não usa o Isolation Forest/LLM da demo nem inventa probabilidade de pane ou economia. As explicações são determinísticas e rastreáveis.

## Dados pessoais e publicação

O usuário autorizou conservar o código do cartão. O conversor mantém esse código como string e exclui nomes, sobrenomes, seriais, IDs de produto e localidade em texto dos registros atuais. O código é um identificador operacional e permanece no arquivo privado e no navegador. Nunca commitar a base real, XLSX ou backups no repositório público. `.gitignore` bloqueia `.data/`, `*.xlsx` e `Pulso-base-*.json`. Hashes, linha e arquivo mantêm rastreabilidade; campos livres são preenchidos pelo usuário.

## Verificação

`npm run test:hyster`, `npm run lint`, `npm run build`. Testes verificam cartões, zeros à esquerda, granularidade Workforce, importação idempotente, sobreposição, separação de operações, unidades, ausência de medições, ordens, integridade do backup e janelas de acompanhamento. O conversor falha quando o layout Hyster/Workforce difere dos cabeçalhos esperados.
