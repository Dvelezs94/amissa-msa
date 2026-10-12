/**
 * Demo seed for PostgreSQL. Run: `npm run db:seed`
 * Requires DATABASE_URL and an existing schema (`npm run db:push`).
 * Idempotent: existing rows (by username, assetId, title, etc.) are skipped or upserted.
 */
import { execSync } from "node:child_process";
import bcrypt from "bcryptjs";
import { count, eq } from "drizzle-orm";
import {
  buildChecklistRevisionReviewRequestBody,
  CHECKLIST_REVISION_REVIEW_TITLE,
} from "../lib/checklist-notification-parse";
import { db, pool } from "../lib/db";
import * as schema from "../lib/db/schema";
import {
  buildRecurrenceJson,
  nextScheduledOccurrenceOnOrAfter,
} from "../lib/maintenance-recurrence";
import { maintenanceScheduleWorkOrderDescription } from "../lib/maintenance-schedule-work-order";
import {
  addCalendarDaysYmd,
  assignSeedChecklistItemIds,
  dateFromYmdAtHour,
  seedChecklistItemCompleted,
} from "../lib/seed-helpers";
import { nextPrefixedFolio } from "../lib/work-order-folio-helpers";
import { ymdInTimeZone } from "../lib/work-order-start-date";
import {
  assetGroupSeed,
  assetSeed,
  calendarSeed,
  checklistFolderSeed,
  checklistSeed,
  dashboardWidgetSeed,
  proposedRevisionSeed,
  requestSeed,
  scheduleSeed,
  SEED_PASSWORDS,
  userSeed,
  workOrderSeed,
} from "./seed-data";

function rid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

async function usersTableExists(): Promise<boolean> {
  const r = await pool.query<{ reg: string | null }>(
    "SELECT to_regclass('public.users') AS reg"
  );
  return r.rows[0]?.reg != null;
}

