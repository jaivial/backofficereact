import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../api/client";
import type { FoodType } from "./_components/foodTypes";

export type Data = Awaited<ReturnType<typeof data>>;

const FOOD_TYPES: FoodType[] = ["vinos", "cafes", "postres", "platos", "bebidas"];

type CountResult = {
  type: FoodType;
  count: number;
};

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

  const requests = FOOD_TYPES.map(async (type): Promise<CountResult> => {
    try {
      if (type === "vinos") {
        const res = await api.comida.vinos.list({ page: 1, pageSize: 1 });
        if (res.success) return { type, count: Number(res.total ?? res.vinos?.length ?? 0) };
        return { type, count: 0 };
      }
      if (type === "postres") {
        const res = await api.comida.postres.list({ page: 1, limit: 1 });
        if (res.success) return { type, count: Number((res as any).total ?? res.postres?.length ?? 0) };
        return { type, count: 0 };
      }

      const res = await (type === "platos"
        ? api.comida.platos.list({ page: 1, pageSize: 1 })
        : type === "bebidas"
          ? api.comida.bebidas.list({ page: 1, pageSize: 1 })
          : api.comida.cafes.list({ page: 1, pageSize: 1 }));

      if (res.success) return { type, count: Number(res.total ?? res.items?.length ?? 0) };
      return { type, count: 0 };
    } catch {
      return { type, count: 0 };
    }
  });

  try {
    const results = await Promise.all(requests);
    for (const row of results) countsByType[row.type] = row.count;
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando carta";
  }

  return { countsByType, error };
}
