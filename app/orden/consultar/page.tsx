"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { parsePublicOrderLookup } from "@/lib/public-order-lookup";

type PublicComment = {
  id: string;
  createdAt: string;
  authorName: string;
  text: string;
  inlineFiles: { filename: string; url: string }[];
};

type EmailMatch = {
  folio: number;
  title: string;
  status: string;
  createdAt: string | null;
  assetName: string | null;
  assetCode: string | null;
};

type FolioLookupResult = {
  folio: number;
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

function formatPublicDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: APP_TIME_ZONE,
  });
}

function isLikelyImageFile(filename: string): boolean {
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|avif)$/i.test(filename);
}

function isLikelyPdf(filename: string): boolean {
  return /\.pdf$/i.test(filename);
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const KIND_LABEL: Record<string, string> = {
  routine: "Programada",
  on_demand: "Bajo demanda",
};

function normalizeLookupPayload(raw: Record<string, unknown>): FolioLookupResult {
  return {
    folio: Number(raw.folio),
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
        <img src={url} alt="" className="aspect-square h-28 w-full object-cover" />
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

  useEffect(() => {
    const folio = searchParams.get("folio")?.trim() ?? "";
    const email = searchParams.get("email")?.trim() ?? "";
    const q = folio || email;
    if (q) {
      setFolioLookup(q);
      setLookupResult(null);
      setEmailMatches(null);
      setLookupError(null);
    }
  }, [searchParams]);

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
    if (orders.length === 1 && orders[0]?.folio != null) {
      await lookupFolio(String(orders[0].folio));
    }
  }

  async function onLookupFolio(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLookupError(null);
    setLookupResult(null);
    setEmailMatches(null);
    const parsed = parsePublicOrderLookup(folioLookup);
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

  async function openEmailMatch(folio: number) {
    setLookupError(null);
    setLookupResult(null);
    setLookupLoading(true);
    try {
      await lookupFolio(String(folio));
    } catch {
      setLookupError("No se pudo consultar el folio.");
    } finally {
      setLookupLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-zinc-900">Consultar orden</h1>
        <p className="text-sm text-zinc-600">
          Busca por folio. Si no lo recuerdas, usa el email de contacto con el que
          creaste la orden.
        </p>
      </header>

      <section
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4"
        aria-labelledby="folio-lookup-heading"
      >
        <h2 id="folio-lookup-heading" className="sr-only">
          Búsqueda por folio o email
        </h2>
        <form onSubmit={onLookupFolio} className="space-y-3">
          <div>
            <label htmlFor="folioConsulta" className="mb-1 block text-sm font-medium text-zinc-700">
              Folio o email
            </label>
            <input
              id="folioConsulta"
              name="folioConsulta"
              type="text"
              autoComplete="off"
              placeholder="Ej. 2009 o ana@correo.com"
              value={folioLookup}
              onChange={(e) => setFolioLookup(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          {lookupError ? (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{lookupError}</p>
          ) : null}
          <button
            type="submit"
            disabled={lookupLoading}
            className="w-full rounded-xl border border-primary-600 bg-white px-4 py-3 font-medium text-primary-600 tap-target hover:bg-primary-50 disabled:opacity-60"
          >
            {lookupLoading ? "Buscando..." : "Consultar"}
          </button>
        </form>
        {emailMatches && emailMatches.length > 1 ? (
          <ul className="space-y-2">
            <li className="text-xs text-zinc-500">
              Estas órdenes usan ese email. Elige una para ver el detalle.
            </li>
            {emailMatches.map((order) => (
              <li key={order.folio}>
                <button
                  type="button"
                  onClick={() => openEmailMatch(order.folio)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-left text-sm hover:border-primary-300 hover:bg-white"
                >
                  <span className="font-semibold text-zinc-900">Folio {order.folio}</span>
                  <span className="mt-0.5 block text-zinc-800">{order.title}</span>
                  <span className="mt-0.5 block text-xs text-zinc-500">
                    {STATUS_LABEL[order.status] ?? order.status}
                    {order.assetName
                      ? ` · ${order.assetName}${order.assetCode ? ` (${order.assetCode})` : ""}`
                      : ""}
                    {order.createdAt ? ` · ${formatPublicDate(order.createdAt)}` : ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {lookupResult ? (
          <div className="space-y-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-800">
            <dl className="space-y-2">
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500">Folio</dt>
                <dd className="font-semibold text-zinc-900">{lookupResult.folio}</dd>
              </div>
              <div>
                <dt className="text-zinc-500">Titulo</dt>
                <dd className="mt-0.5 font-medium">{lookupResult.title}</dd>
              </div>
              {lookupResult.assetName ? (
                <div>
                  <dt className="text-zinc-500">Máquina</dt>
                  <dd className="mt-0.5">
                    {lookupResult.assetName}
                    {lookupResult.assetCode ? ` (${lookupResult.assetCode})` : ""}
                  </dd>
                </div>
              ) : null}
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500">Estado</dt>
                <dd>{STATUS_LABEL[lookupResult.status] ?? lookupResult.status}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500">Prioridad</dt>
                <dd>{PRIORITY_LABEL[lookupResult.priority] ?? lookupResult.priority}</dd>
              </div>
              <div className="flex flex-wrap justify-between gap-2">
                <dt className="text-zinc-500">Registro</dt>
                <dd className="text-right">{formatPublicDate(lookupResult.createdAt)}</dd>
              </div>
              {lookupResult.startedAt ? (
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-zinc-500">Inicio de trabajo</dt>
                  <dd className="text-right">{formatPublicDate(lookupResult.startedAt)}</dd>
                </div>
              ) : null}
              {lookupResult.status === "completed" && lookupResult.completedAt ? (
                <div className="flex flex-wrap justify-between gap-2">
                  <dt className="text-zinc-500">Completada</dt>
                  <dd className="text-right">{formatPublicDate(lookupResult.completedAt)}</dd>
                </div>
              ) : null}
            </dl>

            {lookupResult.comments.length > 0 ? (
              <div className="border-t border-zinc-200 pt-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Comentarios
                </h3>
                <ul className="space-y-3">
                  {lookupResult.comments.map((c) => (
                    <li key={c.id} className="rounded-lg border border-zinc-200 bg-white p-2.5">
                      <div className="mb-1 flex flex-wrap gap-x-1.5 text-[11px] text-zinc-500">
                        <span className="font-medium text-zinc-800">{c.authorName}</span>
                        <span aria-hidden>•</span>
                        <time dateTime={c.createdAt}>{formatPublicDate(c.createdAt)}</time>
                      </div>
                      {c.text ? (
                        <p className="whitespace-pre-wrap text-xs text-zinc-800">{c.text}</p>
                      ) : null}
                      {c.inlineFiles.length > 0 ? (
                        <ul className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                          {c.inlineFiles.map((f) => (
                            <li key={`${c.id}-${f.url}`}>
                              <FileThumbOrLink filename={f.filename} url={f.url} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <div className="flex flex-col gap-2 text-center text-sm sm:flex-row sm:justify-center sm:gap-4">
        <Link href="/orden" className="font-medium text-primary-600">
          Crear orden
        </Link>
        <Link href="/login" className="font-medium text-primary-600">
          Volver al login
        </Link>
      </div>
    </div>
  );
}

export default function ConsultarOrdenPage() {
  return (
    <div className="min-h-screen bg-surface p-6">
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
