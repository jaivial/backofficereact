export type CanonicalAllergen = {
  key: string;
  label: string;
  icon: string;
};

/** The 14 allergens regulated by EU Regulation 1169/2011, in display order. */
export const CANONICAL_ALLERGENS: readonly CanonicalAllergen[] = [
  { key: "Gluten", label: "Gluten", icon: "/media/images/gluten.png" },
  { key: "Crustaceos", label: "Crustaceos", icon: "/media/images/crustaceos.png" },
  { key: "Huevos", label: "Huevos", icon: "/media/images/huevos.png" },
  { key: "Pescado", label: "Pescado", icon: "/media/images/pescado.png" },
  { key: "Cacahuetes", label: "Cacahuetes", icon: "/media/images/cacahuetes.png" },
  { key: "Soja", label: "Soja", icon: "/media/images/soja.png" },
  { key: "Leche", label: "Leche", icon: "/media/images/leche.png" },
  { key: "Frutos de cascara", label: "Frutos de cascara", icon: "/media/images/frutoscascara.png" },
  { key: "Apio", label: "Apio", icon: "/media/images/apio.png" },
  { key: "Mostaza", label: "Mostaza", icon: "/media/images/mostaza.png" },
  { key: "Sesamo", label: "Sesamo", icon: "/media/images/sesamo.png" },
  { key: "Sulfitos", label: "Sulfitos", icon: "/media/images/sulfitos.png" },
  { key: "Altramuces", label: "Altramuces", icon: "/media/images/altramuces.png" },
  { key: "Moluscos", label: "Moluscos", icon: "/media/images/moluscos.png" },
] as const;

export const ALLERGEN_KEYS: ReadonlySet<string> = new Set(CANONICAL_ALLERGENS.map((item) => item.key));

const ALLERGEN_BY_KEY: ReadonlyMap<string, CanonicalAllergen> = new Map(
  CANONICAL_ALLERGENS.map((item) => [item.key, item]),
);

const ALLERGEN_ORDER: ReadonlyMap<string, number> = new Map(
  CANONICAL_ALLERGENS.map((item, index) => [item.key, index]),
);

/** Legacy spellings persisted by older comida/menu code, keyed by normalized lookup form. */
export const ALLERGEN_ALIAS_TO_CANONICAL: Record<string, string> = {
  gluten: "Gluten",
  crustaceos: "Crustaceos",
  huevos: "Huevos",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lacteos: "Leche",
  leche: "Leche",
  "frutos secos": "Frutos de cascara",
  frutos_secos: "Frutos de cascara",
  "frutos de cascara": "Frutos de cascara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sesamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

/** Lowercase, trim and strip diacritics so "Sésamo" and "sesamo" resolve alike. */
function lookupForm(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function normalizeAllergen(value: string | null | undefined): string | null {
  if (!value) return null;
  const canonical = ALLERGEN_ALIAS_TO_CANONICAL[lookupForm(String(value))];
  return canonical || null;
}

export function normalizeAllergenList(values: readonly unknown[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  for (const value of values) {
    const canonical = normalizeAllergen(typeof value === "string" ? value : null);
    if (canonical) seen.add(canonical);
  }
  return Array.from(seen).sort((a, b) => (ALLERGEN_ORDER.get(a) ?? 0) - (ALLERGEN_ORDER.get(b) ?? 0));
}

export function allergenIconSrc(key: string): string | null {
  return ALLERGEN_BY_KEY.get(key)?.icon ?? null;
}

export function allergenLabel(key: string): string {
  return ALLERGEN_BY_KEY.get(key)?.label ?? key;
}
