import { describe, expect, it } from "vitest";
import {
  DEFAULT_CALENDAR_ID,
  countSchedulesByCalendarNav,
  filterSchedulesByCalendarNav,
  calendarCanBeDeleted,
  calendarNameCanChange,
  isDefaultCalendarId,
  resolveDefaultCalendarId,
  sortCalendars,
  calendarAutoRefreshAllowed,
} from "@/lib/calendar-helpers";

describe("sortCalendars", () => {
  it("sorts default calendar first, then sortOrder then name", () => {
    const sorted = sortCalendars([
      { id: "b", name: "Beta", sortOrder: 1 },
      { id: "a", name: "Alfa", sortOrder: 0 },
      { id: DEFAULT_CALENDAR_ID, name: "Mantenimiento", sortOrder: 5 },
      { id: "c", name: "Charlie", sortOrder: 0 },
    ]);
    expect(sorted.map((g) => g.id)).toEqual([
      DEFAULT_CALENDAR_ID,
      "a",
      "c",
      "b",
    ]);
  });
});

describe("resolveDefaultCalendarId", () => {
  it("prefers built-in default when present", () => {
    expect(
      resolveDefaultCalendarId([
        { id: "other", name: "Otro", sortOrder: 0 },
        { id: DEFAULT_CALENDAR_ID, name: "Mantenimiento", sortOrder: 1 },
      ])
    ).toBe(DEFAULT_CALENDAR_ID);
  });

  it("falls back to first sorted calendar", () => {
    expect(
      resolveDefaultCalendarId([{ id: "x", name: "X", sortOrder: 0 }])
    ).toBe("x");
  });
});

describe("isDefaultCalendarId", () => {
  it("matches stable id", () => {
    expect(isDefaultCalendarId(DEFAULT_CALENDAR_ID)).toBe(true);
    expect(isDefaultCalendarId("other")).toBe(false);
  });
});

describe("calendar name and delete policy", () => {
  it("allows renaming the built-in calendar and blocks deleting it", () => {
    expect(calendarNameCanChange(DEFAULT_CALENDAR_ID)).toBe(true);
    expect(calendarNameCanChange("other")).toBe(true);
    expect(calendarCanBeDeleted(DEFAULT_CALENDAR_ID)).toBe(false);
    expect(calendarCanBeDeleted("other")).toBe(true);
  });
});

describe("filterSchedulesByCalendarNav", () => {
  const calendars = [
    { id: "c1", name: "Hornos", sortOrder: 0 },
    { id: "c2", name: "Empaque", sortOrder: 1 },
  ];
  const known = new Set(calendars.map((c) => c.id));
  const schedules = [
    { id: "s1", calendarId: "c1" },
    { id: "s2", calendarId: null },
    { id: "s3", calendarId: "c2" },
    { id: "s4", calendarId: "missing" },
  ];

  it("returns all for all nav", () => {
    expect(filterSchedulesByCalendarNav(schedules, "all", known)).toHaveLength(
      4
    );
  });

  it("returns unassigned and orphaned for none", () => {
    expect(
      filterSchedulesByCalendarNav(schedules, "none", known).map((s) => s.id)
    ).toEqual(["s2", "s4"]);
  });

  it("filters by calendar id", () => {
    expect(
      filterSchedulesByCalendarNav(schedules, "c1", known).map((s) => s.id)
    ).toEqual(["s1"]);
  });

  it("returns empty for unknown calendar id", () => {
    expect(filterSchedulesByCalendarNav(schedules, "x", known)).toEqual([]);
  });
});

describe("countSchedulesByCalendarNav", () => {
  it("counts all, none, and per calendar", () => {
    const calendars = [
      { id: "c1", name: "Hornos", sortOrder: 0 },
      { id: "c2", name: "Empaque", sortOrder: 1 },
    ];
    const schedules = [
      { calendarId: "c1" },
      { calendarId: null },
      { calendarId: "c2" },
      { calendarId: "c1" },
      { calendarId: "gone" },
    ];
    const counts = countSchedulesByCalendarNav(schedules, calendars);
    expect(counts.all).toBe(5);
    expect(counts.none).toBe(2);
    expect(counts.byId.get("c1")).toBe(2);
    expect(counts.byId.get("c2")).toBe(1);
  });
});

describe("calendarAutoRefreshAllowed", () => {
  it("runs only when the page is visible and no blocking UI is open", () => {
    expect(
      calendarAutoRefreshAllowed({ pageVisible: true, blockingUiOpen: false })
    ).toBe(true);
    expect(
      calendarAutoRefreshAllowed({ pageVisible: false, blockingUiOpen: false })
    ).toBe(false);
    expect(
      calendarAutoRefreshAllowed({ pageVisible: true, blockingUiOpen: true })
    ).toBe(false);
  });
});
