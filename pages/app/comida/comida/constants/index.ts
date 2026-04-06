import type { LucideIcon } from "lucide-react";
import { Coffee, GlassWater, UtensilsCrossed, Wine } from "lucide-react";

export type FoodType = "platos" | "bebidas" | "cafes" | "vinos";

export type FoodEntry = {
  type: FoodType;
  label: string;
  hint: string;
  icon: LucideIcon;
};

export const FOOD_ENTRIES: FoodEntry[] = [
  { type: "platos", label: "Platos", hint: "Carta principal", icon: UtensilsCrossed },
  { type: "bebidas", label: "Bebidas", hint: "Refrescos y cocteles", icon: GlassWater },
  { type: "cafes", label: "Cafes", hint: "Cafe e infusiones", icon: Coffee },
  { type: "vinos", label: "Vinos", hint: "Bodega y anadas", icon: Wine },
];
