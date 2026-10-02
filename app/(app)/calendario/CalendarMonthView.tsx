"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  CircleX,
  Equal,
  ExternalLink,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { CalendarCreateEventModal } from "./CalendarCreateEventModal";
import { MaintenanceScheduleDetailEditForm } from "./MaintenanceScheduleDetailEditForm";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import { UserAvatar } from "@/components/UserAvatar";
import {
  expandOccurrencesInRange,
  formatRecurrenceLabel,
  parseRecurrence,
  toYmdLocal,
} from "@/lib/maintenance-recurrence";
import { useSheetModalPresence } from "@/lib/use-sheet-modal-presence";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { useWorkOrderStatusColors } from "@/components/WorkOrderStatusColorsProvider";
import {
  workOrderStatusBadgeStyle,
  workOrderStatusMarkerColor,
  workOrderStatusMarkerLabel,
} from "@/lib/work-order-status-colors";

export type CalendarSchedulePayload = {
  id: string;
  name: string;
  recurrence: string;
  color?: string | null;
  assigneeIds: string[];
  /** Para registros antiguos sin JSON en recurrence */
  nextRunAt: string | null;
  checklistTemplateId?: string | null;
  assetId?: string | null;
  calendarId?: string | null;
};

type SelectedMaintenanceEvent = {
  id: string;
  name: string;
  recurrence: string;
  color?: string | null;
  assigneeIds: string[];
  checklistTemplateId?: string | null;
  assetId?: string | null;
  calendarId?: string | null;
  dateLabel: string;
  dateYmd: string;
};

const WEEK_HEADER = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Lunes = 0 … Domingo = 6 */
function mondayBasedIndex(d: Date): number {
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

function startOfCalendarMonth(year: number, month: number): Date {
  return new Date(year, month, 1);
}

function endOfCalendarMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0);
}

export type CalendarCell = {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  events: {
    id: string;
    name: string;
    recurrence: string;
    color?: string | null;
    assigneeIds: string[];
    checklistTemplateId?: string | null;
    assetId?: string | null;
    calendarId?: string | null;
    hasWorkOrder?: boolean;
  }[];
};

function buildMonthCells(
  cellYear: number,
  cellMonth: number,
  schedules: CalendarSchedulePayload[],
  todayRef: Date = new Date()
): CalendarCell[] {
  const mStart = startOfCalendarMonth(cellYear, cellMonth);
  const monthEnd = endOfCalendarMonth(cellYear, cellMonth);
  const gridStart = new Date(mStart);
  const lead = mondayBasedIndex(mStart);
  gridStart.setDate(gridStart.getDate() - lead);
  const gridEnd = new Date(monthEnd);
  const trail = 6 - mondayBasedIndex(monthEnd);
  gridEnd.setDate(gridEnd.getDate() + trail);

  const map = new Map<
    string,
    {
      id: string;
      name: string;
      recurrence: string;
      color?: string | null;
      assigneeIds: string[];
      checklistTemplateId?: string | null;
      assetId?: string | null;
      calendarId?: string | null;
    }[]
  >();

  for (const s of schedules) {
    let rule = parseRecurrence(s.recurrence);
    if (!rule && s.nextRunAt) {
      const t = new Date(s.nextRunAt);
      if (!Number.isNaN(t.getTime())) {
        rule = {
          frequency: "none",
          interval: 1,
          anchorDate: toYmdLocal(t),
        };
      }
    }
    if (!rule) continue;
    const dates = expandOccurrencesInRange(rule, gridStart, gridEnd);
    for (const d of dates) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const list = map.get(key) ?? [];
      if (!list.some((x) => x.id === s.id)) {
        list.push({
          id: s.id,
          name: s.name,
          recurrence: s.recurrence,
          color: s.color ?? "#02257D",
          assigneeIds: s.assigneeIds ?? [],
          checklistTemplateId: s.checklistTemplateId ?? null,
          assetId: s.assetId ?? null,
          calendarId: s.calendarId ?? null,
        });
        map.set(key, list);
      }
    }
  }

  const cells: CalendarCell[] = [];
  const todayY = todayRef.getFullYear();
  const todayM = todayRef.getMonth();
  const todayD = todayRef.getDate();

  const walk = new Date(gridStart);
  while (walk <= gridEnd) {
    const cur = new Date(walk);
    const inMonth = cur.getMonth() === cellMonth;
    const isToday =
      cur.getFullYear() === todayY &&
      cur.getMonth() === todayM &&
      cur.getDate() === todayD;
    const key = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
    cells.push({
      date: new Date(cur),
      inMonth,
      isToday,
      events: map.get(key) ?? [],
    });
    walk.setDate(walk.getDate() + 1);
  }

  return cells;
}

type YearAuditRow = {
  ymd: string;
  date: Date;
  ev: {
    id: string;
    name: string;
    recurrence: string;
    color?: string | null;
    assigneeIds: string[];
    checklistTemplateId?: string | null;
    assetId?: string | null;
    calendarId?: string | null;
  };
};

const YEAR_AUDIT_PAGE_SIZE = 150;
const LINKED_WO_PAGE_SIZE = 15;

function buildYearAuditRows(
  cellYear: number,
  schedules: CalendarSchedulePayload[]
): YearAuditRow[] {
  const rangeStart = new Date(cellYear, 0, 1);
  const rangeEnd = new Date(cellYear, 11, 31);
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      recurrence: string;
      color?: string | null;
      assigneeIds: string[];
      checklistTemplateId?: string | null;
      assetId?: string | null;
      calendarId?: string | null;
    }[]
  >();

  for (const s of schedules) {
    let rule = parseRecurrence(s.recurrence);
    if (!rule && s.nextRunAt) {
      const t = new Date(s.nextRunAt);
      if (!Number.isNaN(t.getTime())) {
        rule = {
          frequency: "none",
          interval: 1,
          anchorDate: toYmdLocal(t),
        };
      }
    }
    if (!rule) continue;
    const dates = expandOccurrencesInRange(rule, rangeStart, rangeEnd);
    for (const d of dates) {
      if (d.getFullYear() !== cellYear) continue;
      const key = toYmdLocal(d);
      const list = map.get(key) ?? [];
      if (!list.some((x) => x.id === s.id)) {
        list.push({
          id: s.id,
          name: s.name,
          recurrence: s.recurrence,
          color: s.color ?? "#02257D",
          assigneeIds: s.assigneeIds ?? [],
          checklistTemplateId: s.checklistTemplateId ?? null,
          assetId: s.assetId ?? null,
          calendarId: s.calendarId ?? null,
        });
        map.set(key, list);
      }
    }
  }

  const keys = Array.from(map.keys()).sort();
  const rows: YearAuditRow[] = [];
  for (const ymd of keys) {
    const events = map.get(ymd) ?? [];
    const [y, m, day] = ymd.split("-").map(Number);
    const date = new Date(y!, m! - 1, day!);
    for (const ev of events) {
      rows.push({ ymd, date, ev });
    }
  }
  return rows;
}

