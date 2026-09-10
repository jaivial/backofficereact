import { IceCreamCone, Salad, Soup, Sparkles, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Section kinds an operator can add from the "Anadir seccion" modal, and the
 * title each one seeds. Single source of truth shared by the modal, the menu
 * editor hook, and the section settings tab.
 *
 * Coordination id: menu_section_kind_presets_v1
 * (backoffice modal -> section row -> backend group_menu_sections_v2.section_kind)
 */
export type SectionKindPresetDef = {
  /** Persisted section_kind (must match the backend normalizeV2SectionKind output). */
  value: string;
  /** Modal option label. */
  label: string;
  /** Title seeded into the new section ("" seeds a blank, operator-named section). */
  seedTitle: string;
  icon: LucideIcon;
  description: string;
  /** True when picking this option opens a second step instead of creating at once. */
  needsExtraStep?: boolean;
};

export const SECTION_KIND_PRESETS: readonly SectionKindPresetDef[] = [
  { value: "entrantes", label: "Entrantes", seedTitle: "Entrantes", icon: Salad, description: "Seccion de entrantes" },
  { value: "principales", label: "Principal", seedTitle: "Principal", icon: UtensilsCrossed, description: "Seccion de principales" },
  { value: "arroces", label: "Arroz", seedTitle: "Arroz", icon: Soup, description: "Seccion de arroces" },
  { value: "postres", label: "Postres", seedTitle: "Postres", icon: IceCreamCone, description: "Seccion de postres", needsExtraStep: true },
  { value: "custom", label: "Personalizada", seedTitle: "", icon: Sparkles, description: "Seccion en blanco" },
];

export const SECTION_KIND_PRESET_OPTIONS: { value: string; label: string }[] = SECTION_KIND_PRESETS.map(
  (preset) => ({ value: preset.value, label: preset.label }),
);

export function sectionKindPreset(value: string): SectionKindPresetDef {
  return SECTION_KIND_PRESETS.find((preset) => preset.value === value) ?? SECTION_KIND_PRESETS[SECTION_KIND_PRESETS.length - 1];
}

/**
 * Title a freshly added section should carry. Entrantes/Principal/Arroz/Postres
 * seed their own name; "Personalizada" stays blank so the operator names it.
 */
export function sectionKindSeedTitle(value: string): string {
  return sectionKindPreset(value).seedTitle;
}

/** Dessert source of a "postres" section. Coordination id: dessert_section_source_v1 */
export type DessertSource = "general" | "custom";

export const DESSERT_SOURCE_GENERAL: DessertSource = "general";
export const DESSERT_SOURCE_CUSTOM: DessertSource = "custom";

export type DessertSourceOptionDef = {
  value: DessertSource;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const DESSERT_SOURCE_OPTIONS: readonly DessertSourceOptionDef[] = [
  {
    value: DESSERT_SOURCE_GENERAL,
    label: "Usar la carta general de postres",
    description:
      "Los postres estaran sincronizados con la carta general de postres y seran read only. La unica forma de cambiarlos es en /app/comida/postres.",
    icon: IceCreamCone,
  },
  {
    value: DESSERT_SOURCE_CUSTOM,
    label: "Carta de postres personalizada",
    description: "Anade la seccion de postres con los platos de la carta de postres completamente customizable.",
    icon: Sparkles,
  },
];

export function normalizeDessertSource(kind: string, source: unknown): DessertSource {
  // Only dessert sections can mirror the general carta, mirroring the backend
  // normalizer so the UI never shows an impossible state.
  if (String(kind || "").toLowerCase().trim() !== "postres") return DESSERT_SOURCE_CUSTOM;
  return String(source || "").toLowerCase().trim() === DESSERT_SOURCE_GENERAL ? DESSERT_SOURCE_GENERAL : DESSERT_SOURCE_CUSTOM;
}

export function isGeneralDessertSection(kind: string, source: unknown): boolean {
  return normalizeDessertSource(kind, source) === DESSERT_SOURCE_GENERAL;
}

export function dessertSourceLabel(source: DessertSource): string {
  return DESSERT_SOURCE_OPTIONS.find((option) => option.value === source)?.label ?? DESSERT_SOURCE_OPTIONS[1].label;
}
