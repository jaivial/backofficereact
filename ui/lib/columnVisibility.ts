/**
 * Generic CSV-backed column visibility preference.
 *
 * Single reusable implementation for pages that persist "which table columns
 * are visible" as a comma-separated user preference (e.g. reservas, facturas).
 * Coordination id: table_columns_preference_v1
 */
export type ColumnVisibility<T extends string> = {
  /** Keeps only known ids, in canonical order. Unknown/stale ids are dropped. */
  normalize: (ids: readonly string[] | null | undefined) => T[];
  /** Parses the stored CSV preference; an unset value means every column. */
  parse: (raw: string | null | undefined) => T[];
  /** Whether a stored preference is an explicit user choice (vs the default). */
  has: (raw: string | null | undefined) => boolean;
};

export function createColumnVisibility<T extends string>(allIds: readonly T[]): ColumnVisibility<T> {
  const normalize = (ids: readonly string[] | null | undefined): T[] => {
    const set = new Set(ids ?? []);
    return allIds.filter((id) => set.has(id));
  };
  const parse = (raw: string | null | undefined): T[] => {
    const value = String(raw ?? "").trim();
    if (!value) return [...allIds];
    const parsed = normalize(value.split(","));
    return parsed.length > 0 ? parsed : [...allIds];
  };
  const has = (raw: string | null | undefined): boolean => String(raw ?? "").trim() !== "";
  return { normalize, parse, has };
}
