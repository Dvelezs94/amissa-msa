"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import {
  WORKFLOW_STATUSES,
  WORKFLOW_TRIGGER_TYPES,
  defaultWorkflowAction,
  workflowTriggerHint,
  workflowTriggerLabel,
  type ParsedWorkflowDefinition,
  type WorkflowActionConfig,
  type WorkflowTriggerType,
} from "@/lib/workflows";
import { WORKFLOW_STATUS_LABELS } from "@/lib/workflow-canvas";
import {
  WORKFLOW_WIZARD_STEPS,
  workflowWizardAdvanceError,
  workflowWizardNextStep,
  workflowWizardPrevStep,
  workflowWizardStepIndex,
  workflowWizardStepLabel,
  type WorkflowWizardStep,
} from "@/lib/workflow-wizard";
import { WorkflowActionFields } from "./WorkflowActionFields";

type UserOption = { id: string; name: string };

const FIELD =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";
const LABEL = "text-xs font-medium text-zinc-600";

export function WorkflowForm({
  workflowId,
  initial,
  users,
  smtpConfigured,
  telegramConfigured,
}: {
  workflowId?: string;
  initial?: ParsedWorkflowDefinition;
  users: UserOption[];
  smtpConfigured: boolean;
  telegramConfigured: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<WorkflowWizardStep>("basics");
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [triggerType, setTriggerType] = useState<WorkflowTriggerType>(
    initial?.triggerType ?? "work_order.completed"
  );
  const [toStatus, setToStatus] = useState(
    initial?.triggerConfig.toStatus ?? ""
  );
  const [actions, setActions] = useState<WorkflowActionConfig[]>(
    initial?.actions?.length ? initial.actions : [defaultWorkflowAction("notify")]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAction(index: number, patch: Partial<WorkflowActionConfig>) {
    setActions((prev) =>
      prev.map((action, i) => (i === index ? { ...action, ...patch } : action))
    );
  }

  function goNext() {
    const advanceError = workflowWizardAdvanceError(step, { name, actions });
    if (advanceError) {
      setError(advanceError);
      return;
    }
    const next = workflowWizardNextStep(step);
    if (!next) return;
    setError(null);
    setStep(next);
  }

  function goBack() {
    const prev = workflowWizardPrevStep(step);
    if (!prev) return;
    setError(null);
    setStep(prev);
  }

  async function onSave() {
    const advanceError = workflowWizardAdvanceError("actions", { name, actions });
    if (advanceError) {
      setError(advanceError);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        name,
        description,
        enabled,
        triggerType,
        triggerConfig:
          triggerType === "work_order.status_changed" && toStatus
            ? { toStatus }
            : {},
        actions,
      };
      const res = await fetch(
        workflowId ? `/api/workflows/${workflowId}` : "/api/workflows",
        {
          method: workflowId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Error al guardar");
        return;
      }
      const id =
        typeof data.id === "string" ? data.id : workflowId;
      router.push(id ? `/flujos/${id}` : "/flujos");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const cancelHref = workflowId ? `/flujos/${workflowId}` : "/flujos";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4">
      <ol className="flex items-center gap-2">
        {WORKFLOW_WIZARD_STEPS.map((item, index) => {
          const current = workflowWizardStepIndex(step);
          const done = index < current;
          const active = item === step;
          return (
            <li key={item} className="flex min-w-0 flex-1 items-center gap-2">
              <button
                type="button"
                disabled={index > current}
                onClick={() => {
                  if (index < current) {
                    setError(null);
                    setStep(item);
                  }
                }}
                className={`flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 text-left ${
                  index < current ? "hover:bg-zinc-100" : ""
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                    active
                      ? "bg-accent-500 text-white"
                      : done
                        ? "bg-primary-600 text-white"
                        : "bg-zinc-200 text-zinc-600"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`truncate text-sm font-medium ${
                    active ? "text-zinc-900" : "text-zinc-500"
                  }`}
                >
                  {workflowWizardStepLabel(item)}
                </span>
              </button>
              {index < WORKFLOW_WIZARD_STEPS.length - 1 ? (
                <span className="h-px min-w-4 flex-1 bg-zinc-300" aria-hidden />
              ) : null}
            </li>
          );
        })}
      </ol>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {step === "basics" ? (
        <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">
            Cómo se llama este flujo y si debe quedar activo al guardarlo.
          </p>
          <div className="space-y-1">
            <label className={LABEL} htmlFor="wf-name">
              Nombre
            </label>
            <input
              id="wf-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={FIELD}
              placeholder="Ej. Avisar al completar una tarea"
            />
          </div>
          <div className="space-y-1">
            <label className={LABEL} htmlFor="wf-desc">
              Descripción (opcional)
            </label>
            <textarea
              id="wf-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className={FIELD}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-800">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-primary-600"
            />
            Flujo activo
          </label>
        </section>
      ) : null}

      {step === "trigger" ? (
        <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-zinc-500">
            Elige el evento que dispara el flujo.
          </p>
          <div className="space-y-1">
            <label className={LABEL} htmlFor="wf-trigger">
              Evento
            </label>
            <select
              id="wf-trigger"
              value={triggerType}
              onChange={(e) =>
                setTriggerType(e.target.value as WorkflowTriggerType)
              }
              className={FIELD}
            >
              {WORKFLOW_TRIGGER_TYPES.map((type) => (
                <option key={type} value={type}>
                  {workflowTriggerLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <p className="text-xs text-zinc-500">
            {workflowTriggerHint(triggerType)}
          </p>
          {triggerType === "work_order.status_changed" ? (
            <div className="space-y-1">
              <label className={LABEL} htmlFor="wf-status">
                Solo si el nuevo estado es
              </label>
              <select
                id="wf-status"
                value={toStatus}
                onChange={(e) => setToStatus(e.target.value)}
                className={FIELD}
              >
                <option value="">Cualquier estado</option>
                {WORKFLOW_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {WORKFLOW_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </section>
      ) : null}

      {step === "actions" ? (
        <section className="space-y-3">
          <p className="text-sm text-zinc-500">
            Qué debe hacer MSA cuando ocurra ese evento. Puedes añadir varias
            acciones.
          </p>
          {actions.map((action, index) => (
            <WorkflowActionFields
              key={index}
              action={action}
              index={index}
              canRemove={actions.length > 1}
              users={users}
              smtpConfigured={smtpConfigured}
              telegramConfigured={telegramConfigured}
              triggerType={triggerType}
              onPatch={updateAction}
              onType={(i, type) => {
                const current = actions[i];
                updateAction(i, {
                  ...defaultWorkflowAction(type),
                  recipientKind: current?.recipientKind ?? "assignees",
                  userIds: current?.userIds ?? [],
                  role: current?.role ?? null,
                  emails: current?.emails ?? [],
                  telegramChatId: current?.telegramChatId ?? null,
                  excludeActor: current?.excludeActor ?? true,
                });
              }}
              onRemove={(i) =>
                setActions((prev) => prev.filter((_, idx) => idx !== i))
              }
            />
          ))}
          {actions.length < 20 ? (
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["notify", "Notificación"],
                  ["email", "Email"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() =>
                    setActions((prev) => [...prev, defaultWorkflowAction(type)])
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {workflowWizardPrevStep(step) ? (
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Atrás
          </button>
        ) : null}
        {workflowWizardNextStep(step) ? (
          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Siguiente
          </button>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={() => void onSave()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving ? "Guardando…" : workflowId ? "Guardar flujo" : "Crear flujo"}
          </button>
        )}
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
