import { AVAILABLE_USER_ROLES, type UserRole } from "@/lib/auth-shared";
import { normalizeTelegramChatId } from "@/lib/telegram-config";

export const WORKFLOW_TRIGGER_TYPES = [
  "work_order.created",
  "work_order.completed",
  "work_order.status_changed",
  "work_order.assigned",
  "work_order.note_added",
  "solicitud.created",
  "checklist_revision.proposed",
  "checklist_revision.approved",
  "checklist_revision.rejected",
] as const;

export type WorkflowTriggerType = (typeof WORKFLOW_TRIGGER_TYPES)[number];

export const WORKFLOW_ACTION_TYPES = ["notify", "email", "telegram"] as const;
export type WorkflowActionType = (typeof WORKFLOW_ACTION_TYPES)[number];

export const WORKFLOW_RECIPIENT_KINDS = [
  "assignees",
  "requester",
  "users",
  "role",
  "contact",
] as const;
export type WorkflowRecipientKind = (typeof WORKFLOW_RECIPIENT_KINDS)[number];

export const WORKFLOW_STATUSES = [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
] as const;

export {
  WORKFLOW_TEMPLATE_HINT,
  WORKFLOW_TEMPLATE_VARIABLES,
} from "@/lib/workflow-template";

export type WorkflowTriggerConfig = {
  toStatus?: (typeof WORKFLOW_STATUSES)[number];
};

export type WorkflowActionConfig = {
  type: WorkflowActionType;
  recipientKind: WorkflowRecipientKind;
  userIds: string[];
  role: UserRole | null;
  emails: string[];
  telegramChatId: string | null;
  excludeActor: boolean;
  title: string;
  body: string;
};

export type ParsedWorkflowDefinition = {
  name: string;
  description: string;
  enabled: boolean;
  triggerType: WorkflowTriggerType;
  triggerConfig: WorkflowTriggerConfig;
  actions: WorkflowActionConfig[];
};

export type WorkflowEvent = {
  type: WorkflowTriggerType;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  actorName: string | null;
  payload: Record<string, string | null | undefined>;
};

export function isWorkflowTriggerType(value: unknown): value is WorkflowTriggerType {
  return (
    typeof value === "string" &&
    (WORKFLOW_TRIGGER_TYPES as readonly string[]).includes(value)
  );
}

export function isWorkflowActionType(value: unknown): value is WorkflowActionType {
  return (
    typeof value === "string" &&
    (WORKFLOW_ACTION_TYPES as readonly string[]).includes(value)
  );
}

export function workflowTriggerLabel(type: WorkflowTriggerType): string {
  switch (type) {
    case "work_order.created":
      return "Tarea creada";
    case "work_order.completed":
      return "Tarea completada";
    case "work_order.status_changed":
      return "Cambio de estado de tarea";
    case "work_order.assigned":
      return "Tarea asignada";
    case "work_order.note_added":
      return "Nueva nota en tarea";
    case "solicitud.created":
      return "Orden de trabajo creada";
    case "checklist_revision.proposed":
      return "Revisión de checklist propuesta";
    case "checklist_revision.approved":
      return "Revisión de checklist aprobada";
    case "checklist_revision.rejected":
      return "Revisión de checklist rechazada";
  }
}

export function workflowTriggerHint(type: WorkflowTriggerType): string {
  switch (type) {
    case "work_order.created":
      return "Cuando alguien crea una tarea en MSA (incluye las que salen del calendario).";
    case "work_order.completed":
      return "Cuando una tarea pasa a completada.";
    case "work_order.status_changed":
      return "Cuando cambia el estado. Opcional: limitar al estado destino.";
    case "work_order.assigned":
      return "Cuando se añaden responsables a una tarea.";
    case "work_order.note_added":
      return "Cuando se publica un comentario o nota en una tarea.";
    case "solicitud.created":
      return "Cuando llega una orden desde el formulario público /orden.";
    case "checklist_revision.proposed":
      return "Cuando se envía una revisión de checklist a Calidad.";
    case "checklist_revision.approved":
      return "Cuando Calidad aprueba una revisión.";
    case "checklist_revision.rejected":
      return "Cuando Calidad rechaza una revisión.";
  }
}

