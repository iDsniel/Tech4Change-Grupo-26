# Pulso — pacote operacional unificado

O Pulso usa **uma única importação JSON por extração operacional**. Hyster Tracker, indicadores por cartão, eventos, custos, combustível, manutenção e referências históricas são fontes e seções do mesmo pacote; não são bases que o usuário precisa importar separadamente.

## Arquivo canônico

Nome recomendado:

`Pulso-base-operacao.json`

Para a amostra atual:

`Pulso-base-operacao-unificada-jun-ago-2026.json`

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
- `legacy`: referência histórica de 2023, preservada sem entrar automaticamente no baseline atual;
- `sources`: rastreabilidade e hashes das fontes usadas para construir o pacote.

O nome interno `workforce` representa apenas a proveniência/semântica de uma seção do contrato. **Não existe fluxo de importação Workforce separado no produto.** Na UI, essa seção é apresentada como `indicadores por cartão`.

## Geração

O importador já consegue consolidar as fontes em um único arquivo:

```bash
python scripts/import_hyster.py /caminho/relatorios \
  --workforce /caminho/workforceKPITier7.xlsx \
  --legacy /caminho/dashboard-historico.xlsx \
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
- qualidade e rastreabilidade da base;
- referência histórica de 2023 somente quando solicitada.

Não pedir ao usuário para importar Hyster e Workforce separadamente.

## Granularidade

Unificar o arquivo não significa uniformizar a granularidade dos dados.

- `daily` permanece equipamento-dia;
- `events` permanece evento com data/hora;
- indicadores por cartão permanecem cartão-período;
- snapshots continuam snapshots;
- histórico de 2023 permanece referência histórica.

O Pulso cruza essas evidências sem distribuir totais agregados artificialmente por mês/dia e sem transformar associação de cartão em responsabilidade individual.

## Compatibilidade

Arquivos antigos de schema 1 e 2 continuam úteis para migração/recuperação, mas o caminho normal do MVP é o pacote unificado schema 3. Para demonstração e operação atual, prefira sempre regenerar a base unificada e importá-la uma única vez.
