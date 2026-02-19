export type FoodType = "platos" | "postres" | "vinos" | "bebidas" | "cafes";

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
