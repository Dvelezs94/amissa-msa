import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import { copyChecklistTemplateItemsToWorkOrder } from "@/lib/copy-checklist-template-to-work-order";
import { assets } from "@/lib/db/schema";
import { users } from "@/lib/db/schema";
import { eq, desc, asc, and, sql } from "drizzle-orm";
import { createId } from "@/lib/id";
import { recordAuditLog } from "@/lib/audit";
import { loadManyWorkOrderAssignees, setWorkOrderAssigneeIds } from "@/lib/assignees";
import { getNextWorkOrderFolio } from "@/lib/work-order-folio";
import { createNotification } from "@/lib/notifications";
import { clampManualDowntimeMinutes } from "@/lib/machine-downtime";
import { parseOptionalWorkOrderDateInput } from "@/lib/work-order-start-date";
import { emitWorkflowEvent } from "@/lib/workflow-engine";
import { buildWorkflowEvent } from "@/lib/workflows";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const statusRaw = searchParams.get("status");
  const status = statusRaw === "open" ? "pending" : statusRaw;
  const assigneeId = searchParams.get("assigneeId");

  const conditions = [];
  if (status) conditions.push(eq(workOrders.status, status as "pending" | "in_progress" | "completed" | "cancelled"));
  if (assigneeId) {
    conditions.push(
      sql`(
        ${workOrders.assigneeId} = ${assigneeId}
        OR EXISTS (
          SELECT 1 FROM work_order_assignees woa
          WHERE woa.work_order_id = ${workOrders.id}
          AND woa.user_id = ${assigneeId}
        )
      )`
    );
  }

  const base = db
    .select({
      id: workOrders.id,
      folio: workOrders.folio,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      dueDate: workOrders.dueDate,
      startDate: workOrders.startDate,
      completedAt: workOrders.completedAt,
      startedAt: workOrders.startedAt,
      kind: workOrders.kind,
      createdAt: workOrders.createdAt,
      boardSortOrder: workOrders.boardSortOrder,
      assetId: workOrders.assetId,
      assigneeId: workOrders.assigneeId,
      countsMachineDowntime: workOrders.countsMachineDowntime,
      manualDowntimeMinutes: workOrders.manualDowntimeMinutes,
      assetName: assets.name,
      assetAssetId: assets.assetId,
      assetTracksMachineDowntime: assets.tracksMachineDowntime,
      assigneeName: users.name,
      assigneeAvatarUrl: users.avatarUrl,
      assigneeAvatarBackgroundColor: users.avatarBackgroundColor,
    })
    .from(workOrders)
    .leftJoin(assets, eq(workOrders.assetId, assets.id))
    .leftJoin(users, eq(workOrders.assigneeId, users.id))
    .orderBy(asc(workOrders.boardSortOrder), desc(workOrders.createdAt));

  const rows = conditions.length
    ? await base.where(and(...conditions))
    : await base;

  const ids = rows.map((r) => r.id);
  const assigneesByWo = await loadManyWorkOrderAssignees(ids);
  const enriched = rows.map((r) => {
    let assignees = assigneesByWo.get(r.id) ?? [];
    if (assignees.length === 0 && r.assigneeId && r.assigneeName) {
      assignees = [
        {
          id: r.assigneeId,
          name: r.assigneeName,
          email: null as string | null,
          avatarUrl: r.assigneeAvatarUrl,
          avatarBackgroundColor: r.assigneeAvatarBackgroundColor,
        },
      ];
    }
    const primary = assignees[0];
    const assigneeNameJoined =
      assignees.length > 0
        ? assignees.map((a) => a.name).join(", ")
        : null;
    return {
      ...r,
      assignees,
      assigneeIds: assignees.map((a) => a.id),
      assigneeName: assigneeNameJoined,
      assigneeId: primary?.id ?? null,
      assigneeAvatarUrl: primary?.avatarUrl ?? null,
      assigneeAvatarBackgroundColor: primary?.avatarBackgroundColor ?? null,
    };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));
  const title = (body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  const id = createId();
  const folio = await getNextWorkOrderFolio("on_demand");
  const now = new Date();
  const checklistTemplateId = body.checklistTemplateId || null;
  const assetId =
    typeof body.assetId === "string" && body.assetId.trim() ? body.assetId.trim() : null;
  let assetAllowsDowntime = false;
  if (assetId) {
    const a = await db.query.assets.findFirst({
      where: eq(assets.id, assetId),
      columns: { tracksMachineDowntime: true },
    });
    assetAllowsDowntime = a?.tracksMachineDowntime !== false;
  }
  const countsExplicit =
    body.countsMachineDowntime === true || body.countsMachineDowntime === "true";
  const countsMachineDowntime =
    body.countsMachineDowntime === undefined || body.countsMachineDowntime === null
      ? assetAllowsDowntime
      : countsExplicit && assetAllowsDowntime;
  let manualDowntimeMinutes = 0;
  if (body.manualDowntimeMinutes !== undefined) {
    const m = clampManualDowntimeMinutes(body.manualDowntimeMinutes);
    if (m === null) {
      return NextResponse.json(
        { error: "Paro manual inválido (use minutos enteros entre 0 y 525600)" },
        { status: 400 }
      );
    }
    manualDowntimeMinutes = m;
  }
  let assigneeIds: string[] = [];
  if (Array.isArray(body.assigneeIds)) {
    assigneeIds = Array.from(
      new Set(
        body.assigneeIds
          .map((x: unknown) => String(x).trim())
          .filter(Boolean)
      )
    );
  } else if (typeof body.assigneeId === "string" && body.assigneeId.trim()) {
    assigneeIds = [body.assigneeId.trim()];
  }
  const dueParsed = parseOptionalWorkOrderDateInput(
    body.dueDate !== undefined ? body.dueDate : null
  );
  if (!dueParsed.ok) {
    return NextResponse.json({ error: dueParsed.error }, { status: 400 });
  }
  const startParsed = parseOptionalWorkOrderDateInput(
    body.startDate !== undefined ? body.startDate : null
  );
  if (!startParsed.ok) {
    return NextResponse.json({ error: startParsed.error }, { status: 400 });
  }
  await db.insert(workOrders).values({
    id,
    folio,
    title,
    description: body.description?.trim() || null,
    status: "pending",
    priority: body.priority ?? "medium",
    kind: "on_demand",
    assetId,
    assigneeId: assigneeIds[0] ?? null,
    requesterId: session.id,
    dueDate: dueParsed.date,
    startDate: startParsed.date,
    createdAt: now,
    updatedAt: now,
    countsMachineDowntime,
    manualDowntimeMinutes,
  });
  await setWorkOrderAssigneeIds(id, assigneeIds);
  for (const uid of assigneeIds) {
    if (uid !== session.id) {
      await createNotification({
        userId: uid,
        type: "assignment",
        title: "Nueva tarea asignada",
        body: title,
        workOrderId: id,
      });
    }
  }
  if (checklistTemplateId) {
    await copyChecklistTemplateItemsToWorkOrder({
      workOrderId: id,
      checklistTemplateId,
      newId: createId,
    });
  }
  await recordAuditLog({
    entityType: "work_order",
    entityId: id,
    action: "created",
    userId: session.id,
    metadata: {
      title,
      status: "pending",
      priority: body.priority ?? "medium",
      assetId: body.assetId || null,
      assigneeId: assigneeIds[0] ?? null,
      checklistTemplateId,
      dueDate: dueParsed.date ? dueParsed.date.toISOString() : null,
      startDate: startParsed.date ? startParsed.date.toISOString() : null,
    },
  });
  await emitWorkflowEvent(
    buildWorkflowEvent({
      type: "work_order.created",
      entityType: "work_order",
      entityId: id,
      actorUserId: session.id,
      actorName: session.name,
      payload: {
        title,
        folio,
        status: "pending",
        priority: body.priority ?? "medium",
        href: `/tareas/${id}`,
        requesterId: session.id,
        assigneeIds: assigneeIds.join(","),
      },
    })
  );
  if (assigneeIds.length > 0) {
    await emitWorkflowEvent(
      buildWorkflowEvent({
        type: "work_order.assigned",
        entityType: "work_order",
        entityId: id,
        actorUserId: session.id,
        actorName: session.name,
        payload: {
          title,
          folio,
          status: "pending",
          priority: body.priority ?? "medium",
          href: `/tareas/${id}`,
          requesterId: session.id,
          assigneeIds: assigneeIds.join(","),
        },
      })
    );
  }
  return NextResponse.json({ id });
}
