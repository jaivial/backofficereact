import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { GroupMenuV2Summary } from "../../../../api/types";
// Coordination id: menu_editor_preview_open_v1
import { menuEditorPreviewOpenFromPrefs } from "../../../../lib/menuEditorPreferences";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Menus" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let menus: GroupMenuV2Summary[] = [];
  let error: string | null = null;

  try {
    const res = await api.menus.gruposV2.list(true);
    if (res.success) menus = Array.isArray(res.menus) ? res.menus : [];
    else error = res.message || "Error cargando menus";
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando menus";
  }

  // The editor/preview split is a per-user preference; the session REST carries
  // it so the page (and the add-menu modal) hydrates with the right split.
  return { menus, error, editorPreviewOpen: menuEditorPreviewOpenFromPrefs(pageContext.bo?.session?.preferences) };
}
