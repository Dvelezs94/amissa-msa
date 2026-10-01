import {
  buildRecurrenceJson,
  formatWorkdaysLabel,
  nextScheduledOccurrenceOnOrAfter,
  parseHourPlanWorkdays,
  parseRecurrence,
  type MaintenanceRecurrenceRule,
} from "@/lib/maintenance-recurrence";
import { calendarEventHref } from "@/lib/maintenance-schedule-work-order";

/** 0=domingo … 6=sábado. Default: the machine runs every day. */
export const ALL_HOUR_MAINTENANCE_WORKDAYS = [0, 1, 2, 3, 4, 5, 6];

export const HOUR_MAINTENANCE_MAX_HOURS_PER_DAY = 24;
export const HOUR_MAINTENANCE_MAX_EVERY_HOURS = 100_000;
export const HOUR_MAINTENANCE_MAX_DAY_INTERVAL = 3650;

function parsePositiveNumber(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export function parseHoursPerDay(raw: unknown): number | null {
  const n = parsePositiveNumber(raw);
  if (n == null || n > HOUR_MAINTENANCE_MAX_HOURS_PER_DAY) return null;
  return n;
}

export function parseEveryHours(raw: unknown): number | null {
  const n = parsePositiveNumber(raw);
  if (n == null || n > HOUR_MAINTENANCE_MAX_EVERY_HOURS) return null;
  return n;
}

export function isYmdDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Operating days between events: round(everyHours / hoursPerDay), at least 1.
 * When every weekday counts, that is also the calendar-day interval.
 */
export function operatingHoursToDayInterval(
  hoursPerDay: number,
  everyHours: number
): number {
  const days = Math.round(everyHours / hoursPerDay);
  return Math.min(
    HOUR_MAINTENANCE_MAX_DAY_INTERVAL,
    Math.max(1, days)
  );
}

export function coerceHourMaintenanceWorkdays(raw: unknown): number[] {
  if (raw === undefined || raw === null) return [...ALL_HOUR_MAINTENANCE_WORKDAYS];
  if (!Array.isArray(raw)) return [...ALL_HOUR_MAINTENANCE_WORKDAYS];
  const days = Array.from(
    new Set(
      raw
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    )
  ).sort((a, b) => a - b);
  return days.length > 0 ? days : [...ALL_HOUR_MAINTENANCE_WORKDAYS];
}

function sameWorkdays(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const left = [...a].sort((x, y) => x - y);
  const right = [...b].sort((x, y) => x - y);
  return left.every((n, i) => n === right[i]);
}

export function buildHourMaintenanceRecurrence(input: {
  hoursPerDay: number;
  everyHours: number;
  anchorDate: string;
  until?: string | null;
  workdays?: number[];
}): MaintenanceRecurrenceRule {
  const workdays = coerceHourMaintenanceWorkdays(input.workdays);
  const restricted = parseHourPlanWorkdays(workdays);
  return {
    frequency: "daily",
    interval: operatingHoursToDayInterval(input.hoursPerDay, input.everyHours),
    anchorDate: input.anchorDate,
    until: input.until ?? null,
    hourPlan: restricted
      ? {
          hoursPerDay: input.hoursPerDay,
          everyHours: input.everyHours,
          workdays: restricted,
        }
      : {
          hoursPerDay: input.hoursPerDay,
          everyHours: input.everyHours,
        },
  };
}

export function hourMaintenanceSchedulePayload(input: {
  hoursPerDay: number;
  everyHours: number;
  anchorDate: string;
  until?: string | null;
  workdays?: number[];
  from?: Date;
}): { rule: MaintenanceRecurrenceRule; recurrence: string; nextRunAt: Date } {
  const rule = buildHourMaintenanceRecurrence(input);
  const recurrence = buildRecurrenceJson(rule);
  const from = input.from ?? new Date();
  const workdayCount = parseHourPlanWorkdays(input.workdays)?.length ?? 7;
  const horizonDays = Math.max(
    370,
    Math.ceil(rule.interval * (7 / workdayCount)) + 21
  );
  const nextRunAt =
    nextScheduledOccurrenceOnOrAfter(rule, from, horizonDays) ??
    nextScheduledOccurrenceOnOrAfter(
      rule,
      new Date(rule.anchorDate + "T00:00:00"),
      horizonDays
    ) ??
    new Date();
  return { rule, recurrence, nextRunAt };
}

/** Keep machine-hour metadata when the calendar form rewrites recurrence. */
export function preserveHourPlanInRecurrence(
  previousRaw: string,
  nextRaw: string
): string {
  const previous = parseRecurrence(previousRaw);
  const next = parseRecurrence(nextRaw);
  if (!previous?.hourPlan || !next) return nextRaw;
  next.hourPlan = previous.hourPlan;
  return buildRecurrenceJson(next);
}

export function hourPlanTimingChanged(
  previous: {
    hoursPerDay: number;
    everyHours: number;
    startDate: string;
    workdays?: number[];
  },
  next: {
    hoursPerDay: number;
    everyHours: number;
    startDate: string;
    workdays?: number[];
  }
): boolean {
  return (
    previous.hoursPerDay !== next.hoursPerDay ||
    previous.everyHours !== next.everyHours ||
    previous.startDate !== next.startDate ||
    !sameWorkdays(
      coerceHourMaintenanceWorkdays(previous.workdays),
      coerceHourMaintenanceWorkdays(next.workdays)
    )
  );
}

function formatHoursLabel(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

/** Live form preview: operating hours plus the interval on the selected work days. */
export function formatHourMaintenancePreview(
  hoursPerDay: number,
  everyHours: number,
  workdays?: number[] | null
): string | null {
  if (!(hoursPerDay > 0) || !(everyHours > 0)) return null;
  const days = operatingHoursToDayInterval(hoursPerDay, everyHours);
  const restricted = parseHourPlanWorkdays(workdays ?? undefined);
  const dayPart = restricted
    ? days === 1
      ? "Cada 1 día de trabajo"
      : `Cada ${days} días de trabajo`
    : days === 1
      ? "Cada 1 día"
      : `Cada ${days} días`;
  const where = restricted
    ? ` (${formatWorkdaysLabel(restricted)})`
    : " en el calendario";
  return `Cada ${formatHoursLabel(everyHours)} h de uso (${formatHoursLabel(hoursPerDay)} h/día) · ${dayPart}${where}`;
}

export type HourMaintenancePlanView = {
  id: string;
  name: string;
  hoursPerDay: number;
  everyHours: number;
  startDate: string;
  workdays: number[];
  calendarId: string | null;
  calendarName: string | null;
  checklistTemplateId: string | null;
  color: string | null;
  scheduleId: string;
  nextRunAt: string | null;
  recurrence: string | null;
  assigneeIds: string[];
  dayInterval: number;
};

export function hourMaintenancePlanView(input: {
  id: string;
  name: string;
  hoursPerDay: number;
  everyHours: number;
  startDate: string;
  workdays?: number[];
  calendarId: string | null;
  calendarName: string | null;
  checklistTemplateId: string | null;
  color: string | null;
  scheduleId: string;
  nextRunAt: Date | null;
  recurrence: string | null;
  assigneeIds: string[];
}): HourMaintenancePlanView {
  return {
    id: input.id,
    name: input.name,
    hoursPerDay: input.hoursPerDay,
    everyHours: input.everyHours,
    startDate: input.startDate,
    workdays: coerceHourMaintenanceWorkdays(input.workdays),
    calendarId: input.calendarId,
    calendarName: input.calendarName,
    checklistTemplateId: input.checklistTemplateId,
    color: input.color,
    scheduleId: input.scheduleId,
    nextRunAt: input.nextRunAt ? input.nextRunAt.toISOString() : null,
    recurrence: input.recurrence,
    assigneeIds: input.assigneeIds,
    dayInterval: operatingHoursToDayInterval(
      input.hoursPerDay,
      input.everyHours
    ),
  };
}

export function defaultHourMaintenancePlanName(assetName: string): string {
  const n = assetName.trim();
  return n ? `Mantenimiento por horas — ${n}` : "Mantenimiento por horas";
}

/** Toolbar button that opens the hour-maintenance modal. */
export function hourMaintenanceTriggerLabel(planCount: number): string {
  const n = Number.isFinite(planCount) ? Math.max(0, Math.floor(planCount)) : 0;
  return n > 0 ? `Mto. por horas (${n})` : "Mto. por horas";
}

/** After creating a plan, open the calendar on the first scheduled day. */
export function hourMaintenanceCreatedCalendarHref(plan: {
  scheduleId: string;
  startDate: string;
}): string {
  return calendarEventHref(plan.scheduleId, plan.startDate);
}

export type ParsedHourMaintenancePlanFields = {
  name: string;
  hoursPerDay: number;
  everyHours: number;
  startDate: string;
  workdays: number[];
  calendarId: string | null;
  checklistTemplateId: string | null;
  color: string;
  assigneeIds: string[];
};

export function parseHourMaintenancePlanFields(
  body: Record<string, unknown>,
  opts?: { fallbackName?: string }
): { ok: true; value: ParsedHourMaintenancePlanFields } | { ok: false; error: string } {
  const hoursPerDay = parseHoursPerDay(body.hoursPerDay);
  if (hoursPerDay == null) {
    return { ok: false, error: "Horas de uso por día inválidas (mayor que 0 y hasta 24)" };
  }
  const everyHours = parseEveryHours(body.everyHours);
  if (everyHours == null) {
    return { ok: false, error: "Horas entre mantenimientos inválidas" };
  }
  const startDate =
    typeof body.startDate === "string" ? body.startDate.trim() : "";
  if (!isYmdDate(startDate)) {
    return { ok: false, error: "La fecha de inicio debe ser YYYY-MM-DD" };
  }
  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
  const name = nameRaw || opts?.fallbackName || "Mantenimiento por horas";

  let workdays = [...ALL_HOUR_MAINTENANCE_WORKDAYS];
  if (body.workdays !== undefined) {
    if (!Array.isArray(body.workdays)) {
      return { ok: false, error: "Selecciona al menos un día de trabajo" };
    }
    const parsedDays = coerceHourMaintenanceWorkdays(body.workdays);
    const validCount = body.workdays.filter((n) => {
      const v = Number(n);
      return Number.isInteger(v) && v >= 0 && v <= 6;
    }).length;
    if (validCount === 0 || parsedDays.length === 0) {
      return { ok: false, error: "Selecciona al menos un día de trabajo" };
    }
    workdays = parsedDays;
  }

  let assigneeIds: string[] = [];
  if (Array.isArray(body.assigneeIds)) {
    assigneeIds = Array.from(
      new Set(body.assigneeIds.map((x) => String(x).trim()).filter(Boolean))
    );
  }

  const colorRaw =
    typeof body.color === "string" ? body.color.trim().toUpperCase() : "";
  const color = /^#[0-9A-F]{6}$/.test(colorRaw) ? colorRaw : "#02257D";

  const calendarId =
    body.calendarId != null && body.calendarId !== ""
      ? String(body.calendarId)
      : null;
  const checklistTemplateId =
    body.checklistTemplateId != null && body.checklistTemplateId !== ""
      ? String(body.checklistTemplateId)
      : null;

  return {
    ok: true,
    value: {
      name,
      hoursPerDay,
      everyHours,
      startDate,
      workdays,
      calendarId,
      checklistTemplateId,
      color,
      assigneeIds,
    },
  };
}
