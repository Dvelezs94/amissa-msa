import { NextResponse } from "next/server";
import { and, asc, eq, isNull } from "drizzle-orm";
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
  loadManyMaintenanceScheduleAssigneeIds,
  setMaintenanceScheduleAssigneeIds,
} from "@/lib/assignees";
import { createId } from "@/lib/id";
import {
  defaultHourMaintenancePlanName,
  hourMaintenancePlanView,
  hourMaintenanceSchedulePayload,
  parseHourMaintenancePlanFields,
} from "@/lib/hour-maintenance";
import { resolveHourPlanRelations } from "@/lib/hour-maintenance-plans-db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: assetId } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
    columns: { id: true },
  });
  if (!asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rows = await db
    .select({
      id: assetHourMaintenancePlans.id,
      name: assetHourMaintenancePlans.name,
      hoursPerDay: assetHourMaintenancePlans.hoursPerDay,
      everyHours: assetHourMaintenancePlans.everyHours,
      startDate: assetHourMaintenancePlans.startDate,
      workdays: assetHourMaintenancePlans.workdays,
      planCalendarId: assetHourMaintenancePlans.calendarId,
      planChecklistTemplateId: assetHourMaintenancePlans.checklistTemplateId,
      planColor: assetHourMaintenancePlans.color,
      scheduleId: assetHourMaintenancePlans.scheduleId,
      scheduleName: maintenanceSchedules.name,
      scheduleCalendarId: maintenanceSchedules.calendarId,
      scheduleChecklistTemplateId: maintenanceSchedules.checklistTemplateId,
      scheduleColor: maintenanceSchedules.color,
      nextRunAt: maintenanceSchedules.nextRunAt,
      recurrence: maintenanceSchedules.recurrence,
      calendarName: calendars.name,
    })
    .from(assetHourMaintenancePlans)
    .innerJoin(
      maintenanceSchedules,
      eq(assetHourMaintenancePlans.scheduleId, maintenanceSchedules.id)
    )
    .leftJoin(calendars, eq(maintenanceSchedules.calendarId, calendars.id))
    .where(
      and(
        eq(assetHourMaintenancePlans.assetId, assetId),
        isNull(maintenanceSchedules.deletedAt)
      )
    )
    .orderBy(asc(assetHourMaintenancePlans.createdAt));

  const assignees = await loadManyMaintenanceScheduleAssigneeIds(
    rows.map((r) => r.scheduleId)
  );

  return NextResponse.json(
    rows.map((r) =>
      hourMaintenancePlanView({
        id: r.id,
        name: r.scheduleName || r.name,
        hoursPerDay: r.hoursPerDay,
        everyHours: r.everyHours,
        startDate: r.startDate,
        workdays: r.workdays,
        calendarId: r.scheduleCalendarId ?? r.planCalendarId,
        calendarName: r.calendarName,
        checklistTemplateId:
          r.scheduleChecklistTemplateId ?? r.planChecklistTemplateId,
        color: r.scheduleColor ?? r.planColor,
        scheduleId: r.scheduleId,
        nextRunAt: r.nextRunAt,
        recurrence: r.recurrence,
        assigneeIds: assignees.get(r.scheduleId) ?? [],
      })
    )
  );
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: assetId } = await params;
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, assetId),
    columns: { id: true, name: true },
  });
  if (!asset) {
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

  const { recurrence, nextRunAt, rule } = hourMaintenanceSchedulePayload({
    hoursPerDay: parsed.value.hoursPerDay,
    everyHours: parsed.value.everyHours,
    anchorDate: parsed.value.startDate,
    workdays: parsed.value.workdays,
  });

  const scheduleId = createId();
  const planId = createId();

  await db.insert(maintenanceSchedules).values({
    id: scheduleId,
    name: parsed.value.name,
    assetId,
    assigneeId: related.assigneeIds[0] ?? null,
    color: parsed.value.color,
    checklistTemplateId: related.checklistTemplateId,
    calendarId: related.calendarId,
    recurrence,
    nextRunAt,
  });

  await setMaintenanceScheduleAssigneeIds(scheduleId, related.assigneeIds);

  await db.insert(assetHourMaintenancePlans).values({
    id: planId,
    assetId,
    name: parsed.value.name,
    hoursPerDay: parsed.value.hoursPerDay,
    everyHours: parsed.value.everyHours,
    startDate: parsed.value.startDate,
    workdays: parsed.value.workdays,
    calendarId: related.calendarId,
    checklistTemplateId: related.checklistTemplateId,
    color: parsed.value.color,
    scheduleId,
  });

  await recordAuditLog({
    entityType: "maintenance_schedule",
    entityId: scheduleId,
    action: "created",
    userId: session.id,
    metadata: {
      name: parsed.value.name,
      recurrence: rule,
      nextRunAt: nextRunAt.toISOString(),
      hourPlanId: planId,
    },
  });
  await recordAuditLog({
    entityType: "asset_hour_maintenance_plan",
    entityId: planId,
    action: "created",
    userId: session.id,
    metadata: {
      assetId,
      scheduleId,
      hoursPerDay: parsed.value.hoursPerDay,
      everyHours: parsed.value.everyHours,
      startDate: parsed.value.startDate,
      workdays: parsed.value.workdays,
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
      calendarName: null,
      checklistTemplateId: related.checklistTemplateId,
      color: parsed.value.color,
      scheduleId,
      nextRunAt,
      recurrence,
      assigneeIds: related.assigneeIds,
    }),
    { status: 201 }
  );
}
