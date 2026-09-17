# Pulso — operação e manutenção com dados Hyster

## Executar e importar

```bash
python -m pip install -r scripts/requirements-hyster.txt
python scripts/import_hyster.py /caminho/relatorios \
  --workforce /caminho/workforceKPITier7.xlsx \
  --output .data/Pulso-base-operacao.json
npm install
npm run dev
```

Abra `http://localhost:3000/hyster` e importe **um único JSON operacional**. As planilhas Hyster são convertidas para o contrato interno `schemaVersion: 4`; o usuário não precisa importar cada relatório separadamente.

A amostra atual cobre **01/06/2026 a 31/08/2026**. O status atual de frota é um snapshot separado e pode ter timestamp posterior ao período; o contrato registra essa diferença explicitamente.

## Granularidades preservadas

O Pulso não tenta transformar todas as fontes no mesmo grão físico. Cada origem mantém a maior granularidade disponível:

| Fonte | Grão preservado |
| --- | --- |
| Daily Fleet Utilization | equipamento × dia |
| Utilization KPI | equipamento × período |
| Workforce KPI | cartão × período e cartão × equipamento × período |
| Asset Operating History | evento × timestamp × equipamento × cartão |
| Current Fleet Status | snapshot atual por equipamento |
| Fuel / Cost | equipamento × período |
| PM Tracker | registros de manutenção quando disponíveis |

A regra de arquitetura é: **agregar dentro do Pulso quando seguro; nunca desagregar artificialmente**.

## Schema v4

O contrato preserva metadados de equipamento, indicadores brutos, estatísticas nativas da Hyster, eventos, snapshot atual, proveniência e qualidade.

### Daily Fleet

Além das horas de chave, presença, trabalho, ociosidade e espera, o v4 preserva quando disponíveis:

- quantidade de equipamentos utilizados;
- `% Used`;
- `% Work`;
- `% Idle`;
- `% Wait of Idle`.

Esses percentuais são valores reportados pela fonte. Eles são mantidos mesmo quando ultrapassam 100%; o Pulso não corrige silenciosamente a origem.

### Fleet KPI

Para cada métrica, o contrato pode guardar:

```text
statistics.metric.dailyAverage
statistics.metric.monthlyAverage
statistics.metric.total
```

As médias são valores reportados pela Hyster e ficam separadas da série diária observada.

### Workforce KPI

O v4 preserva 29 famílias de métricas, incluindo medidores, distância, trabalho, hidráulica, elevação/descida, perfil de velocidade, overspeed, frente/ré, ociosidade, cinto, carga/descarregado, contêineres e energia/combustível.

Para cada métrica:

```text
metrics.<metric>                 # total do período, compatibilidade
statistics.<metric>.dailyAverage
statistics.<metric>.monthlyAverage
statistics.<metric>.total
```

O contrato também registra `metricAvailability` para distinguir uma métrica suportada mas zerada no período de uma métrica ausente.

### Eventos

O ledger preserva timestamp, equipamento, cartão, tipo, status, criticidade, lockout e shutdown. O pacote registra se a exportação foi filtrada para `Crítica = Sim`.

**Importante:** `sourceCritical=true` não transforma automaticamente o registro em falha ou em prioridade alta. O Pulso continua separando `Falha do sistema`, `Impacto` e demais tipos pelo nome do evento.

### Status atual

`currentStatus` representa um snapshot, não a história do trimestre. `currentStatusSnapshotAt` informa a captura e `dataQuality.currentStatusSnapshotOutsideAnalysisPeriod` impede a interface/IA de tratá-lo como evidência histórica quando estiver fora da janela analisada.

## Privacidade

O identificador operacional preservado é o **código do cartão**. O importador v4 não persiste nomes dos operadores, mesmo quando esses nomes existem nos XLSX de origem.

A camada de contexto enviada para interpretação por IA também remove identidade de cartão/operador: métricas agregadas podem contextualizar um ativo, mas a IA não recebe identificadores individuais para atribuir responsabilidade.

## Qualidade e rastreabilidade

`dataQuality` registra, entre outros:

- equipamento-dias presentes e omitidos;
- métricas Workforce suportadas e zeradas;
- combustível zerado na origem;
- custo/hora zerado ou total ausente;
- disponibilidade de PM Tracker;
- exportação de eventos somente críticos;
- snapshot atual fora do período analisado.

Dias ausentes permanecem **desconhecidos**. Ausência de linha não vira zero automaticamente.

Cada fonte guarda `sha256`, abas, intervalo utilizado e quantidade de linhas para rastreabilidade.

## Uso pelo motor analítico

O motor diário continua usando apenas informação realmente diária do equipamento para baseline, z-score e Isolation Forest. Métricas `card-period` ou `asset-period` entram como **contexto agregado**, nunca como se tivessem acontecido em um dia específico.

O Operational Context Engine agora pode contextualizar um insight com:

- movimento e hidráulica;
- hidráulica auxiliar;
- baixa/média/alta velocidade;
- overspeed baixo/alto;
- frente/ré;
- cinto;
- carga/descarregado;
- disponibilidade de combustível e manutenção;
- aviso de ledger filtrado apenas para eventos críticos.

Isso amplia a explicação sem transformar correlação em causa.

## Persistência

IndexedDB salva bases, ordens e apontamentos no navegador. Uma nova extração do mesmo período substitui o lote anterior. Em períodos sobrepostos, os registros diários/eventos do recorte mais recente substituem os anteriores conforme as regras de `combineDatasets`; contadores agregados não são somados quando isso poderia duplicar informação.

## Verificação

Antes de incorporar alterações:

```bash
npm run test:hyster
npm run lint
npm run build
```

Dados reais, XLSX, JSON operacional e backups permanecem fora do repositório público.