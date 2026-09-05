import type { LucideIcon } from "lucide-react";
import { Coffee, GlassWater, IceCreamCone, UtensilsCrossed, Wine } from "lucide-react";

// Canonical FoodType: all food categories supported by food-type pages.
export type FoodType = "platos" | "postres" | "vinos" | "bebidas" | "cafes";

export type FoodEntry = {
  type: FoodType;
  label: string;
  hint: string;
  icon: LucideIcon;
};

// FOOD_ENTRIES is the hub page (comida/+Page.tsx) entry: one card per food-type page.
export const FOOD_ENTRIES: FoodEntry[] = [
  { type: "platos", label: "Platos", hint: "Carta principal", icon: UtensilsCrossed },
  { type: "bebidas", label: "Bebidas", hint: "Refrescos y cocteles", icon: GlassWater },
  { type: "cafes", label: "Cafes", hint: "Cafe e infusiones", icon: Coffee },
  { type: "postres", label: "Postres", hint: "Dulces y postres", icon: IceCreamCone },
  { type: "vinos", label: "Vinos", hint: "Bodega y anadas", icon: Wine },
];

export const PAGE_SIZE_OPTIONS = [
  { value: "12", label: "12 / pagina" },
  { value: "24", label: "24 / pagina" },
  { value: "48", label: "48 / pagina" },
];
