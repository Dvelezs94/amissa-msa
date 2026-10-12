import { describe, expect, it } from "vitest";
import {
  clampSearchLimitPerKind,
  globalSearchHref,
  globalSearchKindsForRole,
  groupGlobalSearchResults,
  globalSearchResultCountLabel,
  isSearchQueryReady,
  normalizeSearchQuery,
  parseSearchFolio,
  sqlIlikePattern,
  type GlobalSearchHit,
} from "@/lib/global-search";

describe("normalizeSearchQuery", () => {
  it("trims and collapses whitespace", () => {
    expect(normalizeSearchQuery("  horno   HT-01  ")).toBe("horno HT-01");
  });
  it("rejects non-strings", () => {
    expect(normalizeSearchQuery(null)).toBe("");
  });
});

describe("isSearchQueryReady", () => {
  it("requires at least 2 characters", () => {
    expect(isSearchQueryReady("")).toBe(false);
    expect(isSearchQueryReady("h")).toBe(false);
    expect(isSearchQueryReady("ht")).toBe(true);
  });
});

describe("sqlIlikePattern", () => {
  it("wraps the query and strips LIKE wildcards", () => {
    expect(sqlIlikePattern("horno")).toBe("%horno%");
    expect(sqlIlikePattern("%admin_")).toBe("%admin%");
    expect(sqlIlikePattern("%")).toBeNull();
  });
});

describe("parseSearchFolio", () => {
  it("parses folio phrases", () => {
    expect(parseSearchFolio("2005")).toBe("2005");
    expect(parseSearchFolio("#2005")).toBe("2005");
    expect(parseSearchFolio("folio 2005")).toBe("2005");
    expect(parseSearchFolio("ot12")).toBe("OT-12");
    expect(parseSearchFolio("ru-4000")).toBe("RU-4000");
    expect(parseSearchFolio("horno")).toBeNull();
  });
});

describe("globalSearchKindsForRole", () => {
  it("gives admin every kind", () => {
    expect(globalSearchKindsForRole("admin")).toEqual([
      "work_order",
      "schedule",
      "asset",
      "checklist",
      "person",
      "knowledge",
    ]);
  });
  it("limits tecnico and calidad to reachable app sections", () => {
    expect(globalSearchKindsForRole("tecnico")).toEqual([
      "work_order",
      "person",
      "knowledge",
    ]);
    expect(globalSearchKindsForRole("calidad")).toEqual([
      "work_order",
      "checklist",
      "person",
    ]);
  });
});

describe("globalSearchHref", () => {
  it("maps kinds to app routes", () => {
    expect(globalSearchHref("work_order", "wo1")).toBe("/tareas/wo1");
    expect(globalSearchHref("asset", "a1")).toBe("/assets/a1");
    expect(globalSearchHref("checklist", "c1")).toBe("/checklists/c1");
    expect(globalSearchHref("schedule", "s1")).toBe("/calendario");
    expect(globalSearchHref("person", "u1")).toBe("/equipo/u1");
    expect(globalSearchHref("knowledge", "f1", "manual")).toBe(
      "/knowledge-base?q=manual"
    );
  });
});

describe("groupGlobalSearchResults", () => {
  it("groups in kind order and drops empty sections", () => {
    const hits: GlobalSearchHit[] = [
      {
        kind: "person",
        id: "u1",
        title: "Ana",
        subtitle: null,
        href: "/equipo/u1",
      },
      {
        kind: "work_order",
        id: "wo1",
        title: "Falla",
        subtitle: null,
        href: "/tareas/wo1",
      },
    ];
    expect(groupGlobalSearchResults(hits).map((g) => g.kind)).toEqual([
      "work_order",
      "person",
    ]);
  });
});

describe("globalSearchResultCountLabel", () => {
  it("uses singular and plural Spanish", () => {
    expect(globalSearchResultCountLabel(0)).toBe("0 resultados");
    expect(globalSearchResultCountLabel(1)).toBe("1 resultado");
    expect(globalSearchResultCountLabel(4)).toBe("4 resultados");
  });
});

describe("clampSearchLimitPerKind", () => {
  it("defaults and clamps", () => {
    expect(clampSearchLimitPerKind(undefined)).toBe(8);
    expect(clampSearchLimitPerKind(100)).toBe(25);
    expect(clampSearchLimitPerKind(0)).toBe(1);
  });
});
