import React from "react";
import {
  Bean,
  CircleDot,
  Egg,
  Fish,
  FlaskConical,
  LeafyGreen,
  Milk,
  Nut,
  Shell,
  Shrimp,
  Sprout,
} from "lucide-react";

import { cn } from "../../shadcn/utils";
import { CANONICAL_ALLERGENS } from "./allergens";

// The one allergen picker grid.
//
// Both the product editor and the technical sheet let the user choose from the
// same 14 regulated allergens, so they render the same component: two copies
// would drift, and "the same grid" is a guarantee worth testing once.
//
// The value is caller-defined on purpose. Comida persists lowercase slugs
// ("frutos_secos") while sheets use canonical keys ("Frutos de cascara"), and
// this component must not silently rewrite either.

export type AllergenOption = {
  value: string;
  label: string;
  icon: React.ReactNode;
};

const ICON_BY_KEY: Record<string, React.ComponentType<{ size?: number }>> = {
  Gluten: Bean,
  Crustaceos: Shrimp,
  Huevos: Egg,
  Pescado: Fish,
  Cacahuetes: Nut,
  Soja: Bean,
  Leche: Milk,
  "Frutos de cascara": Nut,
  Apio: LeafyGreen,
  Mostaza: Sprout,
  Sesamo: CircleDot,
  Sulfitos: FlaskConical,
  Altramuces: Bean,
  Moluscos: Shell,
};

/** The canonical 14, in regulation order, keyed by canonical name. */
export const CANONICAL_ALLERGEN_OPTIONS: readonly AllergenOption[] = CANONICAL_ALLERGENS.map(
  (allergen) => {
    const Icon = ICON_BY_KEY[allergen.key] ?? CircleDot;
    return {
      value: allergen.key,
      label: allergen.label,
      icon: <Icon size={16} />,
    };
  },
);

type Props = {
  options: readonly AllergenOption[];
  selected: readonly string[];
  onToggle: (value: string, next: boolean) => void;
  /** Values the user may not change, e.g. allergens derived from ingredients. */
  locked?: readonly string[];
  /** Why each locked value is locked; shown as its tooltip. */
  lockedReasons?: Record<string, string>;
  /**
   * Short corner marker per value, e.g. "FT" for an allergen inherited from a
   * technical sheet. Explains why a card cannot be changed, which a padlock
   * alone does not.
   */
  badges?: Record<string, string>;
  className?: string;
  /** Distinguishes the cards when more than one grid is on the page. */
  itemDataRole?: string;
  "data-slot"?: string;
};

export function AllergenSelectGrid({
  options,
  selected,
  onToggle,
  locked,
  lockedReasons,
  badges,
  className,
  itemDataRole = "allergen-option",
  "data-slot": dataSlot,
}: Props) {
  const selectedSet = new Set(selected);
  const lockedSet = new Set(locked ?? []);

  return (
    <div
      className={cn("bo-allergenGrid", className)}
      data-slot={dataSlot}
      data-testid="allergen-select-grid"
    >
      {options.map((option) => {
        const isSelected = selectedSet.has(option.value);
        const isLocked = lockedSet.has(option.value);
        const reason = lockedReasons?.[option.value];
        const badge = badges?.[option.value];
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              "bo-allergenCircle",
              isSelected ? "is-selected" : "is-unselected",
              isLocked && "is-locked",
            )}
            // aria-disabled rather than disabled: the card stays focusable so a
            // screen-reader user can still read why it cannot be changed.
            aria-disabled={isLocked || undefined}
            aria-label={option.label}
            aria-pressed={isSelected}
            title={reason}
            data-role={itemDataRole}
            data-allergen={option.value}
            data-state={isSelected ? "selected" : "unselected"}
            data-locked={isLocked ? "true" : undefined}
            onClick={() => {
              if (isLocked) return;
              onToggle(option.value, !isSelected);
            }}
          >
            <span className="bo-allergenCircleIcon" data-role={`${itemDataRole}-icon`}>
              {option.icon}
            </span>
            <span className="bo-allergenCircleLabel" data-role={`${itemDataRole}-text`}>
              {option.label}
            </span>
            {/* One corner marker only, or the two would overlap. A badge says
                more than a padlock, so it wins when both apply. */}
            {badge ? (
              <span
                className="bo-allergenCircleBadge"
                data-role={`${itemDataRole}-badge`}
                aria-hidden="true"
              >
                {badge}
              </span>
            ) : isLocked ? (
              <span className="bo-allergenCircleLock" aria-hidden="true">
                🔒
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
