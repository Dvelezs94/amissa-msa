import type { UserRole } from "@/lib/auth-shared";

export const DOCS_BASE_PATH = "/documentacion";

export const DOCS_SECTION_SLUGS = [
  "inicio",
  "roles",
  "tareas",
  "calendario",
  "maquinas",
  "checklists",
  "solicitudes",
  "flujos",
  "movil",
  "busqueda",
] as const;

export type DocsSectionSlug = (typeof DOCS_SECTION_SLUGS)[number];

export type DocsSectionMeta = {
  slug: DocsSectionSlug;
  title: string;
  summary: string;
  /** Which roles this chapter is most relevant for (all can open docs). */
  audience: UserRole[];
};

export const DOCS_SECTIONS: DocsSectionMeta[] = [
  {
    slug: "inicio",
    title: "Qué es MSA",
    summary: "Panorama de la plataforma web y la app móvil.",
    audience: ["admin", "tecnico", "calidad"],
  },
  {
    slug: "roles",
    title: "Roles y permisos",
    summary: "Administrador, técnico y calidad: qué puede ver cada uno.",
    audience: ["admin", "tecnico", "calidad"],
  },
  {
    slug: "tareas",
    title: "Tareas (órdenes de trabajo)",
    summary: "Kanban, estados, checklist en la tarea y fecha de inicio.",
    audience: ["admin", "tecnico", "calidad"],
  },
  {
    slug: "calendario",
    title: "Calendario de mantenimiento",
    summary: "Eventos, crear tarea desde un evento y calendarios por área.",
    audience: ["admin"],
  },
  {
    slug: "maquinas",
    title: "Máquinas y áreas",
    summary: "Activos, documentos, paro y mantenimiento por horas de uso.",
    audience: ["admin"],
  },
  {
    slug: "checklists",
    title: "Checklists y revisiones",
    summary: "Plantillas, carpetas y aprobación por Calidad.",
    audience: ["admin", "calidad", "tecnico"],
  },
  {
    slug: "solicitudes",
    title: "Orden de trabajo",
    summary: "Formulario /orden, folio OT y consulta.",
    audience: ["admin"],
  },
  {
    slug: "flujos",
    title: "Flujos (automatizaciones)",
    summary: "Avisos, correos y Telegram cuando ocurre un evento en la planta.",
    audience: ["admin"],
  },
  {
    slug: "movil",
    title: "App móvil",
    summary: "Tareas del día, fotos, notificaciones y actualizaciones APK.",
    audience: ["admin", "tecnico"],
  },
  {
    slug: "busqueda",
    title: "Búsqueda y equipo",
    summary: "Buscador global, perfiles y base de conocimiento.",
    audience: ["admin", "tecnico", "calidad"],
  },
];

export type DocsRoleAccessRow = {
  feature: string;
  admin: boolean;
  tecnico: boolean;
  calidad: boolean;
};

/** High-level product matrix for the docs “Roles” chapter (UI-facing). */
export const DOCS_ROLE_ACCESS: DocsRoleAccessRow[] = [
  { feature: "Dashboard y analíticas", admin: true, tecnico: false, calidad: false },
  { feature: "Calendario de mantenimiento", admin: true, tecnico: false, calidad: false },
  { feature: "Tareas (ver / ejecutar)", admin: true, tecnico: true, calidad: true },
  { feature: "Máquinas y áreas", admin: true, tecnico: false, calidad: false },
  { feature: "Checklists / revisiones", admin: true, tecnico: true, calidad: true },
  { feature: "Aprobar / rechazar revisiones", admin: false, tecnico: false, calidad: true },
  { feature: "Flujos (automatizaciones)", admin: true, tecnico: false, calidad: false },
  { feature: "Usuarios e invitaciones", admin: true, tecnico: false, calidad: false },
  { feature: "Base de conocimiento", admin: true, tecnico: true, calidad: false },
  { feature: "App móvil (tareas del día)", admin: true, tecnico: true, calidad: false },
  { feature: "Orden de trabajo (/orden)", admin: true, tecnico: false, calidad: false },
  { feature: "Búsqueda global", admin: true, tecnico: true, calidad: true },
];

export function isDocsSectionSlug(value: string): value is DocsSectionSlug {
  return (DOCS_SECTION_SLUGS as readonly string[]).includes(value);
}

export function getDocsSection(slug: string): DocsSectionMeta | null {
  if (!isDocsSectionSlug(slug)) return null;
  return DOCS_SECTIONS.find((s) => s.slug === slug) ?? null;
}

export function docsHref(slug: DocsSectionSlug): string {
  return `${DOCS_BASE_PATH}/${slug}`;
}

export function docsNavForRole(role: UserRole): DocsSectionMeta[] {
  // Docs hub is open to every authenticated role; chapters stay listed for orientation.
  void role;
  return DOCS_SECTIONS;
}

export function roleAccessLabel(ok: boolean): string {
  return ok ? "Sí" : "—";
}

export type DocsWorkflowStep = { title: string; detail: string };

export const DOCS_CALENDAR_TO_TASK_STEPS: DocsWorkflowStep[] = [
  {
    title: "Abrir el evento",
    detail: "En Calendario, toca el evento del día que quieres ejecutar.",
  },
  {
    title: "Crear tarea",
    detail:
      "Elige responsables y confirma. Se crea una tarea con la misma fecha y vínculo al evento.",
  },
  {
    title: "Ver el vínculo",
    detail:
      "El calendario marca el día con el estado de la tarea (pendiente, en curso, completada).",
  },
  {
    title: "Trabajar la tarea",
    detail:
      "En web o en la app móvil llenas el checklist, notas y cambias el estatus hasta cerrarla.",
  },
];

export const DOCS_CHECKLIST_REVISION_STEPS: DocsWorkflowStep[] = [
  {
    title: "Editar plantilla",
    detail: "Un admin o técnico propone cambios y guarda una revisión con nombre.",
  },
  {
    title: "Revisión en panel",
    detail: "La propuesta aparece en el panel de revisiones del checklist.",
  },
  {
    title: "Calidad decide",
    detail: "Calidad aprueba o rechaza. Solo las aprobadas rigen el trabajo nuevo.",
  },
];

export const DOCS_MOBILE_DAY_RULE =
  "En la app móvil solo aparecen tareas cuya fecha de inicio (o vencimiento si no hay inicio) es hoy o antes, zona America/Monterrey. Las programadas a futuro se ocultan hasta ese día.";
