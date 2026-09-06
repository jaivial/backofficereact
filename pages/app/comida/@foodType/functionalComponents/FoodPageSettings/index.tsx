import React from "react";

import { Switch } from "../../../../../../ui/shadcn/Switch";
import { Select } from "../../../../../../ui/inputs/Select";
import { WEB_PLACEMENT_OPTIONS } from "./webPlacement";

/**
 * Public visibility settings for a food-type page.
 * The placement dropdown tells the public site whether this food type is shown
 * inside the menus accordion or as its own navigation item.
 * Coordination id: foodtype_page_visibility_v1
 */
export function FoodPageSettings({
  foodType,
  pageActive,
  webPlacement,
  busy,
  onTogglePageActive,
  onChangeWebPlacement,
}: {
  foodType: string;
  pageActive: boolean;
  webPlacement: string;
  busy: boolean;
  onTogglePageActive: (checked: boolean) => void;
  onChangeWebPlacement: (value: string) => void;
}) {
  return (
    <div className="bo-card" data-testid={`food-page-settings-panel-${foodType}`} data-coordination-id="foodtype-page-visibility-v1">
      <div className="bo-foodPageVisibilityRow" data-testid={`food-page-settings-active-row-${foodType}`}>
        <span className="bo-foodPageVisibilityTitle" data-testid={`food-page-settings-active-label-${foodType}`}>
          Pagina publica activa
        </span>
        <Switch
          checked={pageActive}
          disabled={busy}
          onCheckedChange={onTogglePageActive}
          data-testid={`food-page-settings-active-switch-${foodType}`}
        />
      </div>

      <div className="bo-foodPageVisibilityRow bo-foodPageVisibilityRow--stacked" data-testid={`food-page-settings-placement-row-${foodType}`}>
        <span className="bo-foodPageVisibilityTitle" data-testid={`food-page-settings-placement-label-${foodType}`}>
          Posicionamiento visibilidad en web
        </span>
        <Select
          value={webPlacement}
          options={WEB_PLACEMENT_OPTIONS}
          disabled={busy || !pageActive}
          ariaLabel="Posicionamiento visibilidad en web"
          onChange={onChangeWebPlacement}
          fitWidestOption
          data-testid={`food-page-settings-placement-select-${foodType}`}
        />
      </div>
    </div>
  );
}
