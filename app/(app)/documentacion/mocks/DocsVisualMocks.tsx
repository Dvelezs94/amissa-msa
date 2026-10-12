/** Visual mocks with fake data for the product guide (not live API data). */

export function DocsKanbanMock() {
  const columns = [
    {
      title: "Pendiente",
      color: "bg-amber-100 text-amber-900",
      cards: [
        { folio: "RU-4000", title: "Cambio de filtro HT-01", kind: "Rutinaria" },
        { folio: "OT-1", title: "Fuga en línea de vapor", kind: "Orden de trabajo" },
      ],
    },
    {
      title: "En curso",
      color: "bg-sky-100 text-sky-900",
      cards: [
        { folio: "RU-4001", title: "Lubricación prensa 3", kind: "Rutinaria" },
      ],
    },
    {
      title: "Completada",
      color: "bg-emerald-100 text-emerald-900",
      cards: [
        { folio: "RU-4002", title: "Inspección semanal horno", kind: "Rutinaria" },
      ],
    },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Ejemplo · tablero de tareas
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        {columns.map((col) => (
          <div key={col.title} className="rounded-lg bg-white p-2 shadow-sm">
            <p
              className={`mb-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${col.color}`}
            >
              {col.title}
            </p>
            <ul className="space-y-2">
              {col.cards.map((card) => (
                <li
                  key={card.folio}
                  className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2"
                >
                  <p className="text-[10px] font-medium text-zinc-500">
                    Folio {card.folio} · {card.kind}
                  </p>
                  <p className="text-sm font-medium text-zinc-900">{card.title}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DocsCalendarMock() {
  const days = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
  const cells = Array.from({ length: 35 }, (_, i) => {
    const day = i - 2;
    if (day < 1 || day > 31) return { day: null as number | null, events: [] as string[] };
    if (day === 12)
      return { day, events: ["Lubricación"], marker: "pending" as const };
    if (day === 18)
      return { day, events: ["Inspección HT"], marker: "completed" as const };
    if (day === 21) return { day, events: ["Filtro aire"], marker: null };
    return { day, events: [] as string[], marker: null as null };
  });
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Ejemplo · mes con eventos y marcas de tarea
      </p>
      <p className="mb-3 text-sm font-semibold text-zinc-900">Agosto 2026 · Mantenimiento</p>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase text-zinc-500">
        {days.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => (
          <div
            key={i}
            className="min-h-[3.25rem] rounded-md border border-zinc-100 bg-zinc-50 p-1"
          >
            {cell.day != null ? (
              <>
                <p className="text-[10px] font-medium text-zinc-600">{cell.day}</p>
                {cell.events.map((ev) => (
                  <p
                    key={ev}
                    className="mt-0.5 truncate rounded-sm bg-primary-600 px-1 text-[9px] font-semibold text-white"
                  >
                    {ev}
                    {"marker" in cell && cell.marker === "pending" ? (
                      <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
                    ) : null}
                    {"marker" in cell && cell.marker === "completed" ? (
                      <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    ) : null}
                  </p>
                ))}
              </>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-zinc-600">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-amber-400" /> Tarea pendiente
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-emerald-400" /> Tarea completada
        </span>
      </div>
    </div>
  );
}

export function DocsPhoneMock() {
  const tasks = [
    { title: "Lubricación prensa 3", status: "En curso", tone: "bg-sky-500" },
    { title: "Cambio de filtro HT-01", status: "Pendiente", tone: "bg-amber-500" },
    { title: "Revisión banda transportadora", status: "Pendiente", tone: "bg-amber-500" },
  ];
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="rounded-[1.75rem] border-[6px] border-zinc-800 bg-zinc-900 p-2 shadow-lg">
        <div className="overflow-hidden rounded-[1.25rem] bg-zinc-100">
          <div className="bg-primary-600 px-3 py-3 text-white">
            <p className="text-[10px] uppercase tracking-wide text-primary-100">
              MSA · Hoy
            </p>
            <p className="text-sm font-semibold">Mis tareas</p>
          </div>
          <ul className="space-y-2 p-3">
            {tasks.map((t) => (
              <li
                key={t.title}
                className="rounded-lg border border-zinc-200 bg-white p-2.5 shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${t.tone}`} />
                  <p className="text-xs font-medium text-zinc-900">{t.title}</p>
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">{t.status}</p>
              </li>
            ))}
          </ul>
          <div className="flex border-t border-zinc-200 bg-white text-[9px] font-semibold uppercase text-zinc-500">
            {["Tareas", "Docs", "Avisos", "Perfil"].map((tab, i) => (
              <span
                key={tab}
                className={`flex-1 py-2 text-center ${
                  i === 0 ? "text-accent-600" : ""
                }`}
              >
                {tab}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-zinc-500">
        Ejemplo · pantalla de tareas del día (app Android)
      </p>
    </div>
  );
}

export function DocsRolesTableMock({
  rows,
}: {
  rows: {
    feature: string;
    admin: boolean;
    tecnico: boolean;
    calidad: boolean;
  }[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white shadow-sm">
      <table className="min-w-full text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-[11px] uppercase tracking-wide text-zinc-500">
          <tr>
            <th className="px-3 py-2 font-semibold">Función</th>
            <th className="px-3 py-2 font-semibold">Admin</th>
            <th className="px-3 py-2 font-semibold">Técnico</th>
            <th className="px-3 py-2 font-semibold">Calidad</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {rows.map((row) => (
            <tr key={row.feature}>
              <td className="px-3 py-2 font-medium text-zinc-900">{row.feature}</td>
              <Cell ok={row.admin} />
              <Cell ok={row.tecnico} />
              <Cell ok={row.calidad} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Cell({ ok }: { ok: boolean }) {
  return (
    <td className="px-3 py-2">
      {ok ? (
        <span className="inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          Sí
        </span>
      ) : (
        <span className="text-zinc-300">—</span>
      )}
    </td>
  );
}

export function DocsWorkflowCanvasMock() {
  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-4 shadow-sm">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
        Ejemplo · flujo (cuando → entonces)
      </p>
      <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
        <div className="rounded-lg border border-accent-200 bg-accent-50 px-3 py-3 sm:w-48">
          <p className="text-[10px] font-semibold uppercase text-accent-700">
            Cuando
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            Tarea completada
          </p>
        </div>
        <div className="hidden h-0.5 flex-1 bg-zinc-300 sm:block" aria-hidden />
        <div className="flex flex-1 flex-col gap-2">
          <div className="rounded-lg border border-primary-200 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase text-primary-700">
              Notificar
            </p>
            <p className="text-sm text-zinc-800">Rol · Calidad</p>
          </div>
          <div className="rounded-lg border border-teal-200 bg-white px-3 py-2 shadow-sm">
            <p className="text-[10px] font-semibold uppercase text-teal-700">
              Correo
            </p>
            <p className="text-sm text-zinc-800">
              Asunto: Tarea {"{{title}}"} cerrada
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
