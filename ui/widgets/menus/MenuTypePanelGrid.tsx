import React from "react";

import { cn } from "../../shadcn/utils";
import { MENU_TYPE_PANELS } from "./menuPresentation";

export const MenuTypePanelGrid = React.memo(function MenuTypePanelGrid({
  countsByType,
  onSelect,
}: {
  countsByType: Record<string, number>;
  onSelect: (type: string) => void;
}) {
  const panelIdPrefix = React.useId();

  return (
    <div className="bo-menuTypePanels">
      <div className="bo-menuTypePanelsGrid" role="group" aria-label="Tipos de menu">
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
              data-menu-type={panel.value}
              data-surface="minimal-glass"
            >
              <div className="bo-menuTypePanelIcon" aria-hidden="true">
                <Icon size={28} aria-hidden="true" focusable="false" />
              </div>
              <div className="bo-menuTypePanelLabel" id={labelId}>
                {panel.label}
              </div>
              <div className="bo-menuTypePanelDesc" id={descId}>
                {panel.description}
              </div>
              <div className="bo-menuTypePanelCount" id={countId}>
                {count} menu{count !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
