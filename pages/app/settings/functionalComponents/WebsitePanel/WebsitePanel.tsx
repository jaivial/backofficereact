import React, { useMemo } from "react";
import type { MenuTemplateType, RestaurantWebsiteMenuTemplatesConfig } from "../../../../../api/types";
import { Select } from "../../../../../ui/inputs/Select";

const MENU_TYPE_OPTIONS: { value: MenuTemplateType; label: string }[] = [
  { value: "closed_conventional", label: "Menu cerrado convencional" },
  { value: "a_la_carte", label: "Menu carta convencional" },
  { value: "closed_group", label: "Menu cerrado grupo" },
  { value: "a_la_carte_group", label: "Menu carta grupo" },
  { value: "special", label: "Menu especial" },
];

interface WebsitePanelProps {
  websiteMenuTemplates: RestaurantWebsiteMenuTemplatesConfig;
  websiteTemplateUsePerType: boolean;
  busy: boolean;
  onTemplatesChange: React.Dispatch<React.SetStateAction<RestaurantWebsiteMenuTemplatesConfig>>;
  onUsePerTypeChange: React.Dispatch<React.SetStateAction<boolean>>;
  onSave: () => Promise<void>;
}

export function WebsitePanel({
  websiteMenuTemplates,
  websiteTemplateUsePerType,
  busy,
  onTemplatesChange,
  onUsePerTypeChange,
  onSave,
}: WebsitePanelProps) {
  const themeOptions = useMemo(
    () => (websiteMenuTemplates.themes || []).map((theme) => ({ value: theme.id, label: theme.name || theme.id })),
    [websiteMenuTemplates.themes],
  );

  return (
    <div className="bo-panel" aria-label="Pagina web" data-ui="website-panel">
      <div className="bo-panelHead" data-slot="panelHead">
        <div className="bo-panelTitle" data-ui="panelTitle">Pagina web</div>
        <div className="bo-panelMeta" data-ui="panelMeta">Plantillas premium para menus por tipo</div>
      </div>
      <div className="bo-panelBody" data-slot="panelBody">
        <div className="bo-stack">
          <label className="bo-field" data-ui="defaultThemeField">
            <div className="bo-label" data-slot="fieldLabel">Plantilla por defecto</div>
            <Select
              value={websiteMenuTemplates.default_theme_id}
              onChange={(value) => onTemplatesChange((prev) => ({ ...prev, default_theme_id: value }))}
              options={themeOptions}
              size="sm"
              ariaLabel="Plantilla por defecto"
              data-slot="themeSelect"
            />
            <div className="bo-mutedText" data-slot="fieldHint">
              Se aplica a toda la web premium y sirve como fallback para tipos sin override.
            </div>
          </label>

          <div className="bo-field" data-ui="usePerTypeField">
            <label className="bo-checkbox" data-slot="checkboxLabel">
              <input
                type="checkbox"
                checked={websiteTemplateUsePerType}
                onChange={(e) => onUsePerTypeChange(e.target.checked)}
                data-slot="checkboxInput"
              />
              <span data-slot="checkboxText">Usar plantilla distinta por tipo de menu</span>
            </label>
          </div>

          {websiteTemplateUsePerType ? (
            <div className="bo-stack" data-ui="overridesStack">
              {MENU_TYPE_OPTIONS.map((menuTypeOption) => (
                <label className="bo-field" key={menuTypeOption.value} data-ui={`overrideField-${menuTypeOption.value}`}>
                  <div className="bo-label" data-slot="fieldLabel">{menuTypeOption.label}</div>
                  <Select
                    value={websiteMenuTemplates.overrides[menuTypeOption.value] || websiteMenuTemplates.default_theme_id}
                    onChange={(value) =>
                      onTemplatesChange((prev) => ({
                        ...prev,
                        overrides: {
                          ...prev.overrides,
                          [menuTypeOption.value]: value,
                        },
                      }))
                    }
                    options={themeOptions}
                    size="sm"
                    ariaLabel={`Plantilla para ${menuTypeOption.label}`}
                    data-slot="overrideSelect"
                  />
                </label>
              ))}
            </div>
          ) : null}

          <div className="bo-row" data-slot="actions">
            <button className="bo-btn bo-btn--primary" type="button" onClick={onSave} disabled={busy} data-role="saveBtn">
              Guardar pagina web
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
