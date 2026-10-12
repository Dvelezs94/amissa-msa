import { NextResponse } from "next/server";
import { and, desc, eq, ilike, isNull, or } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  assetFiles,
  assetGroups,
  assets,
  calendars,
  checklistFolders,
  checklistTemplates,
  maintenanceSchedules,
  users,
  workOrders,
} from "@/lib/db/schema";
import { formatRoleLabel } from "@/lib/user-profile-labels";
import {
  clampSearchLimitPerKind,
  globalSearchHref,
  globalSearchKindsForRole,
  groupGlobalSearchResults,
  isSearchQueryReady,
  normalizeSearchQuery,
  parseSearchFolio,
  sqlIlikePattern,
  type GlobalSearchHit,
  type GlobalSearchKind,
} from "@/lib/global-search";
import { formatWorkOrderFolioDisplay } from "@/lib/work-order-folio-helpers";
import { workOrderFolioEquals } from "@/lib/work-order-folio";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const query = normalizeSearchQuery(searchParams.get("q") ?? "");
  const limit = clampSearchLimitPerKind(searchParams.get("limit"));
  if (!isSearchQueryReady(query)) {
    return NextResponse.json({ query, groups: [] });
  }

  const pattern = sqlIlikePattern(query);
  if (!pattern) {
    return NextResponse.json({ query, groups: [] });
  }

  const kinds = new Set(globalSearchKindsForRole(session.role));
  const hits = (
    await Promise.all([
      kinds.has("work_order") ? searchWorkOrders(pattern, query, limit) : [],
      kinds.has("schedule") ? searchSchedules(pattern, limit) : [],
      kinds.has("asset") ? searchAssets(pattern, limit) : [],
      kinds.has("checklist") ? searchChecklists(pattern, limit) : [],
      kinds.has("person")
        ? searchPeople(pattern, limit, session.role === "admin")
        : [],
      kinds.has("knowledge") ? searchKnowledge(pattern, query, limit) : [],
    ])
  ).flat();

  return NextResponse.json({
    query,
    groups: groupGlobalSearchResults(hits),
  });
}

function hit(
  kind: GlobalSearchKind,
  id: string,
  title: string,
  subtitle: string | null,
  query?: string
): GlobalSearchHit {
  return {
    kind,
    id,
    title,
    subtitle,
    href: globalSearchHref(kind, id, query),
  };
}

async function searchWorkOrders(
  pattern: string,
  query: string,
  limit: number
): Promise<GlobalSearchHit[]> {
  const folio = parseSearchFolio(query);
  const folioMatch = folio ? workOrderFolioEquals(folio) : null;
  const match = or(
    ilike(workOrders.title, pattern),
    ilike(workOrders.description, pattern),
    ilike(assets.name, pattern),
    ilike(assets.assetId, pattern),
    ...(folioMatch ? [folioMatch] : [])
  );
  const rows = await db
    .select({
      id: workOrders.id,
      folio: workOrders.folio,
      title: workOrders.title,
      assetName: assets.name,
      assetCode: assets.assetId,
    })
    .from(workOrders)
    .leftJoin(assets, eq(workOrders.assetId, assets.id))
    .where(match)
    .orderBy(desc(workOrders.updatedAt))
    .limit(limit);

  return rows.map((r) =>
    hit(
      "work_order",
      r.id,
      r.folio != null ? `${formatWorkOrderFolioDisplay(String(r.folio))} · ${r.title}` : r.title,
      r.assetName
        ? `${r.assetName}${r.assetCode ? ` (${r.assetCode})` : ""}`
        : "Sin máquina"
    )
  );
}

async function searchSchedules(
  pattern: string,
  limit: number
): Promise<GlobalSearchHit[]> {
  const rows = await db
    .select({
      id: maintenanceSchedules.id,
      name: maintenanceSchedules.name,
      calendarName: calendars.name,
    })
    .from(maintenanceSchedules)
    .leftJoin(calendars, eq(maintenanceSchedules.calendarId, calendars.id))
    .where(
      and(
        isNull(maintenanceSchedules.deletedAt),
        or(
          ilike(maintenanceSchedules.name, pattern),
          ilike(calendars.name, pattern)
        )
      )
    )
    .orderBy(desc(maintenanceSchedules.createdAt))
    .limit(limit);

  return rows.map((r) =>
    hit("schedule", r.id, r.name, r.calendarName ?? "Calendario")
  );
}

async function searchAssets(
  pattern: string,
  limit: number
): Promise<GlobalSearchHit[]> {
  const rows = await db
    .select({
      id: assets.id,
      name: assets.name,
      assetId: assets.assetId,
      groupName: assetGroups.name,
    })
    .from(assets)
    .leftJoin(assetGroups, eq(assets.groupId, assetGroups.id))
    .where(
      or(
        ilike(assets.name, pattern),
        ilike(assets.assetId, pattern),
        ilike(assetGroups.name, pattern)
      )
    )
    .orderBy(desc(assets.updatedAt))
    .limit(limit);

  return rows.map((r) =>
    hit(
      "asset",
      r.id,
      r.name,
      [r.assetId, r.groupName].filter(Boolean).join(" · ") || null
    )
  );
}

async function searchChecklists(
  pattern: string,
  limit: number
): Promise<GlobalSearchHit[]> {
  const rows = await db
    .select({
      id: checklistTemplates.id,
      name: checklistTemplates.name,
      description: checklistTemplates.description,
      folderName: checklistFolders.name,
    })
    .from(checklistTemplates)
    .leftJoin(
      checklistFolders,
      eq(checklistTemplates.folderId, checklistFolders.id)
    )
    .where(
      or(
        ilike(checklistTemplates.name, pattern),
        ilike(checklistTemplates.description, pattern),
        ilike(checklistFolders.name, pattern)
      )
    )
    .orderBy(desc(checklistTemplates.createdAt))
    .limit(limit);

  return rows.map((r) =>
    hit(
      "checklist",
      r.id,
      r.name,
      r.folderName ?? r.description ?? null
    )
  );
}

async function searchPeople(
  pattern: string,
  limit: number,
  includeEmail: boolean
): Promise<GlobalSearchHit[]> {
  const match = or(
    ilike(users.name, pattern),
    ilike(users.username, pattern),
    ...(includeEmail ? [ilike(users.email, pattern)] : [])
  );
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      username: users.username,
      email: users.email,
      role: users.role,
    })
    .from(users)
    .where(and(eq(users.isDisabled, false), match))
    .orderBy(users.name)
    .limit(limit);

  return rows.map((r) =>
    hit("person", r.id, r.name, `@${r.username} · ${formatRoleLabel(r.role)}`)
  );
}

async function searchKnowledge(
  pattern: string,
  query: string,
  limit: number
): Promise<GlobalSearchHit[]> {
  const rows = await db
    .select({
      id: assetFiles.id,
      filename: assetFiles.filename,
      category: assetFiles.category,
      assetName: assets.name,
    })
    .from(assetFiles)
    .leftJoin(assets, eq(assetFiles.assetId, assets.id))
    .where(
      or(
        ilike(assetFiles.filename, pattern),
        ilike(assetFiles.category, pattern),
        ilike(assets.name, pattern),
        ilike(assets.assetId, pattern)
      )
    )
    .orderBy(desc(assetFiles.createdAt))
    .limit(limit);

  return rows.map((r) =>
    hit(
      "knowledge",
      r.id,
      r.filename,
      [r.category, r.assetName].filter(Boolean).join(" · ") || null,
      query
    )
  );
}
