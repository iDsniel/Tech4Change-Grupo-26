"use client";

import { useMemo, useState } from "react";
import { CalendarRange, ChevronDown, RotateCcw } from "lucide-react";

type Props = {
  min: string;
  max: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
};

const iso = (date: Date) => date.toISOString().slice(0, 10);
const clamp = (value: string, min: string, max: string) => value < min ? min : value > max ? max : value;

function addDays(value: string, amount: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return iso(date);
}

function label(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function monthPresets(min: string, max: string) {
  const start = new Date(`${min.slice(0, 7)}-01T12:00:00`);
  const end = new Date(`${max.slice(0, 7)}-01T12:00:00`);
  const presets: Array<{ label: string; from: string; to: string }> = [];
  const cursor = new Date(start);
  while (cursor <= end && presets.length < 12) {
    const from = clamp(iso(cursor), min, max);
    const next = new Date(cursor);
    next.setMonth(next.getMonth() + 1);
    next.setDate(0);
    const to = clamp(iso(next), min, max);
    presets.push({
      label: new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(cursor),
      from,
      to
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return presets;
}

export default function PeriodPicker({ min, max, from, to, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const months = useMemo(() => monthPresets(min, max), [min, max]);

  const presets = [
    { label: "Últimos 7 dias", from: clamp(addDays(to, -6), min, max), to },
    { label: "Últimos 30 dias", from: clamp(addDays(to, -29), min, max), to },
    ...months,
    { label: "Período completo", from: min, to: max }
  ];

  return <div className="periodPicker">
    <button className="periodTrigger" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
      <CalendarRange size={17} />
      <span><small>Período</small><strong>{label(from)} — {label(to)}</strong></span>
      <ChevronDown size={16} />
    </button>

    {open && <div className="periodPopover" role="dialog" aria-label="Selecionar período">
      <div className="periodInputs">
        <label>De<input type="date" min={min} max={max} value={from} onChange={(event) => onChange(event.target.value, event.target.value > to ? event.target.value : to)} /></label>
        <label>Até<input type="date" min={min} max={max} value={to} onChange={(event) => onChange(event.target.value < from ? event.target.value : from, event.target.value)} /></label>
      </div>
      <div className="periodPresets">
        {presets.map((preset) => <button type="button" key={`${preset.label}-${preset.from}`} onClick={() => { onChange(preset.from, preset.to); setOpen(false); }}>{preset.label}</button>)}
      </div>
      <button className="periodReset" type="button" onClick={() => { onChange(min, max); setOpen(false); }}><RotateCcw size={14} /> Restaurar período completo</button>
    </div>}
  </div>;
}
