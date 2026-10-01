"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock, Pencil, Trash2, X } from "lucide-react";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import { DEFAULT_CALENDAR_ID } from "@/lib/calendar-helpers";
import {
  ALL_HOUR_MAINTENANCE_WORKDAYS,
  defaultHourMaintenancePlanName,
  formatHourMaintenancePreview,
  hourMaintenanceTriggerLabel,
  hourMaintenanceCreatedCalendarHref,
  parseEveryHours,
  parseHoursPerDay,
  type HourMaintenancePlanView,
} from "@/lib/hour-maintenance";
import { useSheetModalPresence } from "@/lib/use-sheet-modal-presence";
import { APP_TIME_ZONE } from "@/lib/timezone";
import {
  MAINTENANCE_EVENT_COLORS,
  MAINTENANCE_WEEKDAYS,
} from "@/app/(app)/calendario/maintenance-schedule-form-constants";

type SelectOption = { id: string; name: string };

function todayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(
    new Date()
  );
}

function emptyForm(assetName: string, defaultCalendarId: string) {
  return {
    name: defaultHourMaintenancePlanName(assetName),
    hoursPerDay: "8",
    everyHours: "250",
    workdays: [...ALL_HOUR_MAINTENANCE_WORKDAYS],
    startDate: todayYmd(),
    calendarId: defaultCalendarId,
    checklistTemplateId: "",
    color: "#02257D",
    assigneeIds: [] as string[],
  };
}

