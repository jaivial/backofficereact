/**
 * Menus Page Constants
 * Static configuration values for the menus page
 */

export const MENU_STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
];

export const MENU_SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_desc", label: "Adicion mas nueva" },
  { value: "created_asc", label: "Adicion mas antigua" },
  { value: "price_asc", label: "Precio ascendente" },
  { value: "price_desc", label: "Precio descendente" },
];

export const DEFAULT_MENU_TYPE_FILTER = "all";
export const DEFAULT_STATUS_FILTER = "all";
export const DEFAULT_SORT_OPTION = "created_desc";
