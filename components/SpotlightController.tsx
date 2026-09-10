"use client";

import { useEffect } from "react";

const SPOTLIGHT_SELECTOR = [
  ".kpiCard",
  ".insightCard",
  ".detailCard",
  ".aiConclusion",
  ".coachCard",
  ".impactCard",
  ".privacyCard"
].join(",");

export function SpotlightController() {
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduceMotion.matches) return;

    const handlePointerMove = (event: PointerEvent) => {
      const origin = event.target instanceof Element ? event.target : null;
      const target = origin?.closest(SPOTLIGHT_SELECTOR) as HTMLElement | null;
      if (!target) return;

      const rect = target.getBoundingClientRect();
      target.style.setProperty("--spot-x", `${event.clientX - rect.left}px`);
      target.style.setProperty("--spot-y", `${event.clientY - rect.top}px`);
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, []);

  return null;
}
