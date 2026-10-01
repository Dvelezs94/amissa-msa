import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  foreignKey,
  primaryKey,
  real,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["tecnico", "admin", "calidad"] })
    .notNull()
    .default("tecnico"),
  isDisabled: boolean("is_disabled").notNull().default(false),
  avatarUrl: text("avatar_url"),
  /** Fondo del avatar con iniciales (#RRGGBB); null = derivar de id en cliente */
  avatarBackgroundColor: text("avatar_background_color"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

/** Flat groups for machines (assets); no nesting. */
export const assetGroups = pgTable("asset_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  assetId: text("asset_id").notNull().unique(), // human-readable
  locationId: text("location_id"),
  parentAssetId: text("parent_asset_id"),
  qrCode: text("qr_code"),
  groupId: text("group_id").references(() => assetGroups.id, {
    onDelete: "set null",
  }),
  /** Si es false, no se registra paro de máquina en tareas de este activo (KPI y formularios). */
  tracksMachineDowntime: boolean("tracks_machine_downtime").notNull().default(true),
  /** Foto principal de la máquina (URL pública S3). */
  imageUrl: text("image_url"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const assetFiles = pgTable("asset_files", {
  id: text("id").primaryKey(),
  assetId: text("asset_id").references(() => assets.id, { onDelete: "cascade" }), // null = uploaded directly to knowledge base
  filename: text("filename").notNull(),
  fileUrl: text("file_url").notNull(),
  category: text("category"), // e.g. "manual", "spec", "other" or free text
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const workOrders = pgTable(
  "work_orders",
  {
    id: text("id").primaryKey(),
    folio: integer("folio"),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", {
      enum: ["pending", "in_progress", "completed", "cancelled"],
    })
      .notNull()
      .default("pending"),
    priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
      .notNull()
      .default("medium"),
    assetId: text("asset_id"),
    assigneeId: text("assignee_id"),
    requesterId: text("requester_id"),
    dueDate: timestamp("due_date", { withTimezone: true, mode: "date" }),
    /**
     * Planned start / fecha de inicio (optional).
     * Mobile app only shows the task from this calendar day onward. Distinct from startedAt.
     */
    startDate: timestamp("start_date", { withTimezone: true, mode: "date" }),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
    /** Set once on first transition to in_progress; null = nunca iniciada */
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }),
    /** routine = desde mantenimiento programado; on_demand = creada bajo demanda */
    kind: text("kind", { enum: ["routine", "on_demand"] })
      .notNull()
      .default("on_demand"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    /** Order within the Kanban column (same status); lower = higher on the board */
    boardSortOrder: integer("board_sort_order").notNull().default(0),
    /** When true, tiempo de en curso → completada cuenta como paro de máquina (requiere activo). */
    countsMachineDowntime: boolean("counts_machine_downtime").notNull().default(false),
    /** Paro adicional (minutos), p. ej. sin tarea formal o no cubierto por el intervalo en curso. */
    manualDowntimeMinutes: integer("manual_downtime_minutes").notNull().default(0),
  },
  (t) => [
    uniqueIndex("work_orders_folio_unique_idx")
      .on(t.folio)
      .where(sql`${t.folio} IS NOT NULL`),
  ]
);

/** Multiple users assigned to a work order (assignee_id keeps primary/first for legacy joins). */
export const workOrderAssignees = pgTable(
  "work_order_assignees",
  {
    workOrderId: text("work_order_id")
      .notNull()
      .references(() => workOrders.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.workOrderId, t.userId] }),
    index("work_order_assignees_user_idx").on(t.userId),
  ]
);

export const checklistFolders = pgTable(
  "checklist_folders",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    parentFolderId: text("parent_folder_id"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    parentFk: foreignKey({
      columns: [t.parentFolderId],
      foreignColumns: [t.id],
    }).onDelete("cascade"),
  })
);

