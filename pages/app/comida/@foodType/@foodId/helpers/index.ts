import type { FoodType } from "../../../_components/foodTypes";
import { CARD_ALLERGENS, CARD_ALLERGEN_KEYS, ALLERGEN_ALIAS_TO_CARD } from "../constants";

export function normalizeToken(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

export function parseDecimalInput(value: string): number | null {
  const normalized = String(value || "").trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toMoneyInput(value: number | null | undefined): string {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00";
}

export function getEmptyDescription(foodType: FoodType): string {
  if (foodType === "platos") return "Este plato todavia no tiene una descripcion visible en carta.";
  if (foodType === "vinos") return "Este vino todavia no tiene una descripcion visible en carta.";
  if (foodType === "postres") return "Este postre todavia no tiene una descripcion visible en carta.";
  if (foodType === "cafes") return "Este cafe todavia no tiene una descripcion visible en carta.";
  return "Este elemento todavia no tiene una descripcion visible en carta.";
}

export function normalizeToCardAllergens(values: string[]): string[] {
  const set = new Set<string>();
  const unknown: string[] = [];
  values.forEach((raw) => {
    const trimmed = String(raw || "").trim();
    if (!trimmed || trimmed === "[]") return;
    const normalized = normalizeToken(trimmed);
    const mapped = ALLERGEN_ALIAS_TO_CARD[normalized];
    if (mapped) {
      set.add(mapped);
      return;
    }
    if (CARD_ALLERGEN_KEYS.has(trimmed)) {
      set.add(trimmed);
      return;
    }
    unknown.push(trimmed);
  });
  const ordered = CARD_ALLERGENS.map((item) => item.key).filter((key) => set.has(key));
  const unknownDedup = Array.from(new Set(unknown));
  return [...ordered, ...unknownDedup];
}

export function areAllergenSetsEqual(a: string[], b: string[]): boolean {
  const left = normalizeToCardAllergens(a);
  const right = normalizeToCardAllergens(b);
  if (left.length !== right.length) return false;
  const leftNorm = left.map(normalizeToken).sort();
  const rightNorm = right.map(normalizeToken).sort();
  return leftNorm.every((value, idx) => value === rightNorm[idx]);
}
