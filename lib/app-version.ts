import type { BOSection } from "./rbac";

/** Supported A/B versions assignable per user+restaurant. */
export const APP_VERSIONS = ["0.0.1", "0.1", "0.2", "0.3", "0.4"] as const;
export type AppVersion = (typeof APP_VERSIONS)[number];

export type AppCapability = "mobileNavOrder" | "stock" | "pos" | "estadisticas" | "plataforma" | "ads" | "campanas";

const CAPABILITY_MIN_VERSION: Record<AppCapability, AppVersion> = {
  mobileNavOrder: "0.0.1",
  stock: "0.2",
  pos: "0.2",
  estadisticas: "0.2",
  plataforma: "0.2",
  ads: "0.2",
  campanas: "0.3",
};

const SECTION_CAPABILITY: Partial<Record<BOSection, AppCapability>> = {
  stock: "stock",
  pos: "pos",
  estadisticas: "estadisticas",
  plataforma: "plataforma",
  campanas: "campanas",
};

export function isSupportedAppVersion(raw: unknown): raw is AppVersion {
  const value = String(raw ?? "").trim();
  return APP_VERSIONS.some((version) => version === value);
}

/** DB/session fallback only. Request validation should use isSupportedAppVersion. */
export function normalizeAppVersion(raw: unknown): AppVersion {
  const value = String(raw ?? "").trim();
  return isSupportedAppVersion(value) ? value : "0.1";
}

/** Numeric dotted comparison kept generic so adding 0.3 does not change the algorithm. */
export function appVersionAtLeast(version: string, minimum: string): boolean {
  const parse = (value: string): number[] | null => {
    const parts = value.trim().split(".");
    if (parts.length < 2 || parts.length > 3) return null;
    const parsed = parts.map(Number);
    if (parsed.some((part) => !Number.isInteger(part) || part < 0)) return null;
    while (parsed.length < 3) parsed.push(0);
    return parsed;
  };
  const current = parse(version);
  const required = parse(minimum);
  if (!current || !required) return false;
  for (let index = 0; index < 3; index += 1) {
    if (current[index] !== required[index]) return current[index] > required[index];
  }
  return true;
}

/**
 * Version 0.4 is the restricted line: it is an explicit whitelist instead of a
 * minimum-version ladder, so it can keep campanas while dropping stock / TPV /
 * estadisticas / plataforma / ads (which sort below it) and ajustes / website /
 * reportes / estado_cuenta. Mirrors boAppVersion04Modules on the backend.
 */
const VERSION_SECTION_ALLOWLIST: Partial<Record<AppVersion, BOSection[]>> = {
  "0.4": ["reservas", "menus", "comida", "miembros", "horarios", "fichaje", "facturas", "campanas"],
};

const VERSION_CAPABILITY_ALLOWLIST: Partial<Record<AppVersion, AppCapability[]>> = {
  "0.4": ["mobileNavOrder", "campanas"],
};

export function hasAppCapability(appVersionRaw: unknown, capability: AppCapability): boolean {
  const version = normalizeAppVersion(appVersionRaw);
  const allowlist = VERSION_CAPABILITY_ALLOWLIST[version];
  if (allowlist) return allowlist.includes(capability);
  return appVersionAtLeast(version, CAPABILITY_MIN_VERSION[capability]);
}

export function sectionAllowedByAppVersion(section: BOSection, appVersionRaw: unknown): boolean {
  const version = normalizeAppVersion(appVersionRaw);
  const allowlist = VERSION_SECTION_ALLOWLIST[version];
  if (allowlist) return allowlist.includes(section);
  const capability = SECTION_CAPABILITY[section];
  return capability ? hasAppCapability(version, capability) : true;
}
