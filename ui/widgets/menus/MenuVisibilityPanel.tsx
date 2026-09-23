import React from "react";
import { Switch } from "../../shadcn/Switch";
import { Select } from "../../inputs/Select";
import { WEB_PLACEMENT_OPTIONS } from "./webPlacement";

/**
 * Public-visibility settings for a single menu.
 *
 * Mirrors FoodPageSettings so every place that asks "where should this
 * surface live in the public nav?" uses the same dropdown and the same
 * labels. The component is presentational: every write goes through the
 * `busy` flag and the supplied callbacks.
 *
 * Coordination id: special_menu_visibility_v1
 */
export function MenuVisibilityPanel({
  menuId,
  placement,
  active,
  busy,
  onChangePlacement,
  onChangeActive,
}: {
  menuId: number | null;
  placement: string;
  active: boolean;
  busy: boolean;
  onChangePlacement: (value: string) => void;
  onChangeActive: (checked: boolean) => void;
}) {
  return (
    <div
      className="bo-menuVisibilityRows"
      data-testid={`menu-visibility-panel-${menuId ?? "draft"}`}
      data-coordination-id="special-menu-visibility-v1"
    >
      <div className="bo-foodPageVisibilityRow" data-slot="menu-visibility-active-row">
        <span className="bo-foodPageVisibilityTitle" data-slot="menu-visibility-active-label">
          Pagina publica activa
        </span>
        <Switch
          checked={active}
          disabled={busy || menuId == null}
          onCheckedChange={onChangeActive}
          data-testid={`menu-visibility-active-switch-${menuId ?? "draft"}`}
          data-slot="menu-visibility-active-switch"
        />
      </div>

      <div
        className="bo-foodPageVisibilityRow bo-foodPageVisibilityRow--stacked"
        data-slot="menu-visibility-placement-row"
      >
        <span className="bo-foodPageVisibilityTitle" data-slot="menu-visibility-placement-label">
          Posicionamiento visibilidad en web
        </span>
        <Select
          value={placement}
          options={WEB_PLACEMENT_OPTIONS}
          disabled={busy || !active || menuId == null}
          ariaLabel="Posicionamiento visibilidad en web"
          onChange={onChangePlacement}
          fitWidestOption
          data-testid={`menu-visibility-placement-select-${menuId ?? "draft"}`}
          data-slot="menu-visibility-placement-select"
        />
      </div>
    </div>
  );
}
