import type { BOSection } from "./rbac";

/** Supported A/B versions assignable per user+restaurant. */
export const APP_VERSIONS = ["0.1", "0.2"] as const;
export type AppVersion = (typeof APP_VERSIONS)[number];

export type AppCapability = "stock" | "pos" | "estadisticas" | "plataforma" | "ads";

const CAPABILITY_MIN_VERSION: Record<AppCapability, AppVersion> = {
  stock: "0.2",
  pos: "0.2",
  estadisticas: "0.2",
  plataforma: "0.2",
  ads: "0.2",
};

const SECTION_CAPABILITY: Partial<Record<BOSection, AppCapability>> = {
  stock: "stock",
  pos: "pos",
  estadisticas: "estadisticas",
  plataforma: "plataforma",
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
  const parse = (value: string): [number, number] | null => {
    const parts = value.trim().split(".");
    if (parts.length !== 2) return null;
    const major = Number(parts[0]);
    const minor = Number(parts[1]);
    if (!Number.isInteger(major) || !Number.isInteger(minor) || major < 0 || minor < 0) return null;
    return [major, minor];
  };
  const current = parse(version);
  const required = parse(minimum);
  if (!current || !required) return false;
  if (current[0] !== required[0]) return current[0] > required[0];
  return current[1] >= required[1];
}

export function hasAppCapability(appVersionRaw: unknown, capability: AppCapability): boolean {
  return appVersionAtLeast(normalizeAppVersion(appVersionRaw), CAPABILITY_MIN_VERSION[capability]);
}

export function sectionAllowedByAppVersion(section: BOSection, appVersionRaw: unknown): boolean {
  const capability = SECTION_CAPABILITY[section];
  return capability ? hasAppCapability(appVersionRaw, capability) : true;
}
