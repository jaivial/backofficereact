import type { FoodItem, Vino } from "../../../../../api/types";

export type ListItem = FoodItem | Vino;

export type ActiveFilter = "all" | "active" | "inactive";

export type SuplementoFilter = "all" | "yes" | "no";
