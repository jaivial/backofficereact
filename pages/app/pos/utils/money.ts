/** Single source of truth for POS money formatting (es-ES EUR). */
export function money(cents: number | null | undefined): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
}

/** Parses a user-entered amount accepting both "," and "." as decimal separator. */
export function parseAmount(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const normalized = String(value ?? "").trim().replace(",", ".");
  return normalized === "" ? 0 : Number(normalized);
}
