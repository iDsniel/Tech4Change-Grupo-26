# Persistência de intervenções

## Objetivo

Este slice transforma o feedback pós-recomendação em um fluxo operacional real:

```text
Insight detectado
      ↓
Gestor registra ação realizada
      ↓
SQLite persiste a intervenção
      ↓
FeedbackLoop consulta a ação persistida
      ↓
Próximos turnos comparáveis
      ↓
Convergência ao baseline
```

A telemetria continua sintética na demo, mas a ação humana deixa de ser uma fixture estática: ela pode ser criada pela interface ou API e permanece após reinício do processo.

## Storage

Implementação atual: `lib/interventionStore.ts`.

Banco padrão:

```text
.data/tech4change.sqlite
```

Pode ser alterado com:

```text
INTERVENTION_DB_PATH=/caminho/persistente/tech4change.sqlite
```

A pasta `.data/` e arquivos `*.sqlite*` são ignorados pelo Git.

### Tabela `interventions`

Campos principais:

- `id`;
- `insight_id`;
- `applied_at`;
- `target_turns`;
- `action_type`;
- `actor_role`;
- `note`;
- `created_at`;
- `source`.

As três intervenções históricas de `data/interventions-demo.json` são usadas somente como **seed idempotente**. Depois disso o SQLite é o source of truth para leitura e novas gravações.

## API

### Listar

```http
GET /api/telemetry/interventions
```

Filtrar por insight:

```http
GET /api/telemetry/interventions?insightId=FLT-023-mechanical
```

### Registrar

```http
POST /api/telemetry/interventions
Content-Type: application/json
```

Exemplo:

```json
{
  "insightId": "FLT-023-mechanical",
  "appliedAt": "2026-09-06",
  "targetTurns": 3,
  "actionType": "maintenance_action",
  "actorRole": "supervisor",
  "note": "Inspeção técnica executada e ativo liberado para acompanhamento pós-ação."
}
```

O servidor valida que o insight existe no pipeline atual antes de persistir a ação.

## Interface

O `FeedbackLoop` é renderizado junto da explicação do insight.

Quando não há ação:

```text
Registrar ação realizada
```

abre um formulário com:

- data;
- tipo de ação;
- responsável/papel;
- quantidade de turnos a acompanhar;
- nota sobre o que foi executado.

Na demo, a API sugere como data inicial o fim da janela anômala. Isso permite que os registros sintéticos posteriores já existentes sejam usados para demonstrar o acompanhamento. Em uma operação real, deve ser usada a data real da intervenção.

Depois do `POST`, o componente recarrega `/api/telemetry/feedback` e o acompanhamento passa a usar imediatamente a intervenção persistida.

## Prova de persistência

O workflow `Persistence CI`:

1. remove qualquer banco anterior;
2. inicia a aplicação;
3. confirma os 3 seeds;
4. cria uma nova intervenção via HTTP;
5. confirma sua leitura;
6. encerra o processo Next.js;
7. inicia a aplicação novamente usando o mesmo arquivo SQLite;
8. confirma que a intervenção ainda existe;
9. confirma que o feedback passou a considerar o insight como acompanhado;
10. valida `404` para insight inexistente e `422` para contrato inválido.

Assim, o teste diferencia persistência real de um simples estado mantido em memória.

## Limite atual de deployment

SQLite exige um filesystem persistente. O default local é adequado para desenvolvimento, demo e deploy em VM/container com volume persistente.

Em ambientes serverless com filesystem efêmero, o adapter `InterventionStore` deve ser substituído por um backend persistente como PostgreSQL/Supabase/Turso. O motor `feedbackLoop.ts` não precisa mudar, pois ele depende de `InterventionRecord`, não do banco específico.

## Guardrails

- registrar uma ação não confirma que ela causou a melhora;
- o feedback mede associação temporal e convergência;
- nenhuma conclusão disciplinar é automática;
- operador é contexto secundário, não variável única;
- notas persistidas devem registrar o que foi efetivamente realizado;
- a recomendação do motor continua sujeita à validação humana.
