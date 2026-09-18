"use client";

import { useRef, useState, type CSSProperties, type ReactNode } from "react";
import { GripVertical } from "lucide-react";

type Props = {
  left: ReactNode;
  right: ReactNode;
  initialLeft?: number;
  minLeft?: number;
  maxLeft?: number;
  className?: string;
};

export default function ResizableSplit({ left, right, initialLeft = 64, minLeft = 48, maxLeft = 74, className = "" }: Props) {
  const [leftWidth, setLeftWidth] = useState(initialLeft);
  const rootRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  function update(clientX: number) {
    const root = rootRef.current;
    if (!root) return;
    const rect = root.getBoundingClientRect();
    const next = ((clientX - rect.left) / rect.width) * 100;
    setLeftWidth(Math.min(maxLeft, Math.max(minLeft, next)));
  }

  return <div
    ref={rootRef}
    className={`resizableSplit ${className}`}
    style={{ "--split-left": `${leftWidth}%` } as CSSProperties}
  >
    <div className="resizablePane">{left}</div>
    <button
      type="button"
      className="resizableHandle"
      aria-label="Redimensionar painéis"
      onPointerDown={(event) => {
        dragging.current = true;
        event.currentTarget.setPointerCapture(event.pointerId);
        update(event.clientX);
      }}
      onPointerMove={(event) => {
        if (dragging.current) update(event.clientX);
      }}
      onPointerUp={(event) => {
        dragging.current = false;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => { dragging.current = false; }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") setLeftWidth((value) => Math.max(minLeft, value - 3));
        if (event.key === "ArrowRight") setLeftWidth((value) => Math.min(maxLeft, value + 3));
      }}
    >
      <GripVertical size={16} />
    </button>
    <div className="resizablePane">{right}</div>
  </div>;
}
