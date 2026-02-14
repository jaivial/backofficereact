import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { MenuTable, MenuVisibilityItem } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Menus" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let visibility: MenuVisibilityItem[] = [];
  let dia: MenuTable | null = null;
  let error: string | null = null;

  try {
    const [v, d] = await Promise.all([api.menus.visibility.list(), api.menus.dia.get()]);
    if (v.success) visibility = v.menus;
    else error = v.message || "Error cargando visibilidad";

    if (d.success) dia = d.menu;
    else if (!error) error = d.message || "Error cargando menu del dia";
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando menus";
  }

  return { visibility, dia, error };
}

