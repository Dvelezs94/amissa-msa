import { describe, expect, it } from "vitest";
import {
  MOBILE_RELEVANT_PATH_GLOBS,
  hasMobileRelevantChanges,
  isMobileRelevantPath,
  pathMatchesMobileGlob,
} from "@/lib/ci-mobile-paths";

describe("MOBILE_RELEVANT_PATH_GLOBS", () => {
  it("lists mobile tree and cicd workflow", () => {
    expect([...MOBILE_RELEVANT_PATH_GLOBS]).toEqual([
      "mobile/**",
      ".github/workflows/cicd.yml",
    ]);
  });
});

describe("pathMatchesMobileGlob", () => {
  it("matches mobile/** prefix", () => {
    expect(pathMatchesMobileGlob("mobile/App.tsx", "mobile/**")).toBe(true);
    expect(pathMatchesMobileGlob("mobile", "mobile/**")).toBe(true);
    expect(pathMatchesMobileGlob("app/page.tsx", "mobile/**")).toBe(false);
  });

  it("matches exact workflow path", () => {
    expect(
      pathMatchesMobileGlob(
        ".github/workflows/cicd.yml",
        ".github/workflows/cicd.yml"
      )
    ).toBe(true);
    expect(
      pathMatchesMobileGlob(
        ".github/workflows/other.yml",
        ".github/workflows/cicd.yml"
      )
    ).toBe(false);
  });
});

describe("hasMobileRelevantChanges", () => {
  it("returns false for empty or web-only paths", () => {
    expect(hasMobileRelevantChanges([])).toBe(false);
    expect(
      hasMobileRelevantChanges(["app/page.tsx", "lib/auth.ts", "AGENTS.md"])
    ).toBe(false);
  });

  it("returns true for mobile/** changes", () => {
    expect(
      hasMobileRelevantChanges(["app/page.tsx", "mobile/lib/wo-status.ts"])
    ).toBe(true);
  });

  it("returns true for cicd workflow changes", () => {
    expect(
      hasMobileRelevantChanges([".github/workflows/cicd.yml"])
    ).toBe(true);
  });
});

describe("isMobileRelevantPath", () => {
  it("normalizes slashes and ./ prefix", () => {
    expect(isMobileRelevantPath("./mobile/App.tsx")).toBe(true);
    expect(isMobileRelevantPath("mobile\\theme.ts")).toBe(true);
  });
});
