/**
 * Recurrence rules for preventive maintenance / calendar events.
 * Stored as JSON string in `maintenance_schedules.recurrence`.
 */

const MS_DAY = 86_400_000;

export type MaintenanceFrequency =
  | "none"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly";

export type MaintenanceRecurrenceRule = {
  frequency: MaintenanceFrequency;
  /** Every N days / weeks / months / years (default 1) */
  interval: number;
  /**
   * For weekly: 0=domingo … 6=sábado (Date.getDay()).
   * If omitted or empty, se usa el día de la semana de `anchorDate`.
   */
  weekdays?: number[];
  /** YYYY-MM-DD — fin de la serie (opcional) */
  until?: string | null;
  /** YYYY-MM-DD — fechas omitidas de una serie */
  excludedDates?: string[];
  /** YYYY-MM-DD — primera fecha elegida por el usuario */
  anchorDate: string;
  /** When set, this series was generated from machine operating hours. */
  hourPlan?: MaintenanceHourPlan;
};

export type MaintenanceHourPlan = {
  hoursPerDay: number;
  everyHours: number;
  /**
   * Weekdays the machine actually runs (0=domingo … 6=sábado).
   * Omitted or all seven days: every calendar day counts.
   */
  workdays?: number[];
};

/** Unique weekdays 0–6. Empty or all seven → undefined (every calendar day). */
export function parseHourPlanWorkdays(raw: unknown): number[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const days = Array.from(
    new Set(
      raw
        .map((n) => Number(n))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
    )
  ).sort((a, b) => a - b);
  if (days.length === 0 || days.length >= 7) return undefined;
  return days;
}

function parseHourPlan(raw: unknown): MaintenanceHourPlan | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as { hoursPerDay?: unknown; everyHours?: unknown; workdays?: unknown };
  const hoursPerDay = Number(o.hoursPerDay);
  const everyHours = Number(o.everyHours);
  if (!Number.isFinite(hoursPerDay) || hoursPerDay <= 0 || hoursPerDay > 24) {
    return undefined;
  }
  if (!Number.isFinite(everyHours) || everyHours <= 0) return undefined;
  const workdays = parseHourPlanWorkdays(o.workdays);
  return workdays
    ? { hoursPerDay, everyHours, workdays }
    : { hoursPerDay, everyHours };
}

export function parseRecurrence(raw: string): MaintenanceRecurrenceRule | null {
  try {
    const o = JSON.parse(raw) as Partial<MaintenanceRecurrenceRule>;
    if (o && typeof o.frequency === "string" && typeof o.anchorDate === "string") {
      const interval =
        typeof o.interval === "number" && o.interval >= 1
          ? Math.floor(o.interval)
          : 1;
      return {
        frequency: o.frequency as MaintenanceFrequency,
        interval,
        weekdays: Array.isArray(o.weekdays)
          ? o.weekdays.map((n) => Number(n)).filter((n) => n >= 0 && n <= 6)
          : undefined,
        until: o.until ?? null,
        excludedDates: Array.isArray(o.excludedDates)
          ? o.excludedDates.filter((v): v is string => typeof v === "string")
          : undefined,
        anchorDate: o.anchorDate,
        hourPlan: parseHourPlan(o.hourPlan),
      };
    }
  } catch {
    /* legacy texto plano */
  }
  return null;
}

