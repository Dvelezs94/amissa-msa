import { describe, expect, it } from "vitest";
import {
  formatWorkOrderFolioDisplay,
  nextPrefixedFolio,
  parseWorkOrderFolioInput,
  workOrderFoliosMatch,
} from "@/lib/work-order-folio-helpers";

describe("nextPrefixedFolio", () => {
  it("starts OT at OT-1 and ignores numeric and RU values", () => {
    expect(nextPrefixedFolio([null, "", "2044", "RU-4000", "ru-12"], "OT")).toBe("OT-1");
  });

  it("continues the highest existing OT, including variants", () => {
    expect(nextPrefixedFolio(["OT-80", "ot12", "2044", "RU-4102"], "OT")).toBe("OT-81");
  });

  it("starts RU at RU-4000 when existing RU numbers are below the floor", () => {
    expect(nextPrefixedFolio(["ru-12", "OT-3", "2100"], "RU")).toBe("RU-4000");
  });

  it("continues RU above 4000", () => {
    expect(nextPrefixedFolio(["RU-4102", "RU4000", "OT-9"], "RU")).toBe("RU-4103");
  });

  it("does not let a new OT advance the RU counter", () => {
    const existing = ["OT-3", "RU-4000"];
    expect(nextPrefixedFolio(existing, "OT")).toBe("OT-4");
    expect(nextPrefixedFolio(existing, "RU")).toBe("RU-4001");
  });
});

describe("parseWorkOrderFolioInput", () => {
  it("canonicalizes OT and RU with or without a hyphen", () => {
    expect(parseWorkOrderFolioInput("ot12")).toEqual({
      kind: "prefixed",
      series: "OT",
      canonical: "OT-12",
    });
    expect(parseWorkOrderFolioInput("RU-4000")).toEqual({
      kind: "prefixed",
      series: "RU",
      canonical: "RU-4000",
    });
    expect(parseWorkOrderFolioInput("ru4000")?.canonical).toBe("RU-4000");
  });

  it("keeps a legacy integer and rejects junk", () => {
    expect(parseWorkOrderFolioInput("2044")).toEqual({
      kind: "legacy",
      canonical: "2044",
    });
    expect(parseWorkOrderFolioInput("0")).toBeNull();
    expect(parseWorkOrderFolioInput("OT-0")).toBeNull();
    expect(parseWorkOrderFolioInput("abc")).toBeNull();
  });
});

describe("workOrderFoliosMatch", () => {
  it("matches case and hyphen variants of the same series only", () => {
    expect(workOrderFoliosMatch("ot12", "OT-12")).toBe(true);
    expect(workOrderFoliosMatch("ru-4000", "RU4000")).toBe(true);
    expect(workOrderFoliosMatch("2044", "OT-2044")).toBe(false);
  });
});

describe("formatWorkOrderFolioDisplay", () => {
  it("does not add a hash to a prefixed folio", () => {
    expect(formatWorkOrderFolioDisplay("OT-12")).toBe("OT-12");
    expect(formatWorkOrderFolioDisplay("ru-12")).toBe("ru-12");
    expect(formatWorkOrderFolioDisplay("2044")).toBe("#2044");
  });
});
