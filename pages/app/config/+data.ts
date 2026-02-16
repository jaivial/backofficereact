import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { ConfigDefaults, ConfigFloor } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Configuracion" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let defaults: ConfigDefaults | null = null;
  let floors: ConfigFloor[] = [];

  try {
    const [d0, d1] = await Promise.all([api.config.getDefaults(), api.config.getDefaultFloors()]);

    if (d0.success) defaults = d0;
    else error = d0.message || "Error cargando configuración por defecto";

    if (d1.success) floors = d1.floors || [];
    else if (!error) error = d1.message || "Error cargando plantas";
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando configuración";
  }

  return { defaults, floors, error };
}
