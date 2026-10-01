/**
 * CLI for CI: read changed paths (newline-separated) from stdin or argv.
 * Prints `true` or `false` and exits 0.
 *
 * Example:
 *   git diff --name-only "$BASE" "$HEAD" | node --experimental-strip-types scripts/ci-has-mobile-changes.ts
 */
import { readFileSync } from "node:fs";
import { hasMobileRelevantChanges } from "../lib/ci-mobile-paths.ts";

function readPathsFromStdin(): string[] {
  try {
    const text = readFileSync(0, "utf8");
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

const fromArgs = process.argv.slice(2).filter(Boolean);
const paths = fromArgs.length > 0 ? fromArgs : readPathsFromStdin();
process.stdout.write(`${hasMobileRelevantChanges(paths)}\n`);
