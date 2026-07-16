import { SPAIN_PROVINCES, SPAIN_MUNICIPIOS_BY_PROVINCE } from "./spainLocations";

export const PROVINCE_NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  SPAIN_PROVINCES.map((p) => [p.code, p.name]),
);

export const PROVINCE_CODE_BY_NAME: Record<string, string> = Object.fromEntries(
  SPAIN_PROVINCES.map((p) => [p.name, p.code]),
);

let allMunicipiosCache: string[] | null = null;

/** Flat, de-duplicated, alphabetically sorted list of every municipio in Spain. */
export function allMunicipios(): string[] {
  if (allMunicipiosCache) return allMunicipiosCache;
  const set = new Set<string>();
  for (const code of Object.keys(SPAIN_MUNICIPIOS_BY_PROVINCE)) {
    for (const name of SPAIN_MUNICIPIOS_BY_PROVINCE[code]) set.add(name);
  }
  allMunicipiosCache = Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  return allMunicipiosCache;
}

let municipioToProvinceCache: Map<string, string> | null = null;

/** Returns the province code a municipio belongs to (first match if duplicated). */
export function provinceCodeForMunicipio(name: string): string | undefined {
  if (!municipioToProvinceCache) {
    municipioToProvinceCache = new Map();
    for (const code of Object.keys(SPAIN_MUNICIPIOS_BY_PROVINCE)) {
      for (const municipio of SPAIN_MUNICIPIOS_BY_PROVINCE[code]) {
        if (!municipioToProvinceCache.has(municipio)) municipioToProvinceCache.set(municipio, code);
      }
    }
  }
  return municipioToProvinceCache.get(name);
}
