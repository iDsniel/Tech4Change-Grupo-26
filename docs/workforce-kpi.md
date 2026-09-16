# Indicadores por cartão no Pulso

Este documento descreve o contrato e os limites dos indicadores por cartão incorporados à **mesma base operacional** do Pulso. Dados reais e arquivos XLSX/JSON permanecem fora do repositório público.

## Escopo

O relatório Workforce KPI é uma das fontes usadas para construir o pacote operacional único. Para o usuário não existe uma segunda base nem uma segunda importação.

A experiência é:

`relatórios atuais → 1 JSON operacional → Pulso → todos os insights`

A fonte é validada antes da conversão:

- abas esperadas: `Main Page` e `Workforce KPI Report`;
- agrupamento de origem: `Operator`;
- unidade: `Metric`;
- período deve coincidir com o lote operacional preparado;
- cada contador importado vem da coluna **Total Usage**;
- linhas pai representam o cartão no período;
- linhas filhas por equipamento ficam aninhadas no cartão e não são novos totais.

Para a amostra atual, o período é **01/06/2026 a 31/08/2026**.

## Privacidade e identidade do cartão

O Pulso não persiste o nome exibido pelo relatório. Do texto da linha pai, somente o código do cartão é extraído.

Regras:

- código é tratado como **texto**, nunca como número;
- zeros à esquerda presentes na fonte são preservados;
- o Pulso não acrescenta ou remove zeros para tentar conciliar outra fonte;
- linha sem código extraível fica com `cardCode: null` e `cardQuality: incomplete`;
- código repetido fica com `cardQuality: ambiguous` e não é agregado automaticamente;
- linhas filhas mantêm somente o identificador sanitizado do equipamento (`EPxx`).

`AssetOperatingHistory` pode trazer cartão armazenado como valor numérico. Nesse caso, a exportação não permite reconstruir zeros à esquerda ausentes. O cruzamento usa igualdade textual exata; equivalências aproximadas não são inferidas.

## Métricas do schema v3

Quando presentes na fonte, a seção interna `workforce` pode conter:

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

O nome interno `workforce` é apenas uma decisão de compatibilidade do contrato atual. Na interface, tratar como **indicadores por cartão**.

Campo ausente continua ausente. Zero informado pela origem permanece zero. O importador não cria estimativas para indicadores não fornecidos.

## Granularidade

A granularidade é **cartão-período** (`card-period`).

Por isso:

- totais do período não são distribuídos artificialmente por mês ou dia;
- filtros mensais continuam válidos para séries diárias e eventos;
- contadores por cartão permanecem identificados pelo período completo da fonte;
- evolução mensal de um cartão pode mostrar eventos reais por mês, mas não converte total trimestral de horas/distância em série temporal.

## Cruzamento com eventos, ordens e pós-ação

O código do cartão pode contextualizar eventos do `AssetOperatingHistory`. A associação não prova autoria, responsabilidade ou causa.

O Pulso:

1. mostra o perfil de uso do cartão no período;
2. mostra equipamentos presentes nas linhas filhas da fonte;
3. cruza o código exatamente com o ledger de eventos;
4. mostra ordens dos equipamentos relacionados;
5. mantém o acompanhamento antes/depois baseado na série diária do equipamento.

Nenhuma ordem é criada automaticamente por associação de cartão.

## Importação única

Exemplo de geração do pacote atual:

```bash
python scripts/import_hyster.py /caminho/exports \
  --workforce /caminho/workforceKPITier7.xlsx \
  --output .data/Pulso-base-operacao.json
```

Depois o usuário importa somente `Pulso-base-operacao.json` no Pulso.

## Dados reais × demonstração sintética

Existem apenas dois contextos de execução:

- **operação real atual:** pacote operacional com período explícito;
- **demonstração sintética:** ambiente separado, que não alimenta a operação real.

O dashboard antigo usado na etapa de descoberta não é uma base do produto, não é importado e não aparece na interface.

## Persistência nesta etapa

A persistência continua local ao navegador (IndexedDB), com backup/restauração. Não iniciar backend nesta etapa.

Para uso compartilhado futuro ainda será necessário implementar, separadamente:

- autenticação e autorização;
- banco persistente com isolamento por operação;
- versionamento e auditoria;
- controle de concorrência;
- sincronização multiusuário;
- backup central;
- política de retenção;
- gestão de segredos e observabilidade.
