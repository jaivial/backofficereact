/**
 * Facturas Page Utilities
 * Utility functions for the facturas (invoices) page
 */

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
 * Calculates total pages from total items and page size
 */
export function calculateTotalPages(total: number, limit: number): number {
  return Math.ceil(total / limit);
}

/**
 * Generates a summary text for the invoice list
 */
export function generateSummaryText(shown: number, total: number): string {
  return `${shown} de ${total} facturas`;
}
