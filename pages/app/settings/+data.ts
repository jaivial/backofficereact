import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { RestaurantBranding, RestaurantIntegrations } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Ajustes" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  let integrations: RestaurantIntegrations | null = null;
  let branding: RestaurantBranding | null = null;

  try {
    const [a, b] = await Promise.all([api.settings.getIntegrations(), api.settings.getBranding()]);
    if (a.success) integrations = a.integrations;
    else error = a.message || "Error cargando integraciones";

    if (b.success) branding = b.branding;
    else if (!error) error = b.message || "Error cargando branding";
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando ajustes";
  }

  return { integrations, branding, error };
}

