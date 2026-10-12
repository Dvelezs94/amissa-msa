import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, Mail, User as UserIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { UserAvatar } from "@/components/UserAvatar";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { formatRoleLabel } from "@/lib/user-profile-labels";
import {
  getPublicUserProfile,
  getUserWorkOrderStats,
  getWorkOrdersForUserProfile,
} from "@/lib/user-profile";
import {
  parseWorkOrderKind,
  workOrderKindBadgeClass,
  workOrderKindLabel,
} from "@/lib/work-order-kind";
import { formatWorkOrderFolioDisplay } from "@/lib/work-order-folio-helpers";
import { SetPageHeader } from "@/components/SetPageHeader";

function statusLabel(status: string): string {
  if (status === "pending") return "Pendiente";
  if (status === "in_progress") return "En progreso";
  if (status === "completed") return "Completada";
  if (status === "cancelled") return "Cancelada";
  return status;
}

function statusBadgeClass(status: string): string {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "in_progress") return "bg-blue-100 text-blue-800";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  return "bg-zinc-100 text-zinc-600";
}

export default async function EquipoUsuarioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) notFound();

  const { id } = await params;
  const user = await getPublicUserProfile(id);
  if (!user) notFound();

  const showEmail = session.role === "admin" || session.id === id;
  const [stats, workOrders] = await Promise.all([
    getUserWorkOrderStats(id),
    getWorkOrdersForUserProfile(id, 80),
  ]);

  const memberSince = user.createdAt.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: APP_TIME_ZONE,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-zinc-500">
        <Link
          href="/tareas"
          className="font-medium text-[#F14C03] hover:underline"
        >
          Tareas
        </Link>
        <span aria-hidden className="text-zinc-400">
          /
        </span>
        <span className="text-zinc-600">Perfil</span>
      </nav>

      <SetPageHeader title={user.name} subtitle={`@${user.username}`} />

      <header className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <UserAvatar
            userId={user.id}
            name={user.name}
            avatarUrl={user.avatarUrl}
            avatarBackgroundColor={user.avatarBackgroundColor}
            size="lg"
            className="!h-20 !w-20 !text-2xl shrink-0"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600">
              <span className="inline-flex items-center gap-1.5">
                <UserIcon className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                @{user.username}
              </span>
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700">
                {formatRoleLabel(user.role)}
              </span>
            </div>
            {showEmail && user.email ? (
              <p className="flex items-center gap-2 text-sm text-zinc-600">
                <Mail className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                <a href={`mailto:${user.email}`} className="truncate hover:text-primary-600 hover:underline">
                  {user.email}
                </a>
              </p>
            ) : null}
            <p className="text-xs text-zinc-500">Miembro desde {memberSince}</p>
          </div>
        </div>
      </header>

      <section aria-labelledby="resumen-heading">
        <h2 id="resumen-heading" className="sr-only">
          Resumen de tareas
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Activas
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {stats.active}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Pendientes + en progreso</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Completadas
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-emerald-700">
              {stats.completed}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">Histórico</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Total asignadas
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
              {stats.total}
            </p>
            <p className="mt-0.5 text-xs text-zinc-500">
              Incluye canceladas ({stats.cancelled})
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <div className="border-b border-zinc-100 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <ClipboardList className="h-4 w-4 text-zinc-500" aria-hidden />
            Historial de tareas
          </h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            Ordenadas por última actualización (asignación directa o conjunta).
          </p>
        </div>
        {workOrders.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-zinc-500">
            Aún no hay tareas asignadas a esta persona.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {workOrders.map((wo) => {
              const kind = parseWorkOrderKind(wo.kind);
              return (
                <li key={wo.id}>
                  <Link
                    href={`/tareas/${wo.id}`}
                    className="flex flex-col gap-2 px-4 py-3 transition hover:bg-zinc-50 sm:flex-row sm:items-start sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900">
                        {wo.folio != null ? (
                          <span className="text-zinc-500">{formatWorkOrderFolioDisplay(String(wo.folio))} · </span>
                        ) : null}
                        {wo.title}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">
                        {wo.assetName
                          ? `${wo.assetName}${wo.assetAssetId ? ` (${wo.assetAssetId})` : ""}`
                          : "Sin activo"}
                      </p>
                      <span
                        className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${workOrderKindBadgeClass(
                          kind
                        )}`}
                      >
                        {workOrderKindLabel(kind)}
                      </span>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusBadgeClass(
                          wo.status
                        )}`}
                      >
                        {statusLabel(wo.status)}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {wo.completedAt
                          ? `Cerrada ${wo.completedAt.toLocaleDateString("es-MX", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              timeZone: APP_TIME_ZONE,
                            })}`
                          : wo.dueDate
                            ? `Vence ${wo.dueDate.toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                timeZone: APP_TIME_ZONE,
                              })}`
                            : `Alta ${wo.createdAt.toLocaleDateString("es-MX", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                timeZone: APP_TIME_ZONE,
                              })}`}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
