import { useMemo } from "react";

import type { FoodCategory, FoodItem } from "../../../../../api/types";
import type { ListItem } from "../types";
import type { FoodType } from "../../_components/foodTypes";
import { FOOD_TYPE_TIPO_OPTIONS } from "../../_components/foodTypes";

interface UseFilterOptionsOptions {
  foodType: FoodType;
  items: ListItem[];
  categories: FoodCategory[];
}

export function useFilterOptions({ foodType, items, categories }: UseFilterOptionsOptions) {
  const safeItems = Array.isArray(items) ? items : [];
  const safeCategories = Array.isArray(categories) ? categories : [];

  const tipoOptions = useMemo(() => {
    const byValue = new Map<string, string>();
    const tipoList = FOOD_TYPE_TIPO_OPTIONS[foodType];
    if (Array.isArray(tipoList)) {
      tipoList.forEach((option) => {
        byValue.set(option.value, option.label);
      });
    }
    safeItems.forEach((item) => {
      const value = String(item.tipo || "").trim();
      if (!value || byValue.has(value)) return;
      byValue.set(value, value);
    });
    const ordered = Array.from(byValue.entries())
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([value, label]) => ({ value, label }));
    return [{ value: "", label: "Todos los tipos" }, ...ordered];
  }, [foodType, safeItems]);

  const categoryOptions = useMemo(() => {
    const options = [{ value: "", label: "Todas las categorias" }];
    safeCategories.forEach((category) => {
      options.push({ value: String(category.id), label: category.name });
    });
    return options;
  }, [safeCategories]);

  const alergenoOptions = useMemo(() => {
    const values = new Set<string>();
    safeItems.forEach((item) => {
      const food = item as FoodItem;
      if (Array.isArray(food.alergenos)) {
        food.alergenos.forEach((alergeno) => {
          const normalized = String(alergeno || "").trim();
          if (normalized) values.add(normalized);
        });
      }
    });
    return [{ value: "", label: "Todos los alergenos" }, ...Array.from(values).sort().map((value) => ({ value, label: value }))];
  }, [safeItems]);

  return { tipoOptions, categoryOptions, alergenoOptions };
}
