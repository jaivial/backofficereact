import React, { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";

import {
  AllergenSelectGrid,
  CANONICAL_ALLERGEN_OPTIONS,
} from "../../../../../ui/widgets/allergens/AllergenSelectGrid";
import { AllergenPickerPopover } from "./AllergenPickerPopover";
import { IngredientCard } from "./IngredientCard";
import { IngredientPickerPopover } from "./IngredientPickerPopover";
import type { SheetAllergens, SheetComponent } from "./sheetsApi";

// Información: what the dish is made of and what it therefore contains.
// Allergens are split into derived (computed from the ingredient tree) and
// manual. Derived ones are shown locked because unticking "gluten" on a dish
// made of flour would be a food-safety lie, not a preference.

type Props = {
  sheetId: number;
  components: SheetComponent[];
  allergens: SheetAllergens | null;
  onToggleAllergen: (key: string, next: boolean) => void;
  onRemoveComponent: (componentId: number) => void;
  onComponentsChanged: () => void;
};

export function TechnicalSheetInfoTab({
  sheetId,
  components,
  allergens,
  onToggleAllergen,
  onRemoveComponent,
  onComponentsChanged,
}: Props) {
  const addIngredientRef = useRef<HTMLButtonElement | null>(null);
  const addAllergenRef = useRef<HTMLButtonElement | null>(null);
  const [ingredientOpen, setIngredientOpen] = useState(false);
  const [allergenOpen, setAllergenOpen] = useState(false);

  const effective = allergens?.effective ?? [];
  const derived = allergens?.derived ?? [];

  // Only the allergens this sheet actually declares get a card; the grid is a
  // record of what the dish contains, not a checklist of all 14.
  const presentOptions = useMemo(
    () => CANONICAL_ALLERGEN_OPTIONS.filter((option) => effective.includes(option.value)),
    [effective],
  );

  // A derived allergen is locked, and the tooltip names the ingredient that
  // caused it so the lock is explainable rather than mysterious.
  const lockedReasons = useMemo(() => {
    const reasons: Record<string, string> = {};
    for (const key of derived) {
      const contributors = allergens?.contributors?.[key] ?? [];
      reasons[key] = contributors.length > 0
        ? `Detectado automaticamente por: ${contributors.join(", ")}`
        : "Detectado automaticamente por los ingredientes";
    }
    return reasons;
  }, [allergens, derived]);

  return (
    <div className="bo-stack" data-ui="sheet-info-tab" data-testid="sheet-info-tab">
      <section data-testid="sheetsection" className="bo-stack bo-sheetSection">
        <div data-slot="technicalSheetInfoTab-sheetSectionHead" className="bo-sheetSectionHead">
          <h3 data-slot="technicalSheetInfoTab-sectionTitle" className="bo-sectionTitle">Ingredientes</h3>
          <button
            ref={addIngredientRef}
            type="button"
            className="bo-btn bo-btn--secondary bo-btn--sm"
            aria-label="Anadir ingrediente"
            aria-expanded={ingredientOpen}
            data-role="sheet-add-ingredient"
            onClick={() => setIngredientOpen((open) => !open)}
          >
            <Plus size={14} aria-hidden="true" />
            Anadir ingrediente
          </button>
        </div>

        {components.length === 0 ? (
          <p className="bo-sheetHint" data-role="sheet-ingredients-empty">
            Esta ficha aun no tiene ingredientes. Sin ingredientes no se puede calcular el coste ni
            publicar la ficha.
          </p>
        ) : (
          <ul className="bo-ingredientList" data-ui="sheet-ingredient-list">
            {components.map((component) => (
              <IngredientCard
                key={component.id}
                component={component}
                onRemove={onRemoveComponent}
              />
            ))}
          </ul>
        )}

        <IngredientPickerPopover
          open={ingredientOpen}
          anchorRef={addIngredientRef}
          sheetId={sheetId}
          onClose={() => setIngredientOpen(false)}
          onAdded={onComponentsChanged}
        />
      </section>

      <section data-testid="sheetsection-2" className="bo-stack bo-sheetSection">
        <div data-slot="technicalSheetInfoTab-sheetSectionHead" className="bo-sheetSectionHead">
          <h3 data-slot="technicalSheetInfoTab-sectionTitle" className="bo-sectionTitle">Alergenos</h3>
          <button
            ref={addAllergenRef}
            type="button"
            className="bo-btn bo-btn--secondary bo-btn--sm"
            aria-label="Anadir alergeno"
            aria-expanded={allergenOpen}
            data-role="sheet-add-allergen"
            onClick={() => setAllergenOpen((open) => !open)}
          >
            <Plus size={14} aria-hidden="true" />
            Anadir alergeno
          </button>
        </div>

        {/* The same grid as the product editor: one component, so the two can
            never drift apart. Only the allergens actually on the sheet are
            shown; the rest are added from the popover above. */}
        {presentOptions.length === 0 ? (
          <p className="bo-sheetHint" data-role="sheet-allergens-empty">
            Sin alergenos declarados todavia. Se anaden solos al elegir ingredientes.
          </p>
        ) : (
          <AllergenSelectGrid
            data-slot="sheet-alergenos-list"
            options={presentOptions}
            selected={effective}
            locked={derived}
            lockedReasons={lockedReasons}
            onToggle={(value, next) => onToggleAllergen(value, next)}
            itemDataRole="sheet-alergeno-option"
          />
        )}

        {/* Same grid, same data, same handler as the section above, so a change
            made in either place shows in both. */}
        <AllergenPickerPopover
          open={allergenOpen}
          anchorRef={addAllergenRef}
          selected={effective}
          derived={derived}
          contributors={allergens?.contributors}
          onClose={() => setAllergenOpen(false)}
          onToggle={onToggleAllergen}
        />
      </section>
    </div>
  );
}
