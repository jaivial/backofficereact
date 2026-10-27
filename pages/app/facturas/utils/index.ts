/**
 * Facturas Page Utilities
 * Utility functions for the facturas (invoices) page
 */

import { CURRENCY_SYMBOLS } from "../../../../api/types";
import { createClient } from "../../../../api/client";
import { splitStoredPhone } from "../../../../ui/lib/phone";

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

/**
 * Spanish money style identical to the invoice PDF (backend formatMoney):
 * "1.419,00 €". Message bodies read the same number as the document attached
 * to them instead of three different renderings (184.80 € / €184.80 / 184.80 EUR).
 * Reproduces the backend algorithm rather than Intl es-ES, which skips the
 * thousands separator for 4-digit amounts (1419 → "1419,00") while the PDF
 * always groups (1419 → "1.419,00 €").
 *
 * Currency contract (backend migración 057): `invoices.currency CHAR(3)
 * NOT NULL DEFAULT 'EUR'`. A blank/missing value therefore means a serializer
 * gap, never a non-EUR invoice, so the fallback to EUR is explicit and always
 * renders a symbol (never an empty one); this also keeps `currency.trim()` from
 * throwing when a payload arrives null/undefined. An unknown code is printed
 * as-is and never re-labelled as "€". Coordination id: invoice_amount_consistency_v1
 */
export function moneyEs(amount: number, currency?: string | null): string {
  const code = (currency ?? "").trim().toUpperCase() || "EUR";
  const symbol = (CURRENCY_SYMBOLS as Record<string, string>)[code] ?? code;
  const [intPart, decPart = "00"] = Math.abs(amount).toFixed(2).split(".");
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${amount < 0 ? "-" : ""}${grouped},${decPart} ${symbol}`;
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

/**
 * Label of the customer's fiscal identifier: "NIF" for a person (DNI/NIE) and
 * "CIF" for a company, following the option chosen in the invoice form. The
 * invoices created before that choice kept no type and fall back to the shape
 * of the value. Mirrors the backend rule (invoice_render.go: dniCifLabel), so
 * the form, the BackOffice and the PDF label the same value the same way.
 * Coordination id: invoice_dni_cif_type_v1
 */
export function dniCifLabel(invoice: { customer_dni_cif?: string; customer_dni_cif_type?: string } | null): string {
  const value = (invoice?.customer_dni_cif || "").trim();
  if (!value) return "";
  const type = (invoice?.customer_dni_cif_type || "").trim().toLowerCase();
  if (type === "dni") return "NIF";
  if (type === "cif") return "CIF";
  const upper = value.toUpperCase();
  if (/^[0-9]/.test(upper)) return "NIF";
  // A NIE (foreign resident) starts with X, Y or Z followed by digits.
  if (/^[XYZ][0-9]/.test(upper)) return "NIF";
  return "CIF";
}

type InvoicePhone = { customer_phone?: string | null; customer_phone_country_code?: string | null } | null | undefined;

/**
 * Country code + national number of the customer phone for the invoice form.
 * Invoices saved before the country code existed are split from the typed
 * text (default +34). Coordination id: invoice_phone_country_code_v1
 */
export function invoicePhoneParts(invoice: InvoicePhone): { countryCode: string; national: string } {
  const phone = (invoice?.customer_phone || "").trim();
  const countryCode = (invoice?.customer_phone_country_code || "").trim();
  return countryCode ? { countryCode, national: phone } : splitStoredPhone(phone, "34");
}

/**
 * Customer phone as shown in the BackOffice: "+34 600123123" when the code is
 * stored, the stored text otherwise. Mirrors the backend invoicePhoneDisplay
 * used by the PDF and the email. Coordination id: invoice_phone_country_code_v1
 */
export function formatInvoicePhone(invoice: InvoicePhone): string {
  const phone = (invoice?.customer_phone || "").trim();
  const countryCode = (invoice?.customer_phone_country_code || "").trim();
  return countryCode && phone ? `+${countryCode} ${phone}` : phone;
}

/*
 * invoice_send_whatsapp_v1: one idempotency key per WhatsApp send intent,
 * persisted per user + restaurant + invoice so a later send (modal or the
 * form's "Enviar") resumes the same attempt instead of duplicating it; the
 * key is cleared once text and PDF are both delivered.
 */
const waSendStorageKey = (userId: number, restaurantId: number, invoiceId: number) => `bo-wa-send-key:u${userId}:r${restaurantId}:i${invoiceId}`;

export const newWaSendKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `wa-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function storeWaSendKey(userId: number, restaurantId: number, invoiceId: number, key: string): void {
  try { localStorage.setItem(waSendStorageKey(userId, restaurantId, invoiceId), key); } catch { /* storage optional */ }
}

export function clearWaSendKey(userId: number, restaurantId: number, invoiceId: number): void {
  try { localStorage.removeItem(waSendStorageKey(userId, restaurantId, invoiceId)); } catch { /* storage optional */ }
}

/**
 * Key of the current send intent: the stored one, else the latest unfinished
 * attempt on the backend (fresh browser / post-logout), else a new one.
 */
export async function resolveWaSendKey(userId: number, restaurantId: number, invoiceId: number): Promise<string> {
  try {
    const stored = localStorage.getItem(waSendStorageKey(userId, restaurantId, invoiceId));
    if (stored) return stored;
  } catch { /* storage optional */ }
  let key = newWaSendKey();
  try {
    const res = await createClient({ baseUrl: "" }).invoices.getWhatsAppAttempt(invoiceId);
    const att = res.success ? res.attempt : null;
    if (att && !(att.text_status === "sent" && att.pdf_status === "sent")) key = att.idempotency_key;
  } catch { /* new intent */ }
  storeWaSendKey(userId, restaurantId, invoiceId, key);
  return key;
}
