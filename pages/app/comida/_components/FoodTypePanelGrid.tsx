import React from "react";
import { Coffee, GlassWater, Sparkles, UtensilsCrossed, Wine } from "lucide-react";

import { cn } from "../../../../ui/shadcn/utils";
import type { FoodType } from "./foodTypes";
import { FOOD_TYPE_ORDER } from "./foodTypes";

type FoodPanelDef = {
  value: FoodType;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
};

const FOOD_TYPE_PANELS: FoodPanelDef[] = [
  { value: "vinos", label: "Vinos", description: "Carta y referencias de bodega", icon: Wine },
  { value: "cafes", label: "Cafes", description: "Opciones de cafe e infusiones", icon: Coffee },
  { value: "postres", label: "Postres", description: "Postres activos para carta", icon: Sparkles },
  { value: "platos", label: "Platos", description: "Platos y categorias", icon: UtensilsCrossed },
  { value: "bebidas", label: "Bebidas", description: "Refrescos y bebidas", icon: GlassWater },
];

export const FoodTypePanelGrid = React.memo(function FoodTypePanelGrid({
  countsByType,
  onSelect,
}: {
  countsByType: Record<FoodType, number>;
  onSelect: (type: FoodType) => void;
}) {
  const panelIdPrefix = React.useId();
  const orderedPanels = React.useMemo(() => {
    const mapByType = new Map(FOOD_TYPE_PANELS.map((panel) => [panel.value, panel]));
    return FOOD_TYPE_ORDER.map((type) => mapByType.get(type)).filter(Boolean) as FoodPanelDef[];
  }, []);

  return (
    <div className="py-1">
      <div className="grid grid-cols-2 grid-gap-3 sm:grid-cols-3 lg:grid-cols-5" role="group" aria-label="Tipos de carta">
        {orderedPanels.map((panel) => {
          const Icon = panel.icon;
          const count = countsByType[panel.value] || 0;
          const panelId = `${panelIdPrefix}-${panel.value}`;
          const labelId = `${panelId}-label`;
          const descId = `${panelId}-desc`;
          const countId = `${panelId}-count`;

          return (
            <button
              key={panel.value}
              className={cn(
                "flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-border bg-linear-to-b from-white/[0.04] to-black/[0.08] cursor-pointer transition-all duration-150",
                "hover:border-[rgba(185,168,255,0.42)] hover:bg-linear-to-b hover:from-[rgba(185,168,255,0.08)] hover:to-[rgba(185,168,255,0.04)] hover:-translate-y-0.5",
                "active:translate-y-0",
                "focus-visible:outline-2 focus-visible:outline-bo-accent focus-visible:outline-offset-2"
              )}
              type="button"
              onClick={() => onSelect(panel.value)}
              aria-labelledby={labelId}
              aria-describedby={`${descId} ${countId}`}
              data-menu-type={panel.value}
              data-surface="minimal-glass"
            >
              <div className="w-14 h-14 rounded-full bg-[rgba(185,168,255,0.12)] grid place-items-center text-[rgba(185,168,255,0.9)]" aria-hidden="true">
                <Icon size={28} />
              </div>
              <div className="text-[13px] font-semibold text-bo-text text-center" id={labelId}>
                {panel.label}
              </div>
              <div className="text-[11px] text-text-muted text-center" id={descId}>
                {panel.description}
              </div>
              <div className="mt-1 text-[11px] font-medium text-[rgba(185,168,255,0.8)] bg-[rgba(185,168,255,0.10)] px-2 py-0.5 rounded-full" id={countId}>
                {count} item{count !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
