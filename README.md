# MãoLivre AI — Tech4Change Grupo 26

MVP de um copiloto multimodal para profissionais de campo. O profissional consulta um procedimento técnico por texto/voz, pode anexar uma foto como contexto e gera um resumo do atendimento ao final.

## Problema demonstrado

Profissionais de campo interrompem atividades para procurar informação em manuais, PDFs ou sistemas, ou dependem de alguém mais experiente. O MVP testa se uma interface conversacional contextual reduz essa fricção sem retirar a decisão do profissional.

## Escopo do MVP

### Must have
- Procedimento textual carregável (.txt, .md, .csv, .json)
- Pergunta em linguagem natural
- Resposta restrita ao procedimento carregado
- Modo demonstração sem chave de API

### Should have
- Entrada por voz via Web Speech API
- Foto como contexto multimodal
- Relatório do atendimento

### Fora deste MVP
- Vídeo contínuo
- Realidade aumentada
- Integração com ERP/CMMS
- Garantia automática de conformidade ou segurança
- Tomada de decisão autônoma

## Executar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Abra http://localhost:3000.

Sem `OPENAI_API_KEY`, o app funciona em **modo demonstração** com respostas determinísticas para o procedimento de exemplo.

Com chave:

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
```

## Roteiro de demo (2–3 min)

1. Abrir o app e mostrar o procedimento demo carregado.
2. Perguntar: **“Qual é o primeiro passo?”**
3. Usar o microfone para perguntar: **“O que faço se encontrar vazamento?”**
4. Anexar uma foto qualquer como demonstração de contexto multimodal.
5. Fazer mais uma pergunta.
6. Clicar em **Gerar relatório do atendimento**.
7. Destacar o guardrail: quando o procedimento não sustenta uma resposta, a IA deve escalar ao responsável técnico.

## Segurança por design

Este MVP não substitui procedimentos oficiais, bloqueios, EPIs, normas técnicas, autorização de trabalho ou responsabilidade profissional. O prompt da IA proíbe inventar valores, parâmetros e etapas ausentes do procedimento.

## Próximo experimento

Validar com técnicos de manutenção/suporte:
- frequência com que interrompem a atividade para buscar informação;
- tempo perdido procurando procedimentos;
- dependência de profissionais mais experientes;
- aceitabilidade de voz/foto em campo;
- confiança quando a resposta mostra a origem no procedimento.
