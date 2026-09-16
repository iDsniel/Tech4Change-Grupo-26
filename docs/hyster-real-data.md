# Pulso — Hyster Tracker

## Uso

Abra `/hyster` e importe o JSON gerado pelo conversor. O parser lê os oito XLSX, incluindo as abas de dados, mantém referências de linha e hashes SHA-256 e emite apenas campos permitidos. Nomes, sobrenomes, cartões, números de série, IDs do produto, site e departamento não saem no JSON. Os rótulos EP identificam equipamentos, nunca pessoas.

```bash
python -m pip install -r scripts/requirements-hyster.txt
python scripts/import_hyster.py /caminho/relatorios --output .data/hyster.json
npm install
npm run dev
```

Selecione `.data/hyster.json` no navegador em `http://localhost:3000/hyster`. O usuário também pode carregar a base já preparada, sem Python. O processamento da interface é local ao navegador; não há upload, API de ingestão, armazenamento de operadores ou envio ao LLM. Recarregar descarta a base carregada. O arquivo real e os XLSX não devem ser commitados no repositório público. `.data/` e `*.xlsx` são ignorados.

## Contrato de origem

| Exportação | Uso | Restrição |
| --- | --- | --- |
| assetListing | Cadastro e horímetro do snapshot | Não é o horímetro no encerramento histórico |
| DailyFleetUtilization | Série equipamento-dia e baseline | Datas MM/DD/YYYY; equipamento herdado do bloco; dias ausentes são desconhecidos |
| utilizationKPITier7 | Conciliação por equipamento | Agregado do período; médias mensais não são séries mensais |
| AssetOperatingHistory | Eventos tipados e rastreáveis | Crítico na origem não é severidade derivada; eventos não são panes independentes |
| currentFleetStatus | Snapshot separado | Não mede disponibilidade histórica |
| PMTrackerDW | Presença/ausência de dados | Nenhum registro não significa manutenção em dia |
| fuelUsageSummaryequipment | Valores reportados | Zeros não provam ausência de consumo |
| costOfOperationTier7 | Horímetro inicial/final e completude | Custo zero com total ausente não prova custo operacional zero |

## Indicadores e detecção

- Razão de ociosidade: soma de idleHours / soma de keyHours. A base diária é a referência para filtros e agregações. Não usar a média de percentuais exibidos na origem.
- Trabalho/chave não mede produtividade física (faltam toneladas, ciclos ou entregas). Sem calendário planejado, não há disponibilidade nem taxa de utilização da capacidade.
- Não somar movimento e hidráulica, nem assumir trabalho + ociosidade = chave. Contadores podem se sobrepor ou usar semânticas diferentes.
- Baseline exploratório: mesmo equipamento, 28 dias anteriores, ao menos 10 registros com chave ≥ 1 h. Média e desvio padrão amostral da razão diária. Sinal com z ≥ 2 e diferença ≥ 10 pontos percentuais. Zero variância não recebe z artificial. A data avaliada e datas futuras nunca entram na referência.
- Filtros mensais restringem a avaliação, não apagam o histórico anterior necessário ao baseline. Equipamentos não são agrupados como equivalentes.
- Z-score é evidência exploratória, não probabilidade de falha, causalidade ou diagnóstico. Critérios precisam ser calibrados com a operação; não houve validação supervisionada ou cálculo de precisão/recall.
- O modelo Isolation Forest e a geração de explicações do cenário sintético continuam separados. O modo real usa texto determinístico ligado às evidências; não afirma treinamento ou validação do modelo sintético na frota real.
- Falhas de sistema e impactos pedem consulta aos códigos e às ordens de serviço. Não há duração de indisponibilidade, manutenção preditiva ou ganho financeiro demonstrado.
- Registro persistente de ação e avaliação pós-intervenção ainda pertencem à demo sintética. A visão Hyster não finge transferir esses resultados ao histórico real.

## Próximos dados que destravam valor

Códigos e duração de falhas, manutenção realizada e programada, abastecimentos medidos, calendário de turnos, papel de cada equipamento e volume movimentado. Com isso, validar recorrência, normalizar demanda e medir efeito de ações humanas.

## Verificação

`npm run test:hyster`, `npm run lint` e `npm run build`. Testes cobrem ponderação correta, dados ausentes, duplicidade, separação de eventos de status e ausência de vazamento temporal. O importador é específico ao layout observado: mudanças de exportação devem falhar e ser revisadas, nunca inferidas silenciosamente.
