import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { RestaurantInfo } from "../../../api/types";

export type Data = Awaited<ReturnType<typeof data>>;

/**
 * QR module data loader. Observational point: `qr-page:website-fetch` — the
 * restaurant website is fetched here and reused by both tabs.
 */
export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "QR" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let restaurantInfo: RestaurantInfo | null = null;
  let error: string | null = null;

  try {
    const res = await api.config.getRestaurantInfo();
    if (res.success) restaurantInfo = res.restaurantInfo;
    else error = res.message || "Error cargando la pagina web del restaurante";
  } catch (e) {
    error = e instanceof Error ? e.message : "Error cargando la pagina web del restaurante";
  }

  return { restaurantInfo, error };
}
