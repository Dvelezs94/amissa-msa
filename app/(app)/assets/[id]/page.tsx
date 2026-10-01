import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  assets,
  assetFiles,
  assetHourMaintenancePlans,
  calendars,
  checklistTemplates,
  maintenanceSchedules,
  users,
  workOrders,
} from "@/lib/db/schema";
import { loadManyMaintenanceScheduleAssigneeIds } from "@/lib/assignees";
import { hourMaintenancePlanView } from "@/lib/hour-maintenance";
import { AssetFilesSection } from "./AssetFilesSection";
import { AssetWorkOrdersList } from "./AssetWorkOrdersList";
import { AssetCalendarEventsList } from "./AssetCalendarEventsList";
import { AssetHourMaintenanceSection } from "./AssetHourMaintenanceSection";
import { AssetActions } from "./AssetActions";
import { formatDowntimeMinutesSpanish } from "@/lib/machine-downtime";
import { SetPageHeader } from "@/components/SetPageHeader";
import { AssetPhotoThumb } from "../AssetImageField";

async function getAsset(id: string) {
  const asset = await db.query.assets.findFirst({
    where: eq(assets.id, id),
  });
  if (!asset) return null;
  const [
    workOrdersList,
    scheduleList,
    files,
    downtimeRow,
    hourPlanRows,
    calendarOptions,
    templateOptions,
    userOptions,
  ] = await Promise.all([
    db
      .select({
        id: workOrders.id,
        title: workOrders.title,
        status: workOrders.status,
        dueDate: workOrders.dueDate,
        priority: workOrders.priority,
        createdAt: workOrders.createdAt,
        assigneeId: users.id,
        assigneeAvatarUrl: users.avatarUrl,
        assigneeName: users.name,
      })
      .from(workOrders)
      .leftJoin(users, eq(workOrders.assigneeId, users.id))
      .where(eq(workOrders.assetId, id))
      .orderBy(desc(workOrders.createdAt)),
    db
      .select({
        id: maintenanceSchedules.id,
        name: maintenanceSchedules.name,
        recurrence: maintenanceSchedules.recurrence,
        nextRunAt: maintenanceSchedules.nextRunAt,
        color: maintenanceSchedules.color,
        calendarName: calendars.name,
      })
      .from(maintenanceSchedules)
      .leftJoin(calendars, eq(maintenanceSchedules.calendarId, calendars.id))
      .where(
        and(
          eq(maintenanceSchedules.assetId, id),
          isNull(maintenanceSchedules.deletedAt)
        )
      )
      .orderBy(
        asc(maintenanceSchedules.nextRunAt),
        asc(maintenanceSchedules.name)
      ),
    db.query.assetFiles.findMany({
      where: eq(assetFiles.assetId, id),
      orderBy: (f, { desc: d }) => [d(f.createdAt)],
    }),
    db
      .select({
        totalMinutes: sql<number>`
          coalesce(sum(
            case when ${workOrders.status} = 'completed' then
              (case when ${workOrders.countsMachineDowntime} = true
                    and ${workOrders.startedAt} is not null
                    and ${workOrders.completedAt} is not null
                then floor(extract(epoch from (${workOrders.completedAt} - ${workOrders.startedAt})) / 60)
                else 0 end) + coalesce(${workOrders.manualDowntimeMinutes}, 0)
            else 0 end
          ), 0)::int
        `.mapWith(Number),
      })
      .from(workOrders)
      .where(eq(workOrders.assetId, id)),
    db
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
          eq(assetHourMaintenancePlans.assetId, id),
          isNull(maintenanceSchedules.deletedAt)
        )
      )
      .orderBy(asc(assetHourMaintenancePlans.createdAt)),
    db
      .select({
        id: calendars.id,
        name: calendars.name,
      })
      .from(calendars)
      .orderBy(asc(calendars.sortOrder), asc(calendars.name)),
    db
      .select({
        id: checklistTemplates.id,
        name: checklistTemplates.name,
      })
      .from(checklistTemplates)
      .orderBy(asc(checklistTemplates.name)),
    db
      .select({
        id: users.id,
        name: users.name,
      })
      .from(users)
      .orderBy(asc(users.name)),
  ]);
  const downtimeTotalMinutes = downtimeRow[0]?.totalMinutes ?? 0;
  const hourPlanAssignees = await loadManyMaintenanceScheduleAssigneeIds(
    hourPlanRows.map((r) => r.scheduleId)
  );
  return {
    ...asset,
    workOrders: workOrdersList,
    schedules: scheduleList,
    files,
    downtimeTotalMinutes,
    hourPlans: hourPlanRows.map((r) =>
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
        assigneeIds: hourPlanAssignees.get(r.scheduleId) ?? [],
      })
    ),
    calendarOptions,
    templateOptions,
    userOptions,
  };
}

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const asset = await getAsset(id);
  if (!asset) notFound();
  return (
    <div className="space-y-6">
      <SetPageHeader
        title={asset.name}
        subtitle={asset.assetId}
        filters={
          <Link
            href="/assets"
            className="inline-flex items-center gap-1 text-sm font-medium text-[#F14C03] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Máquinas
          </Link>
        }
        actions={
          <>
            <AssetHourMaintenanceSection
              assetId={id}
              assetName={asset.name}
              calendars={asset.calendarOptions}
              checklistTemplates={asset.templateOptions}
              users={asset.userOptions}
              initialPlans={asset.hourPlans}
            />
            <AssetActions id={asset.id} name={asset.name} />
          </>
        }
      />
      <section className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <AssetPhotoThumb
          assetId={asset.id}
          hasImage={asset.imageUrl}
          name={asset.name}
          size="lg"
          cacheKey={asset.updatedAt}
        />
        <div className="min-w-0">
          <p className="text-sm text-zinc-500">ID</p>
          <p className="font-medium text-zinc-900">{asset.assetId}</p>
          <Link
            href={`/assets/${asset.id}/edit`}
            className="mt-2 inline-block text-sm font-medium text-primary-600 hover:underline"
          >
            {asset.imageUrl ? "Cambiar foto" : "Añadir foto"}
          </Link>
        </div>
      </section>
      <section
        aria-labelledby="downtime-heading"
        className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
      >
        <h2 id="downtime-heading" className="text-sm font-semibold text-zinc-900">
          Paro de máquina acumulado
        </h2>
        {asset.tracksMachineDowntime === false ? (
          <p className="mt-2 text-sm text-zinc-600">
            El seguimiento de paro de máquina está desactivado para este activo. Puedes activarlo
            al editar la máquina.
          </p>
        ) : (
          <>
            <p className="mt-1 text-xs text-zinc-500">
              Suma de tareas completadas con paro automático (en curso → terminada) más paro manual
              registrado en cada tarea.
            </p>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-zinc-900">
              {formatDowntimeMinutesSpanish(asset.downtimeTotalMinutes)}
            </p>
          </>
        )}
      </section>

      <AssetFilesSection
        assetId={id}
        initialFiles={asset.files.map((f) => ({
          ...f,
          // Proxy through signed-download route (DB stores raw S3 URL).
          fileUrl: `/api/asset-files/${f.id}`,
        }))}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">Tareas</h2>
            {asset.workOrders.length > 0 ? (
              <span className="tabular-nums text-xs text-zinc-500">
                {asset.workOrders.length}
              </span>
            ) : null}
          </div>
          {asset.workOrders.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aún no hay tareas para esta máquina.
            </p>
          ) : (
            <AssetWorkOrdersList workOrders={asset.workOrders} />
          )}
        </section>

        <section className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Eventos del calendario
            </h2>
            {asset.schedules.length > 0 ? (
              <span className="tabular-nums text-xs text-zinc-500">
                {asset.schedules.length}
              </span>
            ) : null}
          </div>
          {asset.schedules.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No hay eventos de mantenimiento vinculados a esta máquina.
            </p>
          ) : (
            <AssetCalendarEventsList
              events={asset.schedules.map((s) => ({
                id: s.id,
                name: s.name,
                recurrence: s.recurrence,
                nextRunAt: s.nextRunAt,
                color: s.color,
                calendarName: s.calendarName,
              }))}
            />
          )}
        </section>
      </div>
    </div>
  );
}
