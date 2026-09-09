export type BORole = string;

export type BOSection = "campanas" | "reservas" | "menus" | "comida" | "stock" | "pos" | "ajustes" | "miembros" | "fichaje" | "horarios" | "facturas" | "reportes" | "estadisticas" | "estado_cuenta" | "website" | "site-builder" | "plataforma";

export const ROLE_SECTION_ACCESS: Record<string, BOSection[]> = {
  root: ["reservas", "menus", "comida", "stock", "pos", "ajustes", "miembros", "horarios", "fichaje", "facturas", "reportes", "estadisticas", "estado_cuenta", "website", "site-builder", "plataforma", "campanas"],
  admin: ["reservas", "menus", "comida", "stock", "pos", "ajustes", "miembros", "horarios", "fichaje", "facturas", "reportes", "estadisticas", "estado_cuenta", "website", "site-builder", "campanas"],
  metre: ["reservas", "menus", "comida", "fichaje", "facturas"],
  jefe_cocina: ["reservas", "menus", "comida", "stock", "fichaje", "horarios"],
  arrocero: ["fichaje", "horarios"],
  pinche_cocina: ["fichaje", "horarios"],
  fregaplatos: ["fichaje", "horarios"],
  ayudante_cocina: ["fichaje", "horarios"],
  camarero: ["fichaje", "horarios"],
  responsable_sala: ["fichaje", "horarios"],
  ayudante_camarero: ["fichaje", "horarios"],
  runner: ["fichaje", "horarios"],
  barista: ["fichaje", "horarios"],
};

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
  return value === "campanas" || value === "reservas" || value === "menus" || value === "comida" || value === "stock" || value === "pos" || value === "ajustes" || value === "website" || value === "site-builder" || value === "miembros" || value === "fichaje" || value === "horarios" || value === "facturas" || value === "reportes" || value === "estadisticas" || value === "estado_cuenta" || value === "plataforma";
}

export function normalizeSectionAccess(sectionAccessRaw: string[] | null | undefined): BOSection[] {
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

export function sectionAllowedByImportance(section: BOSection, roleImportanceRaw?: number | null): boolean {
  if (section !== "miembros" && section !== "plataforma") return true;
  if (typeof roleImportanceRaw !== "number") return true;
  if (section === "plataforma") return roleImportanceRaw >= 100;
  return roleImportanceRaw >= 90;
}

export function hasRoleSectionAccess(
  roleRaw: string | null | undefined,
  section: BOSection,
  sectionAccessRaw?: string[] | null,
  roleImportanceRaw?: number | null,
): boolean {
  if (!sectionAllowedByImportance(section, roleImportanceRaw)) return false;
  const role = normalizeRole(roleRaw);
  if ((role === "root" || role === "admin") && (section === "stock" || section === "pos" || section === "estadisticas" || section === "campanas")) return true;
  const explicit = normalizeSectionAccess(sectionAccessRaw);
  if (explicit.length > 0) return explicit.includes(section);
  return (ROLE_SECTION_ACCESS[role] ?? []).includes(section);
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
