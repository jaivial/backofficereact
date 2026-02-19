import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../../api/client";
import type { FoodItem, Vino } from "../../../../../api/types";
import { FOOD_TYPE_LABELS, parseFoodType, type FoodType } from "../../_components/foodTypes";

export type Data = Awaited<ReturnType<typeof data>>;

function parseFoodId(pageContext: PageContextServer): number {
  const fromRoute = Number((pageContext as any).routeParams?.foodId);
  if (Number.isFinite(fromRoute) && fromRoute > 0) return fromRoute;
  const m = String(pageContext.urlPathname ?? "").match(/\/app\/comida\/[^/]+\/(\d+)/);
  if (m) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

function normalizePostre(item: any): FoodItem {
  return {
    num: Number(item?.num || 0),
    tipo: "POSTRE",
    nombre: String(item?.nombre || item?.descripcion || ""),
    precio: Number(item?.precio || 0),
    descripcion: String(item?.descripcion || ""),
    titulo: "",
    suplemento: 0,
    alergenos: Array.isArray(item?.alergenos) ? item.alergenos : [],
    active: !!item?.active,
    has_foto: false,
  };
}

export async function data(pageContext: PageContextServer) {
  const typeParam = String((pageContext as any).routeParams?.foodType ?? "");
  const foodType = parseFoodType(typeParam);
  const foodId = parseFoodId(pageContext);

  const config = useConfig();
  config({ title: "Detalle de carta" });

  if (!foodType || !foodId) {
    return {
      foodType: (foodType || "platos") as FoodType,
      foodId,
      item: null as FoodItem | Vino | null,
      error: "Detalle invalido",
    };
  }

  config({ title: `${FOOD_TYPE_LABELS[foodType]} #${foodId}` });

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

  let item: FoodItem | Vino | null = null;
  let error: string | null = null;

  try {
    if (foodType === "vinos") {
      const res = await api.comida.vinos.get(foodId);
      if (res.success) item = (res.vino || res.item) as Vino;
      else error = res.message || "No se pudo cargar el detalle";
    } else if (foodType === "postres") {
      const res = await api.comida.postres.get(foodId);
      if (res.success) item = normalizePostre((res as any).postre || (res as any).item);
      else error = res.message || "No se pudo cargar el detalle";
    } else if (foodType === "platos") {
      const res = await api.comida.platos.get(foodId);
      if (res.success) item = (res as any).item as FoodItem;
      else error = res.message || "No se pudo cargar el detalle";
    } else if (foodType === "bebidas") {
      const res = await api.comida.bebidas.get(foodId);
      if (res.success) item = (res as any).item as FoodItem;
      else error = res.message || "No se pudo cargar el detalle";
    } else {
      const res = await api.comida.cafes.get(foodId);
      if (res.success) item = (res as any).item as FoodItem;
      else error = res.message || "No se pudo cargar el detalle";
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "No se pudo cargar el detalle";
  }

  return { foodType, foodId, item, error };
}
