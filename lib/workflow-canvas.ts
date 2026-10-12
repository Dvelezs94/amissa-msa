import type { UserRole } from "@/lib/auth-shared";
import {
  WORKFLOW_STATUSES,
  isWorkflowActionType,
  isWorkflowTriggerType,
  workflowActionLabel,
  workflowRecipientLabel,
  workflowTriggerLabel,
  type WorkflowActionConfig,
  type WorkflowActionType,
  type WorkflowRecipientKind,
  type WorkflowTriggerType,
} from "@/lib/workflows";

export const WORKFLOW_CANVAS = {
  nodeWidth: 260,
  triggerHeight: 80,
  actionHeight: 80,
  colGap: 88,
  rowGap: 20,
  padding: 48,
} as const;

export const WORKFLOW_STATUS_LABELS: Record<
  (typeof WORKFLOW_STATUSES)[number],
  string
> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export const WORKFLOW_ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administradores",
  tecnico: "Técnicos",
  calidad: "Calidad",
};

export type WorkflowCanvasNodeKind = "trigger" | "action";

export type WorkflowCanvasNode = {
  id: string;
  kind: WorkflowCanvasNodeKind;
  actionIndex: number | null;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type WorkflowCanvasEdge = {
  id: string;
  fromId: string;
  toId: string;
  d: string;
};

export type WorkflowCanvasLayout = {
  nodes: WorkflowCanvasNode[];
  edges: WorkflowCanvasEdge[];
  width: number;
  height: number;
};

export function workflowCanvasTriggerId(): string {
  return "trigger";
}

export function workflowCanvasActionId(index: number): string {
  return `action:${index}`;
}

export function workflowCanvasBezier(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): string {
  const dx = Math.max(48, Math.abs(x2 - x1) * 0.45);
  return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
}

export function layoutWorkflowCanvas(actionCount: number): WorkflowCanvasLayout {
  const count = Math.max(0, Math.floor(actionCount));
  const {
    nodeWidth: w,
    triggerHeight,
    actionHeight,
    colGap,
    rowGap,
    padding,
  } = WORKFLOW_CANVAS;

  const actionsHeight =
    count === 0
      ? triggerHeight
      : count * actionHeight + Math.max(0, count - 1) * rowGap;
  const triggerY =
    padding + Math.max(0, (actionsHeight - triggerHeight) / 2);

  const trigger: WorkflowCanvasNode = {
    id: workflowCanvasTriggerId(),
    kind: "trigger",
    actionIndex: null,
    x: padding,
    y: triggerY,
    w,
    h: triggerHeight,
  };

  const nodes: WorkflowCanvasNode[] = [trigger];
  const edges: WorkflowCanvasEdge[] = [];
  const actionX = padding + w + colGap;

  for (let i = 0; i < count; i += 1) {
    const node: WorkflowCanvasNode = {
      id: workflowCanvasActionId(i),
      kind: "action",
      actionIndex: i,
      x: actionX,
      y: padding + i * (actionHeight + rowGap),
      w,
      h: actionHeight,
    };
    nodes.push(node);
    edges.push({
      id: `e-trigger-${i}`,
      fromId: trigger.id,
      toId: node.id,
      d: workflowCanvasBezier(
        trigger.x + trigger.w,
        trigger.y + trigger.h / 2,
        node.x,
        node.y + node.h / 2
      ),
    });
  }

  return {
    nodes,
    edges,
    width: count === 0 ? padding * 2 + w : actionX + w + padding,
    height: padding * 2 + actionsHeight,
  };
}

export function clampWorkflowCanvasZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(1.6, Math.max(0.55, zoom));
}

export function workflowTriggerSummary(
  type: WorkflowTriggerType,
  toStatus?: string | null
): string {
  if (type === "work_order.status_changed" && toStatus) {
    const label =
      toStatus in WORKFLOW_STATUS_LABELS
        ? WORKFLOW_STATUS_LABELS[toStatus as keyof typeof WORKFLOW_STATUS_LABELS]
        : toStatus;
    return `Solo si queda ${label}`;
  }
  return workflowTriggerLabel(type);
}

export function workflowActionSummary(
  action: Pick<
    WorkflowActionConfig,
    "type" | "recipientKind" | "role" | "title" | "telegramChatId"
  >
): string {
  if (action.type === "telegram") {
    return action.telegramChatId
      ? `Telegram ${action.telegramChatId}`
      : "Canal de Telegram";
  }
  if (action.recipientKind === "role" && action.role) {
    return WORKFLOW_ROLE_LABELS[action.role] ?? workflowRecipientLabel("role");
  }
  return workflowRecipientLabel(action.recipientKind);
}

export function workflowActionTone(type: WorkflowActionType): WorkflowActionType {
  return type;
}

export type WorkflowMiniGraphChip = {
  id: string;
  kind: "trigger" | "action";
  label: string;
  tone: "trigger" | WorkflowActionType;
};

export function workflowMiniGraphChips(input: {
  triggerType: string;
  actions: Array<{ type: string }>;
}): WorkflowMiniGraphChip[] {
  const chips: WorkflowMiniGraphChip[] = [
    {
      id: "trigger",
      kind: "trigger",
      label: isWorkflowTriggerType(input.triggerType)
        ? workflowTriggerLabel(input.triggerType)
        : "Evento",
      tone: "trigger",
    },
  ];
  input.actions.forEach((action, index) => {
    const type = isWorkflowActionType(action.type) ? action.type : "notify";
    chips.push({
      id: `action:${index}`,
      kind: "action",
      label: workflowActionLabel(type),
      tone: type,
    });
  });
  return chips;
}

export function recipientKindsForAction(
  type: WorkflowActionType
): WorkflowRecipientKind[] {
  if (type === "email") {
    return ["assignees", "requester", "users", "role", "contact"];
  }
  if (type === "telegram") return [];
  return ["assignees", "requester", "users", "role"];
}
