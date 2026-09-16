# Pulso — operação e manutenção com dados atuais

## Executar e importar

```bash
python -m pip install -r scripts/requirements-hyster.txt
python scripts/import_hyster.py /caminho/relatorios \
  --workforce /caminho/workforceKPITier7.xlsx \
  --output .data/Pulso-base-operacao.json
npm install
npm run dev
```

Abra `http://localhost:3000/hyster` e importe **um único JSON operacional**. Os relatórios do fornecedor e os indicadores por cartão são fontes do mesmo pacote; não existem importações Hyster e Workforce separadas na experiência do usuário.

Para a amostra atual do Tech4Change, o pacote real cobre exclusivamente **01/06/2026 a 31/08/2026**. O dashboard antigo utilizado durante a descoberta do produto não integra o Pulso, o JSON, o workspace nem os cálculos.

Veja também [contrato, privacidade e granularidade dos indicadores por cartão](workforce-kpi.md) e [decisão de escopo dos dados atuais](DECISION-2026-current-data-only.md).

## Áreas funcionais

| Área | Comportamento |
| --- | --- |
| Operação / Resumo | Horas, razões ponderadas, comparação mensal, presença, movimento, hidráulica, elevação e sinais estatísticos por equipamento |
| Cartões e eventos | Consulta por código, equipamento e período; indicadores agregados por cartão, equipamentos associados, eventos e contexto operacional; sem nomes e sem ranking individual |
| Ordens e manutenção | Preventiva, corretiva/investigação e melhoria operacional; equipe, prazo, prioridade, situação, histórico e conclusão real |
| Apontamentos | Totais por equipamento/dia de horas planejadas, parada no período planejado, abastecimento, custo e produção |
| Base | Importação única, backup/restauração, fontes, qualidade e rastreabilidade |

Um desvio pode abrir o formulário de ordem com equipamento e contexto preenchidos. A criação e o encerramento dependem de ação humana. Após a conclusão, a comparação antes/depois usa a série diária observada do equipamento e não prova causalidade.

No contexto por cartão, ordens são exibidas apenas como contexto dos equipamentos explicitamente relacionados na fonte. O total agregado do cartão nunca é convertido artificialmente em série temporal nem usado para atribuir efeito ou responsabilidade individual.

## Persistência

IndexedDB salva bases, ordens e apontamentos no navegador. Exportar backup inclui o estado local; Restaurar valida o arquivo antes de substituir o workspace.

Esta etapa continua local e de um usuário. Backend autenticado, banco central e sincronização multiusuário permanecem roadmap.

Uma nova extração do mesmo período substitui o lote anterior. Em períodos sobrepostos, a extração importada por último substitui os registros daquele recorte conforme as regras já implementadas. Eventos repetidos na origem são preservados como registros da fonte; não são reinterpretados como panes independentes.

## Indicadores por cartão

O importador valida as abas `Main Page` e `Workforce KPI Report`, unidade métrica, período e cabeçalhos esperados. Somente valores **Total Usage** explicitamente mapeados entram no contrato.

A linha pai fornece o código do cartão e o total do período. Linhas filhas por equipamento ficam aninhadas no cartão e não são somadas novamente ao total. Nomes, números de série e nomes de equipamento não são persistidos.

O código do cartão é texto: zeros à esquerda presentes na fonte são preservados e o Pulso não tenta reconstruir padding ausente em outra fonte.

Quando disponíveis, podem existir:

- usos;
- medidor principal;
- motor/tração;
- medidores hidráulico e de tração;
- distância;
- tempo monitorado;
- chave;
- presença;
- movimento;
- função hidráulica;
- trabalho;
- elevação;
- descida;
- alta velocidade;
- frente;
- ré;
- ociosidade.

Campo ausente permanece ausente. Zero informado pela origem continua zero.

A granularidade é `card-period`. O filtro mensal afeta séries diárias e eventos, mas nunca reparte horas, distância ou demais totais agregados por cartão por mês ou dia.

## Período e snapshots

Todo registro temporal usado na análise real deve pertencer ao intervalo declarado pelo pacote.

Para a base atual:

- `periodStart`: `2026-06-01`;
- `periodEnd`: `2026-08-31`;
- `daily`: somente datas dentro desse intervalo;
- `events`: somente datas dentro desse intervalo;
- indicadores por cartão: mesmo intervalo da operação.

Snapshots capturados fora do período não devem ser apresentados como evidência do trimestre. Na base entregue para o MVP, o snapshot de status capturado em setembro foi removido do JSON corrente.

## Semântica e qualidade

- Diário: dias ausentes permanecem desconhecidos. Razões usam soma de horas. Trabalho/chave não mede produtividade física.
- Eventos: crítico na origem não determina prioridade. Cartão associado não comprova responsabilidade.
- Indicadores por cartão: não somar linha pai com linhas filhas e não distribuir total do período por mês/dia.
- Códigos de cartão: igualdade textual exata; incompletos/ambíguos são sinalizados.
- Não assumir trabalho + ociosidade = chave nem tratar movimento e hidráulica como tempos exclusivos.
- KPI agregado: horímetro de serviço é diferente de tempo de chave.
- Combustível zerado, custos ausentes e manutenção sem registros não comprovam consumo zero, custo zero ou manutenção em dia.
- Baseline exploratório: mesmo equipamento, 28 dias anteriores, mínimo de dez registros com chave ≥ 1 h; média e desvio amostral da razão diária; sinal com z ≥ 2 e aumento ≥ 10 pontos percentuais. A data avaliada e o futuro nunca entram na referência.
- A visão real não inventa probabilidade de pane, economia ou causalidade.

## Dados pessoais e publicação

O código do cartão é preservado como identificador operacional. Nomes de operadores não entram no contrato atual. Dados reais, XLSX, JSON operacional e backups não devem ser commitados no repositório público.

`.gitignore` bloqueia `.data/`, `*.xlsx` e `Pulso-base-*.json`.

## Verificação

Antes de incorporar alterações:

```bash
npm run test:hyster
npm run lint
npm run build
```

Os testes cobrem códigos de cartão como texto, granularidade, importação idempotente, sobreposição, separação de operações, unidades, ordens, integridade do backup e janelas de acompanhamento.
