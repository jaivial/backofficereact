import React from "react";

import { cn } from "../../shadcn/utils";
import { MENU_TYPE_PANELS } from "./menuPresentation";

export const MenuTypePanelGrid = React.memo(function MenuTypePanelGrid({
  countsByType,
  onSelect,
  className,
}: {
  countsByType: Record<string, number>;
  onSelect: (type: string) => void;
  className?: string;
}) {
  const panelIdPrefix = React.useId();

  return (
    <div className={cn("bo-menuTypePanels", className)} data-slot="menu-type-panels">
      <div className="bo-menuTypePanelsGrid" role="group" aria-label="Tipos de menu" data-slot="menu-type-panels-grid">
        {MENU_TYPE_PANELS.map((panel) => {
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
              data-testid={`menu-type-panel-${panel.value}`}
              data-menu-type={panel.value}
              data-surface="minimal-glass"
              data-slot="menu-type-panel"
            >
              <div className="bo-menuTypePanelIcon" aria-hidden="true" data-slot="menu-type-panel-icon">
                <Icon size={28} aria-hidden="true" focusable="false" />
              </div>
              <div className="bo-menuTypePanelLabel" id={labelId} data-slot="menu-type-panel-label">
                {panel.label}
              </div>
              <div className="bo-menuTypePanelDesc" id={descId} data-slot="menu-type-panel-description">
                {panel.description}
              </div>
              <div className="bo-menuTypePanelCount" id={countId} data-slot="menu-type-panel-count">
                {count} menu{count !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
