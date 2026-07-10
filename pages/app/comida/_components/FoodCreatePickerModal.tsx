import { Coffee, GlassWater, UtensilsCrossed, Wine } from "lucide-react";

import { Modal } from "../../../../ui/overlays/Modal";
import type { FoodType } from "./foodTypes";

export type CreateFoodType = Exclude<FoodType, "postres">;

const OPTIONS: Array<{ type: CreateFoodType; label: string; hint: string; icon: typeof Coffee }> = [
  { type: "platos", label: "Plato", hint: "Carta principal", icon: UtensilsCrossed },
  { type: "bebidas", label: "Bebida", hint: "Refrescos y cocteles", icon: GlassWater },
  { type: "vinos", label: "Vino", hint: "Bodega y anadas", icon: Wine },
  { type: "cafes", label: "Cafe", hint: "Cafe e infusiones", icon: Coffee },
];

export function FoodCreatePickerModal({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (type: CreateFoodType) => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Crear elemento de comida" size="lg">
      <div className="bo-foodCreatePicker" data-ui="food-create-picker">
        <p className="bo-modalTitle" data-ui="food-create-picker-title">Que quieres crear?</p>
        <div className="bo-foodHub" data-ui="food-create-picker-hub">
          <div className="bo-foodHubGrid" data-ui="food-create-picker-options">
            {OPTIONS.map(({ type, label, hint, icon: Icon }) => (
              <button
                key={type}
                className="bo-foodHubCard"
                type="button"
                onClick={() => onSelect(type)}
                aria-label={label}
                data-ui="food-create-picker-option"
              >
                <Icon className="bo-foodHubIcon" size={20} aria-hidden="true" data-ui="food-create-picker-icon" />
                <span className="bo-foodHubLabel" data-ui="food-create-picker-label">{label}</span>
                <span className="bo-foodHubHint" data-ui="food-create-picker-hint">{hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
