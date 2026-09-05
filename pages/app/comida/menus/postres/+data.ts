import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../../api/client";
import type { GroupMenuV2, MenuSlider } from "../../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

// Coordination id: menu_section_public_placement_v1
// Postres is a normal menu (legacy_source_table = 'POSTRES'), so this loader
// resolves its id and then reuses the shared menu editor loader shape.
export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Postres" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let menu: GroupMenuV2 | null = null;
  const slider: MenuSlider | null = null;
  let error: string | null = null;

  try {
    const resolved = await api.menus.gruposV2.resolvePostres();
    if (!resolved.success) throw new Error(resolved.message || "No se pudo resolver postres");
    const menuRes = await api.menus.gruposV2.get(resolved.menu_id);
    if (menuRes.success) menu = menuRes.menu;
    else error = menuRes.message || "No se pudo cargar postres";
  } catch (e) {
    error = e instanceof Error ? e.message : "No se pudo cargar postres";
  }

  return { menu, slider, error };
}
