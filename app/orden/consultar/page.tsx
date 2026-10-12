"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { parsePublicOrderLookup } from "@/lib/public-order-lookup";
import { buildPublicOrderTimeline } from "@/lib/public-order-timeline";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/work-order-status-colors";

type PublicComment = {
  id: string;
  createdAt: string;
  authorName: string;
  text: string;
  inlineFiles: { filename: string; url: string }[];
};

type EmailMatch = {
  folio: string;
  title: string;
  status: string;
  createdAt: string | null;
  assetName: string | null;
  assetCode: string | null;
};

type FolioLookupResult = {
  folio: string;
  title: string;
  status: string;
  priority: string;
  kind: string;
  assetName: string | null;
  assetCode: string | null;
  createdAt: string | null;
  dueDate: string | null;
  startedAt: string | null;
  completedAt: string | null;
  comments: PublicComment[];
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-amber-100 text-amber-950",
  in_progress: "bg-sky-100 text-sky-950",
  completed: "bg-emerald-100 text-emerald-950",
  cancelled: "bg-zinc-200 text-zinc-700",
};

const TIMELINE_DOT: Record<string, string> = {
  created: "bg-primary-600",
  started: "bg-sky-500",
  comment: "bg-zinc-400",
  completed: "bg-emerald-600",
  cancelled: "bg-zinc-500",
};

function formatPublicDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  });
}

function statusLabel(status: string) {
  return status in WORK_ORDER_STATUS_LABELS
    ? WORK_ORDER_STATUS_LABELS[status as keyof typeof WORK_ORDER_STATUS_LABELS]
    : status;
}

function isLikelyImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i.test(filename);
}

function isLikelyPdf(filename: string): boolean {
  return /\.pdf$/i.test(filename);
}

function normalizeLookupPayload(raw: Record<string, unknown>): FolioLookupResult {
  return {
    folio: raw.folio == null ? "" : String(raw.folio),
    title: String(raw.title ?? ""),
    status: String(raw.status ?? ""),
    priority: String(raw.priority ?? ""),
    kind: String(raw.kind ?? ""),
    assetName: raw.assetName != null ? String(raw.assetName) : null,
    assetCode: raw.assetCode != null ? String(raw.assetCode) : null,
    createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
    dueDate: raw.dueDate != null ? String(raw.dueDate) : null,
    startedAt: raw.startedAt != null ? String(raw.startedAt) : null,
    completedAt: raw.completedAt != null ? String(raw.completedAt) : null,
    comments: Array.isArray(raw.comments) ? (raw.comments as PublicComment[]) : [],
  };
}

function ticketFromResult(result: FolioLookupResult): EmailMatch {
  return {
    folio: result.folio,
    title: result.title,
    status: result.status,
    createdAt: result.createdAt,
    assetName: result.assetName,
    assetCode: result.assetCode,
  };
}

function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CHIP[status] ?? "bg-zinc-100 text-zinc-700"}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function FileThumbOrLink({ filename, url }: { filename: string; url: string }) {
  if (isLikelyImageFile(filename)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="tap-target overflow-hidden rounded-md border border-zinc-200 bg-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="aspect-square h-24 w-full object-cover" />
        <p className="truncate px-1 py-0.5 text-center text-[10px] text-zinc-600" title={filename}>
          {filename}
        </p>
      </a>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="tap-target flex flex-col items-center justify-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-3 text-primary-700 hover:bg-zinc-100"
    >
      <span className="text-xs font-semibold">{isLikelyPdf(filename) ? "PDF" : "Archivo"}</span>
      <span className="line-clamp-2 text-center text-[10px] text-zinc-600" title={filename}>
        {filename}
      </span>
    </a>
  );
}

