export const OT_FOLIO_SERIES = "OT" as const;
export const RU_FOLIO_SERIES = "RU" as const;
export const INITIAL_OT_FOLIO_NUMBER = 1;
export const INITIAL_RU_FOLIO_NUMBER = 4000;

export type FolioSeries = typeof OT_FOLIO_SERIES | typeof RU_FOLIO_SERIES;

const PREFIXED_FOLIO_RE = /^(OT|RU)-?(\d+)$/i;

export type ParsedWorkOrderFolio =
  | { kind: "prefixed"; series: FolioSeries; canonical: string }
  | { kind: "legacy"; canonical: string };

export function canonicalPrefixedFolio(series: FolioSeries, n: number): string {
  return `${series}-${n}`;
}

/** Number in one series. Ignores case and an optional hyphen. Legacy digits are not a series. */
export function prefixedFolioNumber(raw: string, series: FolioSeries): number | null {
  const match = raw.trim().match(PREFIXED_FOLIO_RE);
  if (!match || match[1].toUpperCase() !== series) return null;
  const n = Number(match[2]);
  if (!Number.isInteger(n) || n < 1) return null;
  return n;
}

/**
 * Next folio for one series. Numeric legacies and the other prefix do not count.
 * Existing values are not rewritten; this only chooses the next code.
 */
export function nextPrefixedFolio(
  existing: readonly (string | null | undefined)[],
  series: FolioSeries
): string {
  let max = 0;
  let found = false;
  for (const raw of existing) {
    if (raw == null || raw === "") continue;
    const n = prefixedFolioNumber(String(raw), series);
    if (n == null) continue;
    found = true;
    if (n > max) max = n;
  }
  if (series === OT_FOLIO_SERIES) {
    return canonicalPrefixedFolio(OT_FOLIO_SERIES, found ? max + 1 : INITIAL_OT_FOLIO_NUMBER);
  }
  const next = found
    ? Math.max(INITIAL_RU_FOLIO_NUMBER, max + 1)
    : INITIAL_RU_FOLIO_NUMBER;
  return canonicalPrefixedFolio(RU_FOLIO_SERIES, next);
}

/** Canonical `OT-n` / `RU-n`, or the legacy digit string. Null when the text is not a folio. */
export function parseWorkOrderFolioInput(raw: string): ParsedWorkOrderFolio | null {
  const trimmed = raw.trim();
  const prefixed = trimmed.match(PREFIXED_FOLIO_RE);
  if (prefixed) {
    const series = prefixed[1].toUpperCase() as FolioSeries;
    const n = Number(prefixed[2]);
    if (!Number.isInteger(n) || n < 1) return null;
    return { kind: "prefixed", series, canonical: canonicalPrefixedFolio(series, n) };
  }
  if (!/^\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return null;
  return { kind: "legacy", canonical: String(n) };
}

export function workOrderFoliosMatch(a: string, b: string): boolean {
  const left = parseWorkOrderFolioInput(a);
  const right = parseWorkOrderFolioInput(b);
  if (!left || !right || left.kind !== right.kind) return false;
  return left.canonical === right.canonical;
}

/** Show the stored folio. Prefixed codes stay as stored; a legacy number gets a leading #. */
export function formatWorkOrderFolioDisplay(folio: string): string {
  const trimmed = folio.trim();
  if (parseWorkOrderFolioInput(trimmed)?.kind === "prefixed") return trimmed;
  return `#${trimmed}`;
}
