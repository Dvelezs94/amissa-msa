"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AssigneeMultiSelect } from "@/components/AssigneeMultiSelect";
import {
  Check,
  Square,
  ImagePlus,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Clock,
  Equal,
  X,
  Pencil,
  ArrowLeft,
  FileText,
  Trash2,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { UserAvatar } from "@/components/UserAvatar";
import { useSetPageHeader } from "@/components/PageHeaderContext";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { checklistDropdownValueIsNoOk } from "@/lib/dashboard-checklists";
import {
  parseWorkOrderKind,
  workOrderKindBadgeClass,
  workOrderKindLabel,
} from "@/lib/work-order-kind";
import {
  formatWorkOrderElapsedCompact,
  formatWorkOrderElapsedLabel,
  workOrderShouldShowElapsed,
} from "@/lib/work-order-duration";
import {
  formatDowntimeMinutesSpanish,
  MAX_MANUAL_DOWNTIME_MINUTES,
  workOrderAutomaticDowntimeMinutes,
  workOrderInProgressDowntimeMinutesSoFar,
} from "@/lib/machine-downtime";
import { checklistItemDepth, flattenChecklistTreeForDisplay } from "@/lib/checklist-item-tree";
import { workOrderChecklistIsCompleteForClosure } from "@/lib/checklist-completion";
import { ChecklistGroupedList } from "@/components/ChecklistGroupedList";
import {
  WorkOrderAssetSelect,
  type WorkOrderAssetOption,
} from "@/components/WorkOrderAssetSelect";
import { useWorkOrderStatusColors } from "@/components/WorkOrderStatusColorsProvider";
import {
  workOrderStatusBadgeStyle,
  workOrderStatusSelectStyle,
} from "@/lib/work-order-status-colors";
import {
  formatUtcDateToDatetimeLocalValue,
  parseDatetimeLocalValue,
  validateWorkOrderCompletedAt,
} from "@/lib/datetime-local";

const priorityDetail: Record<
  string,
  { Icon: typeof Equal; className: string; label: string }
> = {
  low: { Icon: ChevronDown, className: "text-[#0065FF]", label: "Baja" },
  medium: { Icon: Equal, className: "text-[#E2A100]", label: "Media" },
  high: { Icon: ChevronUp, className: "text-[#FF8B00]", label: "Alta" },
  urgent: { Icon: ChevronsUp, className: "text-[#BF2600]", label: "Urgente" },
};

function formatDate(s: string | Date | null) {
  if (s == null) return "—";
  return new Date(s).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  });
}

type ChecklistItem = {
  id: string;
  parentItemId?: string | null;
  sortOrder?: number;
  type: string;
  label: string;
  completed: boolean | null;
  value: unknown;
  fieldType: string | null;
  options?: string[] | null | unknown;
  isOptional?: boolean | null;
};

type WorkOrderComment = {
  id: string;
  body: string;
  createdAt: string | Date;
  user:
    | {
        id: string;
        name: string;
        avatarUrl?: string | null;
        avatarBackgroundColor?: string | null;
      }
    | null;
};

function isImageAttachment(filename: string, fileUrl: string): boolean {
  const raw = `${filename} ${fileUrl}`.toLowerCase();
  return (
    raw.includes(".jpg") ||
    raw.includes(".jpeg") ||
    raw.includes(".png") ||
    raw.includes(".gif") ||
    raw.includes(".webp") ||
    raw.includes(".bmp") ||
    raw.includes(".svg") ||
    raw.includes(".avif")
  );
}

function isLikelyInternalDownloadUrl(url: string): boolean {
  return url.startsWith("/api/work-orders/");
}

const COMMENT_ATTACHMENT_REGEX = /\[\[file:([^|\]]+)\|([^\]]+)\]\]/g;

function parseCommentBody(body: string): {
  text: string;
  attachments: { filename: string; fileUrl: string }[];
} {
  const attachments: { filename: string; fileUrl: string }[] = [];
  const text = body.replace(COMMENT_ATTACHMENT_REGEX, (_full, encodedName: string, fileUrl: string) => {
    const filename = decodeURIComponent(encodedName);
    attachments.push({ filename, fileUrl });
    return "";
  });
  return { text: text.trim(), attachments };
}