export function CalendarMonthView({
  schedules,
  assets,
  users,
  checklistTemplates,
  calendars = [],
  defaultCalendarId = null,
  onBusyChange,
  focusSchedule = null,
  focusDateYmd = null,
  canManageEvents = true,
}: {
  schedules: CalendarSchedulePayload[];
  assets: { id: string; name: string; sublabel?: string }[];
  users: { id: string; name: string; avatarUrl?: string | null }[];
  checklistTemplates: { id: string; name: string }[];
  calendars?: { id: string; name: string }[];
  defaultCalendarId?: string | null;
  onBusyChange?: (busy: boolean) => void;
  focusSchedule?: CalendarSchedulePayload | null;
  focusDateYmd?: string | null;
  canManageEvents?: boolean;
}) {
  const router = useRouter();
  const { colors: statusColors } = useWorkOrderStatusColors();
  const [viewMode, setViewMode] = useState<"year" | "month" | "week" | "day">("month");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [yearAuditPage, setYearAuditPage] = useState(0);
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStart = startOfCalendarMonth(year, month);
  const [selectedEvent, setSelectedEvent] = useState<SelectedMaintenanceEvent | null>(null);
  const appliedFocusRef = useRef(false);
  const [panelEvent, setPanelEvent] = useState<SelectedMaintenanceEvent | null>(null);
  const { mounted: detailModalMounted, show: detailModalShow, onPanelTransitionEnd: onDetailPanelTransitionEnd } =
    useSheetModalPresence(selectedEvent != null);

  useLayoutEffect(() => {
    if (selectedEvent) setPanelEvent(selectedEvent);
  }, [selectedEvent]);

  useEffect(() => {
    if (appliedFocusRef.current || !focusSchedule) return;
    const dateYmd =
      focusDateYmd && /^\d{4}-\d{2}-\d{2}$/.test(focusDateYmd)
        ? focusDateYmd
        : toYmdLocal(new Date());
    const [y, m, day] = dateYmd.split("-").map(Number);
    const date = new Date(y!, m! - 1, day!);
    if (Number.isNaN(date.getTime())) return;
    appliedFocusRef.current = true;
    setCurrentDate(date);
    setSelectedEvent({
      id: focusSchedule.id,
      name: focusSchedule.name,
      recurrence: focusSchedule.recurrence,
      color: focusSchedule.color,
      assigneeIds: focusSchedule.assigneeIds ?? [],
      checklistTemplateId: focusSchedule.checklistTemplateId ?? null,
      assetId: focusSchedule.assetId ?? null,
      calendarId: focusSchedule.calendarId ?? null,
      dateLabel: date.toLocaleDateString("es-MX", {
        year: "numeric",
        month: "short",
        day: "numeric",
        timeZone: APP_TIME_ZONE,
      }),
      dateYmd,
    });
  }, [focusSchedule, focusDateYmd]);

  useEffect(() => {
    if (!detailModalMounted && !selectedEvent) setPanelEvent(null);
  }, [detailModalMounted, selectedEvent]);

  const [creatingWorkOrder, setCreatingWorkOrder] = useState(false);
  const [createWorkOrderError, setCreateWorkOrderError] = useState<string | null>(null);
  const [userOptions, setUserOptions] = useState<{ id: string; name: string }[]>([]);
  const [loadingUserOptions, setLoadingUserOptions] = useState(false);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);
  const [assigneePromptOpen, setAssigneePromptOpen] = useState(false);
  const [undoBanner, setUndoBanner] = useState<
    | { kind: "recurrence"; scheduleId: string }
    | { kind: "restore"; scheduleId: string }
    | null
  >(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteScope, setDeleteScope] = useState<"single" | "future" | "all">(
    "single"
  );
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [editingScheduleName, setEditingScheduleName] = useState(false);
  const [scheduleNameDraft, setScheduleNameDraft] = useState("");
  const [savingScheduleFields, setSavingScheduleFields] = useState(false);
  const scheduleEditBlockRef = useRef<HTMLDivElement>(null);
  /** Detail form (recurrence/checklist) sits below the header; include it in blur-save containment. */
  const scheduleDetailEditSectionRef = useRef<HTMLDivElement>(null);
  /**
   * Clicks on non-focusable nodes leave `activeElement` as body; `relatedTarget` on blur is often null.
   * Set on pointerdown capture when the press is inside the schedule edit surfaces so we skip blur-save.
   */
  const scheduleBlurSaveSkipRef = useRef(false);
  /** Avoid blur-save when focus moves to cancel-edit; must not use mousedown preventDefault there (click-through to backdrop). */
  const cancelScheduleEditBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!editingScheduleName) scheduleBlurSaveSkipRef.current = false;
  }, [editingScheduleName]);

  useEffect(() => {
    if (!editingScheduleName) return;
    setAssigneePromptOpen(false);
    setCreateWorkOrderError(null);
  }, [editingScheduleName]);

  useEffect(() => {
    if (!undoBanner) return;
    const t = window.setTimeout(() => setUndoBanner(null), 28000);
    return () => window.clearTimeout(t);
  }, [undoBanner]);

  async function finishMaintenanceDelete(res: Response, scheduleId: string) {
    const data = (await res.json().catch(() => ({}))) as {
      canUndoRecurrence?: boolean;
      canRestore?: boolean;
    };
    setSelectedEvent(null);
    if (res.ok) {
      if (data.canUndoRecurrence) {
        setUndoBanner({ kind: "recurrence", scheduleId });
      } else if (data.canRestore) {
        setUndoBanner({ kind: "restore", scheduleId });
      } else {
        setUndoBanner(null);
      }
      router.refresh();
    }
  }
  const [linkedWorkOrders, setLinkedWorkOrders] = useState<
    {
      id: string;
      folio: number | null;
      title: string;
      status: string;
      priority?: string | null;
      dueDate?: string | Date | null;
      assigneeId?: string | null;
      assigneeName?: string | null;
      assigneeAvatarUrl?: string | null;
      assignees?: {
        id: string;
        name: string;
        avatarUrl?: string | null;
      }[];
      createdAt: string | Date;
    }[]
  >([]);
  const [linkedWorkOrdersHasMore, setLinkedWorkOrdersHasMore] = useState(false);
  const [loadingLinkedWorkOrders, setLoadingLinkedWorkOrders] = useState(false);
  const [loadingMoreLinkedWorkOrders, setLoadingMoreLinkedWorkOrders] = useState(false);
  const [expandedCells, setExpandedCells] = useState<Record<string, boolean>>({});
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalDate, setCreateModalDate] = useState<string | undefined>(undefined);
  const [workOrderMarkerStatusByKey, setWorkOrderMarkerStatusByKey] = useState<
    Map<string, string>
  >(new Map());

  const blockingUiOpen =
    createModalOpen ||
    deleteModalOpen ||
    assigneePromptOpen ||
    editingScheduleName;
  useEffect(() => {
    onBusyChange?.(blockingUiOpen);
    return () => onBusyChange?.(false);
  }, [blockingUiOpen, onBusyChange]);

  useEffect(() => {
    if (!selectedEvent) setDeleteModalOpen(false);
  }, [selectedEvent]);

  useEffect(() => {
    setEditingScheduleName(false);
    setScheduleNameDraft("");
  }, [panelEvent?.id]);

  async function saveScheduleNameFromDraft() {
    if (!panelEvent) return;
    const trimmed = scheduleNameDraft.trim();
    if (!trimmed) {
      setScheduleNameDraft(panelEvent.name);
      setEditingScheduleName(false);
      return;
    }
    if (trimmed === panelEvent.name) {
      setEditingScheduleName(false);
      return;
    }
    setSavingScheduleFields(true);
    try {
      const res = await fetch(`/api/maintenance-schedules/${panelEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) return;
      setSelectedEvent((prev) =>
        prev && prev.id === panelEvent.id ? { ...prev, name: trimmed } : prev
      );
      setEditingScheduleName(false);
      router.refresh();
    } finally {
      setSavingScheduleFields(false);
    }
  }

  async function saveScheduleDefaultAssignees(ids: string[]) {
    if (!panelEvent) return;
    setSavingScheduleFields(true);
    try {
      const res = await fetch(`/api/maintenance-schedules/${panelEvent.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: ids }),
      });
      if (!res.ok) return;
      setSelectedEvent((prev) =>
        prev && prev.id === panelEvent.id ? { ...prev, assigneeIds: ids } : prev
      );
      router.refresh();
    } finally {
      setSavingScheduleFields(false);
    }
  }

  useEffect(() => {
    if (!detailModalMounted && !createModalOpen && !deleteModalOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (deleteModalOpen) {
        setDeleteModalOpen(false);
        return;
      }
      if (createModalOpen) {
        setCreateModalOpen(false);
        return;
      }
      if (detailModalMounted) {
        setSelectedEvent(null);
        setCreateWorkOrderError(null);
        setAssigneePromptOpen(false);
        setEditingScheduleName(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [detailModalMounted, createModalOpen, deleteModalOpen]);

  useEffect(() => {
    if (!detailModalMounted) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [detailModalMounted]);

  useEffect(() => {
    if (!panelEvent) {
      setLinkedWorkOrders([]);
      setLinkedWorkOrdersHasMore(false);
      setLoadingLinkedWorkOrders(false);
      setLoadingMoreLinkedWorkOrders(false);
      setSelectedAssigneeIds([]);
      setAssigneePromptOpen(false);
      return;
    }
    let cancelled = false;
    setLoadingLinkedWorkOrders(true);
    fetch(
      `/api/maintenance-schedules/${panelEvent.id}/work-orders?dateYmd=${encodeURIComponent(
        panelEvent.dateYmd
      )}&limit=${LINKED_WO_PAGE_SIZE}&offset=0`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const items = Array.isArray(data?.items) ? data.items : [];
        setLinkedWorkOrders(items);
        setLinkedWorkOrdersHasMore(Boolean(data?.hasMore));
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedWorkOrders([]);
        setLinkedWorkOrdersHasMore(false);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingLinkedWorkOrders(false);
      });
    return () => {
      cancelled = true;
    };
  }, [panelEvent]);

  useEffect(() => {
    if (!panelEvent || linkedWorkOrders.length === 0) return;
    const status = linkedWorkOrders[0]?.status;
    if (!status) return;
    const key = `${panelEvent.id}|${panelEvent.dateYmd}`;
    setWorkOrderMarkerStatusByKey((prev) => {
      if (prev.get(key) === status) return prev;
      const next = new Map(prev);
      next.set(key, status);
      return next;
    });
  }, [panelEvent, linkedWorkOrders]);

  useEffect(() => {
    if (!panelEvent) {
      setUserOptions([]);
      setLoadingUserOptions(false);
      return;
    }
    let cancelled = false;
    setLoadingUserOptions(true);
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const users = Array.isArray(data) ? data : [];
        setUserOptions(users);
      })
      .catch(() => {
        if (cancelled) return;
        setUserOptions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingUserOptions(false);
      });
    return () => {
      cancelled = true;
    };
  }, [panelEvent]);

  function statusLabel(status: string) {
    if (status === "pending") return "Pendiente";
    if (status === "in_progress") return "En progreso";
    if (status === "completed") return "Completada";
    if (status === "cancelled") return "Cancelada";
    return status;
  }


  function priorityLabel(priority?: string | null) {
    if (priority === "low") return "Baja";
    if (priority === "medium") return "Media";
    if (priority === "high") return "Alta";
    if (priority === "urgent") return "Urgente";
    return "Media";
  }

  function priorityMeta(priority?: string | null) {
    if (priority === "low") return { Icon: ChevronDown, className: "text-[#0065FF]" };
    if (priority === "high") return { Icon: ChevronUp, className: "text-[#FF8B00]" };
    if (priority === "urgent") return { Icon: ChevronsUp, className: "text-[#BF2600]" };
    return { Icon: Equal, className: "text-[#E2A100]" };
  }

  function formatOpenedAt(value: string | Date) {
    return new Date(value).toLocaleString("es-MX", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: APP_TIME_ZONE,
    });
  }

  const dayEvents = useMemo(
    () => buildMonthCells(year, month, schedules, new Date()),
    [schedules, year, month]
  );
  const yearForView = currentDate.getFullYear();

  const markerRange = useMemo(() => {
    if (viewMode === "year") {
      return {
        from: `${yearForView}-01-01`,
        to: `${yearForView}-12-31`,
      };
    }
    if (dayEvents.length === 0) return null;
    return {
      from: toYmdLocal(dayEvents[0]!.date),
      to: toYmdLocal(dayEvents[dayEvents.length - 1]!.date),
    };
  }, [viewMode, yearForView, dayEvents]);

  useEffect(() => {
    if (!markerRange) {
      setWorkOrderMarkerStatusByKey(new Map());
      return;
    }
    let cancelled = false;
    fetch(
      `/api/maintenance-schedules/work-order-markers?from=${encodeURIComponent(
        markerRange.from
      )}&to=${encodeURIComponent(markerRange.to)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const raw = data?.markers;
        const next = new Map<string, string>();
        if (raw && typeof raw === "object" && !Array.isArray(raw)) {
          for (const [key, status] of Object.entries(raw)) {
            if (typeof key === "string" && typeof status === "string") {
              next.set(key, status);
            }
          }
        }
        setWorkOrderMarkerStatusByKey(next);
      })
      .catch(() => {
        if (cancelled) return;
        setWorkOrderMarkerStatusByKey(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [markerRange]);

  const yearMiniMonths = useMemo(() => {
    if (viewMode !== "year") return [] as CalendarCell[][];
    const now = new Date();
    const months: CalendarCell[][] = [];
    for (let m = 0; m < 12; m++) {
      months.push(buildMonthCells(yearForView, m, schedules, now));
    }
    return months;
  }, [schedules, yearForView, viewMode]);

  const yearAuditRows = useMemo(
    () => (viewMode === "year" ? buildYearAuditRows(yearForView, schedules) : []),
    [viewMode, yearForView, schedules]
  );

  const panelEventHasWorkOrder = useMemo(() => {
    if (!panelEvent) return false;
    if (workOrderMarkerStatusByKey.has(`${panelEvent.id}|${panelEvent.dateYmd}`)) {
      return true;
    }
    return linkedWorkOrders.length > 0;
  }, [panelEvent, workOrderMarkerStatusByKey, linkedWorkOrders.length]);

  useEffect(() => {
    setYearAuditPage(0);
  }, [viewMode, yearForView]);

  useEffect(() => {
    // Collapse per-day expansions when period/view changes.
    setExpandedCells({});
  }, [viewMode, year, month, currentDate]);

  const yearAuditPageCount = Math.max(
    1,
    Math.ceil(yearAuditRows.length / YEAR_AUDIT_PAGE_SIZE)
  );
  const yearAuditSlice = useMemo(() => {
    const start = yearAuditPage * YEAR_AUDIT_PAGE_SIZE;
    return yearAuditRows.slice(start, start + YEAR_AUDIT_PAGE_SIZE);
  }, [yearAuditRows, yearAuditPage]);

  function goToToday() {
    setCurrentDate(new Date());
  }

  function prevPeriod() {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "year") next.setFullYear(next.getFullYear() - 1);
      else if (viewMode === "month") next.setMonth(next.getMonth() - 1);
      else if (viewMode === "week") next.setDate(next.getDate() - 7);
      else next.setDate(next.getDate() - 1);
      return next;
    });
  }

  function nextPeriod() {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "year") next.setFullYear(next.getFullYear() + 1);
      else if (viewMode === "month") next.setMonth(next.getMonth() + 1);
      else if (viewMode === "week") next.setDate(next.getDate() + 7);
      else next.setDate(next.getDate() + 1);
      return next;
    });
  }

  const weekStart = useMemo(() => {
    const base = new Date(currentDate);
    const shift = mondayBasedIndex(base);
    base.setDate(base.getDate() - shift);
    return base;
  }, [currentDate]);
  const weekEnd = useMemo(() => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 6);
    return d;
  }, [weekStart]);

  const title =
    viewMode === "year"
      ? String(yearForView)
      : viewMode === "day"
        ? currentDate.toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "long",
            year: "numeric",
            timeZone: APP_TIME_ZONE,
          })
        : viewMode === "week"
          ? `${weekStart.toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
              timeZone: APP_TIME_ZONE,
            })} - ${weekEnd.toLocaleDateString("es-MX", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: APP_TIME_ZONE,
            })}`
          : monthStart.toLocaleDateString("es-MX", {
              month: "long",
              year: "numeric",
              timeZone: APP_TIME_ZONE,
            });

  const periodNavAriaPrev =
    viewMode === "year"
      ? "Año anterior"
      : viewMode === "month"
        ? "Mes anterior"
        : viewMode === "week"
          ? "Semana anterior"
          : "Día anterior";
  const periodNavAriaNext =
    viewMode === "year"
      ? "Año siguiente"
      : viewMode === "month"
        ? "Mes siguiente"
        : viewMode === "week"
          ? "Semana siguiente"
          : "Día siguiente";

  const visibleCells = useMemo(() => {
    if (viewMode === "year") return [];
    if (viewMode === "month") return dayEvents;
    if (viewMode === "week") {
      const startYmd = toYmdLocal(weekStart);
      const endYmd = toYmdLocal(weekEnd);
      return dayEvents.filter((cell) => {
        const ymd = toYmdLocal(cell.date);
        return ymd >= startYmd && ymd <= endYmd;
      });
    }
    const dayYmd = toYmdLocal(currentDate);
    return dayEvents.filter((cell) => toYmdLocal(cell.date) === dayYmd);
  }, [viewMode, dayEvents, weekStart, weekEnd, currentDate]);

  return (
    <div
      className={`overflow-hidden rounded-lg border border-zinc-200 ${
        viewMode === "year" ? "bg-surface" : "bg-white"
      }`}
    >
      <div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold uppercase tracking-wide text-zinc-900">
              {title}
            </h2>
            <button
              type="button"
              onClick={prevPeriod}
              className="rounded-sm border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              aria-label={periodNavAriaPrev}
            >
              ←
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="rounded-sm border border-zinc-300 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-700 hover:bg-zinc-50"
            >
              Hoy
            </button>
            <button
              type="button"
              onClick={nextPeriod}
              className="rounded-sm border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:bg-zinc-50"
              aria-label={periodNavAriaNext}
            >
              →
            </button>
          </div>
          <div className="inline-flex rounded-sm border border-zinc-300 bg-zinc-50 text-[11px] font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setViewMode("month")}
              className={`px-3 py-1 ${viewMode === "month" ? "bg-primary-50 text-primary-700" : "text-zinc-500"}`}
            >
              Mes
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week")}
              className={`px-3 py-1 ${viewMode === "week" ? "bg-primary-50 text-primary-700" : "text-zinc-500"}`}
            >
              Semana
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day")}
              className={`px-3 py-1 ${viewMode === "day" ? "bg-primary-50 text-primary-700" : "text-zinc-500"}`}
            >
              Día
            </button>
            <button
              type="button"
              onClick={() => setViewMode("year")}
              className={`px-3 py-1 ${viewMode === "year" ? "bg-primary-50 text-primary-700" : "text-zinc-500"}`}
            >
              Año
            </button>
          </div>
        </div>
        {viewMode !== "day" && viewMode !== "year" && (
          <div className={`grid border-b border-zinc-200 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 ${viewMode === "week" ? "grid-cols-7" : "grid-cols-7"}`}>
            {WEEK_HEADER.map((w) => (
              <div key={w} className="border-r border-zinc-200 py-2 last:border-r-0">
                {w}
              </div>
            ))}
          </div>
        )}
        {viewMode === "year" ? (
          <div className="border-t border-zinc-200 bg-surface">
            <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
              {yearMiniMonths.map((cells, monthIdx) => (
                <div
                  key={monthIdx}
                  className="cal-year-month-card overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 shadow-sm"
                >
                  <p className="cal-year-month-title border-b border-zinc-200 px-2 py-1.5 text-center text-[11px] font-bold uppercase tracking-wide text-zinc-800">
                    {new Date(yearForView, monthIdx, 1).toLocaleDateString("es-MX", {
                      month: "long",
                      timeZone: APP_TIME_ZONE,
                    })}
                  </p>
                  <div className="cal-year-dow-row grid grid-cols-7 border-b border-zinc-200 text-center text-[8px] font-semibold uppercase tracking-tight text-zinc-600">
                    {WEEK_HEADER.map((w) => (
                      <div key={w} className="border-r border-zinc-200 py-0.5 last:border-r-0">
                        {w.slice(0, 2)}
                      </div>
                    ))}
                  </div>
                  <div className="cal-year-grid-bg grid grid-cols-7">
                    {cells.map((cell, i) => {
                      const dateYmd = toYmdLocal(cell.date);
                      return (
                        <div
                          key={i}
                          role="button"
                          tabIndex={0}
                          onClick={() => {
                            setCurrentDate(new Date(cell.date));
                            setViewMode("month");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setCurrentDate(new Date(cell.date));
                              setViewMode("month");
                            }
                          }}
                          className={`min-h-[46px] cursor-pointer border-r border-b border-zinc-200 px-0.5 py-0.5 text-left align-top transition-colors ${
                            cell.inMonth ? "cal-year-cell-in" : "cal-year-cell-out"
                          } ${cell.isToday ? "ring-1 ring-inset ring-accent-500" : ""}`}
                        >
                          <div className="cal-year-daynum text-[9px] font-semibold">
                            {cell.date.getDate()}
                          </div>
                          {cell.events.length > 0 ? (
                            <div className="mt-0.5 flex flex-wrap items-center gap-0.5">
                              {cell.events.slice(0, 4).map((ev) => (
                                <button
                                  key={`${ev.id}-${i}`}
                                  type="button"
                                  title={ev.name}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedEvent({
                                      id: ev.id,
                                      name: ev.name,
                                      recurrence: ev.recurrence,
                                      color: ev.color,
                                      assigneeIds: ev.assigneeIds ?? [],
                                      checklistTemplateId: ev.checklistTemplateId ?? null,
                                      assetId: ev.assetId ?? null,
                                      calendarId: ev.calendarId ?? null,
                                      dateLabel: cell.date.toLocaleDateString("es-MX", {
                                        year: "numeric",
                                        month: "short",
                                        day: "numeric",
                                        timeZone: APP_TIME_ZONE,
                                      }),
                                      dateYmd,
                                    });
                                  }}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  className="h-2 w-2 shrink-0 rounded-full"
                                  style={(() => {
                                    const woStatus = workOrderMarkerStatusByKey.get(
                                      `${ev.id}|${dateYmd}`
                                    );
                                    if (!woStatus) {
                                      return { backgroundColor: ev.color ?? "#02257D" };
                                    }
                                    return {
                                      background: `linear-gradient(90deg, ${
                                        ev.color ?? "#02257D"
                                      } 0 50%, ${workOrderStatusMarkerColor(woStatus, statusColors)} 50% 100%)`,
                                    };
                                  })()}
                                  aria-label={ev.name}
                                />
                              ))}
                              {cell.events.length > 4 ? (
                                <span className="text-[8px] font-semibold leading-none text-zinc-500">
                                  +{cell.events.length - 4}
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            <div className="cal-year-audit-strip border-t border-zinc-200 px-3 py-4">
              <h3 className="text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-900">
                Registro anual
              </h3>
              <p className="mt-1 text-xs text-zinc-600">
                Listado cronológico de todas las ocurrencias programadas en {yearForView}. Pulse un día
                en la cuadrícula para abrir la vista mes.
              </p>
              <p className="mt-1 text-xs font-semibold text-zinc-800">
                Total: {yearAuditRows.length} ocurrencia
                {yearAuditRows.length === 1 ? "" : "s"}
              </p>
              {yearAuditRows.length === 0 ? (
                <p className="cal-year-empty mt-3 rounded-md border border-zinc-200 bg-zinc-100 px-3 py-4 text-center text-sm text-zinc-600">
                  Sin ocurrencias en este año.
                </p>
              ) : (
                <>
                  <div className="cal-year-table-scroll mt-3 max-h-[min(28rem,55vh)] overflow-auto rounded-md border border-zinc-200 bg-zinc-100 shadow-sm">
                    <table className="w-full min-w-[520px] border-collapse text-left text-xs">
                      <thead className="cal-year-thead sticky top-0 z-[1] border-b border-zinc-200 text-[10px] font-bold uppercase tracking-wide text-zinc-700">
                        <tr>
                          <th className="whitespace-nowrap px-3 py-2.5">Fecha</th>
                          <th className="px-3 py-2.5">Evento</th>
                          <th className="px-3 py-2.5">Frecuencia</th>
                        </tr>
                      </thead>
                      <tbody className="cal-year-tbody bg-zinc-100 text-zinc-900">
                        {yearAuditSlice.map((row) => (
                          <tr
                            key={`${row.ymd}-${row.ev.id}`}
                            className="cal-year-tr border-b border-zinc-200 last:border-b-0"
                          >
                            <td className="whitespace-nowrap px-3 py-2 text-zinc-700 tabular-nums">
                              {row.date.toLocaleDateString("es-MX", {
                                weekday: "short",
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                timeZone: APP_TIME_ZONE,
                              })}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedEvent({
                                    id: row.ev.id,
                                    name: row.ev.name,
                                    recurrence: row.ev.recurrence,
                                    color: row.ev.color,
                                    assigneeIds: row.ev.assigneeIds ?? [],
                                    checklistTemplateId: row.ev.checklistTemplateId ?? null,
                                    assetId: row.ev.assetId ?? null,
                                    calendarId: row.ev.calendarId ?? null,
                                    dateLabel: row.date.toLocaleDateString("es-MX", {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                      timeZone: APP_TIME_ZONE,
                                    }),
                                    dateYmd: row.ymd,
                                  })
                                }
                                className="max-w-[280px] truncate text-left font-semibold text-primary-600 underline-offset-2 hover:text-primary-700 hover:underline"
                              >
                                {row.ev.name}
                              </button>
                            </td>
                            <td className="px-3 py-2 text-zinc-600 leading-snug">
                              {formatRecurrenceLabel(row.ev.recurrence)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {yearAuditPageCount > 1 ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-zinc-700">
                      <span>
                        Página {yearAuditPage + 1} de {yearAuditPageCount} (
                        {yearAuditSlice.length ? yearAuditPage * YEAR_AUDIT_PAGE_SIZE + 1 : 0}
                        {"–"}
                        {yearAuditPage * YEAR_AUDIT_PAGE_SIZE + yearAuditSlice.length} de{" "}
                        {yearAuditRows.length})
                      </span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={yearAuditPage <= 0}
                          onClick={() => setYearAuditPage((p) => Math.max(0, p - 1))}
                          className="cal-year-page-btn rounded-sm border border-zinc-300 bg-zinc-100 px-2 py-1 font-semibold uppercase tracking-wide text-zinc-800 disabled:opacity-40"
                        >
                          Anterior
                        </button>
                        <button
                          type="button"
                          disabled={yearAuditPage >= yearAuditPageCount - 1}
                          onClick={() =>
                            setYearAuditPage((p) => Math.min(yearAuditPageCount - 1, p + 1))
                          }
                          className="cal-year-page-btn rounded-sm border border-zinc-300 bg-zinc-100 px-2 py-1 font-semibold uppercase tracking-wide text-zinc-800 disabled:opacity-40"
                        >
                          Siguiente
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className={viewMode === "day" ? "grid grid-cols-1" : "grid grid-cols-7"}>
            {visibleCells.map((cell, i) => {
              const dateYmd = toYmdLocal(cell.date);
              const isExpanded = viewMode === "day" || expandedCells[dateYmd] === true;
              const visibleEvents = isExpanded ? cell.events : cell.events.slice(0, 2);
              const hiddenCount = Math.max(0, cell.events.length - visibleEvents.length);
              return (
                <div
                  key={i}
                  onClick={() => {
                    const ymd = toYmdLocal(cell.date);
                    setCurrentDate(new Date(cell.date));
                    if (!canManageEvents) return;
                    setCreateModalDate(ymd);
                    setCreateModalOpen(true);
                  }}
                  title={
                    canManageEvents && cell.events.length === 0
                      ? "Click para crear un evento en este día"
                      : undefined
                  }
                  className={`min-h-[108px] border-r border-b border-zinc-200 px-2 py-1 text-left align-top transition-colors ${
                    cell.inMonth ? "bg-surface" : "bg-zinc-50/50"
                  } ${
                    canManageEvents && cell.events.length === 0
                      ? "cursor-pointer hover:bg-primary-50/50 hover:ring-1 hover:ring-inset hover:ring-primary-300"
                      : ""
                  } ${cell.isToday ? "ring-1 ring-inset ring-accent-500" : ""}`}
                >
                  <div
                    className={`mb-1 text-xs font-medium ${
                      cell.inMonth ? "text-zinc-800" : "text-zinc-500"
                    }`}
                  >
                    {cell.date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {visibleEvents.map((ev) => {
                      const workOrderStatus = workOrderMarkerStatusByKey.get(
                        `${ev.id}|${dateYmd}`
                      );
                      return (
                      <button
                        key={`${ev.id}-${i}`}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent({
                            id: ev.id,
                            name: ev.name,
                            recurrence: ev.recurrence,
                            color: ev.color,
                            assigneeIds: ev.assigneeIds ?? [],
                            checklistTemplateId: ev.checklistTemplateId ?? null,
                            assetId: ev.assetId ?? null,
                            calendarId: ev.calendarId ?? null,
                            dateLabel: cell.date.toLocaleDateString("es-MX", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              timeZone: APP_TIME_ZONE,
                            }),
                            dateYmd,
                          });
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="flex w-full items-center gap-1 truncate rounded-sm px-1.5 py-0.5 text-left text-[10px] font-semibold uppercase tracking-wide text-white"
                        style={{ backgroundColor: ev.color ?? "#02257D" }}
                        title={ev.name}
                      >
                        <span className="truncate">{ev.name}</span>
                        {workOrderStatus ? (
                          <span
                            className="ml-auto inline-flex h-2 w-2 shrink-0 rounded-full ring-1 ring-white/70"
                            style={{
                              backgroundColor: workOrderStatusMarkerColor(
                                workOrderStatus,
                                statusColors
                              ),
                            }}
                            title={workOrderStatusMarkerLabel(workOrderStatus)}
                            aria-label={workOrderStatusMarkerLabel(workOrderStatus)}
                          />
                        ) : null}
                      </button>
                    );
                    })}
                    {hiddenCount > 0 ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCells((prev) => ({ ...prev, [dateYmd]: true }));
                        }}
                        className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700"
                      >
                        +{hiddenCount} más
                      </button>
                    ) : cell.events.length > 2 && viewMode !== "day" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCells((prev) => ({ ...prev, [dateYmd]: false }));
                        }}
                        className="text-[10px] font-semibold text-zinc-500 hover:text-zinc-700"
                      >
                        Ver menos
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailModalMounted && panelEvent ? (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 transition-opacity duration-300 ease-out motion-reduce:transition-none md:items-center md:justify-center md:p-4 ${
            detailModalShow ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => {
            setSelectedEvent(null);
            setCreateWorkOrderError(null);
            setAssigneePromptOpen(false);
            setEditingScheduleName(false);
          }}
        >
          <div
            className={`relative flex max-h-[min(90dvh,900px)] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-zinc-200 border-b-0 bg-white shadow-[0_-8px_30px_rgba(0,0,0,0.12)] transition-transform duration-300 ease-out motion-reduce:transition-none motion-reduce:duration-0 md:max-h-[85vh] md:rounded-lg md:border-b md:shadow-lg ${
              detailModalShow
                ? "translate-y-0 motion-reduce:translate-y-0"
                : "translate-y-full motion-reduce:translate-y-0 md:translate-y-4"
            }`}
            onClick={(e) => e.stopPropagation()}
            onPointerDownCapture={(e) => {
              if (!editingScheduleName) return;
              const t = e.target as Node;
              scheduleBlurSaveSkipRef.current =
                Boolean(scheduleEditBlockRef.current?.contains(t)) ||
                Boolean(scheduleDetailEditSectionRef.current?.contains(t));
            }}
            onTransitionEnd={onDetailPanelTransitionEnd}
          >
            <div className="flex min-h-0 shrink-0 items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3">
              <div className="flex min-h-0 min-w-0 flex-1 items-start gap-2">
                <div className="min-h-0 min-w-0 flex-1">
                  {editingScheduleName ? (
                    <div
                      ref={scheduleEditBlockRef}
                      className="min-h-0 space-y-2 overflow-hidden"
                    >
                      <input
                        type="text"
                        autoFocus
                        value={scheduleNameDraft}
                        onChange={(e) => setScheduleNameDraft(e.target.value)}
                        onBlur={(e) => {
                          const rt = e.relatedTarget as Node | null;
                          if (
                            rt &&
                            cancelScheduleEditBtnRef.current?.contains(rt)
                          ) {
                            return;
                          }
                          if (rt) {
                            if (
                              scheduleEditBlockRef.current?.contains(rt) ||
                              scheduleDetailEditSectionRef.current?.contains(rt)
                            ) {
                              return;
                            }
                          }
                          window.setTimeout(() => {
                            if (scheduleBlurSaveSkipRef.current) {
                              scheduleBlurSaveSkipRef.current = false;
                              return;
                            }
                            const ae = document.activeElement;
                            if (
                              cancelScheduleEditBtnRef.current &&
                              (cancelScheduleEditBtnRef.current === ae ||
                                cancelScheduleEditBtnRef.current.contains(ae))
                            ) {
                              return;
                            }
                            if (
                              scheduleEditBlockRef.current?.contains(ae) ||
                              scheduleDetailEditSectionRef.current?.contains(ae)
                            ) {
                              return;
                            }
                            void saveScheduleNameFromDraft();
                          }, 0);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void saveScheduleNameFromDraft();
                          }
                          if (e.key === "Escape") {
                            e.stopPropagation();
                            setScheduleNameDraft(panelEvent.name);
                            setEditingScheduleName(false);
                          }
                        }}
                        disabled={savingScheduleFields}
                        className="w-full min-w-0 rounded-md border border-zinc-300 px-2 py-1 text-sm font-semibold text-zinc-900 disabled:opacity-60"
                        aria-label="Nombre del evento"
                      />
                      <AssigneeMultiSelect
                        id={`cal-default-assignee-${panelEvent.id}`}
                        users={users}
                        value={panelEvent.assigneeIds}
                        disabled={savingScheduleFields}
                        onChange={(ids) => void saveScheduleDefaultAssignees(ids)}
                        label="Responsables por defecto"
                        emptyHint="Nadie seleccionado"
                      />
                    </div>
                  ) : (
                    <h3 className="truncate text-sm font-semibold text-zinc-900">
                      {panelEvent.name}
                    </h3>
                  )}
                </div>
                {editingScheduleName ? (
                  <button
                    ref={cancelScheduleEditBtnRef}
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setScheduleNameDraft(panelEvent.name);
                      setEditingScheduleName(false);
                    }}
                    aria-label="Cancelar edición"
                    title="Cancelar edición"
                    className="inline-flex shrink-0 rounded-md border border-zinc-300 p-1 text-zinc-600 hover:bg-zinc-100"
                  >
                    <CircleX className="h-4 w-4 pointer-events-none" aria-hidden />
                  </button>
                ) : canManageEvents ? (
                  <button
                    type="button"
                    aria-label="Editar nombre, frecuencia y checklist"
                    title="Editar nombre, frecuencia y checklist"
                    onClick={() => {
                      setScheduleNameDraft(panelEvent.name);
                      setEditingScheduleName(true);
                    }}
                    className="inline-flex shrink-0 rounded-md border border-zinc-300 p-1 text-zinc-600 hover:bg-zinc-100"
                  >
                    <Pencil className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEvent(null);
                  setCreateWorkOrderError(null);
                  setAssigneePromptOpen(false);
                  setEditingScheduleName(false);
                }}
                aria-label="Cerrar modal"
                className="inline-flex shrink-0 items-center justify-center rounded-sm border border-zinc-300 p-1 text-zinc-700 hover:bg-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-3">
              {editingScheduleName ? (
                <div ref={scheduleDetailEditSectionRef}>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    {formatRecurrenceLabel(panelEvent.recurrence)}
                  </p>
                  <MaintenanceScheduleDetailEditForm
                    scheduleId={panelEvent.id}
                    recurrenceJson={panelEvent.recurrence}
                    checklistTemplateId={panelEvent.checklistTemplateId ?? null}
                    assetId={panelEvent.assetId ?? null}
                    calendarId={panelEvent.calendarId ?? null}
                    color={panelEvent.color ?? null}
                    assets={assets}
                    calendars={calendars}
                    checklistTemplates={checklistTemplates}
                    fallbackAnchorYmd={panelEvent.dateYmd}
                    onSaved={(patch) => {
                      setSelectedEvent((prev) => {
                        if (!prev || prev.id !== panelEvent.id) return prev;
                        const n = { ...prev };
                        if (typeof patch.name === "string") n.name = patch.name;
                        if (typeof patch.recurrence === "string") {
                          n.recurrence = patch.recurrence;
                        }
                        if ("checklistTemplateId" in patch) {
                          n.checklistTemplateId =
                            patch.checklistTemplateId == null
                              ? null
                              : String(patch.checklistTemplateId);
                        }
                        if ("assetId" in patch) {
                          n.assetId =
                            patch.assetId == null ? null : String(patch.assetId);
                        }
                        if ("calendarId" in patch) {
                          n.calendarId =
                            patch.calendarId == null
                              ? null
                              : String(patch.calendarId);
                        }
                        if (typeof patch.color === "string") n.color = patch.color;
                        return n;
                      });
                      setEditingScheduleName(false);
                      router.refresh();
                    }}
                  />
                </div>
              ) : (
                <>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
                    {formatRecurrenceLabel(panelEvent.recurrence)}
                  </p>
                  <dl className="mt-2 space-y-2 text-xs text-zinc-700">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Checklist
                      </dt>
                      <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-900">
                        {panelEvent.checklistTemplateId ? (
                          <>
                            <span>
                              {checklistTemplates.find(
                                (t) => t.id === panelEvent.checklistTemplateId
                              )?.name ?? "Checklist no encontrada"}
                            </span>
                            <Link
                              href={`/checklists/${panelEvent.checklistTemplateId}`}
                              className="inline-flex items-center gap-1 rounded-sm border border-zinc-300 px-2 py-0.5 text-xs font-medium text-primary-700 hover:bg-zinc-50"
                            >
                              Ver
                              <ExternalLink className="h-3 w-3" aria-hidden />
                            </Link>
                          </>
                        ) : (
                          "Sin checklist"
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Responsables
                      </dt>
                      <dd className="mt-0.5">
                        {panelEvent.assigneeIds.length === 0 ? (
                          <span className="text-sm text-zinc-500">Sin asignar</span>
                        ) : (
                          <span className="flex flex-wrap items-center gap-1">
                            {panelEvent.assigneeIds.map((id) => {
                              const u = users.find((x) => x.id === id);
                              const name = u?.name ?? "Usuario";
                              return (
                                <span
                                  key={id}
                                  className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-0.5 pr-2"
                                >
                                  <UserAvatar
                                    userId={id}
                                    name={name}
                                    avatarUrl={u?.avatarUrl ?? null}
                                    size="sm"
                                    className="!h-5 !w-5 !text-[8px]"
                                  />
                                  <span className="max-w-[9rem] truncate text-sm text-zinc-800">
                                    {name}
                                  </span>
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Calendario
                      </dt>
                      <dd className="mt-0.5 text-sm text-zinc-900">
                        {panelEvent.calendarId
                          ? calendars.find((c) => c.id === panelEvent.calendarId)
                              ?.name ?? "Calendario no encontrado"
                          : "Sin calendario"}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
                        Máquina
                      </dt>
                      <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-zinc-900">
                        {(() => {
                          if (!panelEvent.assetId) return "Sin máquina";
                          const a = assets.find((x) => x.id === panelEvent.assetId);
                          if (!a) return "Máquina no encontrada";
                          const label = a.sublabel
                            ? `${a.name} (${a.sublabel})`
                            : a.name;
                          return (
                            <>
                              <span>{label}</span>
                              <Link
                                href={`/assets/${panelEvent.assetId}`}
                                className="inline-flex items-center gap-1 rounded-sm border border-zinc-300 px-2 py-0.5 text-xs font-medium text-primary-700 hover:bg-zinc-50"
                              >
                                Ver
                                <ExternalLink className="h-3 w-3" aria-hidden />
                              </Link>
                            </>
                          );
                        })()}
                      </dd>
                    </div>
                  </dl>
                </>
              )}
              {!editingScheduleName ? (
                <>
                  {createWorkOrderError ? (
                    <p className="mb-2 mt-3 rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-600">
                      {createWorkOrderError}
                    </p>
                  ) : null}
                  <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                    Tareas asociadas en {panelEvent.dateLabel}
                  </p>
              {loadingLinkedWorkOrders ? (
                <p className="mt-1 text-xs text-zinc-600">Cargando...</p>
              ) : linkedWorkOrders.length === 0 ? (
                <p className="mt-1 text-xs text-zinc-600">Sin tareas asociadas.</p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {linkedWorkOrders.map((wo) => (
                    <li key={wo.id}>
                      <Link
                        href={`/tareas/${wo.id}`}
                        className="block rounded-lg border border-zinc-200 bg-white p-3 hover:border-primary-200"
                        onClick={() => setSelectedEvent(null)}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="line-clamp-2 font-medium text-zinc-900">
                                {wo.folio != null ? `Folio ${wo.folio} · ` : ""}
                                {wo.title}
                              </p>
                            </div>
                            {(() => {
                              const { Icon, className } = priorityMeta(wo.priority);
                              return (
                                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-zinc-900">
                                  <Icon className={`h-4 w-4 ${className}`} strokeWidth={2.5} aria-hidden />
                                  {priorityLabel(wo.priority)}
                                </span>
                              );
                            })()}
                          </div>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <p className="text-zinc-500">
                              {statusLabel(wo.status)} · Vence{" "}
                              {wo.dueDate
                                ? new Date(wo.dueDate).toLocaleDateString("es-MX", {
                                    timeZone: APP_TIME_ZONE,
                                  })
                                : "—"}
                            </p>
                            <span
                              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                              style={workOrderStatusBadgeStyle(wo.status, statusColors)}
                            >
                              {statusLabel(wo.status)}
                            </span>
                          </div>
                          {(wo.assignees && wo.assignees.length > 0) ||
                          wo.assigneeName ? (
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
                              <span className="shrink-0">Asignado:</span>
                              <span className="flex min-w-0 flex-wrap items-center gap-1">
                                {(wo.assignees?.length
                                  ? wo.assignees
                                  : wo.assigneeName
                                    ? [
                                        {
                                          id: wo.assigneeId ?? "",
                                          name: wo.assigneeName,
                                          avatarUrl: wo.assigneeAvatarUrl,
                                        },
                                      ]
                                    : []
                                ).map((a) => (
                                  <span
                                    key={a.id}
                                    className="inline-flex items-center gap-1 rounded-full bg-zinc-100 py-0.5 pl-0.5 pr-2"
                                  >
                                    <UserAvatar
                                      userId={a.id}
                                      name={a.name}
                                      avatarUrl={a.avatarUrl ?? null}
                                      size="sm"
                                      className="!h-5 !w-5 !text-[8px]"
                                    />
                                    <span className="max-w-[9rem] truncate">{a.name}</span>
                                  </span>
                                ))}
                              </span>
                            </div>
                          ) : null}
                          <p className="text-[10px] text-zinc-500">
                            Abierta el {formatOpenedAt(wo.createdAt)}
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {linkedWorkOrdersHasMore ? (
                <button
                  type="button"
                  disabled={loadingMoreLinkedWorkOrders || !panelEvent}
                  onClick={async () => {
                    if (!panelEvent || loadingMoreLinkedWorkOrders) return;
                    setLoadingMoreLinkedWorkOrders(true);
                    try {
                      const offset = linkedWorkOrders.length;
                      const res = await fetch(
                        `/api/maintenance-schedules/${panelEvent.id}/work-orders?dateYmd=${encodeURIComponent(
                          panelEvent.dateYmd
                        )}&limit=${LINKED_WO_PAGE_SIZE}&offset=${offset}`
                      );
                      const data = await res.json().catch(() => ({}));
                      const items = Array.isArray(data?.items) ? data.items : [];
                      setLinkedWorkOrders((prev) => [...prev, ...items]);
                      setLinkedWorkOrdersHasMore(Boolean(data?.hasMore));
                    } finally {
                      setLoadingMoreLinkedWorkOrders(false);
                    }
                  }}
                  className="mt-2 rounded-sm border border-zinc-200 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                >
                  {loadingMoreLinkedWorkOrders ? "Cargando…" : "Cargar más"}
                </button>
              ) : null}
              {canManageEvents ? (
              <div className="mt-3 flex w-full flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={
                    creatingWorkOrder ||
                    loadingLinkedWorkOrders ||
                    panelEventHasWorkOrder
                  }
                  title={
                    panelEventHasWorkOrder
                      ? "Ya existe una tarea para este evento en este día"
                      : undefined
                  }
                  onClick={() => {
                    if (panelEventHasWorkOrder) return;
                    setCreateWorkOrderError(null);
                    setSelectedAssigneeIds([...panelEvent.assigneeIds]);
                    setAssigneePromptOpen(true);
                  }}
                  className="rounded-lg bg-primary-600 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  {creatingWorkOrder ? "Creando..." : "Crear tarea"}
                </button>
                <button
                  type="button"
                  aria-label="Eliminar del calendario"
                  title="Eliminar del calendario"
                  onClick={() => {
                    setDeleteScope("single");
                    setDeleteModalOpen(true);
                  }}
                  className="inline-flex shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white px-2.5 py-2.5 text-zinc-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden />
                </button>
              </div>
              ) : null}
              {assigneePromptOpen ? (
                <div className="mt-2 min-h-0 overflow-hidden rounded-sm border border-zinc-300 bg-zinc-50 p-2">
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-600">
                  Asignar responsables
                </p>
                {loadingUserOptions ? (
                  <p className="text-xs text-zinc-600">Cargando usuarios...</p>
                ) : (
                  <AssigneeMultiSelect
                    users={userOptions}
                    value={selectedAssigneeIds}
                    onChange={setSelectedAssigneeIds}
                    disabled={creatingWorkOrder}
                    label=""
                    emptyHint="Selecciona al menos una persona"
                  />
                )}
                <div className="mt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    className="rounded-sm bg-primary-600 px-2 py-1 text-[11px] font-semibold uppercase text-white hover:bg-primary-700 disabled:opacity-50"
                    disabled={
                      creatingWorkOrder ||
                      selectedAssigneeIds.length === 0 ||
                      panelEventHasWorkOrder
                    }
                    onClick={async () => {
                      if (
                        !panelEvent ||
                        selectedAssigneeIds.length === 0 ||
                        panelEventHasWorkOrder
                      ) {
                        return;
                      }
                      setCreateWorkOrderError(null);
                      setCreatingWorkOrder(true);
                      try {
                        const res = await fetch(
                          `/api/maintenance-schedules/${panelEvent.id}/create-work-order`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              dateYmd: panelEvent.dateYmd,
                              assigneeIds: selectedAssigneeIds,
                              startDate: panelEvent.dateYmd,
                            }),
                          }
                        );
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setCreateWorkOrderError(
                            typeof data.error === "string"
                              ? data.error
                              : "No se pudo crear la tarea"
                          );
                          return;
                        }
                        setWorkOrderMarkerStatusByKey((prev) => {
                          const next = new Map(prev);
                          next.set(`${panelEvent.id}|${panelEvent.dateYmd}`, "pending");
                          return next;
                        });
                        setSelectedEvent(null);
                        setAssigneePromptOpen(false);
                        router.push(`/tareas/${data.id}`);
                        router.refresh();
                      } finally {
                        setCreatingWorkOrder(false);
                      }
                    }}
                  >
                    Confirmar
                  </button>
                  <button
                    type="button"
                    className="rounded-sm border border-zinc-300 px-2 py-1 text-[11px] font-semibold uppercase text-zinc-700 hover:bg-zinc-100"
                    onClick={() => setAssigneePromptOpen(false)}
                    disabled={creatingWorkOrder}
                  >
                    Cancelar
                  </button>
                </div>
                </div>
              ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteModalOpen && panelEvent ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-cal-modal-title"
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-4"
          onClick={() => setDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="delete-cal-modal-title"
              className="text-base font-semibold text-zinc-900"
            >
              Eliminar del calendario
            </h3>
            <div className="mt-4 space-y-3">
              <label className="flex cursor-pointer items-center gap-3 rounded-lg py-0.5">
                <input
                  type="radio"
                  name="calendar-delete-scope"
                  checked={deleteScope === "single"}
                  onChange={() => setDeleteScope("single")}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium text-zinc-900">Este evento</span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg py-0.5">
                <input
                  type="radio"
                  name="calendar-delete-scope"
                  checked={deleteScope === "future"}
                  onChange={() => setDeleteScope("future")}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium text-zinc-900">
                  Este evento y los siguientes
                </span>
              </label>
              <label className="flex cursor-pointer items-center gap-3 rounded-lg py-0.5">
                <input
                  type="radio"
                  name="calendar-delete-scope"
                  checked={deleteScope === "all"}
                  onChange={() => setDeleteScope("all")}
                  className="accent-primary-600"
                />
                <span className="text-sm font-medium text-zinc-900">Todos los eventos</span>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm font-medium text-primary-600 hover:bg-primary-50"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deleteSubmitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                className="rounded-full bg-primary-600 px-6 py-2 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50"
                onClick={async () => {
                  if (!panelEvent) return;
                  setDeleteSubmitting(true);
                  try {
                    let res: Response;
                    if (deleteScope === "single") {
                      res = await fetch(
                        `/api/maintenance-schedules/${panelEvent.id}?scope=single&date=${encodeURIComponent(
                          panelEvent.dateYmd
                        )}`,
                        { method: "DELETE" }
                      );
                    } else if (deleteScope === "future") {
                      res = await fetch(
                        `/api/maintenance-schedules/${panelEvent.id}?scope=future&date=${encodeURIComponent(
                          panelEvent.dateYmd
                        )}`,
                        { method: "DELETE" }
                      );
                    } else {
                      res = await fetch(
                        `/api/maintenance-schedules/${panelEvent.id}?scope=all`,
                        { method: "DELETE" }
                      );
                    }
                    setDeleteModalOpen(false);
                    await finishMaintenanceDelete(res, panelEvent.id);
                  } finally {
                    setDeleteSubmitting(false);
                  }
                }}
              >
                {deleteSubmitting ? "…" : "OK"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {undoBanner ? (
        <div className="fixed bottom-4 left-1/2 z-[60] flex max-w-[min(100vw-1rem,420px)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-800 shadow-lg">
          <span className="min-w-0 flex-1">
            {undoBanner.kind === "recurrence"
              ? "Cambio de evento aplicado. Puedes revertirlo en segundos."
              : "Evento ocultadao. Puedes restaurarlao en segundos."}
          </span>
          <button
            type="button"
            className="shrink-0 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold uppercase text-white hover:bg-primary-700"
            onClick={async () => {
              const sid = undoBanner.scheduleId;
              const url =
                undoBanner.kind === "recurrence"
                  ? `/api/maintenance-schedules/${sid}/undo-last`
                  : `/api/maintenance-schedules/${sid}/restore`;
              const res = await fetch(url, { method: "POST" });
              setUndoBanner(null);
              if (res.ok) router.refresh();
            }}
          >
            {undoBanner.kind === "recurrence" ? "Deshacer" : "Restaurar"}
          </button>
          <button
            type="button"
            className="shrink-0 rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
            onClick={() => setUndoBanner(null)}
            aria-label="Cerrar aviso"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <CalendarCreateEventModal
        assets={assets}
        users={users}
        checklistTemplates={checklistTemplates}
        calendars={calendars}
        defaultCalendarId={defaultCalendarId}
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        initialStartDate={createModalDate}
        hideTrigger
      />
    </div>
  );
}
