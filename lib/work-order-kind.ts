export type WorkOrderKind = "routine" | "on_demand";

/** Board filter on `/tareas`. `all` shows both kinds. */
export type WorkOrderKindFilter = "all" | WorkOrderKind;

export const WORK_ORDER_KIND_FILTERS: {
  value: WorkOrderKindFilter;
  label: string;
}[] = [
  { value: "all", label: "Todas" },
  { value: "on_demand", label: "Órdenes de trabajo" },
  { value: "routine", label: "Rutinas" },
];

export function workOrderMatchesKindFilter(
  kind: unknown,
  filter: WorkOrderKindFilter
): boolean {
  if (filter === "all") return true;
  return parseWorkOrderKind(kind) === filter;
}

export function parseWorkOrderKind(raw: unknown): WorkOrderKind {
  if (raw === "routine") return "routine";
  return "on_demand";
}

/** routine = programada (calendario); on_demand = bajo demanda */
export function workOrderKindLabel(kind: WorkOrderKind): string {
  return kind === "routine" ? "Rutinaria" : "Orden de trabajo";
}

/**
 * Colores fijos vía `.wo-kind-*` en `globals.css` (visibles también con tema HMI).
 */
export function workOrderKindBadgeClass(
  kind: WorkOrderKind,
  emphasis?: boolean
): string {
  const type = kind === "routine" ? "wo-kind-routine" : "wo-kind-on-demand";
  return emphasis ? `${type} wo-kind-emphasis` : type;
}
