import {
  Bean,
  Egg,
  Fish,
  FlaskConical,
  LeafyGreen,
  Lock,
  Milk,
  Nut,
  CircleDot,
  Shrimp,
  Sprout,
  Star,
  Users,
  UsersRound,
  Wheat,
  Shell,
  UtensilsCrossed,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MenuTypePanelDef = {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

const MENU_TYPE_PANELS: readonly MenuTypePanelDef[] = [
  { value: "closed_conventional", label: "Menu cerrado convencional", icon: Lock, description: "Menu fijo con precio cerrado" },
  { value: "closed_group", label: "Menu cerrado grupal", icon: Users, description: "Menu cerrado para grupos" },
  { value: "a_la_carte", label: "Carta", icon: UtensilsCrossed, description: "Carta abierta" },
  { value: "a_la_carte_group", label: "Carta grupal", icon: UsersRound, description: "Carta para grupos" },
  { value: "special", label: "Menu especial", icon: Star, description: "Menu de temporada o evento" },
];

export const MENU_TYPE_HINTS: Record<string, string> = {
  closed_conventional: "Estructura fija y rapida para menus clasicos",
  closed_group: "Pensado para grupos con timing de servicio",
  a_la_carte: "Carta abierta con mas libertad de eleccion",
  a_la_carte_group: "Version de carta para reservas de grupo",
  special: "Menu de temporada o evento con presentacion especial",
};

export const MENU_TYPES = MENU_TYPE_PANELS.map((panel) => ({
  ...panel,
  enabled: true,
  hint: MENU_TYPE_HINTS[panel.value] ?? "Plantilla lista para editar",
}));

export const menuTypeOptions: { value: string; label: string }[] = MENU_TYPES
  .filter((panel) => panel.enabled)
  .map((panel) => ({ value: panel.value, label: panel.label }));

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
