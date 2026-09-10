"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  PlusCircle,
  RefreshCw,
  Save,
  ShieldCheck,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import type { FeedbackAssessment, InterventionRecord } from "@/lib/feedbackLoop";
import type { InsightCategory } from "@/lib/telemetry";

type RegistrationContext = {
  category: InsightCategory;
  recommendedAction: string;
  suggestedAppliedAt: string;
  demoDateNote: string;
};

type FeedbackResponse = {
  schemaVersion: "telemetry-feedback-v1";
  tracked: boolean;
  message?: string;
  storage?: { engine: string; persistedInterventions: number };
  registration?: RegistrationContext;
  assessments?: FeedbackAssessment[];
};

type PersistResponse = {
  schemaVersion: "telemetry-intervention-v1";
  persisted: boolean;
  intervention: InterventionRecord;
};

const statusCopy = {
  improved: { label: "Convergindo ao baseline", icon: TrendingDown },
  stable: { label: "Ainda em acompanhamento", icon: Activity },
  worsened: { label: "Desvio aumentou", icon: TrendingUp },
  "insufficient-data": { label: "Aguardando mais turnos", icon: Clock3 },
  "not-applicable": { label: "Não aplicável", icon: ShieldCheck }
} as const;

const actionTypeByCategory: Record<InsightCategory, InterventionRecord["actionType"]> = {
  efficiency: "operator_coaching",
  safety: "safety_coaching",
  mechanical: "maintenance_action",
  maintenance: "maintenance_action"
};

const actionLabels: Record<InterventionRecord["actionType"], string> = {
  operator_coaching: "Orientação operacional",
  safety_coaching: "Orientação de segurança",
  load_procedure_review: "Revisão de procedimento de carga",
  maintenance_action: "Ação de manutenção",
  process_change: "Mudança de processo"
};

