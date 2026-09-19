"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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

function findButton(text: string) {
  return buttons().find((item) => item.textContent?.includes(text));
}

function clickButton(text: string) {
  findButton(text)?.click();
}

function assetRow(assetId: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(".demoFleetGrid tbody tr")).find((item) => item.textContent?.includes(assetId)) ?? null;
}

function selectAsset(assetId: string) {
  clickButton("Visão geral");
  window.setTimeout(() => {
    const row = assetRow(assetId);
    row?.click();
  }, 100);
}

function selectAssist(label: string) {
  window.setTimeout(() => clickButton(label), 180);
}

function openInvestigation(assetId: string) {
  selectAsset(assetId);
  window.setTimeout(() => clickButton("Investigar"), 200);
  window.setTimeout(() => {
    const item = Array.from(document.querySelectorAll<HTMLButtonElement>(".demoInsightQueue button")).find((button) => button.textContent?.includes(assetId));
    item?.click();
  }, 420);
}

function openTechnical() {
  const details = document.querySelector<HTMLDetailsElement>(".technicalDetails");
  if (details) details.open = true;
}

export function DemoMode() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo<DemoStep[]>(() => [
    {
      kicker: "ABERTURA",
      title: "Mesmo Pulso, outra fonte de telemetria",
      narration: "A demo agora cobre seis meses. Março a julho formam o baseline do mesmo ativo e turno; agosto fica como holdout. Cada ciclo produtivo leva dois fardos de 2 t, portanto 4 t, e os dados sintéticos separam telemetria OEM-like da camada de processo do Pulso.",
      prepare: () => clickButton("Visão geral"),
      target: () => document.querySelector<HTMLElement>(".demoAssumptionBar")
    },
    {
      kicker: "1 · NEGÓCIO",
      title: "O Pulso aprende o ciclo, não só a tonelagem",
      narration: "Selecione a KLT-03. O Pulso transforma toneladas em ciclos e fardos e decompõe o processo em aproximação vazia, coleta, transferência carregada e depósito. Isso permite localizar qual etapa mudou, não apenas dizer que produziu menos.",
      prepare: () => { selectAsset("KLT-03"); selectAssist("Produtividade"); },
      target: () => document.querySelector<HTMLElement>(".copilotReading")
    },
    {
      kicker: "2 · DETECTAR",
      title: "Atividade abaixo do histórico comparável",
      narration: "O motor compara agosto com cinco meses de baseline robusto do mesmo ativo e turno. Na KLT-03, a queda de t/h vem junto de um ciclo mais longo e o motor identifica a aproximação vazia como a maior deterioração.",
      prepare: () => openInvestigation("KLT-03"),
      target: () => document.querySelector<HTMLElement>(".demoInsightDetail")
    },
    {
      kicker: "3 · AUDITAR",
      title: "Evidência técnica continua disponível",
      narration: "A camada principal usa linguagem operacional. Em detalhes técnicos, mediana + MAD e Isolation Forest permanecem auditáveis para explicar por que aquele contexto foi priorizado sem deixar anomalias antigas contaminarem demais o baseline.",
      prepare: () => { openInvestigation("KLT-03"); window.setTimeout(openTechnical, 520); },
      target: () => document.querySelector<HTMLElement>(".technicalDetails")
    },
    {
      kicker: "4 · SEGURANÇA",
      title: "Velocidade, impactos e contexto da rota",
      narration: "Na KLT-04, a demo combina traveling speed, faixa alta e shock sensors. Frente/ré não aparece porque a referência pública usada não lista essa dimensão para TRUCONNECT lift trucks — o Pulso não inventa dado para preencher a tela.",
      prepare: () => { selectAsset("KLT-04"); selectAssist("Segurança"); },
      target: () => document.querySelector<HTMLElement>(".copilotReading")
    },
    {
      kicker: "5 · MANUTENÇÃO",
      title: "Parada vira impacto operacional, não chute financeiro",
      narration: "Na KLT-05, o Pulso usa o baseline de t/h para estimar capacidade temporariamente indisponível, verifica quanto as outras máquinas absorveram e mostra o impacto residual em toneladas. Sem R$/t válido, ele não inventa custo em dinheiro.",
      prepare: () => { selectAsset("KLT-05"); selectAssist("Manutenção"); },
      target: () => document.querySelector<HTMLElement>(".copilotReading")
    },
    {
      kicker: "6 · MULTI-OEM",
      title: "A interface não depende de uma métrica específica",
      narration: "Abra Fonte e capacidades. No Hyster usamos função hidráulica, marcha e outros indicadores disponíveis. Na Konecranes a demo prioriza load lifted, running modes, fuel, speed, shocks e maintenance counter. A arquitetura é a mesma; o adaptador muda.",
      prepare: () => clickButton("Base"),
      target: () => document.querySelector<HTMLElement>(".demoSource")
    },
    {
      kicker: "FECHAMENTO",
      title: "A máquina gera dados. O Pulso cria contexto. O humano decide.",
      narration: "O diferencial não é replicar o portal do fabricante. É normalizar sinais diferentes, detectar mudanças, relacionar telemetria ao processo e traduzir tudo em uma próxima verificação compreensível e auditável.",
      prepare: () => { clickButton("Visão geral"); selectAsset("KLT-03"); },
      target: () => document.querySelector<HTMLElement>(".operationsCopilotSplit")
    }
  ], []);

  const step = steps[stepIndex];

  const focusStep = useCallback((index: number) => {
    const next = steps[index];
    if (!next) return;

    document.querySelectorAll(".demoFocus").forEach((node) => node.classList.remove("demoFocus"));
    next.prepare?.();

    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      const target = next.target();
      if (target) {
        window.clearInterval(timer);
        document.querySelectorAll(".demoFocus").forEach((node) => node.classList.remove("demoFocus"));
        target.classList.add("demoFocus");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (attempts >= 24) {
        window.clearInterval(timer);
      }
    }, 140);
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
    if (pathname === "/" && params.get("demo") === "1") start();
  }, [start, pathname]);

  if (pathname === "/hyster") return null;

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
          <button title="Tela cheia" onClick={() => document.documentElement.requestFullscreen?.().catch(() => undefined)}><Maximize2 size={15} /></button>
          <button title="Encerrar demonstração" onClick={stop}><X size={16} /></button>
        </div>
      </div>

      <div className="demoProgress" aria-label={`Passo ${stepIndex + 1} de ${steps.length}`}>
        {steps.map((_, index) => <span key={index} className={index <= stepIndex ? "active" : ""} />)}
      </div>

      <div className="demoCopy">
        <span>{step.kicker} · {stepIndex + 1}/{steps.length}</span>
        <h3>{step.title}</h3>
        <p>{step.narration}</p>
      </div>

      <div className="demoNav">
        <button onClick={() => go(stepIndex - 1)} disabled={stepIndex === 0}><ChevronLeft size={16} /> Anterior</button>
        {stepIndex < steps.length - 1
          ? <button className="primary" onClick={() => go(stepIndex + 1)}>Próximo <ChevronRight size={16} /></button>
          : <button className="primary" onClick={stop}>Finalizar</button>}
      </div>
      <small>Atalhos: ← → · espaço · Esc</small>
    </aside>
  );
}
