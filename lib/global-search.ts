import type { UserRole } from "@/lib/auth-shared";
import { parseWorkOrderFolioInput } from "@/lib/work-order-folio-helpers";

export const GLOBAL_SEARCH_KINDS = [
  "work_order",
  "schedule",
  "asset",
  "checklist",
  "person",
  "knowledge",
] as const;

export type GlobalSearchKind = (typeof GLOBAL_SEARCH_KINDS)[number];

export const GLOBAL_SEARCH_KIND_LABELS: Record<GlobalSearchKind, string> = {
  work_order: "Tareas",
  schedule: "Eventos de calendario",
  asset: "Máquinas",
  checklist: "Checklists",
  person: "Personas",
  knowledge: "Base de conocimiento",
};

export const GLOBAL_SEARCH_MIN_QUERY_LENGTH = 2;
export const GLOBAL_SEARCH_LIMIT_PER_KIND = 8;
export const GLOBAL_SEARCH_MAX_QUERY_LENGTH = 80;

export type GlobalSearchHit = {
  kind: GlobalSearchKind;
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

export type GlobalSearchGroup = {
  kind: GlobalSearchKind;
  label: string;
  items: GlobalSearchHit[];
};

export function globalSearchResultCountLabel(count: number): string {
  const n = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
  return n === 1 ? "1 resultado" : `${n} resultados`;
}

export function normalizeSearchQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().replace(/\s+/g, " ").slice(0, GLOBAL_SEARCH_MAX_QUERY_LENGTH);
}

export function isSearchQueryReady(query: string): boolean {
  return query.length >= GLOBAL_SEARCH_MIN_QUERY_LENGTH;
}

/** Strip LIKE wildcards so user input cannot broaden the pattern. */
export function sqlIlikePattern(query: string): string | null {
  const safe = query.replace(/[%_\\]/g, "").trim();
  if (!safe) return null;
  return `%${safe}%`;
}

export function parseSearchFolio(query: string): string | null {
  const folioPhrase = query
    .replace(/^folio\s*#?\s*/i, "")
    .replace(/^#\s*/, "")
    .trim();
  return parseWorkOrderFolioInput(folioPhrase)?.canonical ?? null;
}

export function globalSearchKindsForRole(role: UserRole): GlobalSearchKind[] {
  if (role === "admin") {
    return [...GLOBAL_SEARCH_KINDS];
  }
  if (role === "calidad") {
    return ["work_order", "checklist", "person"];
  }
  return ["work_order", "person", "knowledge"];
}

export function clampSearchLimitPerKind(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return GLOBAL_SEARCH_LIMIT_PER_KIND;
  return Math.min(25, Math.max(1, Math.floor(n)));
}

export function globalSearchHref(
  kind: GlobalSearchKind,
  id: string,
  query = ""
): string {
  switch (kind) {
    case "work_order":
      return `/tareas/${id}`;
    case "asset":
      return `/assets/${id}`;
    case "checklist":
      return `/checklists/${id}`;
    case "schedule":
      return "/calendario";
    case "person":
      return `/equipo/${id}`;
    case "knowledge":
      return query
        ? `/knowledge-base?q=${encodeURIComponent(query)}`
        : "/knowledge-base";
  }
}

export function groupGlobalSearchResults(
  hits: GlobalSearchHit[]
): GlobalSearchGroup[] {
  return GLOBAL_SEARCH_KINDS.map((kind) => ({
    kind,
    label: GLOBAL_SEARCH_KIND_LABELS[kind],
    items: hits.filter((h) => h.kind === kind),
  })).filter((g) => g.items.length > 0);
}
