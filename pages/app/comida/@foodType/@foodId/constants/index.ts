import type { LucideIcon } from "lucide-react";
import {
  UtensilsCrossed,
  GlassWater,
  Coffee,
  Wine,
  Bean,
  Shrimp,
  Egg,
  Fish,
  Nut,
  Milk,
  LeafyGreen,
  Sprout,
  CircleDot,
  FlaskConical,
  Shell,
} from "lucide-react";

import type { FoodType } from "../../../_components/foodTypes";

export const FOOD_TYPE_ICONS: Record<FoodType, LucideIcon> = {
  platos: UtensilsCrossed,
  bebidas: GlassWater,
  cafes: Coffee,
  vinos: Wine,
  postres: UtensilsCrossed,
};

export const AI_ADVISOR_FOOD_TYPES = new Set<FoodType>(["bebidas", "cafes"]);

export const CARD_ALLERGENS = [
  { key: "Gluten", icon: Bean },
  { key: "Crustaceos", icon: Shrimp },
  { key: "Huevos", icon: Egg },
  { key: "Pescado", icon: Fish },
  { key: "Cacahuetes", icon: Nut },
  { key: "Soja", icon: Bean },
  { key: "Leche", icon: Milk },
  { key: "Frutos de cascara", icon: Nut },
  { key: "Apio", icon: LeafyGreen },
  { key: "Mostaza", icon: Sprout },
  { key: "Sesamo", icon: CircleDot },
  { key: "Sulfitos", icon: FlaskConical },
  { key: "Altramuces", icon: Bean },
  { key: "Moluscos", icon: Shell },
] as const;

export const CARD_ALLERGEN_KEYS = new Set<string>(CARD_ALLERGENS.map((item) => item.key));

export const ALLERGEN_ALIAS_TO_CARD: Record<string, string> = {
  gluten: "Gluten",
  crustaceos: "Crustaceos",
  huevos: "Huevos",
  pescado: "Pescado",
  cacahuetes: "Cacahuetes",
  soja: "Soja",
  lacteos: "Leche",
  leche: "Leche",
  "frutos secos": "Frutos de cascara",
  frutos_secos: "Frutos de cascara",
  "frutos de cascara": "Frutos de cascara",
  apio: "Apio",
  mostaza: "Mostaza",
  sesamo: "Sesamo",
  sulfitos: "Sulfitos",
  altramuces: "Altramuces",
  moluscos: "Moluscos",
};

export const QUICK_TIPO_OPTIONS = [
  { value: "ENTRANTE", label: "Entrante" },
  { value: "PRINCIPAL", label: "Principal" },
  { value: "ARROZ", label: "Arroz" },
  { value: "POSTRE", label: "Postre" },
];

export const BEBIDA_CATEGORY_SUGGESTIONS = ["Refrescos", "Aguas", "Zumos", "Cervezas", "Copas", "Licores", "Cocktails"];
