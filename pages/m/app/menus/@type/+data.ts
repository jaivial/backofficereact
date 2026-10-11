import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../../api/client";
import type { GroupMenuV2Summary } from "../../../../../api/types";
import { menuTypeGroupForSlug } from "../menuTypeGroups";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const slug = pageContext.routeParams?.type ?? "";
  const group = menuTypeGroupForSlug(slug);
  const config = useConfig();
  config({ title: group ? group.label : "Menus" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let menus: GroupMenuV2Summary[] = [];
  let error: string | null = null;

  if (!group) {
    error = "Tipo de menu no valido";
  } else {
    try {
      const res = await api.menus.gruposV2.list(true);
      if (res.success) {
        const codes = new Set<number>(group.codes);
        menus = (Array.isArray(res.menus) ? res.menus : []).filter((m) => codes.has(Number(m.menu_type)));
      } else {
        error = res.message || "Error cargando menus";
      }
    } catch (e) {
      error = e instanceof Error ? e.message : "Error cargando menus";
    }
  }

  return { slug, groupLabel: group?.label ?? null, groupDesc: group?.desc ?? null, menus, error };
}
