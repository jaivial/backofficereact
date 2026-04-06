import type { FoodItem } from "../../../../../api/types";
import type { ListItem } from "../types";

export function normalizePostres(
  postres: Array<{
    num: number;
    descripcion: string;
    alergenos?: string[];
    active: boolean;
    precio?: number;
  }>,
): FoodItem[] {
  return postres.map((postre) => ({
    num: postre.num,
    tipo: "POSTRE",
    nombre: postre.descripcion,
    precio: Number(postre.precio ?? 0),
    descripcion: postre.descripcion,
    titulo: "",
    suplemento: 0,
    alergenos: Array.isArray(postre.alergenos) ? postre.alergenos : [],
    active: !!postre.active,
    has_foto: false,
  }));
}

export function buildDeleteApiCall(
  foodType: string,
  api: ReturnType<typeof import("../../../../../api/client").createClient>,
  item: ListItem,
) {
  if (foodType === "vinos") return api.comida.vinos.delete(item.num);
  if (foodType === "postres") return api.comida.postres.delete(item.num);
  if (foodType === "platos") return api.comida.platos.delete(item.num);
  if (foodType === "bebidas") return api.comida.bebidas.delete(item.num);
  return api.comida.cafes.delete(item.num);
}

export function buildToggleApiCall(
  foodType: string,
  api: ReturnType<typeof import("../../../../../api/client").createClient>,
  item: ListItem,
) {
  if (foodType === "vinos") return api.comida.vinos.patch(item.num, { active: !item.active });
  if (foodType === "postres") return api.comida.postres.patch(item.num, { active: !item.active });
  if (foodType === "platos") return api.comida.platos.toggle(item.num);
  if (foodType === "bebidas") return api.comida.bebidas.toggle(item.num);
  return api.comida.cafes.toggle(item.num);
}

export function buildTargetApi(
  foodType: string,
  api: ReturnType<typeof import("../../../../../api/client").createClient>,
) {
  if (foodType === "vinos") return api.comida.vinos;
  if (foodType === "postres") return api.comida.postres;
  if (foodType === "platos") return api.comida.platos;
  if (foodType === "bebidas") return api.comida.bebidas;
  return api.comida.cafes;
}
