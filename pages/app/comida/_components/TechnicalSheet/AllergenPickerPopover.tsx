import React, { useMemo } from "react";

import { Popover } from "../../../../../ui/overlays/Popover";
import {
  AllergenSelectGrid,
  CANONICAL_ALLERGEN_OPTIONS,
} from "../../../../../ui/widgets/allergens/AllergenSelectGrid";
import { normalizeAllergenList } from "../../../../../ui/widgets/allergens/allergens";

// Edit the sheet's allergens.
//
// This renders the same AllergenSelectGrid as the Informacion tab, so the two
// cannot drift apart, and it shows all 14 with their current state rather than
// only the missing ones: the popover edits the same set the tab displays, so
// unticking here is the natural counterpart to ticking.

type Props = {
  open: boolean;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** The sheet's effective allergens, canonical or legacy slugs. */
  selected: readonly string[];
  /** Derived from the ingredient tree: shown locked, never editable here. */
  derived?: readonly string[];
  /** Ingredient names behind each derived allergen, for the tooltip. */
  contributors?: Record<string, string[]>;
  onClose: () => void;
  onToggle: (allergen: string, next: boolean) => void;
  className?: string;
};

export function AllergenPickerPopover({
  open,
  anchorRef,
  selected,
  derived,
  contributors,
  onClose,
  onToggle,
  className,
}: Props) {
  // Normalised so an allergen persisted as "lacteos" still matches the "Leche"
  // card; without this it would look unselected and be added a second time.
  const selectedKeys = useMemo(() => normalizeAllergenList(selected), [selected]);
  const derivedKeys = useMemo(() => normalizeAllergenList(derived), [derived]);

  const lockedReasons = useMemo(() => {
    const reasons: Record<string, string> = {};
    for (const key of derivedKeys) {
      const sources = contributors?.[key] ?? [];
      reasons[key] =
        sources.length > 0
          ? `Detectado automaticamente por: ${sources.join(", ")}`
          : "Detectado automaticamente por los ingredientes";
    }
    return reasons;
  }, [contributors, derivedKeys]);

  return (
    <Popover
      open={open}
      anchorRef={anchorRef}
      onClose={onClose}
      ariaLabel="Alergenos de la ficha"
      widthPx={300}
      className={className}
      data-testid="allergen-picker-popover"
    >
      <div className="bo-popover__head">
        <h4 className="bo-popover__title">Alergenos</h4>
      </div>

      {/* Compact variant of the very same grid used in the Informacion tab. */}
      <AllergenSelectGrid
        className="bo-allergenGrid--compact"
        options={CANONICAL_ALLERGEN_OPTIONS}
        selected={selectedKeys}
        locked={derivedKeys}
        lockedReasons={lockedReasons}
        onToggle={onToggle}
        itemDataRole="sheet-alergeno-picker-option"
      />
    </Popover>
  );
}
