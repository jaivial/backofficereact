import React from "react";
import { Select } from "../../../../../ui/inputs/Select";
import { SearchableSelect } from "../../../../../ui/inputs/SearchableSelect";
import { cn } from "../../../../../ui/shadcn/utils";

export type POSSelectOption<V extends string | number> = { value: V; label: string };

/** Lists longer than this get a search box (products, stock items, tickets...). */
const SEARCH_THRESHOLD = 8;

/**
 * The only dropdown the TPV uses. It wraps the app's reusable `Select` /
 * `SearchableSelect` so every POS picker shares the same trigger, portalled
 * list, keyboard support and theming, while call sites keep their numeric ids.
 * Coordination id: pos_select_reusable_v1
 */
export function POSSelect<V extends string | number>({ value, onChange, options, ariaLabel, placeholder, testId, className, disabled, searchable }: {
  value: V;
  onChange: (value: V) => void;
  options: Array<POSSelectOption<V>>;
  ariaLabel: string;
  placeholder?: string;
  testId: string;
  className?: string;
  disabled?: boolean;
  /** Force (true) or suppress (false) the search box; defaults to list length. */
  searchable?: boolean;
}) {
  const numeric = typeof value === "number";
  const toValue = (raw: string) => (numeric ? Number(raw) : raw) as V;
  const stringOptions = options.map((option) => ({ value: String(option.value), label: option.label }));
  const common = { value: String(value), onChange: (raw: string) => onChange(toValue(raw)), options: stringOptions, ariaLabel, placeholder, disabled, "data-testid": testId, className: cn("pos-select", className) };
  return (searchable ?? options.length > SEARCH_THRESHOLD)
    ? <SearchableSelect {...common} searchPlaceholder="Buscar…" emptyText="Sin resultados" />
    : <Select {...common} />;
}