function ConsultarOrdenForm() {
  const searchParams = useSearchParams();
  const [folioLookup, setFolioLookup] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<FolioLookupResult | null>(null);
  const [emailMatches, setEmailMatches] = useState<EmailMatch[] | null>(null);

  async function lookupFolio(folio: string) {
    const params = new URLSearchParams({ folio });
    const res = await fetch(`/api/solicitud?${params.toString()}`);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      setLookupError(
        typeof data.error === "string" ? data.error : "No se pudo consultar el folio."
      );
      return;
    }
    setLookupResult(normalizeLookupPayload(data));
  }

  async function lookupEmail(email: string) {
    const params = new URLSearchParams({ email });
    const res = await fetch(`/api/solicitud?${params.toString()}`);
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      setLookupError(
        typeof data.error === "string" ? data.error : "No se pudo consultar el email."
      );
      return;
    }
    const orders = Array.isArray(data.orders) ? (data.orders as EmailMatch[]) : [];
    if (orders.length === 0) {
      setLookupError("No se encontró una orden con ese email.");
      return;
    }
    setEmailMatches(orders);
    const first = orders[0];
    if (first?.folio != null) {
      await lookupFolio(String(first.folio));
    }
  }

  async function runLookup(raw: string) {
    setLookupError(null);
    setLookupResult(null);
    setEmailMatches(null);
    const parsed = parsePublicOrderLookup(raw);
    if (!parsed.ok) {
      setLookupError(parsed.error);
      return;
    }
    setLookupLoading(true);
    try {
      if (parsed.value.kind === "email") {
        await lookupEmail(parsed.value.email);
      } else {
        await lookupFolio(String(parsed.value.folio));
      }
    } catch {
      setLookupError("No se pudo consultar la orden.");
    } finally {
      setLookupLoading(false);
    }
  }

  useEffect(() => {
    const folio = searchParams.get("folio")?.trim() ?? "";
    const email = searchParams.get("email")?.trim() ?? "";
    const q = folio || email;
    if (!q) return;
    setFolioLookup(q);
    void runLookup(q);
    // The query string is the only trigger; runLookup closes over the latest fetch helpers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function onLookupFolio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await runLookup(folioLookup);
  }

  async function openEmailMatch(folio: string) {
    setLookupError(null);
    setLookupLoading(true);
    try {
      await lookupFolio(String(folio));
    } catch {
      setLookupError("No se pudo consultar el folio.");
    } finally {
      setLookupLoading(false);
    }
  }

  const tickets =
    emailMatches ?? (lookupResult ? [ticketFromResult(lookupResult)] : []);
  const events = lookupResult
    ? buildPublicOrderTimeline({
        status: lookupResult.status,
        createdAt: lookupResult.createdAt,
        startedAt: lookupResult.startedAt,
        completedAt: lookupResult.completedAt,
        comments: lookupResult.comments,
      })
    : [];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col overflow-x-hidden">
      <header className="border-b border-zinc-200 bg-white px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-500">MSA</p>
            <h1 className="text-xl font-semibold text-zinc-900">Consultar orden de trabajo</h1>
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/orden" className="font-medium text-primary-700 hover:underline">
              Crear orden
            </Link>
            <Link href="/" className="font-medium text-zinc-600 hover:underline">
              Inicio
            </Link>
          </div>
        </div>
        <form onSubmit={onLookupFolio} className="mt-4 flex w-full min-w-0 flex-col gap-2 sm:flex-row">
          <label htmlFor="folioConsulta" className="sr-only">
            Folio o email
          </label>
          <input
            id="folioConsulta"
            name="folioConsulta"
            type="text"
            autoComplete="off"
            placeholder="Folio o email · Ej. OT-12, 2009 o ana@correo.com"
            value={folioLookup}
            onChange={(e) => setFolioLookup(e.target.value)}
            className="w-full min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-sm text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <button
            type="submit"
            disabled={lookupLoading}
            className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white tap-target hover:bg-primary-700 disabled:opacity-60"
          >
            {lookupLoading ? "Buscando..." : "Consultar"}
          </button>
        </form>
        {lookupError ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{lookupError}</p>
        ) : (
          <p className="mt-3 text-xs text-zinc-500">
            El folio abre una orden. El email de contacto lista todas las que registraste.
          </p>
        )}
      </header>

      <div className="grid min-w-0 flex-1 gap-4 p-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start">
        <section
          aria-label="Órdenes"
          className="min-w-0 overflow-hidden rounded-xl border border-zinc-200 bg-white"
        >
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-zinc-900">Órdenes</h2>
            <span className="text-xs text-zinc-500">{tickets.length}</span>
          </div>
          {tickets.length === 0 ? (
            <p className="px-4 py-8 text-sm text-zinc-500">
              {lookupLoading
                ? "Buscando órdenes..."
                : "Aquí aparecen las órdenes de tu búsqueda."}
            </p>
          ) : (
            <ul className="max-h-[70vh] divide-y divide-zinc-100 overflow-y-auto">
              {tickets.map((order) => {
                const selected = lookupResult?.folio === order.folio;
                return (
                  <li key={order.folio}>
                    <button
                      type="button"
                      onClick={() => void openEmailMatch(order.folio)}
                      aria-current={selected ? "true" : undefined}
                      className={`w-full px-4 py-3 text-left tap-target ${
                        selected
                          ? "bg-primary-50 shadow-[inset_3px_0_0_0_#F14C03]"
                          : "hover:bg-zinc-50"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-primary-800">
                          {order.folio}
                        </span>
                        <span className="shrink-0">
                          <StatusChip status={order.status} />
                        </span>
                      </span>
                      <span className="mt-1 block text-sm font-medium text-zinc-900">
                        {order.title}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-zinc-500">
                        {order.assetName
                          ? `${order.assetName}${order.assetCode ? ` · ${order.assetCode}` : ""}`
                          : "Sin máquina"}
                        {order.createdAt ? ` · ${formatPublicDate(order.createdAt)}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-label="Resumen de la orden" className="min-w-0">
          {!lookupResult ? (
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center">
              <p className="text-sm font-medium text-zinc-800">
                {lookupLoading ? "Cargando el estado..." : "Selecciona una orden"}
              </p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
                El resumen y la actividad quedan aquí: registro, inicio, comentarios y cierre.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <article className="rounded-xl border border-zinc-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-sm font-semibold text-primary-800">
                      {lookupResult.folio}
                    </p>
                    <h2 className="mt-1 text-xl font-semibold text-zinc-900">
                      {lookupResult.title}
                    </h2>
                  </div>
                  <StatusChip status={lookupResult.status} />
                </div>
                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <SummaryItem
                    label="Máquina"
                    value={
                      lookupResult.assetName
                        ? `${lookupResult.assetName}${lookupResult.assetCode ? ` (${lookupResult.assetCode})` : ""}`
                        : "—"
                    }
                  />
                  <SummaryItem
                    label="Prioridad"
                    value={PRIORITY_LABEL[lookupResult.priority] ?? lookupResult.priority || "—"}
                  />
                  <SummaryItem label="Registrada" value={formatPublicDate(lookupResult.createdAt)} />
                  <SummaryItem label="Compromiso" value={formatPublicDate(lookupResult.dueDate)} />
                  <SummaryItem label="Inicio" value={formatPublicDate(lookupResult.startedAt)} />
                  <SummaryItem
                    label={lookupResult.status === "cancelled" ? "Cierre" : "Completada"}
                    value={formatPublicDate(lookupResult.completedAt)}
                  />
                </dl>
              </article>

              <article className="rounded-xl border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-900">Actividad</h3>
                {events.length === 0 ? (
                  <p className="mt-3 text-sm text-zinc-500">Todavía no hay actividad registrada.</p>
                ) : (
                  <ol className="mt-4 space-y-0">
                    {events.map((event, index) => (
                      <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {index < events.length - 1 ? (
                          <span
                            className="absolute bottom-0 left-[7px] top-4 w-px bg-zinc-200"
                            aria-hidden
                          />
                        ) : null}
                        <span
                          className={`relative z-10 mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ${TIMELINE_DOT[event.kind] ?? "bg-zinc-400"}`}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2">
                            <p className="text-sm font-medium text-zinc-900">{event.title}</p>
                            <time className="text-xs text-zinc-500" dateTime={event.at}>
                              {formatPublicDate(event.at)}
                            </time>
                          </div>
                          {event.authorName ? (
                            <p className="text-xs text-zinc-500">{event.authorName}</p>
                          ) : null}
                          {event.detail ? (
                            <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
                              {event.detail}
                            </p>
                          ) : null}
                          {event.files.length > 0 ? (
                            <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                              {event.files.map((file) => (
                                <li key={`${event.id}-${file.url}`}>
                                  <FileThumbOrLink filename={file.filename} url={file.url} />
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </article>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-50 px-3 py-2">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 text-sm text-zinc-900">{value}</dd>
    </div>
  );
}

export default function ConsultarOrdenPage() {
  return (
    <div className="min-h-screen bg-zinc-200">
      <Suspense
        fallback={
          <div className="mx-auto max-w-lg py-8 text-center text-sm text-zinc-600">Cargando...</div>
        }
      >
        <ConsultarOrdenForm />
      </Suspense>
    </div>
  );
}
