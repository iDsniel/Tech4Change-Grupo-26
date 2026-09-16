# Pulso — pacote operacional unificado

O Pulso usa **uma única importação JSON por extração operacional**. Telemetria, indicadores por cartão, eventos, custos, combustível, manutenção e demais dados atuais do período fazem parte do mesmo pacote operacional; o usuário não importa fontes separadamente.

## Arquivo canônico

Nome recomendado:

`Pulso-base-operacao.json`

Para a amostra atual:

`Pulso-base-operacao-jun-ago-2026.json`

O pacote atual usa `schemaVersion: 3` e contém, quando disponíveis:

- `assets`: cadastro anonimizado dos equipamentos;
- `daily`: série diária por equipamento;
- `kpi`: contadores consolidados por equipamento;
- `events`: ledger de eventos com código do cartão, sem nome do operador;
- `workforce`: indicadores agregados por cartão e período, dentro do mesmo contrato operacional;
- `currentStatus`: snapshot atual;
- `fuel`: medição reportada de combustível;
- `costs`: custos reportados;
- `maintenanceAvailable`: sinal de disponibilidade da fonte de manutenção;
- `sources`: rastreabilidade e hashes das fontes usadas para construir o pacote.

O nome interno `workforce` representa apenas a proveniência/semântica de uma seção do contrato. **Não existe fluxo de importação Workforce separado no produto.** Na UI, essa seção é apresentada como `indicadores por cartão`.

## Período da amostra atual

O JSON usado no MVP do Tech4Change contém somente dados de:

- início: `2026-06-01`;
- fim: `2026-08-31`.

O dashboard antigo de 2023 foi utilizado apenas como referência de descoberta para entender quais informações a operação acompanhava. Ele **não integra o Pulso, não entra no JSON, não é exibido na interface e não participa de baseline, comparação ou persistência**.

O pacote operacional não deve conter `legacy`, `historical2023` ou seção equivalente.

## Geração

O importador consolida as fontes atuais em um único arquivo:

```bash
python scripts/import_hyster.py /caminho/relatorios \
  --workforce /caminho/workforceKPITier7.xlsx \
  --output .data/Pulso-base-operacao.json
```

Os XLSX e o JSON real ficam fora do GitHub público.

## Regra de UX

A aplicação deve expor **um único controle de importação da base operacional**. Após a importação, todas as áreas do Pulso usam o mesmo objeto validado para produzir:

- resumo executivo;
- visão de frota;
- desvios e evidências;
- indicadores por cartão;
- eventos associados;
- ordens e acompanhamento pós-ação;
- qualidade e rastreabilidade da base.

Não pedir ao usuário para importar Hyster e Workforce separadamente.

## Granularidade

Unificar o arquivo não significa uniformizar a granularidade dos dados.

- `daily` permanece equipamento-dia;
- `events` permanece evento com data/hora;
- indicadores por cartão permanecem cartão-período;
- snapshots continuam snapshots.

O Pulso cruza essas evidências sem distribuir totais agregados artificialmente por mês/dia e sem transformar associação de cartão em responsabilidade individual.

## Compatibilidade

Arquivos antigos podem existir como material de desenvolvimento, mas o caminho normal do MVP é o pacote unificado schema 3 sem qualquer referência histórica de 2023. Para demonstração e operação atual, gere e importe sempre um único pacote do período correspondente.
