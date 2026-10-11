import { MENU_TYPE, type MenuTypeCode } from "../../../../ui/widgets/menus/menuTypeCodes";

/**
 * Mobile menus hub grouping (coordination: mobile menus hub v1).
 * The hub groups the backend menu_type domain into tappable buckets.
 * Slugs are the /m/app/menus/<slug> route params.
 */
export type MenuTypeGroup = {
  slug: string;
  label: string;
  desc: string;
  color: string;
  codes: MenuTypeCode[];
};

export const MENU_TYPE_GROUPS: MenuTypeGroup[] = [
  {
    slug: "cerrados",
    label: "Menus cerrados",
    desc: "Convencionales y de grupo",
    color: "bg-amber-500",
    codes: [MENU_TYPE.CLOSED_CONVENTIONAL, MENU_TYPE.CLOSED_GROUP],
  },
  {
    slug: "carta",
    label: "Carta",
    desc: "A la carta y carta grupal",
    color: "bg-indigo-500",
    codes: [MENU_TYPE.A_LA_CARTE, MENU_TYPE.A_LA_CARTE_GROUP, MENU_TYPE.A_LA_CARTE_TIME],
  },
  {
    slug: "especiales",
    label: "Especiales",
    desc: "Temporada y eventos",
    color: "bg-rose-500",
    codes: [MENU_TYPE.SPECIAL],
  },
];

export function menuTypeGroupForSlug(slug: string): MenuTypeGroup | null {
  return MENU_TYPE_GROUPS.find((g) => g.slug === slug) ?? null;
}
