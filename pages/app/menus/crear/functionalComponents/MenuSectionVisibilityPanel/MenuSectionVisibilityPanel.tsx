import React, { useCallback, useState } from "react";

import { Select } from "../../../../../../ui/inputs/Select";
import { Switch } from "../../../../../../ui/shadcn/Switch";
import type { EditorSection } from "../../types/menuEditor.types";

export const WEB_PLACEMENT_OPTIONS = [
  { value: "inside_menus", label: "Dentro de menus" },
  { value: "independent_section", label: "Seccion independiente" },
];

export type SectionVisibilityPatch = { public_page_active?: boolean; web_placement?: string };

/**
 * Public visibility controls for one menu section.
 * Coordination id: menu_section_public_placement_v1
 * (backoffice -> PATCH /group-menus-v2/{id}/sections/{sectionId}/visibility
 *  -> DB group_menu_sections_v2 -> public sidebar -> preact nav)
 */
export function MenuSectionVisibilityPanel({
  section,
  onChange,
}: {
  section: EditorSection;
  onChange: (patch: SectionVisibilityPatch) => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const tid = section.id ? `section-${section.id}` : section.clientId;
  const active = section.public_page_active ?? false;
  const placement = section.web_placement || "inside_menus";

  const apply = useCallback(async (patch: SectionVisibilityPatch) => {
    setBusy(true);
    try {
      console.log("[checkpoint] section_visibility_changed", `section=${section.id ?? "unsaved"}`, `patch=${JSON.stringify(patch)}`);
      await onChange(patch);
    } finally {
      setBusy(false);
    }
  }, [onChange, section.id]);

  return (
    <div className="bo-panel" data-testid={`menu-section-visibility-panel-${tid}`} data-coordination-id="menu-section-public-placement-v1">
      <div className="bo-panelHead" data-testid={`menu-section-visibility-head-${tid}`}>
        <div className="bo-panelTitle" data-testid={`menu-section-visibility-title-${tid}`}>{`Visibilidad en web: ${section.title || "Seccion"}`}</div>
      </div>
      <div className="bo-panelBody bo-form" data-testid={`menu-section-visibility-body-${tid}`}>
        <div className="bo-field bo-field--inline" data-testid={`menu-section-visibility-active-row-${tid}`}>
          <div data-testid={`menu-section-visibility-active-copy-${tid}`}>
            <div className="bo-label" data-testid={`menu-section-visibility-active-label-${tid}`}>Pagina publica activa</div>
            <div className="bo-mutedText" data-testid={`menu-section-visibility-active-state-${tid}`}>
              {active ? "Visible en la web publica" : "Oculta en la web publica"}
            </div>
          </div>
          <Switch
            checked={active}
            disabled={busy}
            onCheckedChange={(enabled) => { void apply({ public_page_active: enabled }); }}
            aria-label={active ? "Ocultar pagina publica" : "Activar pagina publica"}
            data-testid={`menu-section-visibility-active-switch-${tid}`}
          />
        </div>
        <div className="bo-field" data-testid={`menu-section-visibility-placement-row-${tid}`}>
          <div className="bo-label" data-testid={`menu-section-visibility-placement-label-${tid}`}>Posicionamiento visibilidad en web</div>
          <Select
            value={placement}
            options={WEB_PLACEMENT_OPTIONS}
            disabled={busy || !active}
            ariaLabel="Posicionamiento visibilidad en web"
            onChange={(value) => { void apply({ web_placement: value }); }}
            data-testid={`menu-section-visibility-placement-select-${tid}`}
          />
        </div>
      </div>
    </div>
  );
}
