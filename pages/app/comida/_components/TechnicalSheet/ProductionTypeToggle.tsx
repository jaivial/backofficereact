import React, { useCallback, useState } from "react";

import { InlineAlert } from "../../../../../ui/feedback/InlineAlert";
import { sheetsApi } from "./sheetsApi";

// Every comida product is either bought and sold as-is or produced from a
// technical sheet. The wording is deliberately in kitchen language rather than
// "RAW/MANUFACTURED", because the person setting this is a chef, not a
// developer. Each option carries its own explanation so the choice does not
// depend on guessing what the label means.

export type ProductionType = "RAW" | "MANUFACTURED";

type Props = {
  itemId: number;
  productionType: ProductionType;
  stockRecipeId?: number | null;
  onChange: (next: ProductionType) => void;
  disabled?: boolean;
  /** Which catalogue the id belongs to; wine and postres are separate tables. */
  source?: "comida" | "vinos" | "postres";
  /**
   * True while the product has no id yet (create). The choice is reported to the
   * parent and persisted with the product itself, instead of PATCHing an id
   * that does not exist.
   */
  deferSave?: boolean;
};

const OPTIONS: { value: ProductionType; label: string; hint: string }[] = [
  {
    value: "RAW",
    label: "Materia prima",
    hint: "Se vende tal cual se compra (una botella, un postre de proveedor).",
  },
  {
    value: "MANUFACTURED",
    label: "Preparado",
    hint: "Se elabora en cocina a partir de una ficha tecnica.",
  },
];

export function ProductionTypeToggle({
  itemId,
  productionType,
  stockRecipeId,
  onChange,
  disabled,
  source = "comida",
  deferSave = false,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Deliberately NOT holding a local copy of the selection. Keeping internal
  // state *and* mirroring the prop gives two sources of truth that overwrite
  // each other, which showed up as a save that succeeded in the database while
  // the UI snapped back to the old value. The parent owns the value; this
  // component only reports a confirmed change.
  const current = productionType;

  const select = useCallback(
    async (next: ProductionType) => {
      if (next === current || saving || disabled) return;
      if (deferSave) {
        // Nothing to PATCH yet; the parent persists this with the product.
        onChange(next);
        return;
      }
      setSaving(true);
      setError("");
      try {
        await sheetsApi.setProductionType(itemId, next, stockRecipeId ?? undefined, source);
        // State moves only after the server confirms, so a rejected change can
        // never leave the UI showing something the database does not hold.
        onChange(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo cambiar el tipo");
      } finally {
        setSaving(false);
      }
    },
    [current, deferSave, disabled, itemId, onChange, saving, source, stockRecipeId],
  );

  return (
    <div className="bo-stack" data-ui="production-type-toggle" data-testid="production-type-toggle">
      <div className="bo-productionType" role="radiogroup" aria-label="Tipo de producto" data-slot="production-type-options">
        {OPTIONS.map((option) => {
          const active = current === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={option.label}
              className={`bo-productionType__option${active ? " is-active" : ""}`}
              data-role="production-type-option"
              data-state={active ? "selected" : "unselected"}
              onClick={() => void select(option.value)}
              disabled={saving || disabled}
            >
              {/* The check mark keeps the selected state readable without colour. */}
              <span className="bo-productionType__mark" aria-hidden="true" data-role="production-type-mark">
                {active ? "✓" : ""}
              </span>
              <span className="bo-productionType__label" data-role="production-type-label">{option.label}</span>
              <span className="bo-productionType__hint" data-role="production-type-hint">{option.hint}</span>
            </button>
          );
        })}
      </div>
      {error ? <InlineAlert kind="error" title={error} /> : null}
    </div>
  );
}
