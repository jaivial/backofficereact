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
    <section className="p-6" aria-label="Categorias de comida">
      <div className="rounded-md bg-gradient-to-b from-white/[0.04] to-black/[0.10] bg-card-2 border border-white/[0.06] shadow-soft p-[14px_14px_12px] min-h-[88px]">
        <div className="grid grid-cols-4 grid-gap-3" role="list">
          {FOOD_ENTRIES.map((entry) => {
            const EntryIcon = entry.icon;
            return (
              <button
                key={entry.type}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-md border border bg-gradient-to-b from-white/[0.02] to-black/[0.04] cursor-pointer transition-colors duration-150 transition-border-color duration-150 transition-transform duration-150 hover:bg-gradient-to-b hover:from-white/[0.06] hover:to-black/[0.08] hover:border-2"
                type="button"
                role="listitem"
                onClick={() => openCategory(entry.type)}
                aria-label={`Abrir ${entry.label}`}
              >
                <EntryIcon className="text-accent" size={20} aria-hidden="true" />
                <span className="text-foreground text-base font-bold leading-tight">{entry.label}</span>
                <span className="text-muted-foreground text-xs leading-normal">{entry.hint}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button className="fixed bottom-8 right-8 w-14 h-14 rounded-full bg-accent text-background shadow-soft flex items-center justify-center cursor-pointer transition-transform duration-150 transition-shadow duration-150 border-none hover:scale-105 hover:shadow-lg" type="button" aria-label="Crear elemento de comida" onClick={openCreate}>
        <Plus size={26} />
      </button>
    </section>
  );
}
