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
    <div className="bo-menuTypePanels">
      <div className="bo-menuTypePanelsGrid" role="group" aria-label="Tipos de carta">
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
              className={cn("bo-menuTypePanel", "bo-menuGlassPanel", "bo-menuTypePanel--minimalGlass")}
              type="button"
              onClick={() => onSelect(panel.value)}
              aria-labelledby={labelId}
              aria-describedby={`${descId} ${countId}`}
              data-menu-type={panel.value}
              data-surface="minimal-glass"
            >
              <div className="bo-menuTypePanelIcon" aria-hidden="true">
                <Icon size={28} />
              </div>
              <div className="bo-menuTypePanelLabel" id={labelId}>
                {panel.label}
              </div>
              <div className="bo-menuTypePanelDesc" id={descId}>
                {panel.description}
              </div>
              <div className="bo-menuTypePanelCount" id={countId}>
                {count} item{count !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
