"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { workflowMiniGraphChips } from "@/lib/workflow-canvas";

export type WorkflowListItem = {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  triggerType: string;
  actions: Array<{ type: string }>;
};

const CHIP: Record<string, string> = {
  trigger: "border-accent-200 bg-accent-50 text-accent-700",
  notify: "border-primary-200 bg-primary-50 text-primary-800",
  email: "border-teal-200 bg-teal-50 text-teal-800",
  telegram: "border-sky-200 bg-sky-50 text-sky-800",
};

function MiniGraph({ item }: { item: WorkflowListItem }) {
  const chips = workflowMiniGraphChips({
    triggerType: item.triggerType,
    actions: item.actions,
  });
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip, index) => (
        <span key={chip.id} className="flex items-center gap-1.5">
          {index > 0 ? (
            <span className="h-px w-4 bg-zinc-300" aria-hidden />
          ) : null}
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${CHIP[chip.tone] ?? CHIP.notify}`}
          >
            {chip.label}
          </span>
        </span>
      ))}
    </div>
  );
}

export function WorkflowList({ initial }: { initial: WorkflowListItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  async function toggleEnabled(item: WorkflowListItem) {
    setError(null);
    const res = await fetch(`/api/workflows/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !item.enabled }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "No se pudo actualizar");
      return;
    }
    setItems((prev) =>
      prev.map((row) =>
        row.id === item.id ? { ...row, enabled: !row.enabled } : row
      )
    );
    router.refresh();
  }

  async function onDelete(item: WorkflowListItem) {
    if (!window.confirm(`¿Eliminar el flujo «${item.name}»?`)) return;
    setError(null);
    const res = await fetch(`/api/workflows/${item.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(typeof data.error === "string" ? data.error : "No se pudo eliminar");
      return;
    }
    setItems((prev) => prev.filter((row) => row.id !== item.id));
    router.refresh();
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Aún no hay flujos. Crea uno con el asistente para avisar cuando se
        complete una tarea, se publique una nota u ocurra otro evento.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <p className="font-medium text-zinc-900">
                  <Link
                    href={`/flujos/${item.id}`}
                    className="hover:text-primary-700 hover:underline"
                  >
                    {item.name}
                  </Link>
                  {item.enabled ? null : (
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      Pausado
                    </span>
                  )}
                </p>
                <MiniGraph item={item} />
                {item.description ? (
                  <p className="text-sm text-zinc-600">{item.description}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <label className="mr-1 flex items-center gap-1 text-xs text-zinc-600">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggleEnabled(item)}
                    className="h-4 w-4 rounded border-zinc-300 accent-primary-600"
                  />
                  Activo
                </label>
                <Link
                  href={`/flujos/${item.id}/edit`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-zinc-100"
                  aria-label={`Editar ${item.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => onDelete(item)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-md text-zinc-600 hover:bg-red-50 hover:text-red-700"
                  aria-label={`Eliminar ${item.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
