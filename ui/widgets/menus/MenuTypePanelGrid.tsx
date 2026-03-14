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
    <div className="grid gap-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3" role="group" aria-label="Tipos de menu">
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
              className={cn("flex flex-col items-center gap-2 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] text-center transition-all duration-150 hover:bg-white/[0.04] hover:border-white/[0.12] hover:-translate-y-0.5")}
              type="button"
              onClick={() => onSelect(panel.value)}
              aria-labelledby={labelId}
              aria-describedby={`${descId} ${countId}`}
              data-menu-type={panel.value}
              data-surface="minimal-glass"
            >
              <div className="text-primary" aria-hidden="true">
                <Icon size={28} aria-hidden="true" focusable="false" />
              </div>
              <div className="text-sm font-semibold text-foreground" id={labelId}>
                {panel.label}
              </div>
              <div className="text-xs text-muted" id={descId}>
                {panel.description}
              </div>
              <div className="text-xs text-muted" id={countId}>
                {count} menu{count !== 1 ? "s" : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
