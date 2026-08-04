import React from "react";
import { ImageOff, Trash2 } from "lucide-react";

import type { SheetComponent } from "./sheetsApi";

// One ingredient of the sheet, as a card: picture, name, the numbers, actions.
//
// A card rather than a table row because the picture is what a cook recognises
// first, and a 1:1 image inside a <td> forced the row height around.

type Props = {
  component: SheetComponent;
  onRemove: (componentId: number) => void;
};

export function IngredientCard({ component, onRemove }: Props) {
  return (
    <li
      className="bo-ingredientCard"
      data-ui="ingredient-card"
      data-testid={`ingredient-card-${component.id}`}
    >
      <div className="bo-ingredientCard__media">
        {component.imageUrl ? (
          <img
            className="bo-ingredientCard__image"
            src={component.imageUrl}
            alt={component.name}
            loading="lazy"
          />
        ) : (
          // Keeps the square so a mixed list of photographed and un-photographed
          // ingredients still lines up.
          <span
            className="bo-ingredientCard__placeholder"
            aria-hidden="true"
            data-testid={`ingredient-image-placeholder-${component.id}`}
          >
            <ImageOff size={18} />
          </span>
        )}
      </div>

      <div className="bo-ingredientCard__main">
        <span className="bo-ingredientCard__name">{component.name}</span>
        {component.isOptional ? (
          <span className="bo-ingredientCard__flag">Opcional</span>
        ) : null}
      </div>

      <dl className="bo-ingredientCard__figures">
        <div className="bo-ingredientCard__figure">
          <dt>Cantidad</dt>
          <dd>
            {component.quantity} {component.unitCode}
          </dd>
        </div>
        <div className="bo-ingredientCard__figure">
          <dt>Merma</dt>
          {/* An em dash rather than "0 %": no waste recorded is not the same
              statement as a measured zero. */}
          <dd data-testid={`ingredient-waste-${component.id}`}>
            {component.wastePct > 0 ? `${component.wastePct} %` : "—"}
          </dd>
        </div>
      </dl>

      <div className="bo-ingredientCard__actions">
        <button
          type="button"
          className="bo-btn bo-btn--ghost bo-btn--icon"
          aria-label={`Quitar ${component.name}`}
          title={`Quitar ${component.name}`}
          onClick={() => onRemove(component.id)}
        >
          <Trash2 size={16} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}
