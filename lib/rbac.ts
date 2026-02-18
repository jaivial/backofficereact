export type BORole = string;

export type BOSection = "reservas" | "menus" | "comida" | "ajustes" | "miembros" | "fichaje" | "horarios" | "facturas" | "reportes" | "estado_cuenta";

export const ROLE_SECTION_ACCESS: Record<string, BOSection[]> = {
  root: ["reservas", "menus", "comida", "miembros", "horarios", "ajustes", "fichaje", "facturas", "reportes", "estado_cuenta"],
  admin: ["reservas", "menus", "comida", "miembros", "horarios", "ajustes", "fichaje", "facturas", "reportes", "estado_cuenta"],
  metre: ["reservas", "menus", "comida", "fichaje", "facturas", "estado_cuenta"],
  jefe_cocina: ["reservas", "menus", "comida", "fichaje"],
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
  { key: "comida", href: "/app/comida", label: "Carta" },
  { key: "miembros", href: "/app/miembros", label: "Miembros" },
  { key: "horarios", href: "/app/horarios", label: "Horarios" },
  { key: "ajustes", href: "/app/settings", label: "Ajustes" },
  { key: "fichaje", href: "/app/fichaje", label: "Fichaje" },
  { key: "facturas", href: "/app/facturas", label: "Facturas" },
  { key: "reportes", href: "/app/reportes", label: "Reportes" },
  { key: "estado_cuenta", href: "/app/estado-cuenta", label: "Estado de Cuenta" },
];

const SECTION_HOME: Record<BOSection, string> = {
  reservas: "/app/reservas",
  menus: "/app/menus",
  comida: "/app/comida",
  ajustes: "/app/settings",
  miembros: "/app/miembros",
  horarios: "/app/horarios",
  fichaje: "/app/fichaje",
  facturas: "/app/facturas",
  reportes: "/app/reportes",
  estado_cuenta: "/app/estado-cuenta",
};

const SECTION_PRIORITY: BOSection[] = ["reservas", "menus", "comida", "miembros", "horarios", "ajustes", "fichaje", "facturas", "reportes", "estado_cuenta"];

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
  return value === "reservas" || value === "menus" || value === "comida" || value === "ajustes" || value === "miembros" || value === "fichaje" || value === "horarios" || value === "facturas" || value === "reportes" || value === "estado_cuenta";
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
  if (pathname.startsWith("/app/comida")) return "comida";
  if (pathname.startsWith("/app/settings")) return "ajustes";
  if (pathname.startsWith("/app/miembros")) return "miembros";
  // /app/miembros/mi-horario is a special route for viewing own schedule
  if (pathname === "/app/miembros/mi-horario") return "horarios";
  if (pathname.startsWith("/app/horarios")) return "horarios";
  if (pathname.startsWith("/app/fichaje")) return "fichaje";
  if (pathname.startsWith("/app/facturas")) return "facturas";
  if (pathname.startsWith("/app/reportes")) return "reportes";
  if (pathname.startsWith("/app/estado-cuenta")) return "estado_cuenta";
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

// Role importance levels for access control
export const ROLE_IMPORTANCE: Record<BORole, number> = {
  root: 100,
  admin: 90,
  metre: 70,
  jefe_cocina: 60,
  arrocero: 30,
  pinche_cocina: 20,
  fregaplatos: 10,
  ayudante_cocina: 25,
  camarero: 40,
  responsable_sala: 50,
  ayudante_camarero: 35,
  runner: 15,
  barista: 20,
};

// Check if user can manage (create/edit/delete) horarios
// Admin roles (importance >= 70) can manage all schedules
// Non-admin users can only view their own schedule
export function canManageHorarios(roleRaw: string | null | undefined, roleImportanceRaw?: number | null): boolean {
  const role = normalizeRole(roleRaw);
  const importance = typeof roleImportanceRaw === "number" ? roleImportanceRaw : ROLE_IMPORTANCE[role] ?? 0;
  // Users with importance >= 70 can manage all schedules
  return importance >= 70;
}

// Check if user can view their own schedule (even if they can't manage)
export function canViewOwnSchedule(roleRaw: string | null | undefined): boolean {
  // All users with a role can view their own schedule
  const role = normalizeRole(roleRaw);
  return role !== "" && role !== null;
}
