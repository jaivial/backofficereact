import type { PageContextServer } from "vike/types";
import { useConfig } from "vike-react/useConfig";

import { createClient } from "../../../../api/client";
import type { FoodCategory, FoodItem, Vino } from "../../../../api/types";
import { FOOD_TYPE_LABELS, parseFoodType, type FoodType } from "../_components/foodTypes";

export type Data = Awaited<ReturnType<typeof data>>;

type ListPayload = {
  items: (FoodItem | Vino)[];
  total: number;
};

function normalizePostreItems(postres: Array<{ num: number; descripcion: string; alergenos?: string[]; active: boolean; precio?: number }>): FoodItem[] {
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

async function fetchList(api: ReturnType<typeof createClient>, foodType: FoodType, query: {
  page: number;
  pageSize: number;
  search: string;
  tipo: string;
  active: "all" | "active" | "inactive";
  category: string;
  alergeno: string;
  suplemento: "all" | "yes" | "no";
}): Promise<ListPayload> {
  const activeParam = query.active === "all" ? undefined : query.active === "active" ? 1 : 0;
  const suplementoParam = query.suplemento === "all" ? undefined : query.suplemento === "yes" ? 1 : 0;

  if (foodType === "vinos") {
    const res = await api.comida.vinos.list({
      tipo: query.tipo || undefined,
      active: activeParam,
      q: query.search || undefined,
      page: query.page,
      pageSize: query.pageSize,
    });
    if (!res.success) throw new Error(res.message || "Error cargando vinos");
    return {
      items: Array.isArray(res.vinos) ? res.vinos : [],
      total: Number(res.total ?? res.vinos?.length ?? 0),
    };
  }

  if (foodType === "postres") {
    const res = await api.comida.postres.list({
      active: activeParam,
      search: query.search || undefined,
      page: query.page,
      limit: query.pageSize,
    });
    if (!res.success) throw new Error(res.message || "Error cargando postres");
    const postres = normalizePostreItems(Array.isArray((res as any).postres) ? (res as any).postres : []);
    return {
      items: postres,
      total: Number((res as any).total ?? postres.length),
    };
  }

  const caller = foodType === "platos"
    ? api.comida.platos
    : foodType === "bebidas"
      ? api.comida.bebidas
      : api.comida.cafes;

  const res = await caller.list({
    tipo: query.tipo || undefined,
    active: activeParam,
    q: query.search || undefined,
    page: query.page,
    pageSize: query.pageSize,
    category: query.category || undefined,
    alergeno: query.alergeno || undefined,
    suplemento: suplementoParam,
  });
  if (!res.success) throw new Error(res.message || "Error cargando elementos");
  return {
    items: Array.isArray(res.items) ? res.items : [],
    total: Number(res.total ?? res.items?.length ?? 0),
  };
}

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

  const backendOrigin = pageContext.boRequest?.backendOrigin ?? "http://127.0.0.1:8080";
  const cookieHeader = pageContext.boRequest?.cookieHeader ?? "";
  const api = createClient({ baseUrl: backendOrigin, cookieHeader });

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

  let items: (FoodItem | Vino)[] = [];
  let total = 0;
  let categories: FoodCategory[] = [];
  let error: string | null = null;

  try {
    const [listPayload, categoriesRes] = await Promise.all([
      fetchList(api, foodType, {
        page: Number.isFinite(page) && page > 0 ? page : 1,
        pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 24,
        search: initialFilters.search,
        tipo: initialFilters.tipo,
        active: initialFilters.active,
        category: initialFilters.category,
        alergeno: initialFilters.alergeno,
        suplemento: initialFilters.suplemento,
      }),
      foodType === "platos" ? api.comida.platos.categories.list() : Promise.resolve(null),
    ]);

    items = listPayload.items;
    total = listPayload.total;
    if (categoriesRes && categoriesRes.success) {
      categories = Array.isArray(categoriesRes.categories) ? categoriesRes.categories : [];
    }
  } catch (err) {
    error = err instanceof Error ? err.message : "Error cargando carta";
  }

  return {
    foodType,
    items,
    categories,
    page: Number.isFinite(page) && page > 0 ? page : 1,
    pageSize: Number.isFinite(pageSize) && pageSize > 0 ? Math.min(pageSize, 100) : 24,
    total,
    filters: initialFilters,
    error,
  };
}
