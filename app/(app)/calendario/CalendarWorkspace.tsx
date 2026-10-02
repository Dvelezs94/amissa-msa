"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus, Pencil, Trash2 } from "lucide-react";
import {
  CALENDAR_AUTO_REFRESH_MS,
  calendarAutoRefreshAllowed,
  countSchedulesByCalendarNav,
  filterSchedulesByCalendarNav,
  sortCalendars,
  DEFAULT_CALENDAR_ID,
  DEFAULT_CALENDAR_NAME,
  calendarCanBeDeleted,
  isDefaultCalendarId,
  resolveDefaultCalendarId,
  type CalendarNavId,
} from "@/lib/calendar-helpers";
import { parseCalendarEventSearchParams } from "@/lib/maintenance-schedule-work-order";
import { useSetPageHeader } from "@/components/PageHeaderContext";
import { CalendarCreateEventModal } from "./CalendarCreateEventModal";
import {
  CalendarMonthView,
  type CalendarSchedulePayload,
} from "./CalendarMonthView";

export type CalendarOption = {
  id: string;
  name: string;
  sortOrder: number;
};

export function CalendarWorkspace({
  calendars: initialCalendars,
  schedules,
  assets,
  users,
  checklistTemplates,
  canRenameCalendars = false,
  canManageEvents = false,
}: {
  calendars: CalendarOption[];
  schedules: CalendarSchedulePayload[];
  assets: { id: string; name: string; sublabel?: string }[];
  users: { id: string; name: string; avatarUrl?: string | null }[];
  checklistTemplates: { id: string; name: string }[];
  canRenameCalendars?: boolean;
  canManageEvents?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [calendars, setCalendars] = useState(initialCalendars);
  const focusEvent = useMemo(() => {
    const parsed = parseCalendarEventSearchParams({
      evento: searchParams.get("evento"),
      fecha: searchParams.get("fecha"),
    });
    if (!parsed) return null;
    const schedule = schedules.find((s) => s.id === parsed.scheduleId);
    if (!schedule) return null;
    return { schedule, dateYmd: parsed.dateYmd };
  }, [searchParams, schedules]);
  const [selectedNavId, setSelectedNavId] = useState<CalendarNavId>(
    DEFAULT_CALENDAR_ID
  );
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editCalendar, setEditCalendar] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [monthViewBusy, setMonthViewBusy] = useState(false);
  const appliedFocusNavRef = useRef(false);

  useEffect(() => {
    setCalendars(initialCalendars);
  }, [initialCalendars]);

  useEffect(() => {
    if (!focusEvent || appliedFocusNavRef.current) return;
    appliedFocusNavRef.current = true;
    const calendarId = focusEvent.schedule.calendarId;
    if (calendarId && calendars.some((c) => c.id === calendarId)) {
      setSelectedNavId(calendarId);
    } else {
      setSelectedNavId("all");
    }
  }, [focusEvent, calendars]);

  const blockingUiOpen =
    createDialogOpen ||
    editCalendar != null ||
    createEventOpen ||
    monthViewBusy;
  const blockingUiOpenRef = useRef(blockingUiOpen);
  blockingUiOpenRef.current = blockingUiOpen;

  useEffect(() => {
    function refreshIfAllowed() {
      if (
        !calendarAutoRefreshAllowed({
          pageVisible: document.visibilityState === "visible",
          blockingUiOpen: blockingUiOpenRef.current,
        })
      ) {
        return;
      }
      router.refresh();
    }
    const id = window.setInterval(refreshIfAllowed, CALENDAR_AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", refreshIfAllowed);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refreshIfAllowed);
    };
  }, [router]);

  const sortedCalendars = useMemo(() => sortCalendars(calendars), [calendars]);

  const knownIds = useMemo(
    () => new Set(sortedCalendars.map((c) => c.id)),
    [sortedCalendars]
  );

  const counts = useMemo(
    () => countSchedulesByCalendarNav(schedules, sortedCalendars),
    [schedules, sortedCalendars]
  );

  const navItems = useMemo(
    () => [
      { id: "all" as const, label: "Todos", count: counts.all },
      ...sortedCalendars.map((c) => ({
        id: c.id,
        label: c.name,
        count: counts.byId.get(c.id) ?? 0,
      })),
    ],
    [sortedCalendars, counts]
  );

  const scopedSchedules = useMemo(
    () => filterSchedulesByCalendarNav(schedules, selectedNavId, knownIds),
    [schedules, selectedNavId, knownIds]
  );

  const activeCalendar =
    selectedNavId !== "all"
      ? sortedCalendars.find((c) => c.id === selectedNavId) ?? null
      : null;

  const headerTitle =
    selectedNavId === "all"
      ? "Todos los calendarios"
      : activeCalendar?.name ?? "Calendario";

  const defaultCalendarId =
    activeCalendar?.id ??
    resolveDefaultCalendarId(sortedCalendars) ??
    DEFAULT_CALENDAR_ID;

  async function createCalendar() {
    const name = newName.trim();
    if (!name) return;
    const res = await fetch("/api/calendars", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && typeof data.id === "string") {
      setNewName("");
      setCreateDialogOpen(false);
      setCalendars((prev) => [
        ...prev,
        {
          id: data.id,
          name,
          sortOrder: prev.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1,
        },
      ]);
      setSelectedNavId(data.id);
      router.refresh();
    }
  }

  const defaultCalendarName =
    calendars.find((c) => isDefaultCalendarId(c.id))?.name ??
    DEFAULT_CALENDAR_NAME;

  async function deleteCalendar(id: string) {
    if (!calendarCanBeDeleted(id)) return;
    if (
      !window.confirm(
        `¿Eliminar este calendario? Los eventos pasarán a «${defaultCalendarName}».`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/calendars/${id}`, { method: "DELETE" });
    if (res.ok) {
      if (selectedNavId === id) setSelectedNavId(DEFAULT_CALENDAR_ID);
      setCalendars((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    }
  }

  async function saveEditCalendar() {
    if (!editCalendar) return;
    const name = editCalendar.name.trim();
    if (!name) return;
    const original = calendars.find((c) => c.id === editCalendar.id);
    if (!original || name === original.name) {
      setEditCalendar(null);
      return;
    }
    const res = await fetch(`/api/calendars/${editCalendar.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      setCalendars((prev) =>
        prev.map((c) =>
          c.id === editCalendar.id ? { ...c, name } : c
        )
      );
      setEditCalendar(null);
      router.refresh();
    }
  }

  const createModal = createDialogOpen && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-4 text-left shadow-lg">
        <h2 className="font-semibold text-zinc-900">Nuevo calendario</h2>
        <label className="block text-sm text-zinc-600">
          Nombre
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Ej. Equipo Movil"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void createCalendar();
              }
            }}
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            onClick={() => {
              setCreateDialogOpen(false);
              setNewName("");
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white"
            onClick={() => void createCalendar()}
          >
            Crear
          </button>
        </div>
      </div>
    </div>
  );

  const editModal = editCalendar && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-4 text-left shadow-lg">
        <h2 className="font-semibold text-zinc-900">Editar calendario</h2>
        <label className="block text-sm text-zinc-600">
          Nombre
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-zinc-900"
            value={editCalendar.name}
            onChange={(e) =>
              setEditCalendar((prev) =>
                prev ? { ...prev, name: e.target.value } : null
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void saveEditCalendar();
              }
            }}
            autoFocus
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-100"
            onClick={() => setEditCalendar(null)}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white"
            onClick={() => void saveEditCalendar()}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );

  useSetPageHeader({
    title: "Calendario",
    subtitle: headerTitle,
    actions: (
      <>
        {activeCalendar && canRenameCalendars ? (
          <>
            <button
              type="button"
              className="tap-target rounded-lg border border-zinc-300 bg-white p-2 text-zinc-500 hover:bg-zinc-50"
              title="Editar calendario"
              onClick={() =>
                setEditCalendar({
                  id: activeCalendar.id,
                  name: activeCalendar.name,
                })
              }
            >
              <Pencil className="h-4 w-4" />
            </button>
            {canManageEvents && calendarCanBeDeleted(activeCalendar.id) ? (
              <button
                type="button"
                className="tap-target rounded-lg border border-zinc-300 bg-white p-2 text-zinc-500 hover:bg-red-50 hover:text-red-700"
                title="Eliminar calendario"
                onClick={() => void deleteCalendar(activeCalendar.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            ) : null}
          </>
        ) : null}
        {canManageEvents ? (
          <button
            type="button"
            onClick={() => {
              setNewName("");
              setCreateDialogOpen(true);
            }}
            className="tap-target inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            <CalendarPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuevo calendario</span>
          </button>
        ) : null}
        {canManageEvents ? (
        <CalendarCreateEventModal
          assets={assets}
          users={users}
          checklistTemplates={checklistTemplates}
          calendars={sortedCalendars.map((c) => ({
            id: c.id,
            name: c.name,
          }))}
          defaultCalendarId={defaultCalendarId}
          onOpenChange={setCreateEventOpen}
        />
        ) : null}
      </>
    ),
  });

  return (
    <div className="space-y-3">
      {createModal}
      {editModal}

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <nav
          className="flex gap-1 overflow-x-auto border-b border-zinc-200 px-3 sm:px-4"
          aria-label="Calendarios"
        >
          {navItems.map((n) => {
            const active = selectedNavId === n.id;
            return (
              <button
                key={String(n.id)}
                type="button"
                onClick={() => setSelectedNavId(n.id)}
                className={`tap-target relative shrink-0 border-b-2 px-3 py-3 text-sm transition-colors ${
                  active
                    ? "border-primary-600 font-semibold text-zinc-900"
                    : "border-transparent font-medium text-zinc-500 hover:text-zinc-800"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {n.label}
                  <span
                    className={`tabular-nums text-xs ${
                      active ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    {n.count}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0 space-y-3 p-3 md:p-4">
          <CalendarMonthView
            schedules={scopedSchedules}
            assets={assets}
            users={users}
            checklistTemplates={checklistTemplates}
            calendars={sortedCalendars.map((c) => ({
              id: c.id,
              name: c.name,
            }))}
            defaultCalendarId={defaultCalendarId}
            onBusyChange={setMonthViewBusy}
            focusSchedule={focusEvent?.schedule ?? null}
            focusDateYmd={focusEvent?.dateYmd ?? null}
            canManageEvents={canManageEvents}
          />
        </div>
      </div>
    </div>
  );
}
