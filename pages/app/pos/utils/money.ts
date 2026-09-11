/** Single source of truth for POS money formatting (es-ES EUR). */
export function money(cents: number | null | undefined): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format((cents || 0) / 100);
}
