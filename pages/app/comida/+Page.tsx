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
    <section className="bo-p-6" aria-label="Categorias de comida">
      <div className="bo-card">
        <div className="bo-grid bo-grid-cols-4 bo-grid-gap-3" role="list">
          {FOOD_ENTRIES.map((entry) => {
            const EntryIcon = entry.icon;
            return (
              <button
                key={entry.type}
                className="bo-btnCard"
                type="button"
                role="listitem"
                onClick={() => openCategory(entry.type)}
                aria-label={`Abrir ${entry.label}`}
              >
                <EntryIcon className="bo-accentIcon" size={20} aria-hidden="true" />
                <span className="bo-cardTitle">{entry.label}</span>
                <span className="bo-cardMeta">{entry.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button className="bo-fab" type="button" aria-label="Crear elemento de comida" onClick={openCreate}>
        <Plus size={26} />
      </button>
    </section>
  );
}
