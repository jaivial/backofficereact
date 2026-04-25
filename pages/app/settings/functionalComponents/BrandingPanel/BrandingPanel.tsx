import React from "react";
import type { RestaurantBranding } from "../../../../../api/types";
import { Panel } from "../../../../../ui/shell/Panel";

interface BrandingPanelProps {
  branding: RestaurantBranding;
  busy: boolean;
  onBrandingChange: React.Dispatch<React.SetStateAction<RestaurantBranding>>;
  onSave: () => Promise<void>;
}

export function BrandingPanel({ branding, busy, onBrandingChange, onSave }: BrandingPanelProps) {
  const primary = branding.primaryColor?.trim() || "transparent";
  const accent = branding.accentColor?.trim() || "transparent";

  return (
    <Panel title="Branding" meta="Nombre, logo y emails" aria-label="Branding" data-ui="branding-panel">
      <div className="bo-stack" data-slot="brandingPanel-stack">
          <label className="bo-field" data-ui="brandNameField">
            <div className="bo-label" data-slot="fieldLabel">Nombre de marca</div>
            <input
              className="bo-input"
              value={branding.brandName}
              onChange={(e) => onBrandingChange((p) => ({ ...p, brandName: e.target.value }))}
              data-slot="fieldInput"
            />
          </label>

          <label className="bo-field" data-ui="logoUrlField">
            <div className="bo-label" data-slot="fieldLabel">Logo URL</div>
            <input
              className="bo-input"
              value={branding.logoUrl}
              onChange={(e) => onBrandingChange((p) => ({ ...p, logoUrl: e.target.value }))}
              data-slot="fieldInput"
            />
          </label>

          <div className="bo-row" data-slot="colorRow">
            <label className="bo-field" style={{ flex: 1, minWidth: 240 }} data-ui="primaryColorField">
              <div className="bo-label" data-slot="fieldLabel">Color primario</div>
              <div className="bo-row" data-slot="colorInputRow">
                <input
                  className="bo-input bo-input--sm"
                  value={branding.primaryColor}
                  onChange={(e) => onBrandingChange((p) => ({ ...p, primaryColor: e.target.value }))}
                  data-slot="colorInput"
                />
                <div
                  className="bo-pill"
                  style={{ width: 14, height: 14, background: primary, borderColor: "var(--bo-border)" }}
                  aria-label="Preview color primario"
                  data-slot="colorPreview"
                />
              </div>
            </label>

            <label className="bo-field" style={{ flex: 1, minWidth: 240 }} data-ui="accentColorField">
              <div className="bo-label" data-slot="fieldLabel">Color acento</div>
              <div className="bo-row" data-slot="colorInputRow">
                <input
                  className="bo-input bo-input--sm"
                  value={branding.accentColor}
                  onChange={(e) => onBrandingChange((p) => ({ ...p, accentColor: e.target.value }))}
                  data-slot="colorInput"
                />
                <div
                  className="bo-pill"
                  style={{ width: 14, height: 14, background: accent, borderColor: "var(--bo-border)" }}
                  aria-label="Preview color acento"
                  data-slot="colorPreview"
                />
              </div>
            </label>
          </div>

          <label className="bo-field" data-ui="emailFromNameField">
            <div className="bo-label" data-slot="fieldLabel">Email From Name</div>
            <input
              className="bo-input"
              value={branding.emailFromName}
              onChange={(e) => onBrandingChange((p) => ({ ...p, emailFromName: e.target.value }))}
              data-slot="fieldInput"
            />
          </label>

          <label className="bo-field" data-ui="emailFromAddressField">
            <div className="bo-label" data-slot="fieldLabel">Email From Address</div>
            <input
              className="bo-input"
              value={branding.emailFromAddress}
              onChange={(e) => onBrandingChange((p) => ({ ...p, emailFromAddress: e.target.value }))}
              data-slot="fieldInput"
            />
          </label>

          <div className="bo-row" data-slot="actions">
            <button className="bo-btn bo-btn--primary" type="button" onClick={onSave} disabled={busy} data-role="saveBtn">
              Guardar branding
            </button>
          </div>
        </div>
    </Panel>
  );
}
