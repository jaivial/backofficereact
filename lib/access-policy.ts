import { sectionAllowedByAppVersion } from "./app-version";
import { hasRoleSectionAccess, type BOSection } from "./rbac";

export function hasSectionAccess(
  roleRaw: string | null | undefined,
  section: BOSection,
  sectionAccessRaw?: string[] | null,
  roleImportanceRaw?: number | null,
  appVersionRaw?: unknown,
): boolean {
  const effectiveVersion = appVersionRaw ?? "0.2";
  return sectionAllowedByAppVersion(section, effectiveVersion)
    && hasRoleSectionAccess(roleRaw, section, sectionAccessRaw, roleImportanceRaw);
}

export function canAccessComida(
  roleRaw: string | null | undefined,
  sectionAccessRaw?: string[] | null,
  roleImportanceRaw?: number | null,
  appVersionRaw?: unknown,
): boolean {
  return hasSectionAccess(roleRaw, "menus", sectionAccessRaw, roleImportanceRaw, appVersionRaw)
    || hasSectionAccess(roleRaw, "comida", sectionAccessRaw, roleImportanceRaw, appVersionRaw);
}
