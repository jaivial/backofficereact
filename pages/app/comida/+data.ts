import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { FoodType } from "./_components/foodTypes";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const config = useConfig();
  config({ title: "Carta" });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let error: string | null = null;
  const countsByType: Record<FoodType, number> = {
    vinos: 0,
    cafes: 0,
    postres: 0,
    platos: 0,
    bebidas: 0,
  };

  try {
    const response = await api.comida.counts();
    if (response.success) Object.assign(countsByType, response.countsByType);
    else error = response.message || "Error cargando carta";
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando carta";
  }

  return { countsByType, error };
}
