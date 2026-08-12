import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { WidgetSettings } from "../../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Configuracion reservas" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";

  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  try {
    const res = await api.widget.getSettings();
    if (!("success" in res) || !res.success) {
      const message = "message" in res && typeof res.message === "string" ? res.message : null;
      return { settings: null as WidgetSettings | null, error: message };
    }
    return { settings: res.settings ?? null, error: null as string | null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "No se pudieron cargar los ajustes del widget";
    return { settings: null as WidgetSettings | null, error: message };
  }
}
