import { describe, expect, it } from "vitest";
import { dedupeAssigneeIds } from "@/lib/assignee-ids";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { formatRoleLabel } from "@/lib/user-profile-labels";

describe("dedupeAssigneeIds", () => {
  it("removes empties and duplicates preserving order", () => {
    expect(dedupeAssigneeIds(["a", "", "b", "a", "c"])).toEqual(["a", "b", "c"]);
  });
});

describe("APP_TIME_ZONE", () => {
  it("is Saltillo/Monterrey zone", () => {
    expect(APP_TIME_ZONE).toBe("America/Monterrey");
  });
});

describe("formatRoleLabel", () => {
  it("maps known roles", () => {
    expect(formatRoleLabel("admin")).toBe("Administrador");
    expect(formatRoleLabel("tecnico")).toBe("Técnico");
    expect(formatRoleLabel("calidad")).toBe("Calidad");
  });
  it("returns raw for unknown", () => {
    expect(formatRoleLabel("other")).toBe("other");
  });
});
