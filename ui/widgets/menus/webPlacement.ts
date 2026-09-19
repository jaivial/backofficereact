/**
 * Placement options for public web visibility of a food-type page or a
 * per-menu entry. Reused by the food-type settings panel and the menu
 * configuracion tab so the dropdown and the labels stay aligned.
 *
 * Coordination id: foodtype_page_visibility_v1 + special_menu_visibility_v1
 * (backoffice -> DB -> public REST -> preact nav)
 */
export const WEB_PLACEMENT_OPTIONS = [
  { value: "inside_menus", label: "Dentro de menus" },
  { value: "independent_section", label: "Seccion independiente" },
];

/**
 * Normalize any placement string read from the backend to one of the two
 * known values, so the public client never has to defend against unexpected
 * rows.
 */
export function normalizeWebPlacement(value: string | null | undefined): string {
  return String(value || "").trim() === "independent_section" ? "independent_section" : "inside_menus";
}
