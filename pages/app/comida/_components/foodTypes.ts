// Canonical FoodType imported from shared constants.
import type { FoodType } from "../@foodType/constants/index";
import type { PageVisibility } from "../../../../api/types";
export type { FoodType };

// All food type categories in display order.
export const FOOD_TYPE_ORDER: FoodType[] = ["vinos", "cafes", "postres", "platos", "bebidas"];

export const FOOD_TYPE_LABELS: Record<FoodType, string> = {
  vinos: "Vinos",
  cafes: "Cafes",
  postres: "Postres",
  platos: "Platos",
  bebidas: "Bebidas",
};

export const FOOD_TYPE_SINGULAR: Record<FoodType, string> = {
  vinos: "vino",
  cafes: "cafe",
  postres: "postre",
  platos: "plato",
  bebidas: "bebida",
};

export type FoodTipoOption = {
  value: string;
  label: string;
};

export const FOOD_TYPE_TIPO_OPTIONS: Record<FoodType, FoodTipoOption[]> = {
  vinos: [
    { value: "TINTO", label: "Tinto" },
    { value: "BLANCO", label: "Blanco" },
    { value: "CAVA", label: "Cava" },
  ],
  cafes: [
    { value: "CAFE", label: "Cafe" },
    { value: "INFUSION", label: "Infusion" },
    { value: "CHOCOLATE", label: "Chocolate" },
  ],
  postres: [{ value: "POSTRE", label: "Postre" }],
  platos: [
    { value: "ENTRANTE", label: "Entrante" },
    { value: "PRINCIPAL", label: "Principal" },
    { value: "ARROZ", label: "Arroz" },
    { value: "POSTRE", label: "Postre" },
  ],
  bebidas: [
    { value: "REFRESCO", label: "Refresco" },
    { value: "AGUA", label: "Agua" },
    { value: "ZUMO", label: "Zumo" },
    { value: "CERVEZA", label: "Cerveza" },
    { value: "COPA", label: "Copa" },
    { value: "LICOR", label: "Licor" },
    { value: "COCKTAIL", label: "Cocktail" },
  ],
};

export function parseFoodType(raw: string): FoodType | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "vinos") return "vinos";
  if (value === "cafes" || value === "cafés") return "cafes";
  if (value === "postres") return "postres";
  if (value === "platos") return "platos";
  if (value === "bebidas") return "bebidas";
  return null;
}

/**
 * Food types that own a public page whose visibility and web placement are
 * configurable from the backoffice "Configuracion" tab.
 * Coordination id: foodtype_page_visibility_v1
 * (backoffice food type settings -> backend page visibility -> public site nav)
 */
export type FoodTypeWithPublicPage = "cafes" | "vinos" | "bebidas" | "postres";

export const FOOD_TYPE_VISIBILITY_KEYS: Record<
  FoodTypeWithPublicPage,
  { active: keyof PageVisibility; placement: keyof PageVisibility }
> = {
  cafes: { active: "cafe_page_active", placement: "cafes_web_placement" },
  vinos: { active: "vinos_page_active", placement: "vinos_web_placement" },
  bebidas: { active: "bebidas_page_active", placement: "bebidas_web_placement" },
  postres: { active: "postres_page_active", placement: "postres_web_placement" },
};
