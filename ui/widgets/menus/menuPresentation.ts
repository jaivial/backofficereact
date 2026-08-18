import { Lock, Star, Users, UsersRound, UtensilsCrossed } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type MenuTypePanelDef = {
  value: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

export const MENU_TYPE_PANELS: readonly MenuTypePanelDef[] = [
  { value: "closed_conventional", label: "Menu cerrado convencional", icon: Lock, description: "Menu fijo con precio cerrado" },
  { value: "closed_group", label: "Menu cerrado grupo", icon: Users, description: "Menu fijo para grupos" },
  { value: "a_la_carte", label: "A la carta convencional", icon: UtensilsCrossed, description: "Carta con platos a elegir" },
  { value: "a_la_carte_group", label: "A la carta grupo", icon: UsersRound, description: "Carta para grupos" },
  { value: "special", label: "Menu especial", icon: Star, description: "Menu especial con imagen" },
];

export const MENU_TYPE_ORDER: string[] = MENU_TYPE_PANELS.map((panel) => panel.value);

const MENU_TYPE_QUERY_SLUGS: Record<string, string> = {
  closed_conventional: "menucerradoconvencional",
  closed_group: "menucerradogrupo",
  a_la_carte: "alacarteconvencional",
  a_la_carte_group: "alacartegrupo",
  special: "menuespecial",
};

const MENU_TYPE_BY_QUERY_SLUG = Object.fromEntries(
  Object.entries(MENU_TYPE_QUERY_SLUGS).map(([type, slug]) => [slug, type]),
) as Record<string, string>;

export function menuTypeQuerySlug(kind: string): string {
  return MENU_TYPE_QUERY_SLUGS[kind] ?? MENU_TYPE_QUERY_SLUGS.closed_conventional;
}

export function menuTypeFromQuerySlug(slug: unknown): string | null {
  if (typeof slug !== "string" || !slug) return null;
  return MENU_TYPE_BY_QUERY_SLUG[slug] ?? (MENU_TYPE_ORDER.includes(slug) ? slug : null);
}

export function menuTypeFullLabel(kind: string): string {
  return MENU_TYPE_PANELS.find((panel) => panel.value === kind)?.label ?? MENU_TYPE_PANELS[0].label;
}

export function formatMenuPrice(price: string): string {
  const n = Number(price);
  if (!Number.isFinite(n)) return price;
  return `${n.toFixed(2)} €`;
}

export function menuTypeLabel(kind: string): string {
  if (kind === "closed_group") return "Cerrado grupo";
  if (kind === "a_la_carte") return "A la carta";
  if (kind === "a_la_carte_group") return "A la carta grupo";
  if (kind === "special") return "Especial";
  return "Cerrado convencional";
}