async function main() {
  if (!(await usersTableExists())) {
    console.log("No users table. Running: npx drizzle-kit push --force");
    execSync("npx drizzle-kit push --force", { stdio: "inherit", cwd: process.cwd() });
  }

  const todayYmd = ymdInTimeZone(new Date());
  const passwordHashes = new Map<string, string>();
  for (const password of Object.values(SEED_PASSWORDS)) {
    passwordHashes.set(password, await bcrypt.hash(password, 10));
  }

  const stats = {
    usersInserted: 0,
    usersUpdated: 0,
    groupsInserted: 0,
    assetsInserted: 0,
    foldersInserted: 0,
    templatesInserted: 0,
    itemsInserted: 0,
    calendarsInserted: 0,
    schedulesInserted: 0,
    workOrdersInserted: 0,
    checklistInstancesInserted: 0,
    notesInserted: 0,
    notificationsInserted: 0,
    requestsInserted: 0,
    revisionsInserted: 0,
    widgetsInserted: 0,
  };

  await db.transaction(async (tx) => {
    const userIdByUsername = new Map<string, string>();
    for (const u of userSeed) {
      const passwordHash = passwordHashes.get(u.password);
      if (!passwordHash) throw new Error(`Missing hash for ${u.username}`);
      const existing = await tx
        .select({ id: schema.users.id })
        .from(schema.users)
        .where(eq(schema.users.username, u.username))
        .limit(1);
      if (existing[0]) {
        await tx
          .update(schema.users)
          .set({
            email: u.email,
            name: u.name,
            passwordHash,
            role: u.role,
            avatarBackgroundColor: u.avatarBackgroundColor,
          })
          .where(eq(schema.users.id, existing[0].id));
        userIdByUsername.set(u.username, existing[0].id);
        stats.usersUpdated += 1;
      } else {
        const id = rid("usr");
        await tx.insert(schema.users).values({
          id,
          username: u.username,
          email: u.email,
          name: u.name,
          passwordHash,
          role: u.role,
          avatarBackgroundColor: u.avatarBackgroundColor,
        });
        userIdByUsername.set(u.username, id);
        stats.usersInserted += 1;
      }
    }

    const groupIdByName = new Map<string, string>();
    for (const group of assetGroupSeed) {
      const existing = await tx
        .select({ id: schema.assetGroups.id })
        .from(schema.assetGroups)
        .where(eq(schema.assetGroups.name, group.name))
        .limit(1);
      if (existing[0]) {
        groupIdByName.set(group.name, existing[0].id);
        continue;
      }
      const id = rid("agr");
      await tx.insert(schema.assetGroups).values({
        id,
        name: group.name,
        sortOrder: group.sortOrder,
      });
      groupIdByName.set(group.name, id);
      stats.groupsInserted += 1;
    }

    const assetIdByCode = new Map<string, string>();
    for (const asset of assetSeed) {
      const groupId = groupIdByName.get(asset.groupName) ?? null;
      const existing = await tx
        .select({ id: schema.assets.id })
        .from(schema.assets)
        .where(eq(schema.assets.assetId, asset.assetId))
        .limit(1);
      if (existing[0]) {
        await tx
          .update(schema.assets)
          .set({
            groupId,
            metadata: asset.metadata,
            tracksMachineDowntime: asset.tracksMachineDowntime ?? true,
            updatedAt: new Date(),
          })
          .where(eq(schema.assets.id, existing[0].id));
        assetIdByCode.set(asset.assetId, existing[0].id);
        continue;
      }
      const id = rid("ast");
      await tx.insert(schema.assets).values({
        id,
        name: asset.name,
        assetId: asset.assetId,
        groupId,
        metadata: asset.metadata,
        tracksMachineDowntime: asset.tracksMachineDowntime ?? true,
      });
      assetIdByCode.set(asset.assetId, id);
      stats.assetsInserted += 1;
    }

    const folderIdByName = new Map<string, string>();
    for (const folder of checklistFolderSeed) {
      const existing = await tx
        .select({ id: schema.checklistFolders.id })
        .from(schema.checklistFolders)
        .where(eq(schema.checklistFolders.name, folder.name))
        .limit(1);
      if (existing[0]) {
        folderIdByName.set(folder.name, existing[0].id);
        continue;
      }
      const id = rid("fld");
      await tx.insert(schema.checklistFolders).values({
        id,
        name: folder.name,
        sortOrder: folder.sortOrder,
      });
      folderIdByName.set(folder.name, id);
      stats.foldersInserted += 1;
    }

    const templateIdByName = new Map<string, string>();
    for (const template of checklistSeed) {
      const folderId = folderIdByName.get(template.folderName) ?? null;
      const existingTpl = await tx
        .select({ id: schema.checklistTemplates.id })
        .from(schema.checklistTemplates)
        .where(eq(schema.checklistTemplates.name, template.name))
        .limit(1);

      let templateId: string;
      if (existingTpl[0]) {
        templateId = existingTpl[0].id;
        await tx
          .update(schema.checklistTemplates)
          .set({ description: template.description, folderId })
          .where(eq(schema.checklistTemplates.id, templateId));
      } else {
        templateId = rid("tpl");
        await tx.insert(schema.checklistTemplates).values({
          id: templateId,
          name: template.name,
          description: template.description,
          folderId,
        });
        stats.templatesInserted += 1;
      }
      templateIdByName.set(template.name, templateId);

      const existingItems = await tx
        .select({
          id: schema.checklistTemplateItems.id,
          type: schema.checklistTemplateItems.type,
        })
        .from(schema.checklistTemplateItems)
        .where(eq(schema.checklistTemplateItems.checklistTemplateId, templateId));
      const seedHasSection = template.items.some((item) => item.type === "section");
      const existingHasSection = existingItems.some((item) => item.type === "section");
      if (existingItems.length > 0 && !(seedHasSection && !existingHasSection)) {
        continue;
      }
      if (existingItems.length > 0) {
        await tx
          .delete(schema.checklistTemplateItems)
          .where(eq(schema.checklistTemplateItems.checklistTemplateId, templateId));
      }

      const rows = assignSeedChecklistItemIds(template.items, () => rid("it"));
      for (let index = 0; index < rows.length; index += 1) {
        const item = rows[index]!;
        await tx.insert(schema.checklistTemplateItems).values({
          id: item.id,
          checklistTemplateId: templateId,
          parentItemId: item.parentItemId,
          type: item.type,
          label: item.label,
          sortOrder: index,
          fieldType: item.fieldType,
          options: item.options,
          isOptional: item.isOptional ?? false,
        });
        stats.itemsInserted += 1;
      }
    }

    for (const calendar of calendarSeed) {
      const existing = await tx
        .select({ id: schema.calendars.id })
        .from(schema.calendars)
        .where(eq(schema.calendars.id, calendar.id))
        .limit(1);
      if (existing[0]) {
        await tx
          .update(schema.calendars)
          .set({
            name: calendar.name,
            color: calendar.color,
            sortOrder: calendar.sortOrder,
          })
          .where(eq(schema.calendars.id, calendar.id));
        continue;
      }
      await tx.insert(schema.calendars).values(calendar);
      stats.calendarsInserted += 1;
    }

    const scheduleIdByName = new Map<string, string>();
    for (const schedule of scheduleSeed) {
      const existing = await tx
        .select({ id: schema.maintenanceSchedules.id })
        .from(schema.maintenanceSchedules)
        .where(eq(schema.maintenanceSchedules.name, schedule.name))
        .limit(1);
      const assigneeIds = schedule.assigneeUsernames
        .map((name) => userIdByUsername.get(name))
        .filter((id): id is string => Boolean(id));
      if (existing[0]) {
        scheduleIdByName.set(schedule.name, existing[0].id);
        continue;
      }

      const anchorDate = addCalendarDaysYmd(todayYmd, schedule.anchorOffsetDays);
      const rule = {
        frequency: schedule.frequency,
        interval: schedule.interval,
        anchorDate,
        weekdays: schedule.weekdays,
      };
      const recurrence = buildRecurrenceJson(rule);
      const nextRunAt =
        nextScheduledOccurrenceOnOrAfter(rule, dateFromYmdAtHour(todayYmd, 6)) ??
        dateFromYmdAtHour(addCalendarDaysYmd(todayYmd, 1), 8);
      const id = rid("ms");
      await tx.insert(schema.maintenanceSchedules).values({
        id,
        name: schedule.name,
        assetId: schedule.assetCode
          ? assetIdByCode.get(schedule.assetCode) ?? null
          : null,
        assigneeId: assigneeIds[0] ?? null,
        color: schedule.color,
        recurrence,
        checklistTemplateId: templateIdByName.get(schedule.templateName) ?? null,
        calendarId: schedule.calendarId,
        nextRunAt,
      });
      if (assigneeIds.length > 0) {
        await tx.insert(schema.maintenanceScheduleAssignees).values(
          assigneeIds.map((userId) => ({
            maintenanceScheduleId: id,
            userId,
          }))
        );
      }
      scheduleIdByName.set(schedule.name, id);
      stats.schedulesInserted += 1;
    }

    const existingFolios = await tx
      .select({
        folio: schema.workOrders.folio,
        kind: schema.workOrders.kind,
      })
      .from(schema.workOrders);
    const otFolios: (string | null)[] = [];
    const ruFolios: (string | null)[] = [];
    for (const row of existingFolios) {
      if (row.kind === "routine") ruFolios.push(row.folio);
      else otFolios.push(row.folio);
    }
    const workOrderIdByTitle = new Map<string, string>();
    let boardSort = 0;

    for (const workOrder of workOrderSeed) {
      const existingWo = await tx
        .select({ id: schema.workOrders.id })
        .from(schema.workOrders)
        .where(eq(schema.workOrders.title, workOrder.title))
        .limit(1);
      if (existingWo[0]) {
        workOrderIdByTitle.set(workOrder.title, existingWo[0].id);
        continue;
      }

      const assigneeIds = workOrder.assigneeUsernames
        .map((name) => userIdByUsername.get(name))
        .filter((id): id is string => Boolean(id));
      const requesterId = userIdByUsername.get(workOrder.requesterUsername);
      if (!requesterId || assigneeIds.length === 0) {
        throw new Error(`Usuarios faltantes para tarea: ${workOrder.title}`);
      }

      const startDate =
        workOrder.startOffsetDays == null
          ? null
          : dateFromYmdAtHour(addCalendarDaysYmd(todayYmd, workOrder.startOffsetDays), 8);
      const dueDate =
        workOrder.dueOffsetDays == null
          ? null
          : dateFromYmdAtHour(addCalendarDaysYmd(todayYmd, workOrder.dueOffsetDays), 17);
      const createdAt = startDate ?? dateFromYmdAtHour(todayYmd, 8);
      const startedAt =
        workOrder.status === "in_progress" || workOrder.status === "completed"
          ? dateFromYmdAtHour(
              addCalendarDaysYmd(todayYmd, workOrder.startOffsetDays ?? 0),
              9
            )
          : null;
      const completedAt =
        workOrder.status === "completed"
          ? dateFromYmdAtHour(
              addCalendarDaysYmd(todayYmd, workOrder.dueOffsetDays ?? 0),
              16
            )
          : null;

      const scheduleId = workOrder.scheduleName
        ? scheduleIdByName.get(workOrder.scheduleName)
        : undefined;
      const description = scheduleId
        ? maintenanceScheduleWorkOrderDescription(
            scheduleId,
            workOrder.scheduleName
          )
        : workOrder.description;

      const workOrderId = rid("wo");
      const folio =
        workOrder.kind === "routine"
          ? nextPrefixedFolio(ruFolios, "RU")
          : nextPrefixedFolio(otFolios, "OT");
      await tx.insert(schema.workOrders).values({
        id: workOrderId,
        folio,
        title: workOrder.title,
        description,
        status: workOrder.status,
        priority: workOrder.priority,
        kind: workOrder.kind,
        assetId: workOrder.assetCode
          ? assetIdByCode.get(workOrder.assetCode) ?? null
          : null,
        assigneeId: assigneeIds[0]!,
        requesterId,
        startDate,
        dueDate,
        startedAt,
        completedAt,
        createdAt,
        updatedAt: completedAt ?? startedAt ?? createdAt,
        boardSortOrder: boardSort,
        countsMachineDowntime: workOrder.countsMachineDowntime ?? false,
        manualDowntimeMinutes: workOrder.manualDowntimeMinutes ?? 0,
      });
      if (workOrder.kind === "routine") ruFolios.push(folio);
      else otFolios.push(folio);
      boardSort += 1;
      workOrderIdByTitle.set(workOrder.title, workOrderId);
      stats.workOrdersInserted += 1;

      await tx.insert(schema.workOrderAssignees).values(
        assigneeIds.map((userId) => ({ workOrderId, userId }))
      );

      const templateId = workOrder.templateName
        ? templateIdByName.get(workOrder.templateName)
        : undefined;
      if (templateId) {
        const templateItems = await tx
          .select()
          .from(schema.checklistTemplateItems)
          .where(eq(schema.checklistTemplateItems.checklistTemplateId, templateId));
        const idMap = new Map<string, string>();
        for (const item of templateItems) {
          idMap.set(item.id, rid("woi"));
        }
        const ordered = [...templateItems].sort((a, b) => a.sortOrder - b.sortOrder);
        for (const item of ordered) {
          await tx.insert(schema.workOrderChecklist).values({
            id: idMap.get(item.id)!,
            workOrderId,
            checklistTemplateId: templateId,
            parentItemId: item.parentItemId
              ? idMap.get(item.parentItemId) ?? null
              : null,
            type: item.type,
            label: item.label,
            sortOrder: item.sortOrder,
            completed: seedChecklistItemCompleted({
              type: item.type,
              status: workOrder.status,
              sortOrder: item.sortOrder,
            }),
            value:
              workOrder.fieldValues && item.label in workOrder.fieldValues
                ? workOrder.fieldValues[item.label]
                : null,
            fieldType: item.fieldType ?? undefined,
            options: item.options ?? undefined,
            isOptional: item.isOptional ?? false,
          });
          stats.checklistInstancesInserted += 1;
        }
      }

      for (const body of workOrder.notes ?? []) {
        await tx.insert(schema.notes).values({
          id: rid("nte"),
          workOrderId,
          userId: assigneeIds[0]!,
          body,
          createdAt,
        });
        stats.notesInserted += 1;
      }
    }

    for (const req of requestSeed) {
      const existing = await tx
        .select({ id: schema.requests.id })
        .from(schema.requests)
        .where(eq(schema.requests.description, req.description))
        .limit(1);
      if (existing[0]) continue;
      const requesterId = userIdByUsername.get(req.requesterUsername);
      if (!requesterId) continue;
      await tx.insert(schema.requests).values({
        id: rid("req"),
        description: req.description,
        priority: req.priority,
        assetId: req.assetCode ? assetIdByCode.get(req.assetCode) ?? null : null,
        requesterId,
        status: req.status,
        workOrderId: req.convertedWorkOrderTitle
          ? workOrderIdByTitle.get(req.convertedWorkOrderTitle) ?? null
          : null,
      });
      stats.requestsInserted += 1;
    }

    const hornoTemplateId = templateIdByName.get(proposedRevisionSeed.templateName);
    const operadorId = userIdByUsername.get("operador");
    const calidadId = userIdByUsername.get("calidad");
    if (hornoTemplateId && operadorId) {
      const existingRev = await tx
        .select({ id: schema.checklistTemplateRevisions.id })
        .from(schema.checklistTemplateRevisions)
        .where(eq(schema.checklistTemplateRevisions.name, proposedRevisionSeed.revisionName))
        .limit(1);
      if (!existingRev[0]) {
        const tpl = await tx.query.checklistTemplates.findFirst({
          where: eq(schema.checklistTemplates.id, hornoTemplateId),
        });
        const items = await tx
          .select()
          .from(schema.checklistTemplateItems)
          .where(eq(schema.checklistTemplateItems.checklistTemplateId, hornoTemplateId));
        const snapshotItems = items
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({
            type: item.type,
            label: item.label,
            fieldType: item.fieldType,
            options: item.options,
            id: item.id,
            parentItemId: item.parentItemId,
            isOptional: item.isOptional,
          }));
        const revisionId = rid("rev");
        await tx.insert(schema.checklistTemplateRevisions).values({
          id: revisionId,
          checklistTemplateId: hornoTemplateId,
          revisionNumber: 1,
          name: proposedRevisionSeed.revisionName,
          status: "proposed",
          proposedByUserId: operadorId,
          snapshot: {
            before: {
              name: tpl?.name ?? proposedRevisionSeed.templateName,
              description: tpl?.description ?? null,
              items: snapshotItems,
            },
            after: {
              name: tpl?.name ?? proposedRevisionSeed.templateName,
              description: tpl?.description ?? null,
              items: [
                ...snapshotItems,
                {
                  type: proposedRevisionSeed.extraAfterItem.type,
                  label: proposedRevisionSeed.extraAfterItem.label,
                  fieldType: proposedRevisionSeed.extraAfterItem.fieldType ?? null,
                  options: proposedRevisionSeed.extraAfterItem.options ?? null,
                  isOptional: proposedRevisionSeed.extraAfterItem.isOptional ?? false,
                },
              ],
            },
          },
        });
        stats.revisionsInserted += 1;

        if (calidadId) {
          await tx.insert(schema.notifications).values({
            id: rid("ntf"),
            userId: calidadId,
            type: "work_order_update",
            title: CHECKLIST_REVISION_REVIEW_TITLE,
            body: buildChecklistRevisionReviewRequestBody({
              templateId: hornoTemplateId,
              revisionId,
              templateName: proposedRevisionSeed.templateName,
              revisionName: proposedRevisionSeed.revisionName,
              proposedByName: "Técnico Turno A",
            }),
          });
          stats.notificationsInserted += 1;
        }
      }
    }

    const fallaId = workOrderIdByTitle.get("Falla de calentamiento en horno HT-01");
    const operadorUserId = userIdByUsername.get("operador");
    if (fallaId && operadorUserId) {
      const existingN = await tx
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(eq(schema.notifications.title, "Nueva tarea asignada"))
        .limit(1);
      if (!existingN[0]) {
        await tx.insert(schema.notifications).values({
          id: rid("ntf"),
          userId: operadorUserId,
          type: "assignment",
          title: "Nueva tarea asignada",
          body: "Falla de calentamiento en horno HT-01",
          workOrderId: fallaId,
        });
        stats.notificationsInserted += 1;
      }
    }

    const fugaId = workOrderIdByTitle.get("Fuga de aceite dobladora DB-01");
    const adminId = userIdByUsername.get("admin");
    if (fugaId && adminId) {
      const existingN = await tx
        .select({ id: schema.notifications.id })
        .from(schema.notifications)
        .where(eq(schema.notifications.title, "Tarea completada"))
        .limit(1);
      if (!existingN[0]) {
        await tx.insert(schema.notifications).values({
          id: rid("ntf"),
          userId: adminId,
          type: "work_order_update",
          title: "Tarea completada",
          body: "Fuga de aceite dobladora DB-01",
          workOrderId: fugaId,
        });
        stats.notificationsInserted += 1;
      }
    }

    for (const widget of dashboardWidgetSeed) {
      const userId = userIdByUsername.get(widget.username);
      const templateId = templateIdByName.get(widget.templateName);
      if (!userId || !templateId) continue;
      const existing = await tx
        .select({ id: schema.dashboardWidgets.id })
        .from(schema.dashboardWidgets)
        .where(eq(schema.dashboardWidgets.chartTitle, widget.chartTitle))
        .limit(1);
      if (existing[0]) continue;
      await tx.insert(schema.dashboardWidgets).values({
        id: rid("wdg"),
        userId,
        templateId,
        templateName: widget.templateName,
        fieldLabel: widget.fieldLabel,
        fieldLabels: [widget.fieldLabel],
        chartType: widget.chartType,
        chartTitle: widget.chartTitle,
        dateFrom: addCalendarDaysYmd(todayYmd, -40),
        dateTo: todayYmd,
        sortOrder: stats.widgetsInserted,
      });
      stats.widgetsInserted += 1;
    }
  });

  console.log("Seed completado para entorno metalmecánico (español).");
  console.log(`Usuarios insertados: ${stats.usersInserted} (actualizados: ${stats.usersUpdated})`);
  console.log(`Áreas insertadas: ${stats.groupsInserted}`);
  console.log(`Activos insertados: ${stats.assetsInserted}`);
  console.log(`Carpetas de checklist: ${stats.foldersInserted}`);
  console.log(`Plantillas insertadas: ${stats.templatesInserted}`);
  console.log(`Ítems de plantilla insertados: ${stats.itemsInserted}`);
  console.log(`Calendarios insertados: ${stats.calendarsInserted}`);
  console.log(`Eventos de calendario: ${stats.schedulesInserted}`);
  console.log(`Órdenes de trabajo insertadas: ${stats.workOrdersInserted}`);
  console.log(`Ítems de checklist en órdenes: ${stats.checklistInstancesInserted}`);
  console.log(`Notas: ${stats.notesInserted}`);
  console.log(`Notificaciones: ${stats.notificationsInserted}`);
  console.log(`Solicitudes: ${stats.requestsInserted}`);
  console.log(`Revisiones de checklist: ${stats.revisionsInserted}`);
  console.log(`Widgets de dashboard: ${stats.widgetsInserted}`);
  console.log("");
  console.log("Credenciales de prueba:");
  console.log(`- admin (admin@admin.com) / ${SEED_PASSWORDS.admin}`);
  console.log(`- operador / ${SEED_PASSWORDS.tecnico}`);
  console.log(`- operador.b / ${SEED_PASSWORDS.tecnico}`);
  console.log(`- calidad / ${SEED_PASSWORDS.calidad}`);
}

main()
  .catch((err) => {
    console.error("Error ejecutando seed:", err);
    process.exit(1);
  })
  .finally(() => {
    void pool.end();
  });
