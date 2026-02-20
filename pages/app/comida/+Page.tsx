import React, { useCallback } from "react";
import { Coffee, GlassWater, Plus, UtensilsCrossed, Wine } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type FoodType = "platos" | "bebidas" | "cafes" | "vinos";

type FoodEntry = {
  type: FoodType;
  label: string;
  hint: string;
  icon: LucideIcon;
};

const FOOD_ENTRIES: FoodEntry[] = [
  { type: "platos", label: "Platos", hint: "Carta principal", icon: UtensilsCrossed },
  { type: "bebidas", label: "Bebidas", hint: "Refrescos y cocteles", icon: GlassWater },
  { type: "cafes", label: "Cafes", hint: "Cafe e infusiones", icon: Coffee },
  { type: "vinos", label: "Vinos", hint: "Bodega y anadas", icon: Wine },
];

export default function Page() {
  const openCategory = useCallback((type: FoodType) => {
    window.location.href = `/app/comida/${type}`;
  }, []);

  const openCreate = useCallback(() => {
    window.location.href = "/app/comida/platos";
  }, []);

  return (
    <section className="bo-foodHome" aria-label="Categorias de comida">
      <div className="bo-foodHub">
        <div className="bo-foodHubGrid" role="list">
          {FOOD_ENTRIES.map((entry) => {
            const EntryIcon = entry.icon;
            return (
              <button
                key={entry.type}
                className="bo-foodHubCard"
                type="button"
                role="listitem"
                onClick={() => openCategory(entry.type)}
                aria-label={`Abrir ${entry.label}`}
              >
                <EntryIcon className="bo-foodHubIcon" size={20} aria-hidden="true" />
                <span className="bo-foodHubLabel">{entry.label}</span>
                <span className="bo-foodHubHint">{entry.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button className="bo-menuFab" type="button" aria-label="Crear elemento de comida" onClick={openCreate}>
        <Plus size={26} />
      </button>
    </section>
  );
}
