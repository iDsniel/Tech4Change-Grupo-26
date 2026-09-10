"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Maximize2, Play, Presentation, X } from "lucide-react";

type DemoStep = {
  title: string;
  kicker: string;
  narration: string;
  target: () => HTMLElement | null;
  prepare?: () => void;
};

function buttons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button"));
}

function clickButton(text: string) {
  const button = buttons().find((item) => item.textContent?.includes(text));
  button?.click();
}

function insightCard(assetId: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(".insightCard")).find((item) => item.textContent?.includes(assetId)) ?? null;
}

function articleContaining(text: string) {
  return Array.from(document.querySelectorAll<HTMLElement>("article")).find((item) => item.textContent?.includes(text)) ?? null;
}

function manager() {
  clickButton("Gestor");
}

function selectInsight(assetId: string) {
  manager();
  clickButton("Todos");
  window.setTimeout(() => insightCard(assetId)?.click(), 80);
}

export function DemoMode() {
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo<DemoStep[]>(() => [
    {
      kicker: "ABERTURA",
      title: "Da telemetria à decisão humana",
      narration: "Comece pelo problema: máquinas conectadas já geram muitos dados. O diferencial do copiloto é transformar telemetria em prioridade, evidência e ação — sem automatizar a decisão final.",
      prepare: manager,
      target: () => document.querySelector<HTMLElement>(".kpiGrid")
    },
    {
      kicker: "1 · DETECTAR",
      title: "FLT-017: um desvio que merece atenção",
      narration: "Mostre que o sistema encontrou sozinho um padrão de ineficiência. A comparação é contextual: mesma máquina e mesmo turno, usando o histórico como baseline.",
      prepare: () => selectInsight("FLT-017"),
      target: () => document.querySelector<HTMLElement>(".detailHeader")
    },
    {
      kicker: "2 · EXPLICAR",
      title: "A IA traduz evidência, não inventa diagnóstico",
      narration: "A camada generativa recebe somente evidências estruturadas do motor. Se estiver offline, o fallback determinístico mantém a demonstração funcional.",
      prepare: () => selectInsight("FLT-017"),
      target: () => articleContaining("Copiloto · explicação das evidências") ?? articleContaining("Copiloto explicando as evidências")
    },
    {
      kicker: "3 · PROVAR",
      title: "Z-score: qual variável saiu do normal?",
      narration: "Explique que o z-score mede quanto consumo, idle e demais métricas se afastaram do comportamento histórico comparável. Ele torna a anomalia auditável.",
      prepare: () => selectInsight("FLT-017"),
      target: () => articleContaining("Leitura estatística explicável")
    },
    {
      kicker: "4 · CONFIRMAR",
      title: "Isolation Forest: a combinação inteira também é rara?",
      narration: "O segundo modelo olha o conjunto das variáveis. Quando as duas camadas concordam, a confiança aumenta — mas causalidade e decisão continuam humanas.",
      prepare: () => selectInsight("FLT-017"),
      target: () => articleContaining("2ª opinião · Isolation Forest")
    },
    {
      kicker: "5 · MEDIR",
      title: "Depois da ação, o sistema acompanha o resultado",
      narration: "Aqui está o fechamento do ciclo: a intervenção registrada é comparada aos próximos turnos. Na demo da FLT-017, os sinais convergem novamente para o baseline.",
      prepare: () => selectInsight("FLT-017"),
      target: () => articleContaining("Feedback pós-recomendação")
    },
    {
      kicker: "6 · AGIR AO VIVO",
      title: "Registre uma nova ação na FLT-023",
      narration: "Agora demonstre interação real: abra o formulário, registre a ação executada e salve. Ela fica persistida no SQLite e passa a alimentar o acompanhamento. Se ainda não houver turnos suficientes, o sistema informa que está aguardando dados em vez de inventar resultado.",
      prepare: () => selectInsight("FLT-023"),
      target: () => articleContaining("Feedback pós-recomendação")
    },
    {
      kicker: "FECHAMENTO",
      title: "A máquina gera dados. A IA encontra o padrão. O ser humano decide.",
      narration: "Feche reforçando que o MVP é independente de fabricante: diferentes fontes entram por adapters e chegam ao mesmo contrato normalizado. O valor está na camada de inteligência e no ciclo detectar → orientar → medir.",
      prepare: manager,
      target: () => document.querySelector<HTMLElement>(".dataFooter")
    }
  ], []);

  const step = steps[stepIndex];

  const focusStep = useCallback((index: number) => {
    const next = steps[index];
    if (!next) return;

    document.querySelectorAll(".demoFocus").forEach((node) => node.classList.remove("demoFocus"));
    next.prepare?.();

    window.setTimeout(() => {
      const target = next.target();
      if (!target) return;
      target.classList.add("demoFocus");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 260);
  }, [steps]);

  const start = useCallback(() => {
    setActive(true);
    setStepIndex(0);
    document.body.classList.add("demoActive");
    focusStep(0);
  }, [focusStep]);

  const stop = useCallback(() => {
    setActive(false);
    document.body.classList.remove("demoActive");
    document.querySelectorAll(".demoFocus").forEach((node) => node.classList.remove("demoFocus"));
  }, []);

  const go = useCallback((index: number) => {
    const bounded = Math.max(0, Math.min(steps.length - 1, index));
    setStepIndex(bounded);
    focusStep(bounded);
  }, [focusStep, steps.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!active) return;
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        go(stepIndex + 1);
      }
      if (event.key === "ArrowLeft") go(stepIndex - 1);
      if (event.key === "Escape") stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, go, stepIndex, stop]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1") start();
  }, [start]);

  if (!active) {
    return (
      <button className="demoLauncher" onClick={start} aria-label="Iniciar demonstração guiada">
        <Play size={16} fill="currentColor" />
        Iniciar demonstração
      </button>
    );
  }

  return (
    <aside className="demoPanel" aria-live="polite">
      <div className="demoPanelTop">
        <div className="demoModeBadge"><Presentation size={14} /> DEMO MODE</div>
        <div className="demoPanelActions">
          <button
            title="Tela cheia"
            onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}
          ><Maximize2 size={15} /></button>
          <button title="Encerrar demonstração" onClick={stop}><X size={16} /></button>
        </div>
      </div>

      <div className="demoProgress" aria-label={`Passo ${stepIndex + 1} de ${steps.length}`}>
        {steps.map((_, index) => (
          <span key={index} className={index <= stepIndex ? "active" : ""} />
        ))}
      </div>

      <div className="demoCopy">
        <span>{step.kicker} · {stepIndex + 1}/{steps.length}</span>
        <h3>{step.title}</h3>
        <p>{step.narration}</p>
      </div>

      <div className="demoNav">
        <button onClick={() => go(stepIndex - 1)} disabled={stepIndex === 0}>
          <ChevronLeft size={16} /> Anterior
        </button>
        {stepIndex < steps.length - 1 ? (
          <button className="primary" onClick={() => go(stepIndex + 1)}>
            Próximo <ChevronRight size={16} />
          </button>
        ) : (
          <button className="primary" onClick={stop}>Finalizar</button>
        )}
      </div>
      <small>Atalhos: ← → · espaço · Esc</small>
    </aside>
  );
}
