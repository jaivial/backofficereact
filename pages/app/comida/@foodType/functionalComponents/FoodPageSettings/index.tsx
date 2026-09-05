import React from "react";

import { Switch } from "../../../../../../ui/shadcn/Switch";
import { Select } from "../../../../../../ui/inputs/Select";
import { WEB_PLACEMENT_OPTIONS } from "../../../../menus/crear/functionalComponents/MenuSectionVisibilityPanel/MenuSectionVisibilityPanel";

/**
 * Public visibility settings for a food-type page.
 * The placement dropdown tells the public site whether this food type is shown
 * inside the menus accordion or as its own navigation item.
 * Coordination id: postres_page_visibility_v1
 */
export function FoodPageSettings({
  pageActive,
  webPlacement,
  busy,
  onTogglePageActive,
  onChangeWebPlacement,
}: {
  pageActive: boolean;
  webPlacement: string;
  busy: boolean;
  onTogglePageActive: (checked: boolean) => void;
  onChangeWebPlacement: (value: string) => void;
}) {
  return (
    <div className="bo-card" data-testid="food-page-settings-panel" data-coordination-id="postres-page-visibility-v1">
      <div className="bo-foodPageVisibilityRow" data-testid="food-page-settings-active-row">
        <span className="bo-foodPageVisibilityTitle" data-testid="food-page-settings-active-label">
          Pagina publica activa
        </span>
        <Switch
          checked={pageActive}
          disabled={busy}
          onCheckedChange={onTogglePageActive}
          data-testid="food-page-settings-active-switch"
        />
      </div>

      <div className="bo-foodPageVisibilityRow" data-testid="food-page-settings-placement-row">
        <span className="bo-foodPageVisibilityTitle" data-testid="food-page-settings-placement-label">
          Posicionamiento visibilidad en web
        </span>
        <Select
          value={webPlacement}
          options={WEB_PLACEMENT_OPTIONS}
          disabled={busy || !pageActive}
          ariaLabel="Posicionamiento visibilidad en web"
          onChange={onChangeWebPlacement}
          data-testid="food-page-settings-placement-select"
        />
      </div>
    </div>
  );
}
