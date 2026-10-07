import {
  Bean,
  Egg,
  Fish,
  FlaskConical,
  LeafyGreen,
  Milk,
  Nut,
  CircleDot,
  Shrimp,
  Sprout,
  Wheat,
  Shell,
} from "lucide-react";

// Coordination id: menu_type_codes_v1 - the numeric menu_type codes, their
// meaning and the legacy string mapping live in
// ui/widgets/menus/menuTypeCodes.ts; the panels themselves are owned by
// ui/widgets/menus/menuPresentation.ts. Only the editor-specific hints below
// are local to the creator wizard.
import { MENU_TYPE_PANELS } from "../../../../../ui/widgets/menus/menuPresentation";
import { MENU_TYPE } from "../../../../../ui/widgets/menus/menuTypeCodes";
import type { MenuTypeCode } from "../../../../../ui/widgets/menus/menuTypeCodes";

export const MENU_TYPE_HINTS: Partial<Record<MenuTypeCode, string>> = {
  [MENU_TYPE.CLOSED_CONVENTIONAL]: "Estructura fija y rapida para menus clasicos",
  [MENU_TYPE.CLOSED_GROUP]: "Pensado para grupos con timing de servicio",
  [MENU_TYPE.A_LA_CARTE]: "Carta abierta con mas libertad de eleccion",
  [MENU_TYPE.A_LA_CARTE_GROUP]: "Version de carta para reservas de grupo",
  [MENU_TYPE.SPECIAL]: "Menu de temporada o evento con presentacion especial",
};

export const MENU_TYPES = MENU_TYPE_PANELS.map((panel) => ({
  ...panel,
  enabled: true,
  hint: MENU_TYPE_HINTS[panel.value] ?? "Plantilla lista para editar",
}));

/** Select-compatible options: the numeric code serialised as a string. */
export const menuTypeOptions: { value: string; label: string }[] = MENU_TYPES
  .filter((panel) => panel.enabled)
  .map((panel) => ({ value: String(panel.value), label: panel.label }));

export const DEFAULT_BEVERAGE = {
  type: "no_incluida",
  price_per_person: null as number | null,
  has_supplement: false,
  supplement_price: null as number | null,
};

export const ALLERGENS = [
  { key: "Gluten", icon: Wheat },
  { key: "Crustaceos", icon: Shrimp },
  { key: "Huevos", icon: Egg },
  { key: "Pescado", icon: Fish },
  { key: "Cacahuetes", icon: Nut },
  { key: "Soja", icon: Bean },
  { key: "Leche", icon: Milk },
  { key: "Frutos de cascara", icon: Nut },
  { key: "Apio", icon: LeafyGreen },
  { key: "Mostaza", icon: Sprout },
  { key: "Sesamo", icon: CircleDot },
  { key: "Sulfitos", icon: FlaskConical },
  { key: "Altramuces", icon: Bean },
  { key: "Moluscos", icon: Shell },
] as const;

export const beverageTypeOptions: { value: string; label: string }[] = [
  { value: "no_incluida", label: "No incluida" },
  { value: "opcion", label: "Opcion bebida ilimitada" },
  { value: "ilimitada", label: "Bebida ilimitada" },
];

export const dishVisibilityOptions: { value: string; label: string }[] = [
  { value: "without_image", label: "Sin imagen" },
  { value: "with_image", label: "Con imagen" },
];

export const menuPreviewVisibilityOptions: { value: string; label: string }[] = [
  { value: "without_preview", label: "Sin imagen" },
  { value: "with_preview", label: "Con imagen" },
];

export const DISH_IMAGE_AI_MAX_KB = 150;
export const MENU_AI_TRACE_PREFIX = "[MENU_AI_TRACE]";
