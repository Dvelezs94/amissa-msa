import { describe, expect, it } from "vitest";
import {
  filterUsersByAssigneeQuery,
  orderAssigneeFilterUsers,
} from "@/lib/assignee-search";

const users = [
  { id: "1", name: "Administrador" },
  { id: "2", name: "José García" },
  { id: "3", name: "Técnico Turno A" },
  { id: "4", name: "Inspector de Calidad" },
];

describe("orderAssigneeFilterUsers", () => {
  it("puts the current user first and sorts the rest", () => {
    expect(
      orderAssigneeFilterUsers(users, "", "3").map((u) => u.id)
    ).toEqual(["3", "1", "4", "2"]);
  });

  it("filters by name and still keeps the current user first", () => {
    expect(
      orderAssigneeFilterUsers(users, "turno", "3").map((u) => u.id)
    ).toEqual(["3"]);
    expect(orderAssigneeFilterUsers(users, "jose", "1").map((u) => u.name)).toEqual([
      "José García",
    ]);
  });
});

describe("filterUsersByAssigneeQuery", () => {
  it("returns nothing until the user types", () => {
    expect(filterUsersByAssigneeQuery(users, "")).toEqual([]);
    expect(filterUsersByAssigneeQuery(users, "   ")).toEqual([]);
  });

  it("matches names case-insensitively and ignores accents", () => {
    expect(filterUsersByAssigneeQuery(users, "jose").map((u) => u.id)).toEqual([
      "2",
    ]);
    expect(
      filterUsersByAssigneeQuery(users, "TECNICO").map((u) => u.id)
    ).toEqual(["3"]);
  });

  it("skips people already selected and caps results", () => {
    expect(
      filterUsersByAssigneeQuery(users, "calidad", ["4"]).map((u) => u.id)
    ).toEqual([]);
    expect(
      filterUsersByAssigneeQuery(users, "calidad").map((u) => u.id)
    ).toEqual(["4"]);
    expect(filterUsersByAssigneeQuery(users, "turno", [], 1)).toHaveLength(1);
  });
});
