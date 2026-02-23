import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import type { FoodCategory, FoodItem, Vino } from "../../../../api/types";
import { FOOD_TYPE_LABELS, parseFoodType, type FoodType } from "../_components/foodTypes";

export type Data = Awaited<ReturnType<typeof data>>;

export async function data(pageContext: PageContextServer) {
  const routeType = String((pageContext as any).routeParams?.foodType ?? "");
  const foodType = parseFoodType(routeType);
  const config = useConfig();

  if (!foodType) {
    config({ title: "Carta" });
    return {
      foodType: "platos" as FoodType,
      items: [] as (FoodItem | Vino)[],
      categories: [] as FoodCategory[],
      page: 1,
      pageSize: 24,
      total: 0,
      filters: {
        search: "",
        tipo: "",
        active: "all" as const,
        category: "",
        alergeno: "",
        suplemento: "all" as const,
      },
      error: "Tipo de comida invalido",
    };
  }

  config({ title: `${FOOD_TYPE_LABELS[foodType]} · Carta` });

  const page = Number(pageContext.urlParsed?.search?.page ?? 1);
  const pageSize = Number(pageContext.urlParsed?.search?.pageSize ?? 24);
  const search = typeof pageContext.urlParsed?.search?.q === "string" ? pageContext.urlParsed.search.q : "";
  const tipo = typeof pageContext.urlParsed?.search?.tipo === "string" ? pageContext.urlParsed.search.tipo : "";
  const active = typeof pageContext.urlParsed?.search?.active === "string" ? pageContext.urlParsed.search.active : "all";
  const category = typeof pageContext.urlParsed?.search?.category === "string" ? pageContext.urlParsed.search.category : "";
  const alergeno = typeof pageContext.urlParsed?.search?.alergeno === "string" ? pageContext.urlParsed.search.alergeno : "";
  const suplemento = typeof pageContext.urlParsed?.search?.suplemento === "string" ? pageContext.urlParsed.search.suplemento : "all";

  const initialFilters = {
    search,
    tipo,
    active: active === "active" || active === "inactive" ? active : "all",
    category,
    alergeno,
    suplemento: suplemento === "yes" || suplemento === "no" ? suplemento : "all",
  } as const;

  return {
    foodType,
    items: [] as (FoodItem | Vino)[],
    categories: [] as FoodCategory[],
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 24,
    total: 0,
    filters: initialFilters,
    error: null as string | null,
  };
}