export function AssetHourMaintenanceSection({
  assetId,
  assetName,
  calendars,
  checklistTemplates,
  users,
  initialPlans,
}: {
  assetId: string;
  assetName: string;
  calendars: SelectOption[];
  checklistTemplates: SelectOption[];
  users: SelectOption[];
  initialPlans: HourMaintenancePlanView[];
}) {
  const router = useRouter();
  const defaultCalendarId =
    calendars.find((c) => c.id === DEFAULT_CALENDAR_ID)?.id ||
    calendars[0]?.id ||
    DEFAULT_CALENDAR_ID;

  const [plans, setPlans] = useState(initialPlans);
  const [open, setOpen] = useState(false);
  const { mounted, show, onPanelTransitionEnd } = useSheetModalPresence(open);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(() => emptyForm(assetName, defaultCalendarId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPlans(initialPlans);
  }, [initialPlans]);

  useEffect(() => {
    if (!mounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [mounted]);

  const preview = useMemo(() => {
    const hoursPerDay = parseHoursPerDay(form.hoursPerDay);
    const everyHours = parseEveryHours(form.everyHours);
    if (hoursPerDay == null || everyHours == null) return null;
    return formatHourMaintenancePreview(
      hoursPerDay,
      everyHours,
      form.workdays
    );
  }, [form.hoursPerDay, form.everyHours, form.workdays]);

  function toggleWorkday(day: number) {
    setForm((f) => {
      const selected = f.workdays.includes(day);
      if (selected && f.workdays.length === 1) return f;
      const workdays = selected
        ? f.workdays.filter((d) => d !== day)
        : [...f.workdays, day].sort((a, b) => a - b);
      return { ...f, workdays };
    });
  }

  function fillForm(plan: HourMaintenancePlanView) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      hoursPerDay: String(plan.hoursPerDay),
      everyHours: String(plan.everyHours),
      workdays: [...plan.workdays],
      startDate: plan.startDate,
      calendarId: plan.calendarId || defaultCalendarId,
      checklistTemplateId: plan.checklistTemplateId || "",
      color: plan.color || "#02257D",
      assigneeIds: plan.assigneeIds,
    });
    setError(null);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm(assetName, defaultCalendarId));
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const url = editingId
        ? `/api/assets/${assetId}/hour-maintenance-plans/${editingId}`
        : `/api/assets/${assetId}/hour-maintenance-plans`;
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          hoursPerDay: form.hoursPerDay,
          everyHours: form.everyHours,
          workdays: form.workdays,
          startDate: form.startDate,
          calendarId: form.calendarId || defaultCalendarId,
          checklistTemplateId: form.checklistTemplateId || null,
          color: form.color,
          assigneeIds: form.assigneeIds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string" ? data.error : "Error al guardar"
        );
        return;
      }
      const saved = data as HourMaintenancePlanView;
      if (editingId) {
        setPlans((prev) =>
          prev.map((p) => (p.id === editingId ? saved : p))
        );
        resetForm();
        router.refresh();
        return;
      }
      router.push(hourMaintenanceCreatedCalendarHref(saved));
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(plan: HourMaintenancePlanView) {
    const confirmed = window.confirm(
      `¿Eliminar el plan «${plan.name}» y sus eventos del calendario?`
    );
    if (!confirmed) return;
    setError(null);
    const res = await fetch(
      `/api/assets/${assetId}/hour-maintenance-plans/${plan.id}`,
      { method: "DELETE" }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(
        typeof data.error === "string" ? data.error : "No se pudo eliminar"
      );
      return;
    }
    setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    if (editingId === plan.id) resetForm();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 tap-target"
      >
        <Clock className="h-4 w-4" aria-hidden />
        {hourMaintenanceTriggerLabel(plans.length)}
      </button>

      {mounted ? (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 transition-opacity duration-300 ease-out motion-reduce:transition-none md:items-center md:justify-center md:p-4 ${
            show ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        >
          <section
            aria-labelledby="hour-maintenance-heading"
            role="dialog"
            aria-modal="true"
            className={`relative flex max-h-[min(90dvh,900px)] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-zinc-200 border-b-0 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 md:max-h-[85vh] md:rounded-lg md:border-b md:shadow-lg ${
              show
                ? "translate-y-0 motion-reduce:translate-y-0"
                : "translate-y-full motion-reduce:translate-y-0 md:translate-y-4"
            }`}
            onClick={(e) => e.stopPropagation()}
            onTransitionEnd={onPanelTransitionEnd}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2
                id="hour-maintenance-heading"
                className="text-sm font-semibold text-zinc-900"
              >
                Mantenimiento por horas de uso
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="inline-flex items-center justify-center rounded-sm border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4">
              <p className="text-xs text-zinc-500">
                Indica cuántas horas trabaja la máquina al día, qué días trabaja y cada
                cuántas horas de uso hay que programar un mantenimiento. El calendario
                cuenta solo esos días (un evento cada N días de trabajo, redondeando
                horas ÷ horas por día).
              </p>

      {error ? (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </p>
      ) : null}

      {plans.length === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">
          Aún no hay planes por horas para esta máquina.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {plans.map((plan) => (
            <li
              key={plan.id}
              className="flex items-start justify-between gap-2 rounded-lg border border-zinc-200 p-3"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: plan.color ?? "#02257D" }}
                    aria-hidden
                  />
                  <p className="font-medium text-zinc-900">{plan.name}</p>
                </div>
                <p className="text-xs text-zinc-500">
                  {formatHourMaintenancePreview(
                    plan.hoursPerDay,
                    plan.everyHours,
                    plan.workdays
                  )}
                </p>
                {plan.calendarName ? (
                  <p className="text-xs text-zinc-500">
                    Calendario: {plan.calendarName}
                  </p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => fillForm(plan)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 tap-target"
                  aria-label={`Editar ${plan.name}`}
                  title="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(plan)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-red-50 hover:text-red-700 tap-target"
                  aria-label={`Eliminar ${plan.name}`}
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
        <h3 className="text-sm font-medium text-zinc-900">
          {editingId ? "Editar plan" : "Nuevo plan"}
        </h3>

        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-600" htmlFor="hp-name">
            Nombre
          </label>
          <input
            id="hp-name"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            placeholder="Ej. Inspección cada 250 h"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-zinc-600"
              htmlFor="hp-hours-day"
            >
              Horas de uso por día
            </label>
            <input
              id="hp-hours-day"
              type="number"
              required
              min={0.25}
              max={24}
              step="0.25"
              value={form.hoursPerDay}
              onChange={(e) =>
                setForm((f) => ({ ...f, hoursPerDay: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-zinc-600"
              htmlFor="hp-every"
            >
              Cada cuántas horas de uso
            </label>
            <input
              id="hp-every"
              type="number"
              required
              min={1}
              step="1"
              value={form.everyHours}
              onChange={(e) =>
                setForm((f) => ({ ...f, everyHours: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-zinc-600"
              htmlFor="hp-start"
            >
              Empieza el
            </label>
            <input
              id="hp-start"
              type="date"
              required
              value={form.startDate}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-600" id="hp-workdays">
            Días que trabaja
          </p>
          <div
            className="flex flex-wrap gap-2"
            role="group"
            aria-labelledby="hp-workdays"
          >
            {MAINTENANCE_WEEKDAYS.map((w) => {
              const selected = form.workdays.includes(w.value);
              return (
                <button
                  key={w.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleWorkday(w.value)}
                  className={`tap-target rounded-full border px-2.5 py-1 text-xs ${
                    selected
                      ? "border-primary-400 bg-primary-50 text-primary-900"
                      : "border-zinc-200 bg-zinc-50 text-zinc-600"
                  }`}
                >
                  {w.label}
                </button>
              );
            })}
          </div>
        </div>

        {preview ? (
          <p className="text-xs text-zinc-500">{preview}</p>
        ) : (
          <p className="text-xs text-zinc-500">
            Usa horas de uso por día mayores que 0 (máximo 24) y un intervalo de
            horas de uso positivo.
          </p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-zinc-600"
              htmlFor="hp-calendar"
            >
              Calendario
            </label>
            <select
              id="hp-calendar"
              value={form.calendarId}
              onChange={(e) =>
                setForm((f) => ({ ...f, calendarId: e.target.value }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {calendars.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label
              className="text-xs font-medium text-zinc-600"
              htmlFor="hp-checklist"
            >
              Checklist (opcional)
            </label>
            <select
              id="hp-checklist"
              value={form.checklistTemplateId}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  checklistTemplateId: e.target.value,
                }))
              }
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="">Sin checklist</option>
              {checklistTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <AssigneeMultiSelect
          label="Responsables"
          users={users}
          value={form.assigneeIds}
          onChange={(assigneeIds) => setForm((f) => ({ ...f, assigneeIds }))}
          emptyHint="Sin asignar"
        />

        <div className="space-y-2">
          <p className="text-xs font-medium text-zinc-600">Color del evento</p>
          <div className="flex flex-wrap items-center gap-2">
            {MAINTENANCE_EVENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setForm((f) => ({ ...f, color: c }))}
                className={`h-7 w-7 rounded-full border-2 transition ${
                  form.color === c
                    ? "border-zinc-900 ring-1 ring-zinc-300"
                    : "border-white"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Seleccionar color ${c}`}
              />
            ))}
            <input
              type="color"
              value={form.color}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  color: e.target.value.toUpperCase(),
                }))
              }
              className="h-8 w-10 cursor-pointer rounded border border-zinc-300 bg-white p-1"
              aria-label="Selector de color personalizado"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {saving
              ? "Guardando…"
              : editingId
                ? "Guardar cambios"
                : "Crear plan y eventos"}
          </button>
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </form>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
