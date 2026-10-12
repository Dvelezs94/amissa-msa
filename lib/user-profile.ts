import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets, users, workOrders } from "@/lib/db/schema";

/** Work orders where this user is primary assignee or in `work_order_assignees`. */
export function assignedToUserClause(userId: string) {
  return sql`(
    ${workOrders.assigneeId} = ${userId}
    OR EXISTS (
      SELECT 1 FROM work_order_assignees woa
      WHERE woa.work_order_id = ${workOrders.id}
      AND woa.user_id = ${userId}
    )
  )`;
}

export async function getPublicUserProfile(userId: string) {
  const user = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.isDisabled, false)),
    columns: {
      id: true,
      name: true,
      username: true,
      email: true,
      role: true,
      avatarUrl: true,
      avatarBackgroundColor: true,
      createdAt: true,
    },
  });
  return user ?? null;
}

export type UserProfileWorkOrderRow = {
  id: string;
  folio: string | null;
  title: string;
  status: string;
  priority: string;
  kind: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  assetName: string | null;
  assetAssetId: string | null;
};

export async function getWorkOrdersForUserProfile(
  userId: string,
  limit = 80
): Promise<UserProfileWorkOrderRow[]> {
  const clause = assignedToUserClause(userId);
  const rows = await db
    .select({
      id: workOrders.id,
      folio: workOrders.folio,
      title: workOrders.title,
      status: workOrders.status,
      priority: workOrders.priority,
      kind: workOrders.kind,
      dueDate: workOrders.dueDate,
      completedAt: workOrders.completedAt,
      createdAt: workOrders.createdAt,
      assetName: assets.name,
      assetAssetId: assets.assetId,
    })
    .from(workOrders)
    .leftJoin(assets, eq(workOrders.assetId, assets.id))
    .where(clause)
    .orderBy(desc(workOrders.updatedAt))
    .limit(limit);

  return rows as UserProfileWorkOrderRow[];
}

export type UserProfileStats = {
  total: number;
  active: number;
  completed: number;
  cancelled: number;
};

export async function getUserWorkOrderStats(userId: string): Promise<UserProfileStats> {
  const clause = assignedToUserClause(userId);
  const rows = await db
    .select({
      status: workOrders.status,
      count: sql<number>`count(*)::int`,
    })
    .from(workOrders)
    .where(clause)
    .groupBy(workOrders.status);

  let total = 0;
  let active = 0;
  let completed = 0;
  let cancelled = 0;
  for (const r of rows) {
    const n = Number(r.count) || 0;
    total += n;
    if (r.status === "pending" || r.status === "in_progress") active += n;
    if (r.status === "completed") completed += n;
    if (r.status === "cancelled") cancelled += n;
  }
  return { total, active, completed, cancelled };
}