export function FeedbackLoop({ insightId }: { insightId: string }) {
  const [payload, setPayload] = useState<FeedbackResponse | null>(null);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [appliedAt, setAppliedAt] = useState("");
  const [actionType, setActionType] = useState<InterventionRecord["actionType"]>("process_change");
  const [actorRole, setActorRole] = useState("supervisor");
  const [targetTurns, setTargetTurns] = useState(3);
  const [note, setNote] = useState("");

  const loadFeedback = useCallback(async () => {
    setError("");
    try {
      const response = await fetch(`/api/telemetry/feedback?insightId=${encodeURIComponent(insightId)}`);
      const body = (await response.json()) as FeedbackResponse;
      if (!response.ok && response.status !== 404) throw new Error("Falha ao carregar acompanhamento");
      setPayload(body);
      if (body.registration) {
        setAppliedAt(body.registration.suggestedAppliedAt);
        setActionType(actionTypeByCategory[body.registration.category]);
        setNote(body.registration.recommendedAction);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar acompanhamento");
    }
  }, [insightId]);

  useEffect(() => {
    setPayload(null);
    setFormOpen(false);
    setSaveMessage("");
    setActorRole("supervisor");
    setTargetTurns(3);
    void loadFeedback();
  }, [insightId, loadFeedback]);

  const latest = useMemo(() => payload?.assessments?.[0], [payload]);

  async function saveIntervention(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveMessage("");
    setError("");

    try {
      const response = await fetch("/api/telemetry/interventions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ insightId, appliedAt, actionType, actorRole, targetTurns, note })
      });
      const body = await response.json() as PersistResponse & { message?: string; issues?: string[] };
      if (!response.ok) throw new Error(body.issues?.join(" · ") || body.message || "Não foi possível registrar a ação");
      setSaveMessage(`Ação ${body.intervention.id} persistida no SQLite.`);
      setFormOpen(false);
      await loadFeedback();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar a ação");
    } finally {
      setSaving(false);
    }
  }

  function registrationForm() {
    if (!formOpen) return null;
    return (
      <form onSubmit={saveIntervention} className="detailCard" style={{ marginTop: 14, display: "grid", gap: 12 }}>
        <div className="cardTitle"><Save size={17} /> Registrar ação realizada</div>
        <label style={{ display: "grid", gap: 5 }}>
          <small>Data da ação</small>
          <input type="date" value={appliedAt} onChange={(event) => setAppliedAt(event.target.value)} required />
        </label>
        <label style={{ display: "grid", gap: 5 }}>
          <small>Tipo de ação</small>
          <select value={actionType} onChange={(event) => setActionType(event.target.value as InterventionRecord["actionType"])}>
            {Object.entries(actionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 5 }}>
            <small>Responsável / papel</small>
            <input value={actorRole} onChange={(event) => setActorRole(event.target.value)} maxLength={60} required />
          </label>
          <label style={{ display: "grid", gap: 5 }}>
            <small>Turnos para acompanhar</small>
            <input type="number" min={1} max={10} value={targetTurns} onChange={(event) => setTargetTurns(Number(event.target.value))} required />
          </label>
        </div>
        <label style={{ display: "grid", gap: 5 }}>
          <small>O que foi realizado</small>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={600} required />
        </label>
        {payload?.registration?.demoDateNote && <small>{payload.registration.demoDateNote} Em produção, use a data real.</small>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="submit" className="active" disabled={saving}>{saving ? "Salvando…" : "Salvar e acompanhar"}</button>
          <button type="button" onClick={() => setFormOpen(false)}>Cancelar</button>
        </div>
      </form>
    );
  }

  if (error && !payload) {
    return (
      <article className="aiConclusion">
        <div className="aiTitle"><RefreshCw size={20} /> <strong>Feedback pós-recomendação</strong></div>
        <p>{error}</p>
      </article>
    );
  }

  if (!payload) {
    return (
      <article className="aiConclusion">
        <div className="aiTitle"><RefreshCw size={20} className="pulse" /> <strong>Feedback pós-recomendação</strong></div>
        <p>Consultando ações persistidas e comparando os próximos turnos com o baseline original…</p>
      </article>
    );
  }

  if (!payload.tracked || !latest) {
    return (
      <article className="aiConclusion">
        <div className="aiTitle"><Clock3 size={20} /> <strong>Feedback pós-recomendação</strong></div>
        <p>{payload.message ?? "Ainda não existe uma intervenção registrada para este insight."}</p>
        <small><Database size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />SQLite ativo · o acompanhamento começa depois que uma ação é registrada.</small>
        {error && <p>{error}</p>}
        {saveMessage && <p>{saveMessage}</p>}
        {!formOpen && payload.registration && <button style={{ marginTop: 12 }} onClick={() => setFormOpen(true)}><PlusCircle size={15} /> Registrar ação realizada</button>}
        {registrationForm()}
      </article>
    );
  }

  const status = statusCopy[latest.status];
  const StatusIcon = status.icon;

  return (
    <article className="aiConclusion">
      <div className="aiTitle"><StatusIcon size={20} /> <strong>Feedback pós-recomendação · {status.label}</strong></div>
      <p>{latest.interpretation}</p>

      <div className="detailGrid" style={{ marginTop: 14 }}>
        <div className="detailCard">
          <div className="cardTitle"><CheckCircle2 size={17} /> Ação persistida</div>
          <p>{latest.intervention.note}</p>
          <small>{latest.intervention.appliedAt} · {latest.intervention.actorRole} · {latest.intervention.actionType}</small>
        </div>

        <div className="detailCard">
          <div className="cardTitle"><Gauge size={17} /> Resultado observado</div>
          <p>
            {latest.convergence.improvementPct !== undefined
              ? `${latest.convergence.improvementPct}% de convergência média ao baseline.`
              : "Ainda sem dados suficientes para calcular convergência."}
          </p>
          <small>
            {latest.context.observedTurns}/{latest.context.targetTurns} turno(s) ·
            {latest.context.shift ? ` turno ${latest.context.shift} ·` : ""}
            {latest.context.period ? ` ${latest.context.period}` : " aguardando novos dados"}
          </small>
        </div>
      </div>

      {latest.convergence.metrics.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {latest.convergence.metrics.map((metric) => (
            <div key={metric.metric} style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr 1fr", gap: 10, padding: "8px 0", borderBottom: "1px solid rgba(148,163,184,.18)" }}>
              <strong>{metric.label}</strong>
              <span>antes {metric.beforeValue} {metric.unit}</span>
              <span>depois {metric.afterMean} {metric.unit}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p>{error}</p>}
      {saveMessage && <p>{saveMessage}</p>}
      {!formOpen && payload.registration && <button style={{ marginTop: 12 }} onClick={() => setFormOpen(true)}><PlusCircle size={15} /> Registrar nova ação</button>}
      {registrationForm()}

      <small style={{ display: "block", marginTop: 12 }}>
        <ShieldCheck size={14} style={{ verticalAlign: "-2px", marginRight: 5 }} />
        Persistência: {payload.storage?.engine ?? "sqlite"}. Comparação principal: mesmo ativo + mesmo turno. Operador é referência secundária ({latest.context.sameOperatorTurns} turno(s) com o mesmo operador). Associação temporal não prova causalidade.
      </small>
    </article>
  );
}
