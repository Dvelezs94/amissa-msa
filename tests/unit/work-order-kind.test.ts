import { describe, expect, it } from "vitest";
import {
  parseWorkOrderKind,
  workOrderKindBadgeClass,
  workOrderKindLabel,
  workOrderMatchesKindFilter,
} from "@/lib/work-order-kind";

describe("parseWorkOrderKind", () => {
  it("maps routine", () => {
    expect(parseWorkOrderKind("routine")).toBe("routine");
  });
  it("defaults unknown to on_demand", () => {
    expect(parseWorkOrderKind(undefined)).toBe("on_demand");
    expect(parseWorkOrderKind("other")).toBe("on_demand");
  });
});

describe("workOrderKindLabel", () => {
  it("returns Spanish labels", () => {
    expect(workOrderKindLabel("routine")).toBe("Rutinaria");
    expect(workOrderKindLabel("on_demand")).toBe("Orden de trabajo");
  });
});

describe("workOrderMatchesKindFilter", () => {
  it("keeps every task when the filter is all", () => {
    expect(workOrderMatchesKindFilter("routine", "all")).toBe(true);
    expect(workOrderMatchesKindFilter("on_demand", "all")).toBe(true);
    expect(workOrderMatchesKindFilter(null, "all")).toBe(true);
  });

  it("keeps only routines or only work orders", () => {
    expect(workOrderMatchesKindFilter("routine", "routine")).toBe(true);
    expect(workOrderMatchesKindFilter("on_demand", "routine")).toBe(false);
    expect(workOrderMatchesKindFilter(undefined, "on_demand")).toBe(true);
    expect(workOrderMatchesKindFilter("routine", "on_demand")).toBe(false);
  });
});

describe("workOrderKindBadgeClass", () => {
  it("returns routine classes", () => {
    expect(workOrderKindBadgeClass("routine")).toBe("wo-kind-routine");
    expect(workOrderKindBadgeClass("routine", true)).toBe(
      "wo-kind-routine wo-kind-emphasis"
    );
  });
  it("returns on_demand classes", () => {
    expect(workOrderKindBadgeClass("on_demand")).toBe("wo-kind-on-demand");
  });
});