export function workflowActionLabel(type: WorkflowActionType): string {
  switch (type) {
    case "notify":
      return "Notificación en la app";
    case "email":
      return "Enviar email";
    case "telegram":
      return "Telegram";
  }
}

export function workflowRecipientLabel(kind: WorkflowRecipientKind): string {
  switch (kind) {
    case "assignees":
      return "Responsables de la tarea";
    case "requester":
      return "Quien creó la tarea";
    case "users":
      return "Personas concretas";
    case "role":
      return "Todos los de un rol";
    case "contact":
      return "Contacto del evento (orden de trabajo)";
  }
}

export function interpolateWorkflowTemplate(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_full, key: string) => {
    const value = vars[key];
    return value == null || value === "" ? "" : String(value);
  });
}

export function workflowTemplateVarsFromEvent(
  event: WorkflowEvent
): Record<string, string> {
  const p = event.payload;
  const out: Record<string, string> = {
    actorName: event.actorName ?? "",
  };
  for (const [key, value] of Object.entries(p)) {
    out[key] = value == null ? "" : String(value);
  }
  return out;
}

export function workflowMatchesEvent(
  workflow: {
    enabled: boolean;
    triggerType: string;
    triggerConfig: WorkflowTriggerConfig | null;
  },
  event: WorkflowEvent
): boolean {
  if (!workflow.enabled) return false;
  if (workflow.triggerType !== event.type) return false;
  const toStatus = workflow.triggerConfig?.toStatus;
  if (toStatus && event.type === "work_order.status_changed") {
    return (event.payload.status ?? "") === toStatus;
  }
  return true;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function parseEmailList(raw: unknown): string[] {
  const parts: string[] = [];
  if (typeof raw === "string") {
    parts.push(...raw.split(/[,;\s]+/));
  } else if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") parts.push(...item.split(/[,;\s]+/));
    }
  }
  const unique = new Set<string>();
  for (const part of parts) {
    const email = part.trim().toLowerCase();
    if (EMAIL_RE.test(email)) unique.add(email);
  }
  return Array.from(unique);
}

export function defaultWorkflowAction(
  type: WorkflowActionType = "notify"
): WorkflowActionConfig {
  return {
    type,
    recipientKind: "assignees",
    userIds: [],
    role: null,
    emails: [],
    telegramChatId: null,
    excludeActor: true,
    title: type === "email" ? "MSA: {{title}}" : "{{title}}",
    body: "{{actorName}} · {{status}}\n{{href}}",
  };
}

export function coerceStoredWorkflowActions(raw: unknown): WorkflowActionConfig[] {
  if (!Array.isArray(raw)) return [];
  const out: WorkflowActionConfig[] = [];
  for (const item of raw) {
    const action = parseWorkflowAction(item);
    if (action) out.push(action);
  }
  return out;
}

export function coerceStoredTriggerConfig(raw: unknown): WorkflowTriggerConfig {
  return parseTriggerConfig(raw);
}

function parseTriggerConfig(raw: unknown): WorkflowTriggerConfig {
  if (!raw || typeof raw !== "object") return {};
  const toStatus = (raw as { toStatus?: unknown }).toStatus;
  if (
    typeof toStatus === "string" &&
    (WORKFLOW_STATUSES as readonly string[]).includes(toStatus)
  ) {
    return { toStatus: toStatus as WorkflowTriggerConfig["toStatus"] };
  }
  return {};
}

export function parseWorkflowAction(raw: unknown): WorkflowActionConfig | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (!isWorkflowActionType(o.type)) return null;
  const recipientKind = (WORKFLOW_RECIPIENT_KINDS as readonly string[]).includes(
    String(o.recipientKind)
  )
    ? (o.recipientKind as WorkflowRecipientKind)
    : "assignees";
  const roleRaw = typeof o.role === "string" ? o.role : "";
  const role = (AVAILABLE_USER_ROLES as readonly string[]).includes(roleRaw)
    ? (roleRaw as UserRole)
    : null;
  let userIds: string[] = [];
  if (Array.isArray(o.userIds)) {
    userIds = Array.from(
      new Set(o.userIds.map((x) => String(x).trim()).filter(Boolean))
    );
  }
  const emails = parseEmailList(o.emails);
  const chatRaw = typeof o.telegramChatId === "string" ? o.telegramChatId : "";
  const telegramChatId = chatRaw.trim() ? normalizeTelegramChatId(chatRaw) : null;
  if (chatRaw.trim() && !telegramChatId) return null;
  return {
    type: o.type,
    recipientKind,
    userIds,
    role,
    emails,
    telegramChatId,
    excludeActor: o.excludeActor !== false,
    title: typeof o.title === "string" ? o.title : "",
    body: typeof o.body === "string" ? o.body : "",
  };
}

