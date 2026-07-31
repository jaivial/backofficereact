import React, { useMemo } from "react";

import { cn } from "../../shadcn/utils";
import { allergenIconSrc, allergenLabel, normalizeAllergenList } from "./allergens";

export type AllergenIconListProps = {
  allergens: readonly string[];
  /** Allergens contributed by raw ingredients. Always shown, never removable. */
  derived?: readonly string[];
  /** Ingredient names that contribute each derived allergen, for the tooltip. */
  contributors?: Record<string, string[]>;
  editable?: boolean;
  onToggle?: (allergen: string, next: boolean) => void;
  className?: string;
  ariaLabel?: string;
};

export const AllergenIconList = React.memo(function AllergenIconList({
  allergens,
  derived,
  contributors,
  editable = false,
  onToggle,
  className,
  ariaLabel = "Alergenos",
}: AllergenIconListProps) {
  const keys = useMemo(() => normalizeAllergenList(allergens), [allergens]);
  const derivedKeys = useMemo(() => new Set(normalizeAllergenList(derived)), [derived]);

  if (keys.length === 0) return null;

  return (
    <ul className={cn("bo-allergenList", className)} aria-label={ariaLabel} data-slot="allergen-list">
      {keys.map((key) => {
        const label = allergenLabel(key);
        const isDerived = derivedKeys.has(key);
        const sources = contributors?.[key] ?? [];
        const name = isDerived
          ? sources.length > 0
            ? `${label} (heredado de ${sources.join(", ")})`
            : `${label} (heredado de los ingredientes)`
          : label;
        const icon = (
          <img
            src={allergenIconSrc(key) ?? undefined}
            alt={name}
            title={name}
            loading="lazy"
            decoding="async"
            className="bo-allergenIcon"
          />
        );
        return (
          <li
            key={key}
            className="bo-allergenItem"
            data-slot="allergen-item"
            data-derived={isDerived ? "true" : "false"}
          >
            {editable ? (
              <button
                type="button"
                className="bo-allergenToggle"
                disabled={isDerived}
                aria-label={name}
                title={isDerived ? `${name}. No se puede quitar.` : name}
                onClick={() => onToggle?.(key, false)}
              >
                {icon}
              </button>
            ) : (
              icon
            )}
          </li>
        );
      })}
    </ul>
  );
});
