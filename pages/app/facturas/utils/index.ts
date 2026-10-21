/**
 * Facturas Page Utilities
 * Utility functions for the facturas (invoices) page
 */

/**
 * Formats an amount with its currency symbol (e.g. "€120.50")
 */
export function formatPrice(price: number, currency: string = "EUR"): string {
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";
  return `${symbol}${price.toFixed(2)}`;
}

/**
 * Canonical invoice total for every message template (email, WhatsApp, batch)
 * and preview: mirrors the PDF rule (buildInvoiceRenderData: total ?? amount),
 * so a stored total — including a legitimate 0 — stays authoritative and only
 * legacy rows without total fall back to amount.
 * Coordination id: invoice_amount_consistency_v1
 */
export function invoiceTotal(invoice: { total?: number | null; amount: number }): number {
  return invoice.total ?? invoice.amount;
}

const moneyEsFmt = new Intl.NumberFormat("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Spanish money style identical to the invoice PDF (backend formatMoney):
 * "1.234,56 €". Message bodies read the same number as the document attached
 * to them instead of three different renderings (184.80 € / €184.80 / 184.80 EUR).
 * Coordination id: invoice_amount_consistency_v1
 */
export function moneyEs(amount: number, currency: string = "EUR"): string {
  const symbol = currency === "USD" ? "$" : currency === "GBP" ? "£" : "€";
  return `${moneyEsFmt.format(amount)} ${symbol}`;
}

/**
 * Formats an ISO date string as dd/mm/yyyy (es-ES)
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

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
