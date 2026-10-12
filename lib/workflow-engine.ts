import { and, eq, inArray } from "drizzle-orm";
import { createNotification } from "@/lib/notifications";
import { db } from "@/lib/db";
import { users, workflowDefinitions, workflowRuns } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { sendWorkflowEmail } from "@/lib/workflow-email";
import { sendWorkflowTelegram } from "@/lib/workflow-telegram";
import { workflowTelegramText } from "@/lib/telegram-config";
import {
  coerceStoredTriggerConfig,
  coerceStoredWorkflowActions,
  collectEventContactEmails,
  filterRecipientUserIds,
  interpolateWorkflowTemplate,
  workflowMatchesEvent,
  workflowTemplateVarsFromEvent,
  type WorkflowActionConfig,
  type WorkflowEvent,
} from "@/lib/workflows";

export async function emitWorkflowEvent(event: WorkflowEvent): Promise<void> {
  try {
    await runMatchingWorkflows(event);
  } catch (error) {
    console.error("[workflows]", error);
  }
}

async function runMatchingWorkflows(event: WorkflowEvent): Promise<void> {
  const rows = await db
    .select()
    .from(workflowDefinitions)
    .where(
      and(
        eq(workflowDefinitions.triggerType, event.type),
        eq(workflowDefinitions.enabled, true)
      )
    );

  for (const row of rows) {
    const triggerConfig = coerceStoredTriggerConfig(row.triggerConfig);
    if (
      !workflowMatchesEvent(
        {
          enabled: row.enabled,
          triggerType: row.triggerType,
          triggerConfig,
        },
        event
      )
    ) {
      continue;
    }

    const actions = coerceStoredWorkflowActions(row.actions);
    const errors: string[] = [];
    let ran = 0;
    for (const action of actions) {
      try {
        const result = await runWorkflowAction(action, event);
        if (!result.ok && !result.skipped) {
          errors.push(result.error);
        }
        if (result.ok || result.skipped) ran += 1;
      } catch (error) {
        errors.push(error instanceof Error ? error.message : "Acción falló");
      }
    }

    const status =
      errors.length === 0 ? "ok" : ran > 0 ? "partial" : "error";
    try {
      await db.insert(workflowRuns).values({
        id: createId(),
        workflowId: row.id,
        triggerType: event.type,
        entityType: event.entityType,
        entityId: event.entityId,
        status,
        error: errors.length > 0 ? errors.slice(0, 5).join("; ") : null,
      });
    } catch (error) {
      console.error("[workflows] run log", error);
    }
  }
}

export async function runWorkflowAction(
  action: WorkflowActionConfig,
  event: WorkflowEvent
): Promise<{ ok: true } | { ok: false; skipped?: boolean; error: string }> {
  const vars = workflowTemplateVarsFromEvent(event);
  const title = interpolateWorkflowTemplate(action.title, vars).trim();
  const body = interpolateWorkflowTemplate(action.body, vars).trim();

  if (action.type === "telegram") {
    return sendWorkflowTelegram({
      chatId: action.telegramChatId,
      text: workflowTelegramText(title, body),
    });
  }

  const { userIds, emails } = await resolveActionTargets(action, event);

  if (action.type === "notify") {
    if (userIds.length === 0) {
      return { ok: false, skipped: true, error: "Sin destinatarios" };
    }
    const workOrderId =
      event.entityType === "work_order" ? event.entityId : null;
    await Promise.allSettled(
      userIds.map((userId) =>
        createNotification({
          userId,
          type: "work_order_update",
          title: title || "Aviso MSA",
          body: body || null,
          workOrderId,
        })
      )
    );
    return { ok: true };
  }

  const to = Array.from(new Set([...emails]));
  if (to.length === 0) {
    return { ok: false, skipped: true, error: "Sin destinatarios de email" };
  }
  return sendWorkflowEmail({
    to,
    subject: title || "MSA",
    text: body,
  });
}

async function resolveActionTargets(
  action: WorkflowActionConfig,
  event: WorkflowEvent
): Promise<{ userIds: string[]; emails: string[] }> {
  const payload = event.payload;
  const assigneeIds = String(payload.assigneeIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const requesterId = payload.requesterId?.trim() || null;

  let roleUserIds: string[] = [];
  if (action.recipientKind === "role" && action.role) {
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, action.role), eq(users.isDisabled, false)));
    roleUserIds = rows.map((r) => r.id);
  }

  const userIds = filterRecipientUserIds({
    recipientKind: action.recipientKind,
    assigneeIds,
    requesterId,
    actorUserId: event.actorUserId,
    selectedUserIds: action.userIds,
    roleUserIds,
    excludeActor: action.excludeActor,
  });

  const emails = new Set(action.emails);
  if (action.recipientKind === "contact") {
    for (const e of collectEventContactEmails(payload)) emails.add(e);
  }

  if (action.type === "email" && userIds.length > 0) {
    const rows = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds));
    for (const row of rows) {
      if (row.email) emails.add(row.email.trim().toLowerCase());
    }
  }

  return { userIds, emails: Array.from(emails) };
}
