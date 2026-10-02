export type CalendarSortRow = {
  id: string;
  name: string;
  sortOrder: number;
};

export type ScheduleWithCalendarId = {
  calendarId?: string | null;
};

/** Stable id for the built-in default calendar (seeded in migration). */
export const DEFAULT_CALENDAR_ID = "cal_mantenimiento";
export const DEFAULT_CALENDAR_NAME = "Mantenimiento";

export function isDefaultCalendarId(id: string): boolean {
  return id === DEFAULT_CALENDAR_ID;
}

/**
 * Every calendar, including the built-in default, can change its display name.
 * Identity stays on {@link DEFAULT_CALENDAR_ID}.
 */
export function calendarNameCanChange(id: string): boolean {
  return id.length > 0;
}

/** The built-in default calendar cannot be deleted. */
export function calendarCanBeDeleted(id: string): boolean {
  return !isDefaultCalendarId(id);
}

/**
 * Calendar to assign when creating/updating a schedule without an explicit one.
 * Prefers the built-in default id when present in the list; otherwise first sorted calendar.
 */
export function resolveDefaultCalendarId(
  calendarList: CalendarSortRow[],
  preferredId: string | null | undefined = DEFAULT_CALENDAR_ID
): string | null {
  if (preferredId && calendarList.some((c) => c.id === preferredId)) {
    return preferredId;
  }
  const sorted = sortCalendars(calendarList);
  return sorted[0]?.id ?? null;
}

/** Sort calendars by sortOrder, then name (es). Default calendar sorts first. */
export function sortCalendars<T extends CalendarSortRow>(calendars: T[]): T[] {
  return [...calendars].sort((a, b) => {
    if (a.id === DEFAULT_CALENDAR_ID && b.id !== DEFAULT_CALENDAR_ID) return -1;
    if (b.id === DEFAULT_CALENDAR_ID && a.id !== DEFAULT_CALENDAR_ID) return 1;
    return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "es");
  });
}

export type CalendarNavId = "all" | "none" | string;

/**
 * Filter schedules for the calendar sidebar selection.
 * - `all`: every schedule
 * - `none`: schedules with no calendar
 * - calendar id: schedules assigned to that calendar (unknown ids → empty)
 */
export function filterSchedulesByCalendarNav<T extends ScheduleWithCalendarId>(
  schedules: T[],
  navId: CalendarNavId,
  knownCalendarIds: ReadonlySet<string>
): T[] {
  if (navId === "all") return schedules;
  if (navId === "none") {
    return schedules.filter(
      (s) => !s.calendarId || !knownCalendarIds.has(s.calendarId)
    );
  }
  if (!knownCalendarIds.has(navId)) return [];
  return schedules.filter((s) => s.calendarId === navId);
}

export function countSchedulesByCalendarNav<T extends ScheduleWithCalendarId>(
  schedules: T[],
  calendars: CalendarSortRow[]
): { all: number; none: number; byId: Map<string, number> } {
  const known = new Set(calendars.map((c) => c.id));
  const byId = new Map<string, number>();
  for (const c of calendars) byId.set(c.id, 0);
  let none = 0;
  for (const s of schedules) {
    if (s.calendarId && known.has(s.calendarId)) {
      byId.set(s.calendarId, (byId.get(s.calendarId) ?? 0) + 1);
    } else {
      none += 1;
    }
  }
  return { all: schedules.length, none, byId };
}

/** How often `/calendario` reloads server data while the page is open. */
export const CALENDAR_AUTO_REFRESH_MS = 60_000;

/** Skip ticks while the tab is hidden or a calendar dialog/form is open. */
export function calendarAutoRefreshAllowed(input: {
  pageVisible: boolean;
  blockingUiOpen: boolean;
}): boolean {
  return input.pageVisible && !input.blockingUiOpen;
}
