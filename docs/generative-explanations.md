# Camada de explicação generativa

## Objetivo

A IA generativa **não detecta anomalias** neste projeto. O motor de telemetria continua sendo responsável por baseline, z-score, Isolation Forest, fusão e recomendação operacional. O modelo generativo apenas transforma evidências estruturadas em linguagem mais clara para o gestor.

Fluxo:

```text
Telemetria ingerida
      ↓
telemetry-shift-v1
      ↓
z-score + Isolation Forest
      ↓
Insight estruturado
      ↓
Evidence packet permitido
      ↓
LLM explicador ──────┐
                     ├→ telemetry-explanation-v1
Fallback determinístico ┘
```

## Endpoint

`POST /api/telemetry/explain`

Request:

```json
{
  "insightId": "FLT-023-mechanical"
}
```

O cliente envia somente o identificador. O servidor recarrega o dataset validado, executa o mesmo pipeline e resolve o insight por ID. Dessa forma, o browser não consegue fornecer uma hipótese ou evidência arbitrária para o prompt.

## Evidências permitidas

O modelo recebe somente:

- ID do insight e do ativo;
- operador, quando aplicável;
- categoria e severidade;
- score de fusão;
- hipótese já produzida pelo motor;
- ação já produzida pelo motor;
- evidências estatísticas com valor atual, média, desvio padrão e z-score;
- evidência multivariada com aplicabilidade, concordância, score/percentil quando disponíveis.

O prompt proíbe explicitamente:

- criar números;
- inventar falhas, peças ou condições ambientais;
- transformar hipótese em causa confirmada;
- criar ação operacional diferente da recomendação do motor;
- recomendar punição ou decisão disciplinar.

## Contrato de saída

Versão: `telemetry-explanation-v1`.

```json
{
  "schemaVersion": "telemetry-explanation-v1",
  "mode": "generative",
  "insightId": "FLT-023-mechanical",
  "model": "gpt-5.6-luna",
  "explanation": {
    "headline": "...",
    "explanation": "...",
    "whyItMatters": "...",
    "uncertainty": "..."
  },
  "guardrails": {
    "evidenceBound": true,
    "noAutomaticDecision": true,
    "noRootCauseClaim": true,
    "fallbackAvailable": true
  }
}
```

A resposta do modelo é tratada como não confiável até passar pela validação local. O parser exige as quatro strings, limita tamanho, exige linguagem explícita de incerteza e rejeita expressões categóricas como `causa confirmada`, `diagnóstico confirmado`, `certeza de` e equivalentes definidos no guardrail.

## Fallback determinístico

Se `OPENAI_API_KEY` não estiver configurada, se a chamada falhar, se o modelo devolver JSON inválido ou se o conteúdo violar o contrato, o endpoint retorna HTTP 200 com:

```json
{
  "mode": "deterministic"
}
```

O fallback é montado exclusivamente a partir do próprio insight e das evidências estatísticas. Portanto, a operação e a demo não dependem da disponibilidade do modelo generativo.

## Configuração

Variáveis opcionais:

```text
OPENAI_API_KEY=...
OPENAI_EXPLANATION_MODEL=gpt-5.6-luna
```

Se `OPENAI_EXPLANATION_MODEL` não estiver definida, o endpoint tenta `OPENAI_MODEL` e depois usa `gpt-5.6-luna` como padrão.

## Princípio de segurança

> A IA generativa explica a evidência; ela não cria a evidência.

O sistema deve continuar útil e auditável mesmo quando o modelo generativo estiver totalmente desligado.
