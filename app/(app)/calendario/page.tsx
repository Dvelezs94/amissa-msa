import { Suspense } from "react";
import { getSession } from "@/lib/auth";
import {
  canManageCalendarEvents,
  canRenameCalendar,
} from "@/lib/auth-shared";
import { db } from "@/lib/db";
import {
  maintenanceSchedules,
  assets,
  calendars,
  checklistTemplates,
  users,
} from "@/lib/db/schema";
import { loadManyMaintenanceScheduleAssigneeIds } from "@/lib/assignees";
import { assignOrphanSchedulesToDefaultCalendar } from "@/lib/ensure-default-calendar";
import { asc, desc, isNotNull, isNull } from "drizzle-orm";
import { CalendarWorkspace } from "./CalendarWorkspace";
import { DeletedSchedulesSection } from "./DeletedSchedulesSection";

export const dynamic = "force-dynamic";

export default async function CalendarioPage() {
  const session = await getSession();
  const canRenameCalendars = canRenameCalendar(session?.role);
  const canManageEvents = canManageCalendarEvents(session?.role);
  await assignOrphanSchedulesToDefaultCalendar();

  const userList = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .orderBy(users.name);

  const calendarList = await db
    .select({
      id: calendars.id,
      name: calendars.name,
      sortOrder: calendars.sortOrder,
    })
    .from(calendars)
    .orderBy(asc(calendars.sortOrder), asc(calendars.name));

  const schedules = await db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      recurrence: maintenanceSchedules.recurrence,
      color: maintenanceSchedules.color,
      assigneeId: maintenanceSchedules.assigneeId,
      nextRunAt: maintenanceSchedules.nextRunAt,
      checklistTemplateId: maintenanceSchedules.checklistTemplateId,
      assetId: maintenanceSchedules.assetId,
      calendarId: maintenanceSchedules.calendarId,
    })
    .from(maintenanceSchedules)
    .where(isNull(maintenanceSchedules.deletedAt))
    .orderBy(asc(maintenanceSchedules.nextRunAt), asc(maintenanceSchedules.name));

  const DELETED_PAGE_SIZE = 5;
  const deletedSchedules = await db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      deletedAt: maintenanceSchedules.deletedAt,
    })
    .from(maintenanceSchedules)
    .where(isNotNull(maintenanceSchedules.deletedAt))
    .orderBy(desc(maintenanceSchedules.deletedAt))
    .limit(DELETED_PAGE_SIZE + 1);
  const deletedInitial = deletedSchedules.slice(0, DELETED_PAGE_SIZE);
  const deletedInitialHasMore = deletedSchedules.length > DELETED_PAGE_SIZE;

  const assetOptions = await db
    .select({
      id: assets.id,
      name: assets.name,
      assetId: assets.assetId,
    })
    .from(assets)
    .orderBy(assets.name);

  const templateOptions = await db
    .select({ id: checklistTemplates.id, name: checklistTemplates.name })
    .from(checklistTemplates)
    .orderBy(checklistTemplates.name);

  const scheduleIds = schedules.map((s) => s.id);
  const assigneesBySchedule =
    await loadManyMaintenanceScheduleAssigneeIds(scheduleIds);

  const calendarSchedules = schedules.map((s) => {
    const junction = assigneesBySchedule.get(s.id) ?? [];
    const assigneeIds =
      junction.length > 0 ? junction : s.assigneeId ? [s.assigneeId] : [];
    return {
      id: s.id,
      name: s.name,
      recurrence: s.recurrence,
      color: s.color,
      assigneeIds,
      nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
      checklistTemplateId: s.checklistTemplateId ?? null,
      assetId: s.assetId ?? null,
      calendarId: s.calendarId ?? null,
    };
  });

  return (
    <div className="space-y-5">
      <Suspense fallback={null}>
        <CalendarWorkspace
          calendars={calendarList}
          schedules={calendarSchedules}
          assets={assetOptions.map((a) => ({
            id: a.id,
            name: a.name,
            sublabel: a.assetId,
          }))}
          users={userList}
          checklistTemplates={templateOptions}
          canRenameCalendars={canRenameCalendars}
          canManageEvents={canManageEvents}
        />
      </Suspense>

      {canManageEvents ? (
        <DeletedSchedulesSection
          initial={deletedInitial.map((d) => ({
            id: d.id,
            name: d.name,
            deletedAt: d.deletedAt ? d.deletedAt.toISOString() : null,
          }))}
          initialHasMore={deletedInitialHasMore}
        />
      ) : null}
    </div>
  );
}
