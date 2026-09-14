import type { FoodCategory, FoodItem } from "../../../../../api/types";
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
  if (foodType === "vinos") return api.comida.vinos.toggle(item.num, !item.active);
  if (foodType === "postres") return api.comida.postres.toggle(item.num, !item.active);
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

export type CategorizedSection = {
  /** Stable React key: `cat-<id>` for catalogue categories, `name-<slug>` for
   *  ad-hoc names and `uncategorized` for items without any category. */
  key: string;
  name: string;
  items: ListItem[];
};

/**
 * Groups the current page of list items into one section per beverage category,
 * mirroring the dish sections of the menu editor. Items are matched by
 * `category_id` first (the ids of the beverage catalogue), then by the stored
 * `categoria` name, so legacy rows saved before the catalogue existed still land
 * in the right section. Empty categories are dropped: a section only exists when
 * it has something to show.
 * Coordination id: bebidas_category_sections_v1
 */
export function groupItemsByCategory(
  items: ListItem[],
  categories: FoodCategory[],
): CategorizedSection[] {
  const safeItems = Array.isArray(items) ? items : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const byId = new Map<number, FoodCategory>();
  const byName = new Map<string, FoodCategory>();
  safeCategories.forEach((category) => {
    byId.set(Number(category.id), category);
    byName.set(category.name.trim().toLowerCase(), category);
  });

  const sections: CategorizedSection[] = safeCategories.map((category) => ({
    key: `cat-${category.id}`,
    name: category.name,
    items: [],
  }));
  const sectionByKey = new Map(sections.map((section) => [section.key, section]));
  const orphanSections = new Map<string, CategorizedSection>();
  const uncategorized: CategorizedSection = { key: "uncategorized", name: "Sin categoria", items: [] };

  safeItems.forEach((item) => {
    const food = item as FoodItem;
    const id = typeof food.category_id === "number" ? food.category_id : null;
    const name = String(food.categoria || "").trim();
    const matched = (id !== null ? byId.get(id) : undefined) ?? (name ? byName.get(name.toLowerCase()) : undefined);

    if (matched) {
      sectionByKey.get(`cat-${matched.id}`)?.items.push(item);
      return;
    }
    if (name) {
      const orphanKey = `name-${name.toLowerCase()}`;
      if (!orphanSections.has(orphanKey)) {
        orphanSections.set(orphanKey, { key: orphanKey, name, items: [] });
      }
      orphanSections.get(orphanKey)!.items.push(item);
      return;
    }
    uncategorized.items.push(item);
  });

  return [...sections, ...orphanSections.values(), uncategorized].filter((section) => section.items.length > 0);
}
