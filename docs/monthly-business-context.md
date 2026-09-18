# Visão mensal alinhada ao negócio

Esta evolução do Pulso separa três perguntas que não devem ser misturadas em um único score:

1. **Atividade operacional registrada** — trabalho/chave, função hidráulica/chave, movimento/chave e ociosidade/chave.
2. **Segurança de deslocamento** — distribuição frente/ré, faixas de velocidade, overspeed e impactos.
3. **Produtividade e custo do negócio** — pallets/toneladas/movimentos e custo realizado, somente quando esses dados forem apontados por uma fonte real.

## Granularidade confirmada nas três planilhas Workforce

Os arquivos de junho, julho e agosto/2026 têm período mensal completo e linhas de cartão/equipamento com médias e totais. As linhas **não possuem data/hora por uso**.

Consequências:

- Workforce entra como `card-month` / `asset-month`;
- o mesmo cartão pode ser comparado entre meses;
- hidráulica, movimento, marcha e velocidade não são atribuídos a dia ou turno;
- eventos do Asset Operating History possuem data/hora e podem ser associados aos turnos operacionais;
- nenhum total mensal é dividido artificialmente por dia ou turno.

## Turnos operacionais configurados

- A: 07:00 até antes de 15:00;
- B: 15:00 até antes de 23:00;
- C: 23:00 até antes de 07:00.

O recorte de turno é usado apenas onde existe timestamp real.

## Contexto do processo

Configuração do MVP atual:

- fluxo principal: pallets de hardboard;
- a frota também é usada pontualmente pela manutenção e durante manutenções;
- a operação informou preferência por maior uso de marcha ré;
- velocidade é um sinal de segurança relevante.

Esses itens são **contexto configurado**, não telemetria medida. A IA não deve transformá-los em fatos observados.

## Segurança

O Pulso mostra:

- % da marcha em ré e à frente;
- % do movimento em baixa, média e alta velocidade;
- % do movimento marcado pela origem como overspeed;
- impactos por mês e por turno quando o evento possui horário.

Não existe limite automático para dizer "seguro/inseguro". A preferência por maior uso de ré é apresentada como regra operacional informada e deve ser validada com Segurança/Operação antes de virar threshold.

## Produtividade e custo

Função hidráulica é um bom sinal de atividade real da empilhadeira, mas não é throughput do negócio.

Para medir produtividade do fluxo de hardboard sem estimar, a camada de apontamentos aceita:

- `pallets`;
- toneladas;
- movimentos;
- custo realizado;
- contexto de uso: produção, manutenção, misto ou não informado.

Quando custo e pallets reais existirem no mesmo período, o Pulso pode calcular custo/pallet. Sem esses dados, mostra `n/d` e não estima economia.

## Uso pela IA

O Operational Context Engine adiciona ao insight diário:

- contexto Workforce do mês correto;
- comparação com o mês anterior;
- mudanças de trabalho, hidráulica, movimento e ociosidade;
- frente/ré, alta velocidade e overspeed;
- impactos/falhas por turno derivados de eventos timestampados;
- pallets/custo apenas se apontados;
- limitação explícita quando produção versus manutenção não estiver identificada.
