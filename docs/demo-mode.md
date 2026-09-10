# Demo Mode — roteiro de apresentação

O **Demo Mode** transforma o dashboard em uma demonstração guiada para banca, mentoria ou validação com usuários.

## Como iniciar

Execute o projeto em modo de produção:

```bash
npm install
npm run build
npm run start
```

Abra:

```text
http://localhost:3000
```

Clique no botão flutuante **Iniciar demonstração**.

Também é possível iniciar automaticamente com:

```text
http://localhost:3000/?demo=1
```

## Controles

- `Próximo` ou seta `→`: avança;
- `Anterior` ou seta `←`: volta;
- `Espaço`: avança;
- `Esc`: encerra;
- botão de tela cheia: solicita fullscreen ao navegador.

Cada passo seleciona o contexto necessário, rola suavemente a página e destaca a área que deve ser apresentada.

## Sequência guiada

### Abertura — problema e visão geral

Área destacada: KPIs.

Mensagem principal:

> Máquinas conectadas já geram muitos dados. O problema é transformar telemetria em prioridade, evidência e ação.

### 1 — Detectar

O tour seleciona automaticamente **FLT-017 / OP-042**.

Mensagem principal:

> O sistema compara a máquina com seu próprio histórico em um turno comparável e detecta um padrão de ineficiência fora do baseline.

### 2 — Explicar

Área destacada: explicação do copiloto.

Mensagem principal:

> A IA generativa não detecta a anomalia; ela recebe evidências estruturadas e as traduz. Sem chave/API, o fallback determinístico preserva a demo.

### 3 — Provar

Área destacada: z-score.

Mensagem principal:

> O z-score mostra quais variáveis saíram do comportamento esperado e quanto desviaram.

### 4 — Confirmar

Área destacada: Isolation Forest.

Mensagem principal:

> O segundo modelo verifica se a combinação multivariada também é incomum. Concordância aumenta evidência, não prova causalidade.

### 5 — Medir

Área destacada: feedback pós-recomendação da FLT-017.

Mensagem principal:

> Depois da intervenção, o sistema acompanha os turnos seguintes e mede convergência ao baseline.

Na fixture atual, a FLT-017 demonstra 3 turnos pós-ação e forte convergência ao baseline. Os números são sintéticos e devem ser apresentados como prova de conceito, não como resultado de uma operação real.

### 6 — Agir ao vivo

O tour seleciona automaticamente **FLT-023** e abre o formulário de intervenção.

Revise os campos e clique em **Salvar e acompanhar**.

Mensagem principal:

> A ação foi registrada pelo gestor, persistida em SQLite e passa a alimentar o acompanhamento. Se ainda não houver dados suficientes, o sistema assume explicitamente que está aguardando novos turnos.

O passo suporta repetição: se a FLT-023 já tiver uma intervenção registrada, o tour abre **Registrar nova ação**.

### Fechamento

Mensagem principal:

> A máquina gera os dados. A IA encontra o padrão. O ser humano decide.

Explique que CSV, Konecranes e futuras fontes entram por adapters e chegam ao mesmo contrato normalizado antes do motor analítico.

## Checklist antes da banca

1. usar Node 22;
2. atualizar a `main`;
3. executar `npm install`, `npm run build` e `npm run start`;
4. abrir o dashboard e percorrer o Demo Mode uma vez;
5. validar que FLT-017 e FLT-023 aparecem;
6. confirmar que o banco `.data/tech4change.sqlite` é gravável;
7. preferir apresentar com o notebook conectado à energia;
8. não depender da IA generativa: o fallback determinístico é parte do desenho do MVP;
9. deixar o GitHub Actions verde aberto em uma aba separada para perguntas técnicas.

## Guardrails da demonstração

- dataset e resultados apresentados são sintéticos;
- o contrato Konecranes é mock de demonstração, não payload proprietário oficial;
- associação temporal após uma ação não prova causalidade;
- nenhuma decisão disciplinar ou técnica crítica é automática;
- o Demo Mode somente conduz a interface; não altera o motor analítico nem cria resultados artificiais.
