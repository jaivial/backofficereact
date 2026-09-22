import { useEffect, useMemo, useState } from "react";
import { createClient } from "../../../../../../api/client";
import { WEBSITE_ROUTE_OPTIONS } from "../lib/adEditor";

export type RouteOption = { value: string; label: string };

const MENU_TYPE_LABEL: Record<string, string> = {
  special: "Menú especial",
  closed_group: "Menú de grupo",
  a_la_carte_group: "Carta de grupo",
  a_la_carte: "Carta",
  closed_conventional: "Menú",
};

/**
 * Coordination id: ads_cta_menu_routes_v1. Button "Web" destinations are the
 * static public pages plus every active menu (any type, specials included),
 * linked through the public `/menu/:id` route the backend also accepts.
 */
export function useMenuRouteOptions(): RouteOption[] {
  const [menus, setMenus] = useState<RouteOption[]>([]);

  useEffect(() => {
    let alive = true;
    void createClient({ baseUrl: "" })
      .menus.gruposV2.list(false)
      .then((res) => {
        if (!alive || !res.success) return;
        setMenus(
          res.menus
            .filter((menu) => menu.active && !menu.is_draft)
            .map((menu) => ({
              value: `/menu/${menu.id}`,
              label: `${MENU_TYPE_LABEL[menu.menu_type] ?? "Menú"}: ${menu.menu_title || `#${menu.id}`}`,
            })),
        );
      })
      .catch(() => {
        console.warn("[ads_cta_menu_routes_v1] active menus unavailable, using static routes");
      });
    return () => {
      alive = false;
    };
  }, []);

  return useMemo(() => [...WEBSITE_ROUTE_OPTIONS, ...menus], [menus]);
}
