import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { GroupMenuV2 } from "../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Editor de menus" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  const rawMenuId = typeof pageContext.urlParsed?.search?.menuId === "string" ? pageContext.urlParsed.search.menuId : "";
  const menuId = Number(rawMenuId);

  let menu: GroupMenuV2 | null = null;
  let error: string | null = null;

  if (Number.isFinite(menuId) && menuId > 0) {
    try {
      const res = await api.menus.gruposV2.get(menuId);
      if (res.success) menu = res.menu;
      else error = res.message || "No se pudo cargar el menu";
    } catch (e) {
      error = e instanceof Error ? e.message : "No se pudo cargar el menu";
    }
  }

  return { menu, error };
}