export function WorkOrderDetail({
  initial,
  canEditAssignee = false,
  canEditCompletedAt = false,
  canEditChecklistWhenLocked = false,
  canDeleteWorkOrder = false,
}: {
  initial: {
    id: string;
    folio?: string | number | null;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    kind?: string | null;
    dueDate: string | Date | null;
    startDate?: string | Date | null;
    createdAt: string | Date;
    startedAt?: string | Date | null;
    completedAt: string | Date | null;
    asset: { id: string; name: string; assetId: string; tracksMachineDowntime?: boolean } | null;
    assignees?: { id: string; name: string; avatarUrl?: string | null }[];
    assigneeIds?: string[];
    assignee: { id: string; name: string; avatarUrl?: string | null } | null;
    requester: { id: string; name: string; avatarUrl?: string | null } | null;
    checklistMeta: {
      templateName: string;
      revisionName: string | null;
      revisionNumber: number | null;
    } | null;
    checklist: ChecklistItem[];
    attachments: {
      id: string;
      fileUrl: string;
      filename: string;
      createdAt: string | Date;
    }[];
    countsMachineDowntime?: boolean | null;
    manualDowntimeMinutes?: number | null;
    calendarSource?: { name: string; href: string } | null;
  };
  canEditAssignee?: boolean;
  canEditCompletedAt?: boolean;
  canEditChecklistWhenLocked?: boolean;
  canDeleteWorkOrder?: boolean;
}) {
  const router = useRouter();
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { colors: statusColors } = useWorkOrderStatusColors();

  useSetPageHeader({
    title: initial.title,
    subtitle:
      initial.folio != null
        ? `Folio ${initial.folio}`
        : `Ref. ${initial.id.slice(0, 8)}…`,
  });

  function toRenderablePhotoUrl(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return trimmed;
    if (trimmed.startsWith("/")) return trimmed;
    try {
      const parsed = new URL(trimmed);
      if (parsed.pathname.startsWith("/api/work-orders/")) {
        return `${parsed.pathname}${parsed.search}${parsed.hash}`;
      }
    } catch {
      // Keep original when it's not a valid absolute URL
    }
    return trimmed;
  }

  function checklistPhotoUrls(value: unknown): string[] {
    const urls = new Set<string>();
    const visit = (input: unknown) => {
      if (Array.isArray(input)) {
        input.forEach(visit);
        return;
      }
      if (typeof input === "string") {
        const raw = input.trim();
        if (!raw) return;
        if (
          (raw.startsWith("[") && raw.endsWith("]")) ||
          (raw.startsWith("{") && raw.endsWith("}"))
        ) {
          try {
            visit(JSON.parse(raw));
            return;
          } catch {
            // treat as plain string if not JSON
          }
        }
        urls.add(toRenderablePhotoUrl(raw));
        return;
      }
      if (input && typeof input === "object") {
        const obj = input as Record<string, unknown>;
        visit(obj.fileUrl);
        visit(obj.url);
        visit(obj.src);
        visit(obj.value);
        visit(obj.values);
        visit(obj.photos);
        visit(obj.attachments);
      }
    };
    visit(value);
    return Array.from(urls);
  }

  const [checklist, setChecklist] = useState(initial.checklist);
  const checklistOrdered = useMemo(
    () => flattenChecklistTreeForDisplay(checklist),
    [checklist]
  );
  const [assigneeIds, setAssigneeIds] = useState<string[]>(
    () => initial.assigneeIds ?? (initial.assignee?.id ? [initial.assignee.id] : [])
  );
  const [assigneeUsers, setAssigneeUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [assigneeSaving, setAssigneeSaving] = useState(false);
  /** Admin: summary view + edit reveals AssigneeMultiSelect (sidebar stays compact). */
  const [assigneePickerOpen, setAssigneePickerOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageLightbox, setImageLightbox] = useState<{ src: string; alt: string } | null>(
    null
  );
  const commentFilesInputRef = useRef<HTMLInputElement>(null);
  const detailsPanelRef = useRef<HTMLDetailsElement>(null);
  const isCompleted = initial.status === "completed";
  const checklistUnlocked = initial.status === "in_progress";
  const [checklistForceEdit, setChecklistForceEdit] = useState(false);
  const checklistEditable =
    checklistUnlocked ||
    (checklistForceEdit &&
      canEditChecklistWhenLocked &&
      (initial.status === "completed" || initial.status === "cancelled"));
  const showChecklistEditToggle =
    canEditChecklistWhenLocked &&
    !checklistUnlocked &&
    (initial.status === "completed" || initial.status === "cancelled");
  const kind = parseWorkOrderKind(initial.kind);
  const [durationTick, setDurationTick] = useState(0);
  const [comments, setComments] = useState<WorkOrderComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [commentSaving, setCommentSaving] = useState(false);
  const [commentFiles, setCommentFiles] = useState<File[]>([]);

  const isCancelled = initial.status === "cancelled";
  const canEditAsset = !isCompleted && !isCancelled;

  useEffect(() => {
    setChecklistForceEdit(false);
  }, [initial.id, initial.status]);
  const [assetsList, setAssetsList] = useState<WorkOrderAssetOption[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [workOrderAssetId, setWorkOrderAssetId] = useState<string | null>(
    () => initial.asset?.id ?? null
  );
  const [assetSaving, setAssetSaving] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);

  const workOrderAsset = useMemo(() => {
    if (!workOrderAssetId) return null;
    const fromList = assetsList.find((a) => a.id === workOrderAssetId);
    if (fromList) {
      return {
        id: fromList.id,
        name: fromList.name,
        assetId: fromList.assetId,
        tracksMachineDowntime: fromList.tracksMachineDowntime,
      };
    }
    if (initial.asset?.id === workOrderAssetId) return initial.asset;
    return null;
  }, [workOrderAssetId, assetsList, initial.asset]);

  const machineDowntimeBlocked =
    workOrderAsset != null && workOrderAsset.tracksMachineDowntime === false;

  useEffect(() => {
    setWorkOrderAssetId(initial.asset?.id ?? null);
  }, [initial.id, initial.asset?.id]);

  useEffect(() => {
    let cancelled = false;
    setAssetsLoading(true);
    fetch("/api/assets")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setAssetsList(
          Array.isArray(d)
            ? d.map((a: WorkOrderAssetOption) => ({
                id: a.id,
                name: a.name,
                assetId: a.assetId,
                tracksMachineDowntime: a.tracksMachineDowntime,
              }))
            : []
        );
      })
      .catch(() => {
        if (!cancelled) setAssetsList([]);
      })
      .finally(() => {
        if (!cancelled) setAssetsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveWorkOrderAsset(nextAssetId: string | null) {
    if (!canEditAsset || nextAssetId === workOrderAssetId) return;
    const prevId = workOrderAssetId;
    setAssetSaving(true);
    setAssetError(null);
    setWorkOrderAssetId(nextAssetId);
    try {
      const res = await fetch(`/api/work-orders/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetId: nextAssetId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "No se pudo guardar la máquina");
      }
      router.refresh();
    } catch (e) {
      setWorkOrderAssetId(prevId);
      setAssetError(e instanceof Error ? e.message : "Error");
    } finally {
      setAssetSaving(false);
    }
  }
  const [countsMachineDowntime, setCountsMachineDowntime] = useState(
    () =>
      initial.asset?.tracksMachineDowntime === false
        ? false
        : initial.countsMachineDowntime === true
  );
  const [manualAmountDraft, setManualAmountDraft] = useState(() =>
    String(Math.max(0, Number(initial.manualDowntimeMinutes ?? 0)))
  );
  const [manualUnit, setManualUnit] = useState<"min" | "h">("min");
  const [downtimeSaving, setDowntimeSaving] = useState(false);
  const [downtimeError, setDowntimeError] = useState<string | null>(null);
  const [completedAtDraft, setCompletedAtDraft] = useState(() =>
    formatUtcDateToDatetimeLocalValue(initial.completedAt)
  );
  const [completedAtSaving, setCompletedAtSaving] = useState(false);
  const [completedAtError, setCompletedAtError] = useState<string | null>(null);

  useEffect(() => {
    setCompletedAtDraft(formatUtcDateToDatetimeLocalValue(initial.completedAt));
    setCompletedAtError(null);
  }, [initial.id, initial.completedAt]);

  useEffect(() => {
    if (workOrderAsset?.tracksMachineDowntime === false) {
      setCountsMachineDowntime(false);
    } else {
      setCountsMachineDowntime(initial.countsMachineDowntime === true);
    }
    setManualAmountDraft(String(Math.max(0, Number(initial.manualDowntimeMinutes ?? 0))));
  }, [
    initial.id,
    initial.countsMachineDowntime,
    initial.manualDowntimeMinutes,
    workOrderAsset?.tracksMachineDowntime,
  ]);

  const autoDowntimePreviewMinutes = useMemo(() => {
    void durationTick;
    if (initial.status === "completed") {
      return workOrderAutomaticDowntimeMinutes({
        status: initial.status,
        countsMachineDowntime,
        startedAt: initial.startedAt,
        completedAt: initial.completedAt,
      });
    }
    if (initial.status === "in_progress") {
      return workOrderInProgressDowntimeMinutesSoFar({
        status: initial.status,
        countsMachineDowntime,
        startedAt: initial.startedAt,
        nowMs: Date.now(),
      });
    }
    return 0;
  }, [
    durationTick,
    initial.status,
    initial.startedAt,
    initial.completedAt,
    countsMachineDowntime,
  ]);

  async function patchCompletedAt(iso: string) {
    setCompletedAtSaving(true);
    setCompletedAtError(null);
    try {
      const res = await fetch(`/api/work-orders/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: iso }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "No se pudo guardar");
      }
      router.refresh();
    } catch (e) {
      setCompletedAtError(e instanceof Error ? e.message : "Error");
      setCompletedAtDraft(formatUtcDateToDatetimeLocalValue(initial.completedAt));
      throw e;
    } finally {
      setCompletedAtSaving(false);
    }
  }

  async function saveCompletedAtDraft() {
    if (!canEditCompletedAt || !initial.completedAt) return;
    const current = formatUtcDateToDatetimeLocalValue(initial.completedAt);
    if (completedAtDraft === current) return;
    const parsed = parseDatetimeLocalValue(completedAtDraft);
    if (!parsed) {
      setCompletedAtError("Fecha u hora inválida");
      setCompletedAtDraft(current);
      return;
    }
    const validationError = validateWorkOrderCompletedAt(parsed);
    if (validationError) {
      setCompletedAtError(validationError);
      setCompletedAtDraft(current);
      return;
    }
    try {
      await patchCompletedAt(parsed.toISOString());
    } catch {
      // error handled in patchCompletedAt
    }
  }

  async function patchDowntimeFields(patch: {
    countsMachineDowntime?: boolean;
    manualDowntimeMinutes?: number;
  }) {
    setDowntimeSaving(true);
    setDowntimeError(null);
    try {
      const res = await fetch(`/api/work-orders/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string }).error ?? "No se pudo guardar");
      }
      router.refresh();
    } catch (e) {
      setDowntimeError(e instanceof Error ? e.message : "Error");
      throw e;
    } finally {
      setDowntimeSaving(false);
    }
  }

  async function onToggleCountsDowntime(next: boolean) {
    if (machineDowntimeBlocked) return;
    const prev = countsMachineDowntime;
    setCountsMachineDowntime(next);
    try {
      await patchDowntimeFields({ countsMachineDowntime: next });
    } catch {
      setCountsMachineDowntime(prev);
    }
  }

  async function onSaveManualDowntime() {
    if (machineDowntimeBlocked) return;
    const raw = Number(String(manualAmountDraft).replace(",", "."));
    if (!Number.isFinite(raw) || raw < 0) {
      setDowntimeError("Cantidad inválida");
      return;
    }
    const minutes = manualUnit === "h" ? Math.round(raw * 60) : Math.round(raw);
    if (minutes > MAX_MANUAL_DOWNTIME_MINUTES) {
      setDowntimeError("Paro manual demasiado grande (máx. 525600 minutos).");
      return;
    }
    try {
      await patchDowntimeFields({ manualDowntimeMinutes: minutes });
    } catch {
      // error state handled in patchDowntimeFields
    }
  }

  const needsLiveDuration = initial.status === "in_progress";

  useEffect(() => {
    if (!needsLiveDuration) return;
    const id = window.setInterval(() => setDurationTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [needsLiveDuration]);

  useEffect(() => {
    if (!canEditAssignee) return;
    let cancelled = false;
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          const list = Array.isArray(data) ? data : [];
          setAssigneeUsers(list.map((u) => ({ id: u.id, name: u.name })));
        }
      })
      .catch(() => {
        if (!cancelled) setAssigneeUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, [canEditAssignee]);

  useEffect(() => {
    setAssigneeIds(
      initial.assigneeIds ?? (initial.assignee?.id ? [initial.assignee.id] : [])
    );
  }, [initial.id, initial.assignee?.id, JSON.stringify(initial.assigneeIds ?? [])]);

  useEffect(() => {
    setAssigneePickerOpen(false);
  }, [initial.id]);

  useEffect(() => {
    if (!assigneePickerOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setAssigneePickerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [assigneePickerOpen]);

  useEffect(() => {
    if (!imageLightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setImageLightbox(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [imageLightbox]);

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      detailsPanelRef.current?.setAttribute("open", "");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadComments() {
      setCommentsLoading(true);
      setCommentsError(null);
      try {
        const res = await fetch(`/api/work-orders/${initial.id}/notes`, {
          cache: "no-store",
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) {
          throw new Error(
            (data as { error?: string })?.error ?? "No se pudieron cargar los comentarios."
          );
        }
        if (!cancelled) {
          setComments(Array.isArray(data) ? (data as WorkOrderComment[]) : []);
        }
      } catch (error) {
        if (!cancelled) {
          setCommentsError(
            error instanceof Error ? error.message : "No se pudieron cargar los comentarios."
          );
          setComments([]);
        }
      } finally {
        if (!cancelled) {
          setCommentsLoading(false);
        }
      }
    }
    void loadComments();
    return () => {
      cancelled = true;
    };
  }, [initial.id]);

  async function uploadWorkOrderPhoto(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(`/api/work-orders/${initial.id}/attachments`, {
      method: "POST",
      body: fd,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error ?? "Error al subir la foto");
    }
    return data as {
      id: string;
      fileUrl: string;
      filename: string;
      createdAt: string;
    };
  }

  async function onChecklistPhotoSelected(itemId: string, e: React.ChangeEvent<HTMLInputElement>) {
    if (!checklistEditable) return;
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setUploadError(null);
    setUploading(true);
    try {
      const existing =
        checklistPhotoUrls(checklist.find((i) => i.id === itemId)?.value);
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const row = await uploadWorkOrderPhoto(file);
        uploadedUrls.push(row.fileUrl);
      }
      const merged = Array.from(new Set([...existing, ...uploadedUrls]));
      setChecklist((prev) => prev.map((i) => (i.id === itemId ? { ...i, value: merged } : i)));
      await fetch(`/api/work-orders/${initial.id}/checklist`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, value: merged }),
      });
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Error al subir");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function removeChecklistPhoto(itemId: string, photoUrl: string) {
    if (!checklistEditable) return;
    const existing = checklistPhotoUrls(checklist.find((i) => i.id === itemId)?.value);
    const next = existing.filter((url) => url !== photoUrl);
    setChecklist((prev) => prev.map((i) => (i.id === itemId ? { ...i, value: next } : i)));
    await fetch(`/api/work-orders/${initial.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, value: next }),
    });
  }

  async function toggleStep(itemId: string, completed: boolean) {
    if (!checklistEditable) return;
    setChecklist((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed } : i))
    );
    await fetch(`/api/work-orders/${initial.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, completed }),
    });
  }

  async function updateFieldValue(itemId: string, value: unknown) {
    if (!checklistEditable) return;
    setChecklist((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, value } : i))
    );
    await fetch(`/api/work-orders/${initial.id}/checklist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId, value }),
    });
  }

  async function updateStatus(status: string) {
    if (status === "completed" && !workOrderChecklistIsCompleteForClosure(checklist)) {
      window.alert(
        "Marca todos los pasos y completa los campos obligatorios del checklist antes de completar la tarea."
      );
      return;
    }
    await fetch(`/api/work-orders/${initial.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    window.location.reload();
  }

  async function updateAssignees(nextIds: string[]) {
    if (!canEditAssignee || isCompleted) return;
    const previous = assigneeIds;
    setAssigneeIds(nextIds);
    setAssigneeSaving(true);
    try {
      const res = await fetch(`/api/work-orders/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeIds: nextIds }),
      });
      if (!res.ok) {
        setAssigneeIds(previous);
      }
    } catch {
      setAssigneeIds(previous);
    } finally {
      setAssigneeSaving(false);
    }
  }

  const displayedAssignees = useMemo(() => {
    return assigneeIds
      .map((id) => {
        const fromList = initial.assignees?.find((a) => a.id === id);
        if (fromList) return fromList;
        if (initial.assignee?.id === id) return initial.assignee;
        const u = assigneeUsers.find((x) => x.id === id);
        return u ? { id: u.id, name: u.name, avatarUrl: null as string | null } : null;
      })
      .filter((x): x is { id: string; name: string; avatarUrl?: string | null } => x != null);
  }, [assigneeIds, initial.assignees, initial.assignee, assigneeUsers]);

  async function submitComment() {
    const body = commentDraft.trim();
    if ((!body && commentFiles.length === 0) || commentSaving) return;
    setCommentSaving(true);
    setCommentsError(null);
    try {
      const formData = new FormData();
      formData.append("body", body);
      for (const file of commentFiles) {
        formData.append("files", file);
      }
      const res = await fetch(`/api/work-orders/${initial.id}/notes`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string })?.error ?? "No se pudo guardar el comentario."
        );
      }
      setCommentDraft("");
      setCommentFiles([]);
      if (commentFilesInputRef.current) commentFilesInputRef.current.value = "";
      setComments((prev) => [data as WorkOrderComment, ...prev]);
    } catch (error) {
      setCommentsError(error instanceof Error ? error.message : "No se pudo guardar el comentario.");
    } finally {
      setCommentSaving(false);
    }
  }

  async function onConfirmDeleteWorkOrder() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/work-orders/${initial.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDeleteError(
          typeof data.error === "string" ? data.error : "No se pudo eliminar la tarea."
        );
        setDeleteLoading(false);
        return;
      }
      setDeleteConfirmOpen(false);
      router.push("/tareas");
      router.refresh();
    } catch {
      setDeleteError("No se pudo eliminar la tarea.");
      setDeleteLoading(false);
    }
  }

  const pr = priorityDetail[initial.priority] ?? {
    Icon: Equal,
    className: "text-zinc-400",
    label: initial.priority,
  };
  const PriIcon = pr.Icon;

  const statusLabel =
    initial.status === "pending"
      ? "Pendiente"
      : initial.status === "in_progress"
        ? "En curso"
        : initial.status === "completed"
          ? "Completada"
          : initial.status === "cancelled"
            ? "Cancelada"
            : initial.status.replace("_", " ");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-2 sm:gap-3">
          <nav
            className="flex flex-wrap items-center gap-1 text-sm text-zinc-500"
            aria-label="Migas de pan"
          >
            <Link
              href="/tareas"
              className="inline-flex items-center gap-1 font-medium text-[#F14C03] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Tareas
            </Link>
            <span aria-hidden className="text-zinc-400">
              /
            </span>
            <span className="text-zinc-600">
              {initial.folio != null
                ? `Folio ${initial.folio}`
                : `Ref. ${initial.id.slice(0, 8)}…`}
            </span>
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!isCompleted && (
            <Link
              href={`/tareas/${initial.id}/edit`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 tap-target"
              aria-label="Editar tarea"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </Link>
          )}
          {canDeleteWorkOrder ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteConfirmOpen(true);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-red-50 hover:text-red-700 tap-target"
                aria-label="Eliminar tarea"
                title="Eliminar tarea"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <ConfirmDialog
                open={deleteConfirmOpen}
                title="Eliminar tarea"
                message={
                  deleteError ??
                  (isCompleted
                    ? `¿Eliminar la tarea completada «${initial.title}»? Se borrarán también comentarios, adjuntos y datos del checklist. Esta acción no se puede deshacer.`
                    : `¿Eliminar la tarea «${initial.title}»? Esta acción no se puede deshacer.`)
                }
                confirmLabel="Eliminar"
                onConfirm={() => void onConfirmDeleteWorkOrder()}
                onCancel={() => {
                  if (!deleteLoading) setDeleteConfirmOpen(false);
                }}
                loading={deleteLoading}
              />
            </>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <details
            open
            className="group rounded-xl border border-zinc-200 bg-white [&_summary::-webkit-details-marker]:hidden"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-zinc-900">
              <span>Descripción</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-180" />
            </summary>
            <div className="border-t border-zinc-100 px-4 py-4 text-sm leading-relaxed text-zinc-800">
              {initial.calendarSource ? (
                <p>
                  Generada desde calendario de mantenimiento:{" "}
                  <Link
                    href={initial.calendarSource.href}
                    className="font-medium text-primary-600 hover:underline"
                  >
                    {initial.calendarSource.name}
                  </Link>
                  .
                </p>
              ) : initial.description ? (
                <p className="whitespace-pre-wrap">{initial.description}</p>
              ) : (
                <p className="text-zinc-400">Sin descripción.</p>
              )}
            </div>
          </details>

      {checklist.length > 0 && (
        <section className="max-w-none rounded-xl border border-zinc-200 bg-white p-4">
          <div className="flex items-start justify-between gap-3">
            <h2 className="min-w-0 text-sm font-semibold text-zinc-900">
              Checklist
              {initial.checklistMeta ? ` · ${initial.checklistMeta.templateName}` : ""}
              {initial.checklistMeta?.revisionName
                ? ` · Revisión ${initial.checklistMeta.revisionName}`
                : initial.checklistMeta?.revisionNumber != null
                  ? ` · Revisión ${initial.checklistMeta.revisionNumber}`
                  : ""}
            </h2>
            {showChecklistEditToggle ? (
              <button
                type="button"
                onClick={() => setChecklistForceEdit((v) => !v)}
                className={`tap-target inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
                  checklistForceEdit
                    ? "border-primary-300 bg-primary-50 text-primary-800"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <Pencil className="h-3.5 w-3.5" aria-hidden />
                {checklistForceEdit ? "Listo" : "Editar"}
              </button>
            ) : null}
          </div>
          {!checklistEditable && initial.status === "pending" && (
            <p className="mb-2 mt-1 text-xs text-amber-700">
              Cambia el estado a <strong>En curso</strong> en el panel derecho para
              editar el checklist.
            </p>
          )}
          {checklistForceEdit && checklistEditable && !checklistUnlocked ? (
            <p className="mb-2 mt-1 text-xs text-primary-700">
              Modo edición activo. Los cambios se guardan al modificar cada campo.
            </p>
          ) : null}
          <ChecklistGroupedList
            flat={checklistOrdered}
            all={checklist}
            className="mt-3 space-y-5"
            collapseContextKey={initial.id}
            renderItem={(item, { insideSection }) => {
              const depth = checklistItemDepth(item, checklist);
              const padStyle = { paddingLeft: Math.min(depth, 8) * 16 };
              const rowPad = insideSection ? "py-3 px-4" : "";
              return item.type === "step" ? (
                <li
                  key={item.id}
                  style={padStyle}
                  className={`flex items-center gap-2 text-zinc-900 ${rowPad || "py-3"}`}
                >
                  {!checklistEditable ? (
                    <span className="text-zinc-600">
                      {item.completed ? (
                        <Check className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        toggleStep(item.id, !(item.completed ?? false))
                      }
                      className="tap-target text-zinc-600"
                      aria-label={item.completed ? "Marcar incompleto" : "Marcar completo"}
                    >
                      {item.completed ? (
                        <Check className="h-5 w-5 text-emerald-600" />
                      ) : (
                        <Square className="h-5 w-5" />
                      )}
                    </button>
                  )}
                  <span
                    className={
                      item.completed ? "text-zinc-500 line-through" : "text-zinc-900"
                    }
                  >
                    {item.label}
                  </span>
                </li>
              ) : item.type === "text_block" ? (
                <li key={item.id} style={padStyle} className={`text-zinc-900 ${rowPad || "py-3"}`}>
                  {item.fieldType === "title" ? (
                    <h3 className="text-lg font-semibold text-zinc-900">{item.label}</h3>
                  ) : item.fieldType === "subtitle" ? (
                    <h4 className="text-base font-semibold text-zinc-800">{item.label}</h4>
                  ) : (
                    <p className="text-sm leading-relaxed text-zinc-700">{item.label}</p>
                  )}
                </li>
              ) : (
                <li key={item.id} style={padStyle} className={`flex flex-col gap-1.5 text-zinc-900 ${rowPad || "py-3"}`}>
                  {item.fieldType !== "checkbox" ? (
                    <label className="text-sm font-medium text-zinc-700">
                      {item.label}
                      {item.isOptional ? (
                        <span className="ml-1 font-normal text-zinc-400">(opcional)</span>
                      ) : null}
                    </label>
                  ) : null}
                  {!checklistEditable ? (
                    <div className="text-zinc-900">
                      {item.fieldType === "checkbox" ? (
                        <div className="inline-flex min-h-11 w-full flex-wrap items-center gap-2 py-1">
                          {item.value === true ? (
                            <Check className="h-5 w-5 text-primary-600" />
                          ) : item.value === false ? (
                            <Square className="h-5 w-5 text-zinc-500" />
                          ) : item.isOptional ? (
                            <span className="text-sm text-zinc-400">Sin respuesta</span>
                          ) : (
                            <Square className="h-5 w-5 text-zinc-500" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              item.value === true
                                ? "text-zinc-500 line-through"
                                : "text-zinc-700"
                            }`}
                          >
                            {item.label}
                            {item.isOptional ? (
                              <span className="ml-1 font-normal text-zinc-400">(opcional)</span>
                            ) : null}
                          </span>
                        </div>
                      ) : item.fieldType === "photo" &&
                          checklistPhotoUrls(item.value).length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {checklistPhotoUrls(item.value).map((photoUrl) => (
                              <button
                                key={photoUrl}
                                type="button"
                                onClick={() =>
                                  setImageLightbox({
                                    src: photoUrl,
                                    alt: item.label || "Evidencia",
                                  })
                                }
                                className="tap-target rounded-lg border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                aria-label={`Ampliar evidencia: ${item.label}`}
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={photoUrl}
                                  alt=""
                                  className="pointer-events-none h-24 w-24 rounded-lg border border-zinc-200 object-cover"
                                />
                              </button>
                            ))}
                          </div>
                        ) : item.fieldType === "dropdown" &&
                          isCompleted &&
                          item.value != null &&
                          checklistDropdownValueIsNoOk(item.value) ? (
                          <span className="inline-flex max-w-full rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-sm font-semibold text-red-700">
                            {String(item.value)}
                          </span>
                        ) : item.value != null ? (
                          String(item.value)
                        ) : (
                          "—"
                        )}
                    </div>
                  ) : (
                    <>
                      {item.fieldType === "checkbox" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (item.isOptional) {
                              if (item.value === true) void updateFieldValue(item.id, false);
                              else if (item.value === false) void updateFieldValue(item.id, null);
                              else void updateFieldValue(item.id, true);
                            } else {
                              void updateFieldValue(item.id, !(item.value === true));
                            }
                          }}
                          className="inline-flex min-h-11 w-full items-center gap-2 rounded-md py-2 text-left hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                          aria-pressed={item.value === true}
                        >
                          {item.value === true ? (
                            <Check className="h-5 w-5 text-primary-600" />
                          ) : item.value === false ? (
                            <Square className="h-5 w-5 text-zinc-500" />
                          ) : (
                            <Square className="h-5 w-5 shrink-0 border border-dashed border-zinc-300 text-zinc-300" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              item.value === true
                                ? "text-zinc-500 line-through"
                                : "text-zinc-700"
                            }`}
                          >
                            {item.label}
                            {item.isOptional ? (
                              <span className="ml-1 block text-xs font-normal text-zinc-400">
                                Opcional: toque para Sí → No → vacío
                              </span>
                            ) : null}
                          </span>
                        </button>
                      )}
                      {item.fieldType === "text" && (
                        <input
                          type="text"
                          value={item.value != null ? String(item.value) : ""}
                          onChange={(e) =>
                            updateFieldValue(
                              item.id,
                              e.target.value === "" && item.isOptional ? null : e.target.value
                            )
                          }
                          placeholder={item.isOptional ? "Opcional" : "Escribir valor"}
                          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      )}
                      {item.fieldType === "number" && (
                        <input
                          type="number"
                          value={item.value != null ? Number(item.value) : ""}
                          onChange={(e) =>
                            updateFieldValue(item.id, e.target.value === "" ? null : Number(e.target.value))
                          }
                          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      )}
                      {item.fieldType === "date" && (
                        <input
                          type="date"
                          value={item.value != null ? String(item.value).slice(0, 10) : ""}
                          onChange={(e) => updateFieldValue(item.id, e.target.value || null)}
                          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      )}
                      {item.fieldType === "dropdown" && (
                        <select
                          value={item.value != null ? String(item.value) : ""}
                          onChange={(e) => updateFieldValue(item.id, e.target.value || null)}
                          className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-zinc-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="" className="bg-white text-zinc-900">
                            Seleccionar…
                          </option>
                          {(Array.isArray(item.options) ? item.options : []).map((opt: string) => (
                            <option key={opt} value={opt} className="bg-white text-zinc-900">
                              {opt}
                            </option>
                          ))}
                        </select>
                      )}
                      {item.fieldType === "photo" && (
                        <div className="space-y-2">
                          {checklistPhotoUrls(item.value).length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {checklistPhotoUrls(item.value).map((photoUrl, idx) => (
                                <div key={photoUrl} className="relative">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setImageLightbox({
                                        src: photoUrl,
                                        alt: item.label || "Previsualización",
                                      })
                                    }
                                    className="tap-target rounded-lg border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                    aria-label={`Ampliar: ${item.label}`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={photoUrl}
                                      alt=""
                                      className="pointer-events-none h-24 w-24 rounded-lg border border-zinc-200 object-cover"
                                    />
                                  </button>
                                  {checklistEditable && (
                                    <button
                                      type="button"
                                      onClick={() => removeChecklistPhoto(item.id, photoUrl)}
                                      className="tap-target absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
                                      aria-label={`Eliminar foto ${idx + 1}`}
                                      title="Eliminar foto"
                                    >
                                      ×
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={uploading}
                            onChange={(e) => onChecklistPhotoSelected(item.id, e)}
                            className="text-sm text-zinc-600 file:mr-2 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary-700"
                          />
                        </div>
                      )}
                      {item.fieldType !== "checkbox" && item.fieldType !== "text" && item.fieldType !== "number" && item.fieldType !== "date" && item.fieldType !== "dropdown" && item.fieldType !== "photo" && (
                        <p className="text-zinc-900">
                          {item.value != null ? String(item.value) : "—"}
                        </p>
                      )}
                    </>
                  )}
                </li>
              );
            }}
          />
          {checklistUnlocked && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => updateStatus("completed")}
                className="rounded-lg bg-emerald-600 py-2 px-3 text-sm font-medium text-white tap-target hover:bg-emerald-700"
              >
                Completar tarea
              </button>
            </div>
          )}
        </section>
      )}

          <section className="order-last rounded-xl border border-zinc-200 bg-white p-3 md:p-4 lg:order-none">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-zinc-900">Comentarios y evidencias</h2>
            </div>
            <div className="space-y-1.5">
              <textarea
                value={commentDraft}
                onChange={(e) => setCommentDraft(e.target.value)}
                placeholder="Escribe un comentario..."
                rows={2}
                className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input
                    ref={commentFilesInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (!files) return;
                      setCommentFiles(Array.from(files));
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => commentFilesInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 tap-target"
                  >
                    <ImagePlus className="h-3.5 w-3.5" />
                    Adjuntar
                  </button>
                  {commentFiles.length > 0 ? (
                    <span className="text-xs text-zinc-500">
                      {commentFiles.length} archivo(s) seleccionado(s)
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void submitComment()}
                  disabled={commentSaving || (commentDraft.trim().length === 0 && commentFiles.length === 0)}
                  className="rounded-lg bg-[#F14C03] px-2.5 py-1.5 text-xs font-medium text-white tap-target hover:bg-[#D84402] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {commentSaving ? "Enviando..." : "Comentar"}
                </button>
              </div>
            </div>
            {commentsError ? <p className="mt-2 text-xs text-red-600">{commentsError}</p> : null}
            <div className="mt-2 max-h-72 overflow-y-auto pr-1">
              {commentsLoading ? (
                <p className="text-xs text-zinc-500">Cargando comentarios...</p>
              ) : comments.length === 0 ? (
                <p className="text-xs text-zinc-500">Aún no hay comentarios.</p>
              ) : (
                <ul className="space-y-1.5">
                  {comments.map((comment) => {
                    const parsed = parseCommentBody(comment.body);
                    return (
                      <li key={comment.id} className="rounded-lg border border-zinc-200 p-2">
                        <div className="flex items-start gap-2">
                          <UserAvatar
                            userId={comment.user?.id ?? comment.id}
                            name={comment.user?.name ?? "Usuario"}
                            avatarUrl={comment.user?.avatarUrl ?? null}
                            size="sm"
                            className="!h-7 !w-7 !text-[9px]"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-zinc-500">
                              <span className="font-medium text-zinc-800">
                                {comment.user?.name ?? "Usuario"}
                              </span>
                              <span>•</span>
                              <span>{formatDate(comment.createdAt)}</span>
                            </div>
                            {parsed.text ? (
                              <p className="mt-0.5 whitespace-pre-wrap text-xs text-zinc-800">
                                {parsed.text}
                              </p>
                            ) : null}
                            {parsed.attachments.length > 0 ? (
                              <ul className="mt-1.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                                {parsed.attachments.map((attachment) => (
                                  <li
                                    key={`${comment.id}-${attachment.fileUrl}`}
                                    className="overflow-hidden rounded-md border border-zinc-200"
                                  >
                                    {isImageAttachment(attachment.filename, attachment.fileUrl) ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setImageLightbox({
                                            src: attachment.fileUrl,
                                            alt: attachment.filename || "Evidencia",
                                          })
                                        }
                                        className="tap-target block w-full rounded-md border border-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
                                        aria-label={`Ampliar evidencia: ${attachment.filename}`}
                                      >
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img
                                          src={attachment.fileUrl}
                                          alt=""
                                          className="h-24 w-full object-cover"
                                        />
                                      </button>
                                    ) : (
                                      <a
                                        href={attachment.fileUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="tap-target flex aspect-square w-full flex-col items-center justify-center gap-1 bg-zinc-50 px-2 text-zinc-600 hover:bg-zinc-100"
                                      >
                                        <FileText className="h-5 w-5 text-zinc-500" aria-hidden />
                                        <span className="line-clamp-2 text-center text-[10px] font-medium">
                                          Archivo
                                        </span>
                                      </a>
                                    )}
                                    <p
                                      title={attachment.filename}
                                      className="truncate px-1 py-0.5 text-[10px] text-zinc-500"
                                    >
                                      {attachment.filename}
                                    </p>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

        </div>

        <aside className="order-first w-full shrink-0 space-y-4 lg:order-none lg:sticky lg:top-4 lg:w-72 xl:w-80">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
            <label
              htmlFor="wo-status"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500"
            >
              Estado
            </label>
            {isCompleted || initial.status === "cancelled" ? (
              <div
                className="inline-flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-sm font-semibold"
                style={workOrderStatusBadgeStyle(initial.status, statusColors)}
              >
                {statusLabel}
              </div>
            ) : (
              <select
                id="wo-status"
                value={initial.status}
                onChange={(e) => updateStatus(e.target.value)}
                className="w-full cursor-pointer rounded-lg border-2 py-2.5 pl-3 pr-8 text-sm font-semibold shadow-sm focus:outline-none focus:ring-2"
                style={workOrderStatusSelectStyle(initial.status, statusColors)}
              >
                <option value="pending">Pendiente</option>
                <option value="in_progress">En progreso</option>
                <option value="completed">Terminada</option>
                <option value="cancelled">Cancelada</option>
              </select>
            )}
          </div>

          {!isCancelled && workOrderAsset ? (
            <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Paro de máquina
              </h3>
              {machineDowntimeBlocked ? (
                <p className="mb-3 text-sm text-zinc-600">
                  El seguimiento de paro está desactivado para la máquina asignada. Actívalo en{" "}
                  <Link href={`/assets/${workOrderAsset.id}/edit`} className="font-medium text-primary-600 hover:underline">
                    editar máquina
                  </Link>
                  .
                </p>
              ) : null}
              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-800">
                <input
                  type="checkbox"
                  className="tap-target mt-0.5 h-4 w-4 shrink-0 rounded border-zinc-300 text-primary-600 focus:ring-primary-500"
                  checked={countsMachineDowntime}
                  disabled={downtimeSaving || machineDowntimeBlocked}
                  onChange={(e) => void onToggleCountsDowntime(e.target.checked)}
                />
                <span>
                  Contar el tiempo por lo que dure esta tarea en progreso como paro de máquina
                </span>
              </label>
              {countsMachineDowntime ? (
                <p className="mt-2 text-xs text-zinc-600">
                  Paro automático (vista previa):{" "}
                  <span className="font-medium text-zinc-900">
                    {formatDowntimeMinutesSpanish(autoDowntimePreviewMinutes)}
                  </span>
                  {initial.status === "in_progress" ? (
                    <span className="text-zinc-400"> · se actualiza cada minuto</span>
                  ) : null}
                </p>
              ) : null}
              {isCompleted && countsMachineDowntime ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Al cerrar la tarea, este intervalo se sumó al total de la máquina (si estaba
                  vinculada).
                </p>
              ) : null}

              <div className="mt-4 border-t border-zinc-100 pt-3">
                <p className="text-xs font-medium text-zinc-700">Paro manual adicional</p>
                <p className="mt-0.5 text-[11px] leading-snug text-zinc-500">
                  Por ejemplo paro sin checklist o no cubierto por el tiempo en curso. Se guarda en
                  minutos (o horas abajo).
                </p>
                <div className="mt-2 flex flex-wrap items-end gap-2">
                  <div className="min-w-0 flex-1">
                    <label htmlFor="wo-manual-downtime" className="sr-only">
                      Cantidad de paro manual
                    </label>
                    <input
                      id="wo-manual-downtime"
                      type="text"
                      inputMode="decimal"
                      value={manualAmountDraft}
                      disabled={downtimeSaving || machineDowntimeBlocked}
                      onChange={(e) => setManualAmountDraft(e.target.value)}
                      className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                    />
                  </div>
                  <select
                    value={manualUnit}
                    disabled={downtimeSaving || machineDowntimeBlocked}
                    onChange={(e) => setManualUnit(e.target.value as "min" | "h")}
                    className="rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900"
                    aria-label="Unidad"
                  >
                    <option value="min">Minutos</option>
                    <option value="h">Horas</option>
                  </select>
                  <button
                    type="button"
                    disabled={downtimeSaving || machineDowntimeBlocked}
                    onClick={() => void onSaveManualDowntime()}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-800 disabled:opacity-50 tap-target"
                  >
                    Guardar
                  </button>
                </div>
                {initial.status === "completed" ? (
                  <p className="mt-2 text-[11px] text-zinc-500">
                    Guardado:{" "}
                    <span className="font-medium text-zinc-800">
                      {formatDowntimeMinutesSpanish(
                        Math.max(0, Math.floor(Number(initial.manualDowntimeMinutes ?? 0)))
                      )}
                    </span>
                  </p>
                ) : null}
              </div>

              {downtimeError ? (
                <p className="mt-2 text-xs text-red-600">{downtimeError}</p>
              ) : null}
            </div>
          ) : null}

          <details
            ref={detailsPanelRef}
            className="group overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between border-b border-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
              <span>Detalles</span>
              <ChevronDown className="h-4 w-4 shrink-0 text-zinc-400 transition group-open:rotate-180" />
            </summary>
            <div className="divide-y divide-zinc-100 px-4">
              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <span className="text-zinc-500">Tipo</span>
                <div className="min-w-0">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${workOrderKindBadgeClass(
                      kind
                    )}`}
                  >
                    {workOrderKindLabel(kind)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <span className="text-zinc-500">Prioridad</span>
                <div className="flex min-w-0 items-center gap-2 font-medium text-zinc-900">
                  <PriIcon
                    className={`h-4 w-4 shrink-0 ${pr.className}`}
                    strokeWidth={2.5}
                    aria-hidden
                  />
                  <span>{pr.label}</span>
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <div className="flex items-center gap-1.5 text-zinc-500">
                  <span>Asignado</span>
                  {canEditAssignee && !isCompleted && !assigneePickerOpen ? (
                    <button
                      type="button"
                      disabled={assigneeSaving}
                      onClick={() => setAssigneePickerOpen(true)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-50 tap-target"
                      aria-label="Editar responsables"
                      title="Editar responsables"
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden />
                    </button>
                  ) : null}
                </div>
                <div className="min-w-0">
                  {canEditAssignee ? (
                    <div className="space-y-2">
                      {displayedAssignees.length > 0 ? (
                        <ul className="flex flex-col gap-2">
                          {displayedAssignees.map((a) => (
                            <li key={a.id}>
                              <Link
                                href={`/equipo/${a.id}`}
                                className="flex min-w-0 items-center gap-2 rounded-md py-0.5 pr-1 -my-0.5 transition hover:bg-zinc-50"
                              >
                                <UserAvatar
                                  userId={a.id}
                                  name={a.name}
                                  avatarUrl={a.avatarUrl}
                                  size="sm"
                                  className="!h-8 !w-8 !text-[10px]"
                                />
                                <span className="truncate text-sm font-medium text-zinc-900">
                                  {a.name}
                                </span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-sm text-zinc-400">Sin asignar</span>
                      )}
                    </div>
                  ) : displayedAssignees.length > 0 ? (
                    <ul className="flex flex-col gap-2">
                      {displayedAssignees.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/equipo/${a.id}`}
                            className="flex min-w-0 items-center gap-2 rounded-md py-0.5 pr-1 -my-0.5 transition hover:bg-zinc-50"
                          >
                            <UserAvatar
                              userId={a.id}
                              name={a.name}
                              avatarUrl={a.avatarUrl}
                              size="sm"
                              className="!h-8 !w-8 !text-[10px]"
                            />
                            <span className="truncate text-sm font-medium text-zinc-900">
                              {a.name}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <span className="text-sm text-zinc-400">Sin asignar</span>
                  )}
                </div>
              </div>

              {initial.requester ? (
                <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                  <span className="text-zinc-500">Solicitante</span>
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar
                      userId={initial.requester.id}
                      name={initial.requester.name}
                      avatarUrl={initial.requester.avatarUrl}
                      size="sm"
                      className="!h-8 !w-8 !text-[10px]"
                    />
                    <span className="truncate font-medium text-zinc-900">
                      {initial.requester.name}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <label htmlFor="wo-asset" className="text-zinc-500">
                  Máquina
                </label>
                <div className="min-w-0 space-y-1.5">
                  {canEditAsset ? (
                    <WorkOrderAssetSelect
                      id="wo-asset"
                      value={workOrderAssetId}
                      assets={assetsList}
                      loading={assetsLoading}
                      disabled={assetSaving}
                      onChange={(id) => void saveWorkOrderAsset(id)}
                    />
                  ) : workOrderAsset ? (
                    <Link
                      href={`/assets/${workOrderAsset.id}`}
                      className="font-medium text-[#F14C03] hover:underline"
                    >
                      <span className="block truncate">{workOrderAsset.name}</span>
                      <span className="text-xs font-normal text-zinc-500">
                        {workOrderAsset.assetId}
                      </span>
                    </Link>
                  ) : (
                    <span className="text-sm text-zinc-400">Sin máquina</span>
                  )}
                  {assetError ? (
                    <p className="text-xs text-red-600">{assetError}</p>
                  ) : null}
                  {canEditAsset && !workOrderAssetId ? (
                    <p className="text-xs text-zinc-500">
                      Asigna una máquina para registrar paro y vincular la tarea al activo.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <span className="text-zinc-500">Inicio</span>
                <span className="font-medium text-zinc-900">
                  {initial.startDate ? formatDate(initial.startDate) : "—"}
                </span>
              </div>

              <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                <span className="text-zinc-500">Vencimiento</span>
                <span className="font-medium text-zinc-900">
                  {formatDate(initial.dueDate)}
                </span>
              </div>

              {workOrderShouldShowElapsed(initial.status, initial.startedAt) ? (
                (() => {
                  void durationTick;
                  const nowMs = Date.now();
                  const compact = formatWorkOrderElapsedCompact(
                    initial.startedAt,
                    initial.status,
                    initial.completedAt,
                    nowMs
                  );
                  const verbose = formatWorkOrderElapsedLabel(
                    initial.startedAt,
                    initial.status,
                    initial.completedAt,
                    nowMs
                  );
                  const label =
                    initial.status === "completed"
                      ? "Tiempo total"
                      : "Tiempo transcurrido";
                  return (
                    <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                      <span className="flex items-center gap-1.5 text-zinc-500">
                        <Clock className="h-4 w-4 shrink-0 text-zinc-400" aria-hidden />
                        {label}
                      </span>
                      <div className="min-w-0 text-zinc-900">
                        <span
                          className="block tabular-nums tracking-tight"
                          title={verbose}
                        >
                          {compact}
                        </span>
                        {initial.status === "in_progress" ? (
                          <span className="mt-1 block text-xs text-zinc-400">
                            Desde que pasó a en progreso. Actualización cada minuto.
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })()
              ) : null}

              {initial.status === "completed" && initial.completedAt ? (
                <div className="grid grid-cols-[minmax(0,40%)_1fr] gap-3 py-3 text-sm">
                  <span className="text-zinc-500">Completada</span>
                  <div className="min-w-0 space-y-1">
                    {canEditCompletedAt ? (
                      <>
                        <input
                          type="datetime-local"
                          value={completedAtDraft}
                          disabled={completedAtSaving}
                          onChange={(e) => {
                            setCompletedAtDraft(e.target.value);
                            setCompletedAtError(null);
                          }}
                          onBlur={() => void saveCompletedAtDraft()}
                          className="tap-target w-full max-w-full rounded-md border border-zinc-200 bg-white px-2 py-1.5 font-medium text-zinc-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-60"
                          aria-label="Fecha de completado"
                        />
                        {completedAtError ? (
                          <p className="text-xs text-red-600">{completedAtError}</p>
                        ) : null}
                      </>
                    ) : (
                      <span className="font-medium text-zinc-900">
                        {formatDate(initial.completedAt)}
                      </span>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </details>
        </aside>
      </div>

      {assigneePickerOpen && canEditAssignee ? (
        <div
          className="fixed inset-0 z-[150] flex items-end justify-center sm:items-center sm:p-4"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/60 transition-opacity"
            aria-label="Cerrar"
            onClick={() => setAssigneePickerOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="wo-assignee-modal-title"
            className="relative z-10 flex max-h-[min(90dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border border-zinc-200 border-b-0 bg-white shadow-xl sm:rounded-xl sm:border-b"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
              <h2
                id="wo-assignee-modal-title"
                className="text-base font-semibold tracking-tight text-zinc-900"
              >
                Responsables
              </h2>
              <button
                type="button"
                onClick={() => setAssigneePickerOpen(false)}
                className="tap-target rounded-lg border border-zinc-300 p-1.5 text-zinc-600 hover:bg-zinc-100"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              <AssigneeMultiSelect
                id="wo-assignee-modal-select"
                users={assigneeUsers}
                value={assigneeIds}
                onChange={(next) => void updateAssignees(next)}
                disabled={assigneeSaving}
                label=""
                emptyHint="Sin asignar"
              />
            </div>
            <div className="shrink-0 border-t border-zinc-100 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:pb-4">
              <button
                type="button"
                onClick={() => setAssigneePickerOpen(false)}
                className="w-full rounded-xl bg-primary-600 py-3 text-sm font-medium text-white hover:bg-primary-700 tap-target"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {imageLightbox ? (
        <div
          className="fixed inset-0 z-[200] flex flex-col bg-zinc-950/95"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada"
        >
          <div className="flex shrink-0 items-center justify-between gap-3 px-3 py-3 sm:px-4">
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">
              {imageLightbox.alt}
            </p>
            <button
              type="button"
              onClick={() => setImageLightbox(null)}
              className="tap-target shrink-0 rounded-lg p-2 text-white hover:bg-white/10"
              aria-label="Cerrar"
            >
              <X className="h-6 w-6" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className="flex min-h-0 flex-1 items-center justify-center p-4 pt-0"
            onClick={() => setImageLightbox(null)}
            aria-label="Cerrar vista ampliada"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageLightbox.src}
              alt={imageLightbox.alt}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </button>
        </div>
      ) : null}
    </div>
  );
}
