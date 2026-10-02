/** Tipos y constantes usables en Client Components (sin next/headers). */

export const AVAILABLE_USER_ROLES = [
  "tecnico",
  "admin",
  "calidad",
] as const;
export type UserRole = (typeof AVAILABLE_USER_ROLES)[number];

export type SessionUser = {
  id: string;
  username: string;
  email: string | null;
  name: string;
  role: UserRole;
  avatarUrl: string | null;
  avatarBackgroundColor: string | null;
};

/** Admins and calidad may edit checklist on completed/cancelled work orders. */
export function canEditLockedWorkOrderChecklist(role: UserRole): boolean {
  return role === "admin" || role === "calidad";
}

/** Only admins may permanently delete work orders (any status). */
export function canDeleteWorkOrder(role: UserRole | undefined): boolean {
  return role === "admin";
}

/** Admins and calidad (legacy supervisor) may rename calendars. */
export function canRenameCalendar(role: UserRole | undefined): boolean {
  return role === "admin" || role === "calidad";
}

/** Creating, editing, and deleting calendar events stays admin-only. */
export function canManageCalendarEvents(role: UserRole | undefined): boolean {
  return role === "admin";
}
