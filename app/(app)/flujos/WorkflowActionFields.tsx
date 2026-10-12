"use client";

import { useState } from "react";
import { FlaskConical, Trash2 } from "lucide-react";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import { AVAILABLE_USER_ROLES, type UserRole } from "@/lib/auth-shared";
import {
  recipientKindsForAction,
  WORKFLOW_ROLE_LABELS,
} from "@/lib/workflow-canvas";
import {
  WORKFLOW_ACTION_TYPES,
  WORKFLOW_TEMPLATE_HINT,
  workflowActionLabel,
  workflowRecipientLabel,
  type WorkflowActionConfig,
  type WorkflowActionType,
  type WorkflowRecipientKind,
  type WorkflowTriggerType,
} from "@/lib/workflows";
import { shouldShowWorkflowSmtpHint } from "@/lib/smtp-config";
import { shouldShowWorkflowTelegramHint } from "@/lib/telegram-config";
import { WorkflowTemplateField } from "./WorkflowTemplateField";

const FIELD =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500";
const LABEL = "text-xs font-medium text-zinc-600";

export function WorkflowActionFields({
  action,
  index,
  canRemove,
  users,
  smtpConfigured,
  telegramConfigured,
  triggerType,
  onPatch,
  onType,
  onRemove,
}: {
  action: WorkflowActionConfig;
  index: number;
  canRemove: boolean;
  users: { id: string; name: string }[];
  smtpConfigured: boolean;
  telegramConfigured: boolean;
  triggerType: WorkflowTriggerType;
  onPatch: (index: number, patch: Partial<WorkflowActionConfig>) => void;
  onType: (index: number, type: WorkflowActionType) => void;
  onRemove: (index: number) => void;
}) {
  const kinds = recipientKindsForAction(action.type);
  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  async function onTest() {
    setTesting(true);
    setTestMessage(null);
    setTestError(null);
    try {
      const res = await fetch("/api/workflows/test-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, triggerType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTestError(
          typeof data.error === "string" ? data.error : "No se pudo probar"
        );
        return;
      }
      setTestMessage(
        typeof data.message === "string"
          ? data.message
          : "Prueba enviada"
      );
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <select
          value={action.type}
          onChange={(e) => onType(index, e.target.value as WorkflowActionType)}
          className={FIELD}
          aria-label={`Tipo de acción ${index + 1}`}
        >
          {WORKFLOW_ACTION_TYPES.map((type) => (
            <option key={type} value={type}>
              {workflowActionLabel(type)}
            </option>
          ))}
        </select>
        {canRemove ? (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-red-50 hover:text-red-700"
            aria-label="Quitar acción"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {action.type === "email" &&
      shouldShowWorkflowSmtpHint({
        smtpConfigured,
        nodeEnv: process.env.NODE_ENV,
      }) ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          El envío de correo necesita SMTP_HOST y SMTP_FROM en el servidor. Sin
          eso, esta acción se omite.
        </p>
      ) : null}

      {action.type === "telegram" &&
      shouldShowWorkflowTelegramHint({
        telegramConfigured,
        nodeEnv: process.env.NODE_ENV,
      }) ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          El envío a Telegram necesita TELEGRAM_BOT_TOKEN en el servidor. Sin
          eso, esta acción se omite.
        </p>
      ) : null}

      {action.type === "telegram" ? (
        <div className="space-y-1">
          <label className={LABEL} htmlFor={`wf-telegram-${index}`}>
            Chat o canal (opcional)
          </label>
          <input
            id={`wf-telegram-${index}`}
            value={action.telegramChatId ?? ""}
            onChange={(e) =>
              onPatch(index, { telegramChatId: e.target.value.trim() || null })
            }
            placeholder="-1001234567890 o @canal"
            className={FIELD}
          />
          <p className="text-[11px] text-zinc-500">
            Si lo dejas vacío, se usa el chat por defecto del servidor.
          </p>
        </div>
      ) : (
      <>
      <div className="space-y-1">
        <label className={LABEL} htmlFor={`wf-recipients-${index}`}>
          Destinatarios
        </label>
        <select
          id={`wf-recipients-${index}`}
          value={action.recipientKind}
          onChange={(e) => {
            const recipientKind = e.target.value as WorkflowRecipientKind;
            onPatch(index, {
              recipientKind,
              role:
                recipientKind === "role"
                  ? action.role ?? "admin"
                  : action.role,
            });
          }}
          className={FIELD}
        >
          {kinds.map((kind) => (
            <option key={kind} value={kind}>
              {workflowRecipientLabel(kind)}
            </option>
          ))}
        </select>
      </div>

      {action.recipientKind === "users" ? (
        <AssigneeMultiSelect
          label="Personas"
          users={users}
          value={action.userIds}
          onChange={(userIds) => onPatch(index, { userIds })}
          emptyHint="Selecciona al menos una persona"
        />
      ) : null}

      {action.recipientKind === "role" ? (
        <select
          value={action.role ?? "admin"}
          onChange={(e) =>
            onPatch(index, { role: e.target.value as UserRole })
          }
          className={FIELD}
          aria-label="Rol destinatario"
        >
          {AVAILABLE_USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {WORKFLOW_ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      ) : null}

      {action.type === "email" ? (
        <div className="space-y-1">
          <label className={LABEL} htmlFor={`wf-emails-${index}`}>
            Emails extra (opcional)
          </label>
          <input
            id={`wf-emails-${index}`}
            value={action.emails.join(", ")}
            onChange={(e) =>
              onPatch(index, {
                emails: e.target.value
                  .split(/[,;]+/)
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            placeholder="ops@empresa.com"
            className={FIELD}
          />
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-zinc-700">
        <input
          type="checkbox"
          checked={action.excludeActor}
          onChange={(e) =>
            onPatch(index, { excludeActor: e.target.checked })
          }
          className="h-4 w-4 rounded border-zinc-300 accent-primary-600"
        />
        No avisar a quien disparó el evento
      </label>
      </>
      )}

      <div className="space-y-1">
        <label className={LABEL} htmlFor={`wf-title-${index}`}>
          {action.type === "email" ? "Asunto" : "Título"}
        </label>
        <WorkflowTemplateField
          id={`wf-title-${index}`}
          value={action.title}
          onChange={(title) => onPatch(index, { title })}
        />
      </div>
      <div className="space-y-1">
        <label className={LABEL} htmlFor={`wf-body-${index}`}>
          Mensaje
        </label>
        <WorkflowTemplateField
          id={`wf-body-${index}`}
          multiline
          rows={3}
          value={action.body}
          onChange={(body) => onPatch(index, { body })}
        />
      </div>
      <p className="text-[11px] text-zinc-500">{WORKFLOW_TEMPLATE_HINT}</p>
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
        <button
          type="button"
          disabled={testing}
          onClick={() => void onTest()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          {testing ? "Probando…" : "Probar"}
        </button>
        <p className="text-[11px] text-zinc-500">
          {action.type === "telegram"
            ? "Se envía al chat de Telegram configurado, con datos de ejemplo."
            : "Te llega a ti, con datos de ejemplo."}
        </p>
      </div>
      {testError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {testError}
        </p>
      ) : null}
      {testMessage ? (
        <p className="rounded-lg bg-support-green/15 px-3 py-2 text-xs text-zinc-800">
          {testMessage}
        </p>
      ) : null}
    </div>
  );
}
