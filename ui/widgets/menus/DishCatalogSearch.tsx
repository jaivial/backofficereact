import React from "react";
import { Plus, Search } from "lucide-react";
import type { DishCatalogItem } from "../../../api/types";
import { AutosaveInput } from "../../inputs/AutosaveInput";
import { ALLERGENS } from "../../../pages/app/menus/crear/constants/menuEditor.constants";

const ALLERGEN_ALIASES: Record<string, string> = {
  lacteos: "leche",
  frutos_secos: "frutos de cascara",
};

/**
 * Catalog search row ("Buscar en catalogo..." + results + trailing action).
 *
 * Shared by the menu section editor and the special-menu principales picker
 * so both surfaces keep one look (data-slot="menuSectionEditor-dishAddRow").
 * Presentational: the caller owns the term, the results and what picking or
 * the extra actions do. `resultsFooter` renders inside the results list (e.g.
 * "Crear nuevo plato").
 */
export type DishCatalogSearchTestIds = {
  row: string;
  input: string;
  results: string;
  /** Receives the catalog item id. */
  result: (id: number) => string;
};

/** Default ids built from one prefix; existing surfaces pass their own. */
export function dishCatalogSearchTestIds(prefix: string): DishCatalogSearchTestIds {
  return {
    row: `${prefix}-add-row`,
    input: `${prefix}-dish-search`,
    results: `${prefix}-search-results`,
    result: (id) => `${prefix}-search-result-${id}`,
  };
}

export function DishCatalogSearch({
  testIds,
  term,
  items,
  onTermChange,
  onPick,
  ariaLabel,
  placeholder = "Buscar en catalogo...",
  resultsFooter,
  action,
}: {
  testIds: DishCatalogSearchTestIds;
  term: string;
  items: DishCatalogItem[];
  onTermChange: (term: string) => void;
  onPick: (item: DishCatalogItem) => void;
  ariaLabel: string;
  placeholder?: string;
  resultsFooter?: React.ReactNode;
  action?: React.ReactNode;
}) {
  const showResults = term.trim().length >= 2 && (items.length > 0 || Boolean(resultsFooter));
  return (
    <div className="bo-dishAddRow" data-slot="menuSectionEditor-dishAddRow" data-testid={testIds.row}>
      <div className="bo-dishSearchWrap" data-slot="menuSectionEditor-dishSearchWrap">
        <Search size={14} aria-hidden="true" />
        <AutosaveInput
          className="bo-input bo-dishSearch"
          value={term}
          onChange={(e) => onTermChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          data-testid={testIds.input}
        />
      </div>
      {showResults ? (
        <div className="bo-dishSearchResults" role="listbox" aria-label="Resultados de busqueda" data-testid={testIds.results}>
          {items.map((item) => (
            <button
              key={item.id}
              className="bo-dishSearchResultItem"
              type="button"
              onClick={() => onPick(item)}
              role="option"
              aria-selected={false}
              data-testid={testIds.result(item.id)}
            >
              <span className="bo-dishSearchResultTitle" data-slot="menuSectionEditor-dishSearchResultTitle">{item.title}</span>
              {item.allergens && item.allergens.length > 0 ? (
                <span className="bo-dishSearchResultAllergens" aria-label="Alergenos" data-slot="menuSectionEditor-dishSearchResultAllergens">
                  {item.allergens.map((allergen) => {
                    const key = allergen.trim().toLowerCase();
                    const entry = ALLERGENS.find((a) => a.key.toLowerCase() === (ALLERGEN_ALIASES[key] ?? key));
                    if (!entry) return null;
                    const Icon = entry.icon;
                    return <span key={`${entry.key}-${allergen}`} className="bo-dishSearchResultAllergenIcon" title={entry.key}><Icon size={14} aria-hidden="true" /></span>;
                  })}
                </span>
              ) : null}
            </button>
          ))}
          {resultsFooter}
        </div>
      ) : null}
      {action}
    </div>
  );
}

export function DishCatalogSearchAddButton({ label, ariaLabel, onClick, testId }: { label: string; ariaLabel: string; onClick: () => void; testId: string }) {
  return (
    <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={onClick} aria-label={ariaLabel} data-testid={testId}>
      <Plus size={14} /> {label}
    </button>
  );
}
