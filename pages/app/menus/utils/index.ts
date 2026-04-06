/**
 * Menus Page Utilities
 * Utility functions for the menus page
 */

import type { GroupMenuV2Summary } from "../../../../api/types";

/**
 * Normalizes a search value for consistent matching
 * - Removes accents/diacritics
 * - Converts to lowercase
 * - Trims whitespace
 */
export function normalizedSearchValue(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

/**
 * Gets the timestamp for when a menu was added (created_at or modified_at)
 */
export function menuAddedAt(menu: GroupMenuV2Summary): number {
  const createdAtMs = menu.created_at ? Date.parse(menu.created_at) : Number.NaN;
  if (Number.isFinite(createdAtMs)) return createdAtMs;
  const modifiedAtMs = menu.modified_at ? Date.parse(menu.modified_at) : Number.NaN;
  if (Number.isFinite(modifiedAtMs)) return modifiedAtMs;
  return menu.id;
}

/**
 * Extracts the numeric price from a menu item
 */
export function menuPriceNumber(menu: GroupMenuV2Summary): number {
  const n = Number(menu.price);
  return Number.isFinite(n) ? n : 0;
}
