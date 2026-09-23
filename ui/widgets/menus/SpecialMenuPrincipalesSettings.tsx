import React from "react";
import { Plus, Trash2 } from "lucide-react";
import type { DishCatalogItem, SpecialMenuPrincipal } from "../../../api/types";
import { Switch } from "../../shadcn/Switch";
import { DishCatalogSearch } from "./DishCatalogSearch";

export type SpecialMenuPrincipalesSection = {
  id: number;
  title: string;
  principales: SpecialMenuPrincipal[];
};

/**
 * "Anadir platos principales" settings for a special menu.
 *
 * One toggle for the menu; when on, every image section gets the catalog
 * search (same row as the section editor) and the list of picked dishes, each
 * with a delete button. The search results end with "Crear nuevo plato",
 * which the caller wires to the regular create-dish modal.
 *
 * Presentational: search state, persistence and the modal live in the caller.
 * Coordination id: special_menu_principales_v1
 */
export function SpecialMenuPrincipalesSettings({
  enabled,
  busy,
  sections,
  searchTerms,
  searchResults,
  onToggle,
  onSearch,
  onPick,
  onRemove,
  onCreateDish,
}: {
  enabled: boolean;
  busy: boolean;
  sections: SpecialMenuPrincipalesSection[];
  searchTerms: Record<number, string>;
  searchResults: Record<number, DishCatalogItem[]>;
  onToggle: (enabled: boolean) => void;
  onSearch: (sectionId: number, term: string) => void;
  onPick: (sectionId: number, item: DishCatalogItem) => void;
  onRemove: (sectionId: number, dishId: number) => void;
  onCreateDish: (sectionId: number) => void;
}) {
  return (
    <div className="bo-field bo-field--full bo-specialPrincipales" data-coordination-id="special_menu_principales_v1" data-testid="menu-crear-special-principales">
      <div className="bo-field bo-field--inline" data-slot="special-principales-toggle-row" data-testid="menu-crear-special-principales-toggle-row">
        <div className="bo-label" data-slot="special-principales-toggle-label" data-testid="menu-crear-special-principales-toggle-label">Añadir platos principales</div>
        <Switch checked={enabled} disabled={busy} onCheckedChange={onToggle} data-testid="menu-crear-special-principales-switch" />
      </div>
      {enabled ? (
        sections.length === 0 ? (
          <p className="bo-mutedText" data-testid="menu-crear-special-principales-no-sections">Añade secciones en la pestaña Platos para elegir sus principales.</p>
        ) : (
          <div className="bo-specialPrincipalesSections" data-testid="menu-crear-special-principales-sections">
            {sections.map((section, idx) => {
              const label = section.title.trim() || `Sección ${idx + 1}`;
              return (
                <div className="bo-specialPrincipalesSection" key={section.id} data-testid={`menu-crear-special-principales-section-${section.id}`}>
                  <div className="bo-label" data-testid={`menu-crear-special-principales-section-title-${section.id}`}>{label}</div>
                  <DishCatalogSearch
                    testIds={{
                      row: `menu-crear-special-principales-add-row-${section.id}`,
                      input: `menu-crear-special-principales-search-${section.id}`,
                      results: `menu-crear-special-principales-results-${section.id}`,
                      result: (dishId) => `menu-crear-special-principales-result-${section.id}-${dishId}`,
                    }}
                    term={searchTerms[section.id] ?? ""}
                    items={(searchResults[section.id] ?? []).filter((item) => !section.principales.some((p) => p.dish_id === item.id))}
                    onTermChange={(term) => onSearch(section.id, term)}
                    onPick={(item) => onPick(section.id, item)}
                    ariaLabel={`Buscar principal para ${label}`}
                    placeholder="Buscar plato principal..."
                    resultsFooter={
                      <button
                        type="button"
                        className="bo-dishSearchResultItem bo-dishSearchResultItem--create"
                        onClick={() => onCreateDish(section.id)}
                        data-testid={`menu-crear-special-principales-create-${section.id}`}
                      >
                        <span className="bo-dishSearchResultTitle" data-testid={`menu-crear-special-principales-create-label-${section.id}`}><Plus size={14} aria-hidden="true" /> Crear nuevo plato</span>
                      </button>
                    }
                  />
                  {section.principales.length > 0 ? (
                    <ul className="bo-specialPrincipalesList" data-testid={`menu-crear-special-principales-list-${section.id}`}>
                      {section.principales.map((dish) => (
                        <li className="bo-specialPrincipalesRow" key={dish.dish_id} data-testid={`menu-crear-special-principales-row-${section.id}-${dish.dish_id}`}>
                          <span className="bo-specialPrincipalesRowTitle" data-testid={`menu-crear-special-principales-row-title-${section.id}-${dish.dish_id}`}>{dish.title}</span>
                          <button
                            type="button"
                            className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm"
                            onClick={() => onRemove(section.id, dish.dish_id)}
                            disabled={busy}
                            aria-label={`Eliminar ${dish.title}`}
                            data-testid={`menu-crear-special-principales-remove-${section.id}-${dish.dish_id}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="bo-mutedText" data-testid={`menu-crear-special-principales-empty-${section.id}`}>Sin principales: esta sección se reserva sin elegir plato.</p>
                  )}
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
