# Decisão de produto — somente operação atual no Pulso

O dashboard de 2023 foi utilizado exclusivamente como referência de descoberta para entender quais indicadores a operação acompanhava e orientar a evolução do produto.

Ele **não faz parte do Pulso**, não deve ser importado, persistido, exibido ou incluído no JSON operacional.

Para a amostra atual do Tech4Change, o pacote operacional canônico contém exclusivamente dados de **01/06/2026 a 31/08/2026**.

Regras:

- uma única importação JSON reúne todos os dados atuais disponíveis do período;
- indicadores por cartão, telemetria, eventos, custos, combustível, status e demais fontes atuais coexistem no mesmo pacote;
- nenhuma seção `legacy`, `historical2023` ou equivalente é permitida no pacote atual;
- o dashboard antigo não aparece em navegação, Base, documentação de uso ou demo do produto;
- ele pode continuar existindo apenas fora do produto como material de pesquisa/benchmark de requisitos;
- dados sintéticos continuam separados da operação real.

Esta decisão prevalece sobre instruções antigas do repositório que mandavam preservar ou exibir referência histórica de 2023.
