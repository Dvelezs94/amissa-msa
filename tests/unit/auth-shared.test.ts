import { describe, expect, it } from "vitest";
import {
  AVAILABLE_USER_ROLES,
  canDeleteWorkOrder,
  canEditLockedWorkOrderChecklist,
  canManageCalendarEvents,
  canRenameCalendar,
} from "@/lib/auth-shared";

describe("AVAILABLE_USER_ROLES", () => {
  it("includes tecnico, admin and calidad", () => {
    expect(AVAILABLE_USER_ROLES).toContain("tecnico");
    expect(AVAILABLE_USER_ROLES).toContain("admin");
    expect(AVAILABLE_USER_ROLES).toContain("calidad");
    expect(AVAILABLE_USER_ROLES).toHaveLength(3);
  });
});

describe("canEditLockedWorkOrderChecklist", () => {
  it("allows admin and calidad only", () => {
    expect(canEditLockedWorkOrderChecklist("admin")).toBe(true);
    expect(canEditLockedWorkOrderChecklist("calidad")).toBe(true);
    expect(canEditLockedWorkOrderChecklist("tecnico")).toBe(false);
  });
});

describe("canRenameCalendar", () => {
  it("allows admin and calidad (supervisor)", () => {
    expect(canRenameCalendar("admin")).toBe(true);
    expect(canRenameCalendar("calidad")).toBe(true);
    expect(canRenameCalendar("tecnico")).toBe(false);
    expect(canRenameCalendar(undefined)).toBe(false);
  });
});

describe("canManageCalendarEvents", () => {
  it("allows admin only", () => {
    expect(canManageCalendarEvents("admin")).toBe(true);
    expect(canManageCalendarEvents("calidad")).toBe(false);
    expect(canManageCalendarEvents("tecnico")).toBe(false);
  });
});

describe("canDeleteWorkOrder", () => {
  it("allows admin only", () => {
    expect(canDeleteWorkOrder("admin")).toBe(true);
    expect(canDeleteWorkOrder("tecnico")).toBe(false);
    expect(canDeleteWorkOrder("calidad")).toBe(false);
    expect(canDeleteWorkOrder(undefined)).toBe(false);
  });
});
