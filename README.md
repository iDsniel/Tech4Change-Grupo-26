# Copiloto Operacional AI — Tech4Change Grupo 26

MVP de uma camada de inteligência sobre telemetria industrial. A solução compara o comportamento atual de empilhadeiras com o histórico do próprio ativo, identifica anomalias e transforma sinais técnicos em explicações e recomendações para operadores e gestores.

> **A máquina gera os dados. A IA encontra o padrão. O ser humano decide.**

## Problema

Frotas e equipamentos conectados geram muitos dados, mas dashboards tradicionais ainda exigem que alguém descubra manualmente:

- o que está acontecendo;
- se o problema está no equipamento, processo ou operação;
- qual é o impacto;
- qual ação deve ser priorizada.

O MVP demonstra uma abordagem de *human augmentation*: a IA organiza evidências e hipóteses sem automatizar decisões disciplinares ou técnicas críticas.

## Caso demonstrativo

Usamos empilhadeiras como cenário e conceitos de telemetria publicamente documentados pela Konecranes TRUCONNECT. Os valores deste repositório são **100% sintéticos** e o schema é **normalizado pelo MVP**; ele não deve ser apresentado como payload literal da API Konecranes.

Sinais utilizados na demonstração:

- consumo de combustível;
- tempo em marcha lenta;
- deslocamento vazio;
- temperatura;
- impactos;
- sobrecarga;
- contador de manutenção;
- ativo, turno e associação opcional ao operador.

## Vertical slice implementado

```text
Telemetria sintética
      ↓
Schema normalizado
      ↓
Detector determinístico
      ↓
Evidências + score
      ↓
Hipótese de causa
      ↓
Recomendação ao humano
      ↓
Visão Gestor / Visão Operador
```

O detector é intencionalmente auditável. Para o hackathon, isso permite mostrar ao jurado por que um insight foi criado em vez de esconder toda a lógica dentro de uma caixa-preta.

## Cenários do MVP

1. **Ineficiência operacional — FLT-017 / OP-042**  
   Consumo acima do baseline junto com aumento de idle e deslocamento vazio, concentrado em um operador/turno.

2. **Possível degradação mecânica — FLT-023**  
   Consumo e temperatura sobem em múltiplos operadores enquanto idle permanece estável.

3. **Eventos de impacto — FLT-031 / OP-007**  
   Aumento de impactos concentrado em uma janela operacional.

4. **Sobrecarga — FLT-012 / OP-015**  
   Tentativas de sobrecarga acima do histórico.

5. **Manutenção preventiva — FLT-044**  
   Contador entra na janela de planejamento de manutenção.

## API do MVP

### `GET /api/telemetry`

Retorna:

- frota demo;
- janelas sintéticas;
- resumo da operação;
- insights ordenados por criticidade;
- evidências e recomendações;
- disclaimer de origem dos dados.

### `POST /api/telemetry`

Aceita um array `windows[]` seguindo o contrato de `TelemetryWindow` e executa o mesmo detector sobre dados enviados pelo cliente.

Isso deixa o backend preparado para substituir o mock por um adapter de TRUCONNECT, outro fabricante ou uma fonte interna.

## Executar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

O slice de telemetria não exige chave de API para funcionar.

## Arquitetura futura

```text
Konecranes / Toyota / Hyster / Yale / Jungheinrich / outros
                           ↓
                        Adapter
                           ↓
                   Schema normalizado
                           ↓
               Baseline + regras / ML
                           ↓
                    Insight Engine
                           ↓
              IA generativa explicativa
                           ↓
              Operador + Gestor + CMMS
```

## Evolução de IA

A implementação atual prioriza transparência e uma demo determinística. Próximos passos:

1. carregar o dataset sintético de 30 dias já preparado para o projeto;
2. calcular baseline automaticamente por ativo/turno;
3. adicionar z-score e/ou Isolation Forest;
4. usar modelo generativo somente para transformar evidências estruturadas em explicação clara;
5. adicionar feedback pós-recomendação para medir evolução do operador;
6. criar adapter real para a fonte de telemetria disponível.

## Guardrails

- insight não é diagnóstico definitivo;
- nenhuma decisão disciplinar é automática;
- condição de rota, piso, processo, planejamento e máquina deve ser considerada;
- `operator_id` é opcional e pode depender de integração externa;
- dados e códigos de diagnóstico demo não representam códigos reais do fabricante;
- sinais disponíveis variam conforme equipamento, configuração e assinatura do provedor de telemetria.

## Referências públicas usadas na modelagem

- Konecranes TRUCONNECT Remote Monitoring for Lift Trucks;
- Konecranes TRUCONNECT for Lift Trucks brochure;
- Konecranes Developer Portal / Cloud API onboarding;
- TRUCONNECT Ports Data API.

O objetivo das referências é validar **conceitos de telemetria e viabilidade de integração**, não reproduzir um contrato proprietário de produção.
