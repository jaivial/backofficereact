export type BORole = string;

export type BOSection = "reservas" | "menus" | "ajustes" | "miembros" | "fichaje" | "horarios";

export const ROLE_SECTION_ACCESS: Record<string, BOSection[]> = {
  root: ["reservas", "menus", "miembros", "horarios", "ajustes", "fichaje"],
  admin: ["reservas", "menus", "miembros", "horarios", "ajustes", "fichaje"],
  metre: ["reservas", "menus", "fichaje"],
  jefe_cocina: ["reservas", "menus", "fichaje"],
  arrocero: ["fichaje"],
  pinche_cocina: ["fichaje"],
  fregaplatos: ["fichaje"],
  ayudante_cocina: ["fichaje"],
  camarero: ["fichaje"],
  responsable_sala: ["fichaje"],
  ayudante_camarero: ["fichaje"],
  runner: ["fichaje"],
  barista: ["fichaje"],
};

export type SidebarItemKey = BOSection;

export type SidebarItem = {
  key: SidebarItemKey;
  href: string;
  label: string;
};

const SIDEBAR_ITEMS: SidebarItem[] = [
  { key: "reservas", href: "/app/reservas", label: "Reservas" },
  { key: "menus", href: "/app/menus", label: "Menus" },
  { key: "miembros", href: "/app/miembros", label: "Miembros" },
  { key: "horarios", href: "/app/horarios", label: "Horarios" },
  { key: "ajustes", href: "/app/settings", label: "Ajustes" },
  { key: "fichaje", href: "/app/fichaje", label: "Fichaje" },
];

const SECTION_HOME: Record<BOSection, string> = {
  reservas: "/app/reservas",
  menus: "/app/menus",
  ajustes: "/app/settings",
  miembros: "/app/miembros",
  horarios: "/app/horarios",
  fichaje: "/app/fichaje",
};

const SECTION_PRIORITY: BOSection[] = ["reservas", "menus", "miembros", "horarios", "ajustes", "fichaje"];

const ROLE_LABELS: Record<string, string> = {
  root: "Root",
  admin: "Admin",
  metre: "Metre",
  jefe_cocina: "Jefe de cocina",
  arrocero: "Arrocero",
  pinche_cocina: "Pinche de cocina",
  fregaplatos: "Fregaplatos",
  ayudante_cocina: "Ayudante de cocina",
  camarero: "Camarero",
  responsable_sala: "Responsable de sala",
  ayudante_camarero: "Ayudante camarero",
  runner: "Runner",
  barista: "Barista",
};

function isSection(value: string): value is BOSection {
  return value === "reservas" || value === "menus" || value === "ajustes" || value === "miembros" || value === "fichaje" || value === "horarios";
}

function normalizeSectionAccess(sectionAccessRaw: string[] | null | undefined): BOSection[] {
  if (!Array.isArray(sectionAccessRaw)) return [];
  const out: BOSection[] = [];
  const seen = new Set<BOSection>();
  for (const raw of sectionAccessRaw) {
    const section = String(raw ?? "").trim().toLowerCase();
    if (!isSection(section) || seen.has(section)) continue;
    seen.add(section);
    out.push(section);
  }
  return out;
}

export function normalizeRole(roleRaw: string | null | undefined): BORole {
  const role = String(roleRaw ?? "").trim().toLowerCase();
  if (role === "owner") return "admin";
  if (!role) return "admin";
  return role;
}

function sectionAllowedByImportance(section: BOSection, roleImportanceRaw?: number | null): boolean {
  if (section !== "miembros") return true;
  if (typeof roleImportanceRaw !== "number") return true;
  return roleImportanceRaw >= 90;
}

export function hasSectionAccess(
  roleRaw: string | null | undefined,
  section: BOSection,
  sectionAccessRaw?: string[] | null,
  roleImportanceRaw?: number | null,
): boolean {
  if (!sectionAllowedByImportance(section, roleImportanceRaw)) return false;
  const explicit = normalizeSectionAccess(sectionAccessRaw);
  if (explicit.length > 0) return explicit.includes(section);
  const role = normalizeRole(roleRaw);
  return (ROLE_SECTION_ACCESS[role] ?? []).includes(section);
}

export function sectionForPath(pathname: string): BOSection | null {
  if (!pathname.startsWith("/app")) return null;
  if (pathname === "/app" || pathname.startsWith("/app/dashboard")) return "reservas";
  if (pathname.startsWith("/app/reservas")) return "reservas";
  if (pathname.startsWith("/app/config")) return "reservas";
  if (pathname.startsWith("/app/comsit")) return "reservas";
  if (pathname.startsWith("/app/menus")) return "menus";
  if (pathname.startsWith("/app/settings")) return "ajustes";
  if (pathname.startsWith("/app/miembros")) return "miembros";
  if (pathname.startsWith("/app/horarios")) return "horarios";
  if (pathname.startsWith("/app/fichaje")) return "fichaje";
  return null;
}

export function firstAllowedPath(roleRaw: string | null | undefined, sectionAccessRaw?: string[] | null, roleImportanceRaw?: number | null): string {
  const explicit = normalizeSectionAccess(sectionAccessRaw);
  const sections = explicit.length > 0 ? SECTION_PRIORITY.filter((s) => explicit.includes(s)) : ROLE_SECTION_ACCESS[normalizeRole(roleRaw)] ?? [];
  for (const section of sections) {
    if (!sectionAllowedByImportance(section, roleImportanceRaw)) continue;
    const candidate = SECTION_HOME[section];
    if (candidate) return candidate;
  }
  return "/app/fichaje";
}

export function isPathAllowed(
  pathname: string,
  roleRaw: string | null | undefined,
  sectionAccessRaw?: string[] | null,
  roleImportanceRaw?: number | null,
): boolean {
  const section = sectionForPath(pathname);
  if (!section) return false;
  return hasSectionAccess(roleRaw, section, sectionAccessRaw, roleImportanceRaw);
}

export function sidebarItemsForRole(
  roleRaw: string | null | undefined,
  sectionAccessRaw?: string[] | null,
  roleImportanceRaw?: number | null,
): SidebarItem[] {
  return SIDEBAR_ITEMS.filter((item) => hasSectionAccess(roleRaw, item.key, sectionAccessRaw, roleImportanceRaw));
}

export function roleLabel(roleRaw: string | null | undefined): string {
  const role = normalizeRole(roleRaw);
  const known = ROLE_LABELS[role];
  if (known) return known;
  return role
    .split("_")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}