/** Maps stored rule to UI state (quarterly/semiannual as monthly interval in DB). */
export function ruleToMaintenanceEditFormState(rule: MaintenanceRecurrenceRule): {
  frequency: string;
  interval: number;
  anchorDate: string;
  until: string;
  weekdays: number[];
} {
  let frequency: string = rule.frequency;
  let interval = Math.max(1, Math.floor(rule.interval || 1));
  if (rule.frequency === "monthly") {
    if (interval === 3) {
      frequency = "quarterly";
      interval = 1;
    } else if (interval === 6) {
      frequency = "semiannual";
      interval = 1;
    }
  }
  const anchor = parseYmdToLocalDate(rule.anchorDate);
  const weekdays =
    rule.weekdays && rule.weekdays.length > 0
      ? Array.from(new Set(rule.weekdays)).sort((a, b) => a - b)
      : [anchor.getDay()];
  return {
    frequency,
    interval,
    anchorDate: rule.anchorDate,
    until: rule.until ?? "",
    weekdays,
  };
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function parseYmdToLocalDate(ymd: string): Date {
  const [y, m, day] = ymd.split("-").map(Number);
  if (!y || !m || !day) return new Date(NaN);
  return new Date(y, m - 1, day);
}

export function toYmdLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(date: Date, n: number): Date {
  const d = date.getDate();
  const next = new Date(date.getFullYear(), date.getMonth() + n, 1);
  const lastDay = new Date(
    next.getFullYear(),
    next.getMonth() + 1,
    0
  ).getDate();
  next.setDate(Math.min(d, lastDay));
  return startOfDay(next);
}

function addYears(date: Date, n: number): Date {
  const next = new Date(date.getFullYear() + n, date.getMonth(), date.getDate());
  return startOfDay(next);
}

/** First date >= anchor where getDay() === w (0–6). */
function firstWeekdayOnOrAfter(anchor: Date, w: number): Date {
  let d = startOfDay(anchor);
  for (let i = 0; i < 14; i++) {
    if (d.getDay() === w && d >= startOfDay(anchor)) return d;
    d = new Date(d.getTime() + MS_DAY);
  }
  return startOfDay(anchor);
}

function weekdaysFromRule(rule: MaintenanceRecurrenceRule, anchor: Date): number[] {
  if (rule.weekdays && rule.weekdays.length > 0) {
    return Array.from(new Set(rule.weekdays)).sort((a, b) => a - b);
  }
  return [anchor.getDay()];
}

/** Primera ocurrencia de la serie (para `nextRunAt`). */
export function computeFirstOccurrence(rule: MaintenanceRecurrenceRule): Date {
  const anchor = startOfDay(parseYmdToLocalDate(rule.anchorDate));
  if (Number.isNaN(anchor.getTime())) return new Date();

  const interval = Math.max(1, Math.floor(rule.interval || 1));

  switch (rule.frequency) {
    case "none":
      return anchor;
    case "daily":
      return anchor;
    case "weekly": {
      if (interval === 1) {
        const days = weekdaysFromRule(rule, anchor);
        let best: Date | null = null;
        for (const w of days) {
          const cand = firstWeekdayOnOrAfter(anchor, w);
          if (!best || cand < best) best = cand;
        }
        return best ?? anchor;
      }
      const days = weekdaysFromRule(rule, anchor);
      const w = days[0]!;
      const first = firstWeekdayOnOrAfter(anchor, w);
      return first;
    }
    case "monthly":
    case "yearly":
      return anchor;
    default:
      return anchor;
  }
}

export function expandOccurrencesInRange(
  rule: MaintenanceRecurrenceRule,
  rangeStart: Date,
  rangeEnd: Date
): Date[] {
  const anchor = startOfDay(parseYmdToLocalDate(rule.anchorDate));
  if (Number.isNaN(anchor.getTime())) return [];

  const start = startOfDay(rangeStart);
  const end = startOfDay(rangeEnd);
  const until = rule.until
    ? startOfDay(parseYmdToLocalDate(rule.until))
    : null;
  if (until && !Number.isNaN(until.getTime()) && until < start) return [];

  const capEnd =
    until && !Number.isNaN(until.getTime()) && until < end ? until : end;
  const interval = Math.max(1, Math.floor(rule.interval || 1));
  const out: Date[] = [];
  const excluded = new Set(rule.excludedDates ?? []);

  const pushInRange = (d: Date) => {
    if (d >= start && d <= capEnd && d >= anchor) {
      if (excluded.has(toYmdLocal(d))) return;
      out.push(new Date(d));
    }
  };

  switch (rule.frequency) {
    case "none":
      pushInRange(anchor);
      break;
    case "daily": {
      const workdays = parseHourPlanWorkdays(rule.hourPlan?.workdays);
      if (workdays) {
        let d = new Date(anchor);
        let workdaysSince = 0;
        while (d <= capEnd) {
          if (d.getTime() === anchor.getTime()) {
            pushInRange(d);
          } else if (workdays.includes(d.getDay())) {
            workdaysSince += 1;
            if (workdaysSince % interval === 0) pushInRange(d);
          }
          d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        }
        break;
      }
      let d = new Date(Math.max(anchor.getTime(), start.getTime()));
      while (d <= capEnd) {
        const daysSince = Math.round((d.getTime() - anchor.getTime()) / MS_DAY);
        if (daysSince >= 0 && daysSince % interval === 0 && !excluded.has(toYmdLocal(d))) {
          out.push(new Date(d));
        }
        d = new Date(d.getTime() + MS_DAY);
      }
      break;
    }
    case "weekly": {
      const weekdays = weekdaysFromRule(rule, anchor);
      if (interval === 1) {
        let d = new Date(Math.max(anchor.getTime(), start.getTime()));
        while (d <= capEnd) {
          if (d >= anchor && weekdays.includes(d.getDay()) && !excluded.has(toYmdLocal(d)))
            out.push(new Date(d));
          d = new Date(d.getTime() + MS_DAY);
        }
      } else {
        const w = weekdays[0]!;
        const first = firstWeekdayOnOrAfter(anchor, w);
        let k = 0;
        while (true) {
          const d = new Date(first.getTime() + k * interval * 7 * MS_DAY);
          if (d > capEnd) break;
          pushInRange(d);
          k++;
        }
      }
      break;
    }
    case "monthly": {
      let d = new Date(anchor);
      while (d < start) d = addMonths(d, interval);
      while (d <= capEnd) {
        pushInRange(d);
        d = addMonths(d, interval);
      }
      break;
    }
    case "yearly": {
      let d = new Date(anchor);
      while (d < start) d = addYears(d, interval);
      while (d <= capEnd) {
        pushInRange(d);
        d = addYears(d, interval);
      }
      break;
    }
  }

  return out.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Última ocurrencia estrictamente anterior a `splitYmd` (día calendario local).
 * Sirve para truncar una serie conservando solo fechas pasadas respecto a un corte.
 */
export function lastOccurrenceStrictlyBefore(
  rule: MaintenanceRecurrenceRule,
  splitYmd: string
): Date | null {
  const split = startOfDay(parseYmdToLocalDate(splitYmd));
  if (Number.isNaN(split.getTime())) return null;
  const rangeEnd = new Date(split.getTime() - MS_DAY);
  const anchor = startOfDay(parseYmdToLocalDate(rule.anchorDate));
  if (Number.isNaN(anchor.getTime())) return null;
  if (rangeEnd < anchor) return null;
  const occ = expandOccurrencesInRange(rule, anchor, rangeEnd);
  if (occ.length === 0) return null;
  return occ[occ.length - 1]!;
}

/**
 * Primera ocurrencia de la regla en el intervalo que empieza el día local de `from` (inclusive).
 */
export function nextScheduledOccurrenceOnOrAfter(
  rule: MaintenanceRecurrenceRule,
  from: Date,
  horizonDays = 370
): Date | null {
  const rangeStart = startOfDay(from);
  const rangeEnd = new Date(rangeStart.getTime() + horizonDays * MS_DAY);
  const occ = expandOccurrencesInRange(rule, rangeStart, rangeEnd);
  return occ.length > 0 ? occ[0]! : null;
}

/**
 * Próxima fecha a mostrar en listados (p. ej. dashboard): prioriza la regla JSON;
 * si no hay regla parseable, usa `nextRunAt` si sigue siendo vigente.
 */
export function resolveNextMaintenanceDisplayDate(
  recurrenceRaw: string,
  nextRunAt: Date | null,
  from: Date
): Date | null {
  const startToday = startOfDay(from);
  const rule = parseRecurrence(recurrenceRaw);
  if (rule) {
    const d = nextScheduledOccurrenceOnOrAfter(rule, from);
    if (d) return d;
  }
  if (nextRunAt != null && nextRunAt.getTime() >= startToday.getTime()) {
    return nextRunAt;
  }
  return null;
}

const WEEKDAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const WORKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Lun–Dom labels for the selected weekdays. */
export function formatWorkdaysLabel(workdays: number[]): string {
  const set = new Set(workdays);
  return WORKDAY_DISPLAY_ORDER.filter((d) => set.has(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join(", ");
}

export function formatRecurrenceLabel(raw: string): string {
  const rule = parseRecurrence(raw);
  if (!rule) return raw;

  const iv = Math.max(1, rule.interval);
  const parts: string[] = [];

  switch (rule.frequency) {
    case "none":
      parts.push("No se repite");
      break;
    case "daily":
      if (parseHourPlanWorkdays(rule.hourPlan?.workdays)) {
        parts.push(iv === 1 ? "Cada día de trabajo" : `Cada ${iv} días de trabajo`);
      } else {
        parts.push(iv === 1 ? "Cada día" : `Cada ${iv} días`);
      }
      break;
    case "weekly": {
      if (iv === 1) {
        const days = weekdaysFromRule(rule, parseYmdToLocalDate(rule.anchorDate));
        if (days.length === 7) {
          parts.push("Cada semana (todos los días)");
        } else {
          const names = days.map((d) => WEEKDAY_LABELS[d]).join(", ");
          parts.push(`Cada semana: ${names}`);
        }
      } else {
        parts.push(
          iv === 2
            ? "Cada 2 semanas (mismo día de la semana)"
            : `Cada ${iv} semanas (mismo día de la semana)`
        );
      }
      break;
    }
    case "monthly":
      parts.push(iv === 1 ? "Cada mes" : `Cada ${iv} meses`);
      break;
    case "yearly":
      parts.push(iv === 1 ? "Cada año" : `Cada ${iv} años`);
      break;
  }

  if (rule.hourPlan) {
    const h = formatHourNumber(rule.hourPlan.everyHours);
    const d = formatHourNumber(rule.hourPlan.hoursPerDay);
    const workdays = parseHourPlanWorkdays(rule.hourPlan.workdays);
    const dayNote = workdays ? `, ${formatWorkdaysLabel(workdays)}` : "";
    parts.unshift(`Cada ${h} h de uso (${d} h/día${dayNote})`);
  }

  if (rule.until) {
    parts.push(`hasta el ${rule.until}`);
  }

  return parts.join(" · ") || "No se repite";
}

function formatHourNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Math.round(n * 100) / 100);
}

export function buildRecurrenceJson(rule: MaintenanceRecurrenceRule): string {
  const normalized: MaintenanceRecurrenceRule = {
    frequency: rule.frequency,
    interval: Math.max(1, Math.floor(rule.interval || 1)),
    anchorDate: rule.anchorDate,
    until: rule.until ?? null,
  };
  if (
    rule.frequency === "weekly" &&
    rule.weekdays &&
    rule.weekdays.length > 0
  ) {
    normalized.weekdays = Array.from(new Set(rule.weekdays)).sort(
      (a, b) => a - b
    );
  }
  if (rule.excludedDates && rule.excludedDates.length > 0) {
    normalized.excludedDates = Array.from(new Set(rule.excludedDates)).sort();
  }
  if (rule.hourPlan) {
    const workdays = parseHourPlanWorkdays(rule.hourPlan.workdays);
    normalized.hourPlan = workdays
      ? {
          hoursPerDay: rule.hourPlan.hoursPerDay,
          everyHours: rule.hourPlan.everyHours,
          workdays,
        }
      : {
          hoursPerDay: rule.hourPlan.hoursPerDay,
          everyHours: rule.hourPlan.everyHours,
        };
  }
  return JSON.stringify(normalized);
}
