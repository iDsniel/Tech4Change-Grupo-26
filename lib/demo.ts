export const sampleProcedure = `PROCEDIMENTO DEMO — INSPEÇÃO DE BOMBA CENTRÍFUGA\n\nObjetivo: orientar uma inspeção visual básica em ambiente de demonstração.\n\n1. Identificação: confirme o código do equipamento e a ordem de serviço.\n2. Condição inicial: observe vazamentos aparentes, ruídos anormais e sinais visíveis de aquecimento.\n3. Área externa: verifique integridade visual da carcaça e conexões acessíveis.\n4. Registro: fotografe qualquer anomalia visível e descreva o que foi observado.\n5. Escalonamento: se houver condição não prevista neste procedimento, interrompa a orientação automática e acione o responsável técnico.\n\nEste procedimento é apenas demonstrativo. A aplicação não substitui procedimentos oficiais, bloqueios, EPIs, normas técnicas ou autorização de trabalho.`;

export function demoAnswer(question: string, manual: string) {
  const q = question.toLowerCase();
  if (q.includes("vazamento")) {
    return "O procedimento orienta observar vazamentos aparentes na condição inicial. Registre uma foto e descreva a anomalia. Se a condição não estiver prevista no procedimento oficial, escale ao responsável técnico.";
  }
  if (q.includes("primeiro") || q.includes("começar") || q.includes("inicio")) {
    return "Comece confirmando o código do equipamento e a ordem de serviço. Depois faça a observação inicial de vazamentos, ruídos anormais e sinais visíveis de aquecimento.";
  }
  if (q.includes("foto") || q.includes("registr")) {
    return "Registre por foto qualquer anomalia visível e complemente com uma descrição objetiva do que foi observado.";
  }
  return `Com base no procedimento carregado, eu consigo orientar apenas o que estiver documentado. Para esta pergunta, revise o trecho mais próximo do procedimento e, se não houver instrução explícita, escale ao responsável técnico.\n\nProcedimento ativo: ${manual.slice(0, 180)}…`;
}
