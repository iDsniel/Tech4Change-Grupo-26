"use client";

import type { ReactNode } from "react";
import {
  Activity,
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Database,
  Sparkles
} from "lucide-react";

export type PulsoViewKey = "overview" | "investigate" | "actions" | "base";

type Props = {
  view: PulsoViewKey;
  onChange: (view: PulsoViewKey) => void;
  attentionCount?: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
};

const items: Array<{ key: PulsoViewKey; label: string; icon: ReactNode }> = [
  { key: "overview", label: "Visão geral", icon: <Activity size={18} /> },
  { key: "investigate", label: "Investigar", icon: <BrainCircuit size={18} /> },
  { key: "actions", label: "Ações", icon: <ClipboardList size={18} /> },
  { key: "base", label: "Base", icon: <Database size={18} /> }
];

export default function PulsoSidebar({ view, onChange, attentionCount = 0, collapsed, onToggleCollapsed }: Props) {
  return <aside className={`pulsoSidebar ${collapsed ? "collapsed" : ""}`} aria-label="Navegação principal">
    <div className="sidebarBrand">
      <div className="pulsoMark"><Sparkles size={19} /></div>
      {!collapsed && <div><strong>Pulso</strong><span>Copiloto Operacional AI</span></div>}
    </div>

    <nav className="sidebarNav">
      {items.map((item) => <button
        key={item.key}
        type="button"
        aria-current={view === item.key ? "page" : undefined}
        aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined}
        className={view === item.key ? "active" : ""}
        onClick={() => onChange(item.key)}
      >
        <span className="sidebarIcon">{item.icon}</span>
        {!collapsed && <span>{item.label}</span>}
        {item.key === "investigate" && attentionCount > 0 && <em>{attentionCount}</em>}
      </button>)}
    </nav>

    <button className="sidebarCollapse" type="button" onClick={onToggleCollapsed} aria-label={collapsed ? "Expandir navegação" : "Recolher navegação"}>
      {collapsed ? <ChevronRight size={17} /> : <><ChevronLeft size={17} /><span>Recolher</span></>}
    </button>
  </aside>;
}
