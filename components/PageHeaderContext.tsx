"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type PageHeaderContent = {
  title?: string | null;
  subtitle?: string | null;
  /** Search / filters shown left in the content toolbar. */
  filters?: ReactNode;
  /** Primary page actions shown right in the content toolbar (not the sticky nav). */
  actions?: ReactNode;
};

type PageHeaderSetters = {
  /** Shallow-merge into the current header (does not wipe omitted keys). */
  patchHeader: (next: PageHeaderContent) => void;
  clearHeader: () => void;
};

const PageHeaderStateContext = createContext<PageHeaderContent | null>(null);
const PageHeaderSettersContext = createContext<PageHeaderSetters | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [header, setHeaderState] = useState<PageHeaderContent>({});

  const patchHeader = useCallback((next: PageHeaderContent) => {
    setHeaderState((prev) => ({ ...prev, ...next }));
  }, []);

  const clearHeader = useCallback(() => {
    setHeaderState({});
  }, []);

  const setters = useMemo(
    () => ({ patchHeader, clearHeader }),
    [patchHeader, clearHeader]
  );

  return (
    <PageHeaderSettersContext.Provider value={setters}>
      <PageHeaderStateContext.Provider value={header}>
        {children}
      </PageHeaderStateContext.Provider>
    </PageHeaderSettersContext.Provider>
  );
}

/** Read current sticky header content (title consumers only). */
export function usePageHeader() {
  const header = useContext(PageHeaderStateContext);
  if (header === null) {
    throw new Error("usePageHeader must be used within PageHeaderProvider");
  }
  return header;
}

function usePageHeaderSetters() {
  const setters = useContext(PageHeaderSettersContext);
  if (!setters) {
    throw new Error("Page header hooks must be used within PageHeaderProvider");
  }
  return setters;
}

/**
 * Set sticky header title/actions for the lifetime of the calling component.
 * Omitting `filters` or `actions` leaves values set by another caller.
 */
export function useSetPageHeader(content: PageHeaderContent) {
  const { patchHeader } = usePageHeaderSetters();
  const { title, subtitle, filters, actions } = content;
  const includeFilters = Object.prototype.hasOwnProperty.call(content, "filters");
  const includeActions = Object.prototype.hasOwnProperty.call(content, "actions");

  useEffect(() => {
    const patch: PageHeaderContent = {
      title: title ?? null,
      subtitle: subtitle ?? null,
    };
    if (includeFilters) patch.filters = filters ?? null;
    if (includeActions) patch.actions = actions ?? null;
    patchHeader(patch);
    return () => {
      const clear: PageHeaderContent = {
        title: null,
        subtitle: null,
      };
      if (includeFilters) clear.filters = null;
      if (includeActions) clear.actions = null;
      patchHeader(clear);
    };
  }, [title, subtitle, filters, actions, includeFilters, includeActions, patchHeader]);
}

/** Set content-toolbar filters (left) without owning title/actions. */
export function usePageHeaderFilters(filters: ReactNode) {
  const { patchHeader } = usePageHeaderSetters();

  useEffect(() => {
    patchHeader({ filters });
    return () => patchHeader({ filters: null });
  }, [filters, patchHeader]);
}

/** Set content-toolbar actions (right) without owning title/filters. */
export function usePageHeaderActions(actions: ReactNode) {
  const { patchHeader } = usePageHeaderSetters();

  useEffect(() => {
    patchHeader({ actions });
    return () => patchHeader({ actions: null });
  }, [actions, patchHeader]);
}

/** Longest-prefix match for default section titles in the sticky header. */
export function resolveAppShellTitle(pathname: string): string | null {
  if (pathname.endsWith("/edit")) {
    if (pathname.startsWith("/tareas/")) return "Editar tarea";
    if (pathname.startsWith("/assets/")) return "Editar máquina";
    if (pathname.startsWith("/flujos/")) return "Editar flujo";
    if (pathname.includes("/revisions/")) return "Editar revisión";
  }
  if (pathname.endsWith("/revisions/new")) return "Nueva revisión";
  if (/\/checklists\/[^/]+\/revisions$/.test(pathname)) return "Revisiones";

  const rules: { prefix: string; title: string }[] = [
    { prefix: "/dashboard", title: "Dashboard" },
    { prefix: "/calendario", title: "Calendario" },
    { prefix: "/tareas/new", title: "Nueva tarea" },
    { prefix: "/tareas", title: "Tareas" },
    { prefix: "/checklists/new", title: "Nueva plantilla" },
    { prefix: "/checklists", title: "Checklist" },
    { prefix: "/assets/new", title: "Añadir máquina" },
    { prefix: "/assets", title: "Máquinas" },
    { prefix: "/knowledge-base", title: "Base de conocimiento" },
    { prefix: "/analytics", title: "Analíticas" },
    { prefix: "/users", title: "Usuarios" },
    { prefix: "/flujos/new", title: "Nuevo flujo" },
    { prefix: "/flujos", title: "Flujos" },
    { prefix: "/profile", title: "Perfil" },
    { prefix: "/ask", title: "Asistente" },
    { prefix: "/requests", title: "Solicitudes" },
    { prefix: "/equipo", title: "Equipo" },
    { prefix: "/buscar", title: "Búsqueda" },
    { prefix: "/logs", title: "Logs de plataforma" },
  ];
  let best: { prefix: string; title: string } | null = null;
  for (const rule of rules) {
    if (
      pathname === rule.prefix ||
      pathname.startsWith(`${rule.prefix}/`)
    ) {
      if (!best || rule.prefix.length > best.prefix.length) best = rule;
    }
  }
  return best?.title ?? null;
}
