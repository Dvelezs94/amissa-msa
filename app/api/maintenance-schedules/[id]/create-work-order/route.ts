import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { setWorkOrderAssigneeIds } from "@/lib/assignees";
import { copyChecklistTemplateItemsToWorkOrder } from "@/lib/copy-checklist-template-to-work-order";
import { maintenanceSchedules, users, workOrders } from "@/lib/db/schema";
import { createId } from "@/lib/id";
import { getNextWorkOrderFolio } from "@/lib/work-order-folio";
import { recordAuditLog } from "@/lib/audit";
import {
  dueDateFromYmd,
  maintenanceScheduleWorkOrderDescription,
  parseScheduleYmd,
} from "@/lib/maintenance-schedule-work-order";
import { workOrderExistsForScheduleDay } from "@/lib/maintenance-schedule-work-order-db";
import { toYmdLocal } from "@/lib/maintenance-recurrence";
import { parseOptionalWorkOrderDateInput } from "@/lib/work-order-start-date";
import { emitWorkflowEvent } from "@/lib/workflow-engine";
import { buildWorkflowEvent } from "@/lib/workflows";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const schedule = await db.query.maintenanceSchedules.findFirst({
    where: and(
      eq(maintenanceSchedules.id, id),
      isNull(maintenanceSchedules.deletedAt)
    ),
  });
  if (!schedule) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const dateYmd =
    parseScheduleYmd(body?.dateYmd) ??
    (schedule.nextRunAt ? toYmdLocal(new Date(schedule.nextRunAt)) : null);
  const dueDate =
    (dateYmd ? dueDateFromYmd(dateYmd) : null) ?? schedule.nextRunAt ?? null;

  const startParsed = parseOptionalWorkOrderDateInput(
    body?.startDate !== undefined && body?.startDate !== null && body?.startDate !== ""
      ? body.startDate
      : dateYmd
  );
  if (!startParsed.ok) {
    return NextResponse.json({ error: startParsed.error }, { status: 400 });
  }

  if (dateYmd && (await workOrderExistsForScheduleDay(id, dateYmd))) {
    return NextResponse.json(
      { error: "Ya existe una tarea para este evento en este día" },
      { status: 409 }
    );
  }
  let assigneeIds: string[] = [];
  if (Array.isArray(body?.assigneeIds)) {
    assigneeIds = Array.from(
      new Set(
        body.assigneeIds
          .map((x: unknown) => String(x).trim())
          .filter(Boolean)
      )
    );
  } else if (typeof body?.assigneeId === "string" && body.assigneeId.trim()) {
    assigneeIds = [body.assigneeId.trim()];
  }
  if (assigneeIds.length === 0) {
    return NextResponse.json(
      { error: "Debes seleccionar al menos un responsable" },
      { status: 400 }
    );
  }
  for (const aid of assigneeIds) {
    const assignee = await db.query.users.findFirst({
      where: eq(users.id, aid),
      columns: { id: true },
    });
    if (!assignee) {
      return NextResponse.json(
        { error: "Responsable no encontrado" },
        { status: 400 }
      );
    }
  }
  const assigneeId = assigneeIds[0]!;

  const workOrderId = createId();
  const folio = await getNextWorkOrderFolio("routine");
  const now = new Date();

  await db.insert(workOrders).values({
    id: workOrderId,
    folio,
    title: schedule.name,
    description: maintenanceScheduleWorkOrderDescription(
      schedule.id,
      schedule.name
    ),
    status: "pending",
    priority: "medium",
    kind: "routine",
    assetId: schedule.assetId ?? null,
    assigneeId,
    requesterId: session.id,
    dueDate,
    startDate: startParsed.date,
    createdAt: now,
    updatedAt: now,
  });

  await setWorkOrderAssigneeIds(workOrderId, assigneeIds);

  if (schedule.checklistTemplateId) {
    await copyChecklistTemplateItemsToWorkOrder({
      workOrderId,
      checklistTemplateId: schedule.checklistTemplateId,
      newId: createId,
    });
  }

  await recordAuditLog({
    entityType: "work_order",
    entityId: workOrderId,
    action: "created_from_schedule",
    userId: session.id,
    metadata: {
      scheduleId: schedule.id,
      checklistTemplateId: schedule.checklistTemplateId ?? null,
      dueDate: dueDate ? dueDate.toISOString() : null,
      startDate: startParsed.date ? startParsed.date.toISOString() : null,
    },
  });

  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: schedule.id,
    action: "work_order_created",
    userId: session.id,
    metadata: {
      workOrderId,
      folio,
    },
  });

  await emitWorkflowEvent(
    buildWorkflowEvent({
      type: "work_order.created",
      entityType: "work_order",
      entityId: workOrderId,
      actorUserId: session.id,
      actorName: session.name,
      payload: {
        title: schedule.name,
        folio,
        status: "pending",
        priority: "medium",
        href: `/tareas/${workOrderId}`,
        requesterId: session.id,
        assigneeIds: assigneeIds.join(","),
      },
    })
  );
  await emitWorkflowEvent(
    buildWorkflowEvent({
      type: "work_order.assigned",
      entityType: "work_order",
      entityId: workOrderId,
      actorUserId: session.id,
      actorName: session.name,
      payload: {
        title: schedule.name,
        folio,
        status: "pending",
        priority: "medium",
        href: `/tareas/${workOrderId}`,
        requesterId: session.id,
        assigneeIds: assigneeIds.join(","),
      },
    })
  );

  return NextResponse.json({ id: workOrderId, folio });
}
