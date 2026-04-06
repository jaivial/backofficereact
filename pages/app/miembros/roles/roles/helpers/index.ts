import type { Member, RoleCatalogItem, RoleUserItem } from "../../../../../../api/types";

export function fallbackRoleImportance(roleRaw: string | null | undefined): number {
  const role = String(roleRaw ?? "").trim().toLowerCase();
  if (role === "root") return 100;
  if (role === "admin") return 90;
  return 0;
}

export function sortRoles(list: RoleCatalogItem[]): RoleCatalogItem[] {
  return [...list].sort((a, b) => {
    if (a.importance !== b.importance) return b.importance - a.importance;
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.slug.localeCompare(b.slug);
  });
}

export { fullName } from "../../../../../../lib/member";
