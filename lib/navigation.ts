import { canAccessComida, hasSectionAccess } from "./access-policy";
import { normalizeRole, normalizeSectionAccess, ROLE_SECTION_ACCESS, type BOSection } from "./rbac";

export type SidebarItemKey = BOSection;

export type SidebarItem = {
  key: SidebarItemKey;
  href: string;
  label: string;
};

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "reservas", href: "/app/reservas", label: "Reservas" },
  { key: "menus", href: "/app/menus", label: "Menus" },
  { key: "comida", href: "/app/comida", label: "Carta" },
  { key: "stock", href: "/app/stock", label: "Stock" },
  { key: "pos", href: "/app/pos", label: "TPV" },
  { key: "miembros", href: "/app/miembros", label: "Miembros" },
  { key: "horarios", href: "/app/horarios", label: "Horarios" },
  { key: "fichaje", href: "/app/fichaje", label: "Fichaje" },
  { key: "facturas", href: "/app/facturas", label: "Facturas" },
  { key: "estadisticas", href: "/app/estadisticas", label: "Estadisticas" },
  { key: "plataforma", href: "/app/plataforma", label: "Plataforma" },
];

const SECTION_HOME: Record<BOSection, string> = {
  reservas: "/app/reservas",
  menus: "/app/menus",
  comida: "/app/comida",
  stock: "/app/stock",
  pos: "/app/pos",
  ajustes: "/app/settings",
  website: "/app/site-builder",
  "site-builder": "/app/site-builder",
  miembros: "/app/miembros",
  horarios: "/app/horarios",
  fichaje: "/app/fichaje",
  facturas: "/app/facturas",
  reportes: "/app/reportes",
  estadisticas: "/app/estadisticas",
  estado_cuenta: "/app/estado-cuenta",
  plataforma: "/app/plataforma",
};

const SECTION_PRIORITY: BOSection[] = ["reservas", "menus", "comida", "pos", "stock", "miembros", "horarios", "fichaje", "facturas", "estadisticas"];

export function sectionForPath(pathname: string): BOSection | null {
  if (!pathname.startsWith("/app")) return null;
  if (pathname === "/app" || pathname.startsWith("/app/dashboard")) return "reservas";
  if (pathname.startsWith("/app/reservas") || pathname.startsWith("/app/config") || pathname.startsWith("/app/comsit")) return "reservas";
  if (pathname.startsWith("/app/menus")) return "menus";
  if (pathname.startsWith("/app/comida")) return "comida";
  if (pathname.startsWith("/app/stock")) return "stock";
  if (pathname.startsWith("/app/pos")) return "pos";
  if (pathname.startsWith("/app/settings")) return "ajustes";
  if (pathname.startsWith("/app/website") || pathname.startsWith("/app/site-builder")) return "website";
  if (pathname === "/app/miembros/mi-horario") return "horarios";
  if (pathname.startsWith("/app/miembros")) return "miembros";
  if (pathname.startsWith("/app/horarios")) return "horarios";
  if (pathname.startsWith("/app/fichaje")) return "fichaje";
  if (pathname.startsWith("/app/facturas")) return "facturas";
  if (pathname.startsWith("/app/reportes")) return "reportes";
  if (pathname.startsWith("/app/estadisticas")) return "estadisticas";
  if (pathname.startsWith("/app/estado-cuenta")) return "estado_cuenta";
  if (pathname.startsWith("/app/plataforma")) return "plataforma";
  return null;
}

export function firstAllowedPath(roleRaw: string | null | undefined, sectionAccessRaw?: string[] | null, roleImportanceRaw?: number | null, appVersionRaw?: unknown): string {
  const explicit = normalizeSectionAccess(sectionAccessRaw);
  const sections = explicit.length > 0 ? SECTION_PRIORITY.filter((section) => explicit.includes(section)) : ROLE_SECTION_ACCESS[normalizeRole(roleRaw)] ?? [];
  for (const section of sections) {
    if (hasSectionAccess(roleRaw, section, sectionAccessRaw, roleImportanceRaw, appVersionRaw)) {
      const candidate = SECTION_HOME[section];
      if (candidate) return candidate;
    }
  }
  return "/app/fichaje";
}

export function isPathAllowed(pathname: string, roleRaw: string | null | undefined, sectionAccessRaw?: string[] | null, roleImportanceRaw?: number | null, appVersionRaw?: unknown): boolean {
  if (pathname === "/app" || pathname === "/app/") return true;
  if (pathname === "/app/backoffice" || pathname.startsWith("/app/backoffice/")) return true;
  const section = sectionForPath(pathname);
  if (!section) return false;
  return section === "comida"
    ? canAccessComida(roleRaw, sectionAccessRaw, roleImportanceRaw, appVersionRaw)
    : hasSectionAccess(roleRaw, section, sectionAccessRaw, roleImportanceRaw, appVersionRaw);
}

export function sidebarItemsForRole(roleRaw: string | null | undefined, sectionAccessRaw?: string[] | null, roleImportanceRaw?: number | null, appVersionRaw?: unknown): SidebarItem[] {
  return SIDEBAR_ITEMS.filter((item) => item.key === "comida"
    ? canAccessComida(roleRaw, sectionAccessRaw, roleImportanceRaw, appVersionRaw)
    : hasSectionAccess(roleRaw, item.key, sectionAccessRaw, roleImportanceRaw, appVersionRaw));
}