export function parseWorkflowDefinition(
  body: Record<string, unknown>
): { ok: true; value: ParsedWorkflowDefinition } | { ok: false; error: string } {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "El nombre es obligatorio" };
  if (name.length > 120) return { ok: false, error: "El nombre es demasiado largo" };

  if (!isWorkflowTriggerType(body.triggerType)) {
    return { ok: false, error: "Evento no válido" };
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const enabled = body.enabled !== false;
  const triggerConfig = parseTriggerConfig(body.triggerConfig);

  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    return { ok: false, error: "Añade al menos una acción" };
  }
  if (body.actions.length > 20) {
    return { ok: false, error: "Máximo 20 acciones por flujo" };
  }

  const actions: WorkflowActionConfig[] = [];
  for (const raw of body.actions) {
    const action = parseWorkflowAction(raw);
    if (!action) {
      const chat =
        raw && typeof raw === "object"
          ? (raw as { telegramChatId?: unknown }).telegramChatId
          : undefined;
      if (typeof chat === "string" && chat.trim() && !normalizeTelegramChatId(chat)) {
        return {
          ok: false,
          error: "El chat de Telegram debe ser un id numérico o un @canal",
        };
      }
      return {
        ok: false,
        error: "Hay una acción inválida (revisa el tipo o destinatarios)",
      };
    }
    const title = action.title.trim();
    if (!title) {
      return { ok: false, error: "Cada acción de aviso necesita un título o asunto" };
    }
    if (action.type !== "telegram") {
      if (action.recipientKind === "users" && action.userIds.length === 0) {
        return { ok: false, error: "Selecciona al menos una persona" };
      }
      if (action.recipientKind === "role" && !action.role) {
        return { ok: false, error: "Selecciona un rol" };
      }
    }
    if (
      action.type === "email" &&
      action.recipientKind === "contact" &&
      action.emails.length === 0
    ) {
      // contact email comes from the event; extra addresses optional
    }
    actions.push(action);
  }

  return {
    ok: true,
    value: {
      name,
      description,
      enabled,
      triggerType: body.triggerType,
      triggerConfig,
      actions,
    },
  };
}

export function filterRecipientUserIds(input: {
  recipientKind: WorkflowRecipientKind;
  assigneeIds: string[];
  requesterId: string | null;
  actorUserId: string | null;
  selectedUserIds: string[];
  roleUserIds: string[];
  excludeActor: boolean;
}): string[] {
  let ids: string[] = [];
  switch (input.recipientKind) {
    case "assignees":
      ids = input.assigneeIds;
      break;
    case "requester":
      ids = input.requesterId ? [input.requesterId] : [];
      break;
    case "users":
      ids = input.selectedUserIds;
      break;
    case "role":
      ids = input.roleUserIds;
      break;
    case "contact":
      ids = [];
      break;
  }
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!input.excludeActor || !input.actorUserId) return unique;
  return unique.filter((id) => id !== input.actorUserId);
}

export function collectEventContactEmails(payload: WorkflowEvent["payload"]): string[] {
  return parseEmailList(payload.contactEmail ?? "");
}

export function buildWorkflowEvent(input: {
  type: WorkflowTriggerType;
  entityType: string;
  entityId: string;
  actorUserId: string | null;
  actorName: string | null;
  payload: Record<string, string | number | null | undefined>;
}): WorkflowEvent {
  const payload: WorkflowEvent["payload"] = {};
  for (const [key, value] of Object.entries(input.payload)) {
    if (value == null || value === "") payload[key] = null;
    else payload[key] = String(value);
  }
  return {
    type: input.type,
    entityType: input.entityType,
    entityId: input.entityId,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    payload,
  };
}