export const checklistTemplates = pgTable("checklist_templates", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  folderId: text("folder_id").references(() => checklistFolders.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const checklistTemplateItems = pgTable("checklist_template_items", {
  id: text("id").primaryKey(),
  checklistTemplateId: text("checklist_template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),
  /** When set, this row is nested under a checklist section (`type === "section"`). */
  parentItemId: text("parent_item_id"),
  type: text("type", {
    enum: ["step", "custom_field", "text_block", "section"],
  }).notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  fieldType: text("field_type", {
    enum: [
      "text",
      "number",
      "date",
      "dropdown",
      "checkbox",
      "photo",
      "title",
      "subtitle",
      "paragraph",
    ],
  }),
  options: jsonb("options").$type<string[]>(), // for dropdown: string[]
  /** Solo aplica a `custom_field`: si es true, el valor puede quedar en blanco al cerrar la tarea. */
  isOptional: boolean("is_optional").notNull().default(false),
});

export const checklistTemplateRevisions = pgTable("checklist_template_revisions", {
  id: text("id").primaryKey(),
  checklistTemplateId: text("checklist_template_id")
    .notNull()
    .references(() => checklistTemplates.id, { onDelete: "cascade" }),
  revisionNumber: integer("revision_number").notNull(),
  name: text("name").notNull(),
  status: text("status", { enum: ["approved", "proposed", "rejected", "draft"] })
    .notNull()
    .default("proposed"),
  proposedByUserId: text("proposed_by_user_id")
    .notNull()
    .references(() => users.id),
  reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true, mode: "date" }),
  reviewComment: text("review_comment"),
  snapshot: jsonb("snapshot")
    .$type<{
      before?: {
        name: string;
        description: string | null;
        items: Array<{
          type: string;
          label: string;
          fieldType: string | null;
          options: string[] | null;
          id?: string | null;
          parentItemId?: string | null;
          isOptional?: boolean | null;
        }>;
      };
      after: {
        name: string;
        description: string | null;
        items: Array<{
          type: string;
          label: string;
          fieldType: string | null;
          options: string[] | null;
          id?: string | null;
          parentItemId?: string | null;
          isOptional?: boolean | null;
        }>;
      };
    }>()
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const workOrderChecklist = pgTable("work_order_checklist", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  checklistTemplateId: text("checklist_template_id"),
  /** Nesting under a section row in the same work order checklist. */
  parentItemId: text("parent_item_id"),
  type: text("type", {
    enum: ["step", "custom_field", "text_block", "section"],
  }).notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  completed: boolean("completed").notNull().default(false),
  value: jsonb("value"), // for custom_field
  fieldType: text("field_type", {
    enum: [
      "text",
      "number",
      "date",
      "dropdown",
      "checkbox",
      "photo",
      "title",
      "subtitle",
      "paragraph",
    ],
  }),
  options: jsonb("options").$type<string[]>(),
  /** Copiado desde plantilla; solo aplica a `custom_field`. */
  isOptional: boolean("is_optional").notNull().default(false),
});

export const notes = pgTable("notes", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const attachments = pgTable("attachments", {
  id: text("id").primaryKey(),
  workOrderId: text("work_order_id")
    .notNull()
    .references(() => workOrders.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id),
  fileUrl: text("file_url").notNull(),
  filename: text("filename").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const requests = pgTable("requests", {
  id: text("id").primaryKey(),
  description: text("description").notNull(),
  priority: text("priority", { enum: ["low", "medium", "high", "urgent"] })
    .notNull()
    .default("medium"),
  assetId: text("asset_id"),
  requesterId: text("requester_id").notNull().references(() => users.id),
  status: text("status", { enum: ["pending", "converted", "cancelled"] })
    .notNull()
    .default("pending"),
  workOrderId: text("work_order_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

// Dashboard: saved analytics widgets per user
export const dashboardWidgets = pgTable("dashboard_widgets", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  templateId: text("template_id").notNull(),
  templateName: text("template_name").notNull(),
  fieldLabel: text("field_label").notNull(),
  /** Etiquetas de checklist a graficar juntas (mismo tipo). El primero se repite en `field_label` por compatibilidad. */
  fieldLabels: jsonb("field_labels")
    .$type<string[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** Vista del gráfico al abrir el dashboard (línea/barras/pastel según tipo de campo). */
  chartType: text("chart_type", { enum: ["line", "bar", "pie", "stacked"] })
    .notNull()
    .default("line"),
  /** Horizontal reference lines for numeric time-series charts (value + optional label). */
  thresholds: jsonb("thresholds")
    .$type<{ id: string; value: number; label?: string; color?: string }[]>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  /** Título personalizado del gráfico; null = título por defecto según campos. */
  chartTitle: text("chart_title"),
  /** Manual/auto min-max for chart axes (analytics widgets). */
  axisLimits: jsonb("axis_limits")
    .$type<{
      yAuto: boolean;
      yMin: number | null;
      yMax: number | null;
      xAuto: boolean;
      xMin: number | null;
      xMax: number | null;
    }>()
    .notNull()
    .default(sql`'{"yAuto":true,"yMin":null,"yMax":null,"xAuto":true,"xMin":null,"xMax":null}'::jsonb`),
  dateFrom: text("date_from"), // YYYY-MM-DD or null
  dateTo: text("date_to"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: text("id").primaryKey(),
  entityType: text("entity_type").notNull(), // e.g. work_order, checklist_template, work_order_checklist
  entityId: text("entity_id").notNull(),
  action: text("action").notNull(), // e.g. created, updated, completed
  /** null = accion del sistema o publica (ej. solicitud sin sesion) */
  userId: text("user_id").references(() => users.id),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["assignment", "work_order_update", "mention"] })
      .notNull(),
    title: text("title").notNull(),
    body: text("body"),
    workOrderId: text("work_order_id").references(() => workOrders.id, {
      onDelete: "cascade",
    }),
    noteId: text("note_id").references(() => notes.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { withTimezone: true, mode: "date" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => ({
    userCreatedIdx: index("notifications_user_created_idx").on(
      t.userId,
      t.createdAt
    ),
    userUnreadIdx: index("notifications_user_unread_idx").on(t.userId, t.readAt),
  })
);

/** Named calendars (areas/teams); schedules optionally belong to one. */
export const calendars = pgTable("calendars", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  color: text("color"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

// Phase 3
export const maintenanceSchedules = pgTable("maintenance_schedules", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  assetId: text("asset_id"),
  assigneeId: text("assignee_id").references(() => users.id),
  color: text("color"),
  recurrence: text("recurrence").notNull(), // cron or interval description
  checklistTemplateId: text("checklist_template_id"),
  calendarId: text("calendar_id").references(() => calendars.id, {
    onDelete: "set null",
  }),
  nextRunAt: timestamp("next_run_at", { withTimezone: true, mode: "date" }),
  /** Soft-delete: null = activo en calendario */
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .notNull()
    .defaultNow(),
});

export const maintenanceScheduleAssignees = pgTable(
  "maintenance_schedule_assignees",
  {
    maintenanceScheduleId: text("maintenance_schedule_id")
      .notNull()
      .references(() => maintenanceSchedules.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.maintenanceScheduleId, t.userId] }),
    index("maintenance_schedule_assignees_user_idx").on(t.userId),
  ]
);

/** Hour-based auto schedules: machine work hours/day + interval hours → calendar events. */
export const assetHourMaintenancePlans = pgTable(
  "asset_hour_maintenance_plans",
  {
    id: text("id").primaryKey(),
    assetId: text("asset_id")
      .notNull()
      .references(() => assets.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    hoursPerDay: real("hours_per_day").notNull(),
    everyHours: real("every_hours").notNull(),
    startDate: text("start_date").notNull(),
    /** 0=domingo … 6=sábado. All seven = hours accumulate every calendar day. */
    workdays: jsonb("workdays")
      .$type<number[]>()
      .notNull()
      .default(sql`'[0,1,2,3,4,5,6]'::jsonb`),
    calendarId: text("calendar_id").references(() => calendars.id, {
      onDelete: "set null",
    }),
    checklistTemplateId: text("checklist_template_id"),
    color: text("color"),
    scheduleId: text("schedule_id")
      .notNull()
      .references(() => maintenanceSchedules.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("asset_hour_maintenance_plans_schedule_uidx").on(t.scheduleId),
    index("asset_hour_maintenance_plans_asset_idx").on(t.assetId),
  ]
);

/** Admin-defined automations: event trigger + actions (notify / email). */
export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    enabled: boolean("enabled").notNull().default(true),
    triggerType: text("trigger_type").notNull(),
    triggerConfig: jsonb("trigger_config")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    actions: jsonb("actions")
      .$type<unknown[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdByUserId: text("created_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("workflow_definitions_trigger_idx").on(t.triggerType, t.enabled),
  ]
);

export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    workflowId: text("workflow_id").references(() => workflowDefinitions.id, {
      onDelete: "set null",
    }),
    triggerType: text("trigger_type").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    status: text("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("workflow_runs_created_idx").on(t.createdAt)]
);
