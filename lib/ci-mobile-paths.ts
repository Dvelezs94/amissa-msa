/** Globs / paths that force the mobile Android CI job. Keep in sync with `.github/workflows/cicd.yml`. */
export const MOBILE_RELEVANT_PATH_GLOBS = [
  "mobile/**",
  ".github/workflows/cicd.yml",
] as const;

function normalizeRepoPath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

/** Match a single changed path against a simple glob (`**` only as a trailing segment). */
export function pathMatchesMobileGlob(
  filePath: string,
  glob: string
): boolean {
  const path = normalizeRepoPath(filePath);
  if (!path || path.startsWith("#")) return false;

  if (glob.endsWith("/**")) {
    const prefix = glob.slice(0, -3);
    return path === prefix || path.startsWith(`${prefix}/`);
  }

  return path === glob;
}

export function isMobileRelevantPath(filePath: string): boolean {
  return MOBILE_RELEVANT_PATH_GLOBS.some((glob) =>
    pathMatchesMobileGlob(filePath, glob)
  );
}

/** True if any changed path should trigger mobile Android CI. */
export function hasMobileRelevantChanges(paths: string[]): boolean {
  return paths.some((p) => isMobileRelevantPath(p));
}
