"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, Search, X } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { orderAssigneeFilterUsers } from "@/lib/assignee-search";
import { WORK_ORDER_KIND_FILTERS, type WorkOrderKindFilter } from "@/lib/work-order-kind";
import { useSheetModalPresence } from "@/lib/use-sheet-modal-presence";

export type WorkOrderFilterUser = {
  id: string;
  name: string;
  avatarUrl?: string | null;
  avatarBackgroundColor?: string | null;
};

export function WorkOrderFiltersDialog({
  open,
  onClose,
  kindFilter,
  onKindFilterChange,
  users,
  currentUserId,
  selectedAssigneeId,
  onAssigneeChange,
}: {
  open: boolean;
  onClose: () => void;
  kindFilter: WorkOrderKindFilter;
  onKindFilterChange: (next: WorkOrderKindFilter) => void;
  users: WorkOrderFilterUser[];
  currentUserId: string | null;
  selectedAssigneeId: string | null;
  onAssigneeChange: (next: string | null) => void;
}) {
  const { mounted, show, onPanelTransitionEnd } = useSheetModalPresence(open);
  const [personQuery, setPersonQuery] = useState("");

  useEffect(() => {
    if (!open) setPersonQuery("");
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted, onClose]);

  const visibleUsers = useMemo(
    () => orderAssigneeFilterUsers(users, personQuery, currentUserId),
    [users, personQuery, currentUserId]
  );

  const hasActive = kindFilter !== "all" || selectedAssigneeId != null;

  return mounted ? (
    <div
      className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 transition-opacity duration-300 ease-out motion-reduce:transition-none md:items-center md:p-4 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="wo-filters-heading"
        className={`relative flex max-h-[min(90dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-zinc-200 border-b-0 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 md:rounded-2xl md:border-b md:shadow-lg ${
          show
            ? "translate-y-0 motion-reduce:translate-y-0"
            : "translate-y-full motion-reduce:translate-y-0 md:translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
        onTransitionEnd={onPanelTransitionEnd}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
          <h2 id="wo-filters-heading" className="text-sm font-semibold text-zinc-900">
            Filtros
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="inline-flex items-center justify-center rounded-md border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Tipo
            </p>
            <div className="space-y-2" role="group" aria-label="Tipo de tarea">
              {WORK_ORDER_KIND_FILTERS.map((option) => (
                <FilterChoice
                  key={option.value}
                  selected={kindFilter === option.value}
                  onClick={() => onKindFilterChange(option.value)}
                  label={option.label}
                />
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Persona
            </p>
            <label className="relative block">
              <span className="sr-only">Buscar persona</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                value={personQuery}
                onChange={(e) => setPersonQuery(e.target.value)}
                placeholder="Buscar persona…"
                className="w-full rounded-xl border border-zinc-300 py-2 pl-9 pr-3 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </label>
            <div className="space-y-2" role="group" aria-label="Persona asignada">
              <FilterChoice
                selected={selectedAssigneeId == null}
                onClick={() => onAssigneeChange(null)}
                label="Todas las personas"
              />
              {visibleUsers.map((user) => (
                <FilterChoice
                  key={user.id}
                  selected={selectedAssigneeId === user.id}
                  onClick={() => onAssigneeChange(user.id)}
                  label={
                    user.id === currentUserId ? `${user.name} (tú)` : user.name
                  }
                  leading={
                    <UserAvatar
                      userId={user.id}
                      name={user.name}
                      avatarUrl={user.avatarUrl}
                      avatarBackgroundColor={user.avatarBackgroundColor}
                      size="sm"
                    />
                  }
                />
              ))}
              {visibleUsers.length === 0 ? (
                <p className="px-1 text-sm text-zinc-500">Nadie coincide.</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-zinc-200 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            disabled={!hasActive}
            onClick={() => {
              onKindFilterChange("all");
              onAssigneeChange(null);
            }}
            className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
          >
            Limpiar
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            Listo
          </button>
        </div>
      </section>
    </div>
  ) : null;
}

function FilterChoice({
  selected,
  onClick,
  label,
  leading,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  leading?: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm tap-target ${
        selected
          ? "border-primary-300 bg-primary-50 text-zinc-900"
          : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50"
      }`}
    >
      {leading}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      <Check
        className={`h-4 w-4 shrink-0 ${selected ? "text-primary-600" : "text-transparent"}`}
        aria-hidden
      />
    </button>
  );
}
