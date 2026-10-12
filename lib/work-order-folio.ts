import { eq, sql, type SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schema";
import {
  nextPrefixedFolio,
  parseWorkOrderFolioInput,
  type FolioSeries,
} from "@/lib/work-order-folio-helpers";

export {
  formatWorkOrderFolioDisplay,
  nextPrefixedFolio,
  parseWorkOrderFolioInput,
  workOrderFoliosMatch,
} from "@/lib/work-order-folio-helpers";

function seriesForKind(kind: "routine" | "on_demand"): FolioSeries {
  return kind === "routine" ? "RU" : "OT";
}

export async function getNextWorkOrderFolio(
  kind: "routine" | "on_demand"
): Promise<string> {
  const rows = await db
    .select({ folio: workOrders.folio })
    .from(workOrders)
    .where(eq(workOrders.kind, kind));
  return nextPrefixedFolio(
    rows.map((row) => row.folio),
    seriesForKind(kind)
  );
}

/**
 * Match a typed folio against stored text.
 * Prefixed folios compare a normalized form so `ot12` finds `OT-12`.
 * A legacy number matches only that digit string.
 */
export function workOrderFolioEquals(raw: string): SQL | null {
  const parsed = parseWorkOrderFolioInput(raw);
  if (!parsed) return null;
  if (parsed.kind === "legacy") {
    return eq(workOrders.folio, parsed.canonical);
  }
  return sql`upper(regexp_replace(upper(${workOrders.folio}), '^(OT|RU)-?([0-9]+)$', '\\1-\\2')) = ${parsed.canonical}`;
}
