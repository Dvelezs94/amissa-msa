import { NextResponse } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assetHourMaintenancePlans,
  assets,
  calendars,
  maintenanceSchedules,
} from "@/lib/db/schema";
import { recordAuditLog } from "@/lib/audit";
import {
  loadMaintenanceScheduleAssigneeIds,
  setMaintenanceScheduleAssigneeIds,
} from "@/lib/assignees";
import {
  defaultHourMaintenancePlanName,
  hourMaintenancePlanView,
  hourMaintenanceSchedulePayload,
  hourPlanTimingChanged,
  parseHourMaintenancePlanFields,
} from "@/lib/hour-maintenance";
import {
  deleteHourPlansForScheduleId,
  resolveHourPlanRelations,
} from "@/lib/hour-maintenance-plans-db";

async function loadPlan(assetId: string, planId: string) {
  const rows = await db
    .select({
      id: assetHourMaintenancePlans.id,
      name: assetHourMaintenancePlans.name,
      hoursPerDay: assetHourMaintenancePlans.hoursPerDay,
      everyHours: assetHourMaintenancePlans.everyHours,
      startDate: assetHourMaintenancePlans.startDate,
      workdays: assetHourMaintenancePlans.workdays,
      scheduleId: assetHourMaintenancePlans.scheduleId,
      scheduleName: maintenanceSchedules.name,
      scheduleCalendarId: maintenanceSchedules.calendarId,
      scheduleChecklistTemplateId: maintenanceSchedules.checklistTemplateId,
      scheduleColor: maintenanceSchedules.color,
      nextRunAt: maintenanceSchedules.nextRunAt,
      recurrence: maintenanceSchedules.recurrence,
      calendarName: calendars.name,
      deletedAt: maintenanceSchedules.deletedAt,
    })
    .from(assetHourMaintenancePlans)
    .innerJoin(
      maintenanceSchedules,
      eq(assetHourMaintenancePlans.scheduleId, maintenanceSchedules.id)
    )
    .leftJoin(calendars, eq(maintenanceSchedules.calendarId, calendars.id))
    .where(
      and(
        eq(assetHourMaintenancePlans.id, planId),
        eq(assetHourMaintenancePlans.assetId, assetId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: assetId, planId } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
    columns: { id: true, name: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const existing = await loadPlan(assetId, planId);
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const parsed = parseHourMaintenancePlanFields(body, {
    fallbackName: defaultHourMaintenancePlanName(asset.name),
  });
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const related = await resolveHourPlanRelations(parsed.value);
  if (!related.ok) {
    return NextResponse.json({ error: related.error }, { status: 400 });
  }

  const timingChanged = hourPlanTimingChanged(
    {
      hoursPerDay: existing.hoursPerDay,
      everyHours: existing.everyHours,
      startDate: existing.startDate,
      workdays: existing.workdays,
    },
    {
      hoursPerDay: parsed.value.hoursPerDay,
      everyHours: parsed.value.everyHours,
      startDate: parsed.value.startDate,
      workdays: parsed.value.workdays,
    }
  );

  const scheduleSet: {
    name: string;
    color: string;
    checklistTemplateId: string | null;
    calendarId: string;
    recurrence?: string;
    nextRunAt?: Date;
  } = {
    name: parsed.value.name,
    color: parsed.value.color,
    checklistTemplateId: related.checklistTemplateId,
    calendarId: related.calendarId,
  };

  let recurrence = existing.recurrence;
  let nextRunAt = existing.nextRunAt;
  if (timingChanged) {
    const payload = hourMaintenanceSchedulePayload({
      hoursPerDay: parsed.value.hoursPerDay,
      everyHours: parsed.value.everyHours,
      anchorDate: parsed.value.startDate,
      workdays: parsed.value.workdays,
    });
    scheduleSet.recurrence = payload.recurrence;
    scheduleSet.nextRunAt = payload.nextRunAt;
    recurrence = payload.recurrence;
    nextRunAt = payload.nextRunAt;
  }

  await db
    .update(maintenanceSchedules)
    .set(scheduleSet)
    .where(
      and(
        eq(maintenanceSchedules.id, existing.scheduleId),
        isNull(maintenanceSchedules.deletedAt)
      )
    );

  await setMaintenanceScheduleAssigneeIds(
    existing.scheduleId,
    related.assigneeIds
  );

  await db
    .update(assetHourMaintenancePlans)
    .set({
      name: parsed.value.name,
      hoursPerDay: parsed.value.hoursPerDay,
      everyHours: parsed.value.everyHours,
      startDate: parsed.value.startDate,
      workdays: parsed.value.workdays,
      calendarId: related.calendarId,
      checklistTemplateId: related.checklistTemplateId,
      color: parsed.value.color,
    })
    .where(eq(assetHourMaintenancePlans.id, planId));

  await recordAuditLog({
    entityType: "asset_hour_maintenance_plan",
    entityId: planId,
    action: "updated",
    userId: session.id,
    metadata: {
      assetId,
      scheduleId: existing.scheduleId,
      timingChanged,
    },
  });

  return NextResponse.json(
    hourMaintenancePlanView({
      id: planId,
      name: parsed.value.name,
      hoursPerDay: parsed.value.hoursPerDay,
      everyHours: parsed.value.everyHours,
      startDate: parsed.value.startDate,
      workdays: parsed.value.workdays,
      calendarId: related.calendarId,
      calendarName: existing.calendarName,
      checklistTemplateId: related.checklistTemplateId,
      color: parsed.value.color,
      scheduleId: existing.scheduleId,
      nextRunAt,
      recurrence,
      assigneeIds: related.assigneeIds,
    })
  );
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: assetId, planId } = await params;
  const existing = await loadPlan(assetId, planId);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!existing.deletedAt) {
    await db
      .update(maintenanceSchedules)
      .set({ deletedAt: new Date() })
      .where(eq(maintenanceSchedules.id, existing.scheduleId));
    await recordAuditLog({
      entityType: "maintenance_schedule",
      entityId: existing.scheduleId,
      action: "soft_deleted",
      userId: session.id,
      metadata: {
        scheduleName: existing.scheduleName,
        reason: "hour_plan_deleted",
        hourPlanId: planId,
      },
    });
  }

  await deleteHourPlansForScheduleId(existing.scheduleId);

  await recordAuditLog({
    entityType: "asset_hour_maintenance_plan",
    entityId: planId,
    action: "deleted",
    userId: session.id,
    metadata: { assetId, scheduleId: existing.scheduleId },
  });

  return NextResponse.json({ ok: true });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; planId: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: assetId, planId } = await params;
  const existing = await loadPlan(assetId, planId);
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const assigneeIds = await loadMaintenanceScheduleAssigneeIds(
    existing.scheduleId,
    null
  );

  return NextResponse.json(
    hourMaintenancePlanView({
      id: existing.id,
      name: existing.scheduleName || existing.name,
      hoursPerDay: existing.hoursPerDay,
      everyHours: existing.everyHours,
      startDate: existing.startDate,
      workdays: existing.workdays,
      calendarId: existing.scheduleCalendarId,
      calendarName: existing.calendarName,
      checklistTemplateId: existing.scheduleChecklistTemplateId,
      color: existing.scheduleColor,
      scheduleId: existing.scheduleId,
      nextRunAt: existing.nextRunAt,
      recurrence: existing.recurrence,
      assigneeIds,
    })
  );
}
