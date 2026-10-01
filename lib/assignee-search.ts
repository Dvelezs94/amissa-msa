/** Filter people for assignee typeahead (no DB — safe for Vitest). */

export function normalizeAssigneeSearch(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

/** People list for the tareas filter: current user first, then A–Z, narrowed by the query. */
export function orderAssigneeFilterUsers<T extends { id: string; name: string }>(
  users: T[],
  query: string,
  currentUserId?: string | null,
  locale = "es"
): T[] {
  const meId = currentUserId?.trim() || null;
  const needle = normalizeAssigneeSearch(query);
  const matched = needle
    ? users.filter((user) => normalizeAssigneeSearch(user.name).includes(needle))
    : users;
  const me: T[] = [];
  const others: T[] = [];
  for (const user of matched) {
    if (meId && user.id === meId) me.push(user);
    else others.push(user);
  }
  others.sort((a, b) =>
    a.name.localeCompare(b.name, locale, { sensitivity: "base" })
  );
  return [...me, ...others];
}

export function filterUsersByAssigneeQuery<T extends { id: string; name: string }>(
  users: T[],
  query: string,
  excludeIds: Iterable<string> = [],
  limit = 8
): T[] {
  const needle = normalizeAssigneeSearch(query);
  if (!needle) return [];
  const excluded = new Set(
    Array.from(excludeIds, (id) => String(id).trim()).filter(Boolean)
  );
  const out: T[] = [];
  for (const user of users) {
    if (excluded.has(user.id)) continue;
    if (!normalizeAssigneeSearch(user.name).includes(needle)) continue;
    out.push(user);
    if (out.length >= limit) break;
  }
  return out;
}
