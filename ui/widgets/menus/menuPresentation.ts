import { Lock, Star, Users, UsersRound, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DEFAULT_MENU_TYPE, MENU_TYPE, normalizeMenuType } from "./menuTypeCodes";
import type { MenuTypeCode } from "./menuTypeCodes";

// Coordination id: menu_type_codes_v1 - the numeric codes and their meaning
// live in ./menuTypeCodes; this file only owns the presentation (labels,
// icons and the external URL contract).

export type MenuTypePanelDef = {
  value: MenuTypeCode;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const MENU_TYPE_PANELS: readonly MenuTypePanelDef[] = [
  { value: MENU_TYPE.CLOSED_CONVENTIONAL, label: "Menu cerrado convencional", icon: Lock, description: "Menu fijo con precio cerrado" },
  { value: MENU_TYPE.CLOSED_GROUP, label: "Menu cerrado grupo", icon: Users, description: "Menu fijo para grupos" },
  { value: MENU_TYPE.A_LA_CARTE, label: "A la carta convencional", icon: UtensilsCrossed, description: "Carta con platos a elegir" },
  { value: MENU_TYPE.A_LA_CARTE_GROUP, label: "A la carta grupo", icon: UsersRound, description: "Carta para grupos" },
  { value: MENU_TYPE.SPECIAL, label: "Menu especial", icon: Star, description: "Menu especial con imagen" },
];

export const MENU_TYPE_ORDER: MenuTypeCode[] = MENU_TYPE_PANELS.map((panel) => panel.value);

/**
 * EXTERNAL URL CONTRACT (`?menutype=<slug>`): these slugs are stored in user
 * bookmarks, so they must never change. Only the map key (now the numeric
 * code) changed when menu_type moved from strings to codes.
 */
const DEFAULT_MENU_TYPE_QUERY_SLUG = "menucerradoconvencional";

const MENU_TYPE_QUERY_SLUGS: Partial<Record<MenuTypeCode, string>> = {
  [MENU_TYPE.CLOSED_CONVENTIONAL]: DEFAULT_MENU_TYPE_QUERY_SLUG,
  [MENU_TYPE.CLOSED_GROUP]: "menucerradogrupo",
  [MENU_TYPE.A_LA_CARTE]: "alacarteconvencional",
  [MENU_TYPE.A_LA_CARTE_GROUP]: "alacartegrupo",
  [MENU_TYPE.SPECIAL]: "menuespecial",
};

const MENU_TYPE_BY_QUERY_SLUG: Record<string, MenuTypeCode> = Object.fromEntries(
  Object.entries(MENU_TYPE_QUERY_SLUGS).map(([type, slug]) => [slug, Number(type) as MenuTypeCode]),
);

export function menuTypeQuerySlug(rawMenuType: unknown): string {
  return MENU_TYPE_QUERY_SLUGS[normalizeMenuType(rawMenuType)] ?? DEFAULT_MENU_TYPE_QUERY_SLUG;
}

export function menuTypeFromQuerySlug(slug: unknown): MenuTypeCode | null {
  if (typeof slug !== "string" || !slug) return null;
  return MENU_TYPE_BY_QUERY_SLUG[slug] ?? null;
}

export function menuTypeFullLabel(rawMenuType: unknown): string {
  const code = normalizeMenuType(rawMenuType);
  return MENU_TYPE_PANELS.find((panel) => panel.value === code)?.label ?? MENU_TYPE_PANELS[0].label;
}

export function formatMenuPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return `${n.toFixed(2)} €`;
}

const MENU_TYPE_SHORT_LABELS: Record<MenuTypeCode, string> = {
  [MENU_TYPE.UNKNOWN]: "Cerrado convencional",
  [MENU_TYPE.CLOSED_CONVENTIONAL]: "Cerrado convencional",
  [MENU_TYPE.CLOSED_GROUP]: "Cerrado grupo",
  [MENU_TYPE.A_LA_CARTE]: "A la carta",
  [MENU_TYPE.A_LA_CARTE_GROUP]: "A la carta grupo",
  [MENU_TYPE.A_LA_CARTE_TIME]: "A la carta por tiempo",
  [MENU_TYPE.SPECIAL]: "Especial",
};

export function menuTypeLabel(rawMenuType: unknown): string {
  return MENU_TYPE_SHORT_LABELS[normalizeMenuType(rawMenuType)];
}
