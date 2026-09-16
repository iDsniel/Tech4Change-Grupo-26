# Workforce KPI no Pulso

Este documento descreve o contrato e os limites da integração do relatório **Workforce KPI** com a operação Hyster. Dados reais e arquivos XLSX/JSON de operação permanecem fora do repositório público.

## Escopo da integração

O importador aceita o Workforce KPI como fonte complementar aos oito relatórios Hyster já utilizados pelo Pulso. Ele não substitui `DailyFleetUtilization`, `AssetOperatingHistory` ou o KPI consolidado por equipamento.

A fonte é validada antes da conversão:

- abas esperadas: `Main Page` e `Workforce KPI Report`;
- agrupamento de origem: `Operator`;
- unidade: `Metric`;
- período do Workforce deve coincidir com o lote Hyster que está sendo preparado;
- cada contador importado vem da coluna **Total Usage** da fonte;
- linhas pai representam o cartão no período;
- linhas filhas por equipamento ficam aninhadas no cartão e não são tratadas como novos totais.

## Privacidade e identidade do cartão

O Pulso não persiste o nome exibido pelo relatório. Do texto da linha pai, somente o código entre parênteses é extraído.

Regras:

- código é tratado como **texto**, nunca como número;
- zeros à esquerda, quando presentes no texto da fonte, são preservados;
- o Pulso não acrescenta ou remove zeros para tentar conciliar outra fonte;
- linha sem código extraível fica com `cardCode: null` e `cardQuality: incomplete`;
- código repetido fica com `cardQuality: ambiguous` e não é agregado automaticamente;
- linhas filhas mantêm somente o identificador sanitizado do equipamento (`EPxx`), sem número de série ou nome do equipamento.

`AssetOperatingHistory` pode vir com cartão armazenado como valor numérico. Nesse caso, a exportação por si só não permite reconstruir zeros à esquerda que não estejam no arquivo. O cruzamento com Workforce usa igualdade exata do texto; equivalências aproximadas não são inferidas.

## Métricas do contrato `schemaVersion: 3`

Quando presentes na fonte, o bloco `workforce` pode conter:

- usos (`usageCount`);
- medidor principal;
- tempo de motor/tração;
- medidor hidráulico;
- medidor de tração;
- distância (km);
- tempo monitorado;
- chave ligada;
- presença;
- movimento;
- função hidráulica;
- trabalho;
- elevação;
- descida;
- alta velocidade;
- marcha ré;
- marcha à frente;
- ociosidade.

Campo ausente continua ausente. Zero da fonte permanece zero. O importador não cria estimativas para indicadores não fornecidos.

## Granularidade

O Workforce utilizado nesta integração é um agregado de **cartão-período** (`granularity: card-period`).

Por isso:

- totais do período não são distribuídos artificialmente por mês ou dia;
- o filtro mensal do Pulso continua válido para séries diárias e eventos;
- na tela de cartões, os contadores Workforce continuam identificados pelo período completo da fonte;
- a evolução mensal de um cartão pode mostrar eventos reais por mês, mas não converte o total trimestral de horas/distância em série temporal.

Essa separação impede falsa precisão.

## Cruzamento com eventos, ordens e pós-ação

O código do cartão pode contextualizar eventos do `AssetOperatingHistory`. A associação não prova autoria, responsabilidade ou causa.

O Pulso usa o Workforce como evidência complementar:

1. mostra o perfil de uso do cartão no período;
2. mostra os equipamentos presentes nas linhas filhas da fonte;
3. cruza o código exatamente com o ledger de eventos;
4. permite visualizar ordens registradas para os equipamentos relacionados;
5. mantém o acompanhamento antes/depois baseado na série diária do **equipamento**, não no total Workforce do cartão.

Nenhuma ordem é criada automaticamente por associação de cartão.

## Importação local

Os arquivos reais ficam fora do GitHub. Exemplo:

```bash
python scripts/import_hyster.py /caminho/exports \
  --workforce /caminho/workforceKPITier7.xlsx \
  --output .data/Pulso-base-operacao-v3.json
```

A pasta `.data/` e arquivos reais não devem ser versionados.

## Separação das três bases

- **Operação atual:** Hyster + Workforce, período e granularidade explícitos.
- **Histórico 2023:** importação opcional `legacy`, preservada em módulo separado e não misturada à série diária atual.
- **Demonstração sintética:** continua na tela inicial e nos contratos de demo; não alimenta a operação real.

## Persistência nesta etapa

A persistência continua local ao navegador (IndexedDB), com backup/restauração. A integração Workforce não inicia migração de backend.

Para uso compartilhado futuro, ainda será necessário implementar, em etapa separada:

- autenticação e autorização por usuário/organização;
- banco persistente com isolamento por operação;
- versionamento de lotes importados e trilha de auditoria;
- armazenamento seguro dos arquivos ou somente de dados sanitizados;
- controle de concorrência para ordens/apontamentos;
- sincronização multiusuário e estratégia de backup/restore no servidor;
- política de retenção e exclusão de dados;
- gestão de segredos e observabilidade.

Esses itens são roadmap, não fazem parte deste slice.
