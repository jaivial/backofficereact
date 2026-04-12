import React from "react";
import { Eye, Settings2 } from "lucide-react";
import { LoadingSpinner } from "../../../../../../ui/feedback/LoadingSpinner";

export type MenuPreviewProps = {
  previewThemeLoading: boolean;
  previewNeedsUpgrade: boolean;
  previewThemeLabel: string;
  previewThemeId: string;
  menuType: string;
  previewMenuPayload: Record<string, unknown>;
  previewUrl: string;
  mobileTab: "editor" | "preview";
  onMobileTabChange: (tab: "editor" | "preview") => void;
  previewFrameRef: React.MutableRefObject<HTMLIFrameElement | null>;
};

export function MenuPreview({
  previewThemeLoading,
  previewNeedsUpgrade,
  previewThemeLabel,
  previewThemeId,
  menuType,
  previewMenuPayload,
  previewUrl,
  mobileTab,
  onMobileTabChange,
  previewFrameRef,
}: MenuPreviewProps) {
  return (
    <aside className={`bo-previewPane ${mobileTab === "preview" ? "is-mobileActive" : ""}`} data-preview-pane="true" data-testid="menu-preview-pane">
      <div className="bo-previewHead">
        <div>
          <div className="bo-panelTitle">Preview web</div>
          <div className="bo-panelMeta">
            {previewNeedsUpgrade
              ? "Activa premium para desbloquear plantillas"
              : "Plantilla web asignada en configuracion"}
          </div>
        </div>
        <div className="bo-previewThemeSummary">
          <span className={`bo-chip bo-menuOriginChip ${previewNeedsUpgrade ? "" : "is-on"}`}>
            {previewNeedsUpgrade ? "Sin plantilla asignada" : previewThemeLabel}
          </span>
        </div>
      </div>

      <div className="bo-previewSwitchGlass" data-preview-switch="true">
        <button
          className={`bo-previewSwitchBtn ${mobileTab === "editor" ? "is-active" : ""}`}
          type="button"
          onClick={() => onMobileTabChange("editor")}
          aria-label="Editor"
          data-testid="menu-preview-tab-editor"
        >
          <span className="bo-previewSwitchBtnLabel">Editor</span>
          <span className="bo-previewSwitchBtnIcon" aria-hidden="true">
            <Settings2 size={14} />
          </span>
        </button>
        <button
          className={`bo-previewSwitchBtn ${mobileTab === "preview" ? "is-active" : ""}`}
          type="button"
          onClick={() => onMobileTabChange("preview")}
          aria-label="Preview"
          data-testid="menu-preview-tab-preview"
        >
          <span className="bo-previewSwitchBtnLabel">Preview</span>
          <span className="bo-previewSwitchBtnIcon" aria-hidden="true">
            <Eye size={14} />
          </span>
        </button>
      </div>

      {previewThemeLoading ? (
        <div className="bo-previewLoading" role="status" aria-live="polite">
          <LoadingSpinner size="lg" label="Cargando plantilla" />
          <span>Cargando plantilla del restaurante...</span>
        </div>
      ) : previewNeedsUpgrade ? (
        <section className="bo-previewUpgrade" aria-label="Upgrade premium" data-testid="menu-preview-upgrade-section">
          <div className="bo-previewUpgradeAura bo-previewUpgradeAura--one" aria-hidden="true" />
          <div className="bo-previewUpgradeAura bo-previewUpgradeAura--two" aria-hidden="true" />
          <div className="bo-previewUpgradeAura bo-previewUpgradeAura--three" aria-hidden="true" />
          <div className="bo-previewUpgradeBadge">Premium</div>
          <h3 className="bo-previewUpgradeTitle">Desbloquea la web de menus premium</h3>
          <p className="bo-previewUpgradeText">
            Este restaurante todavia no tiene una plantilla web asignada. Activa la suscripcion premium para mostrar
            el preview en tiempo real con el tema elegido.
          </p>
          <div className="bo-previewUpgradeActions" aria-label="Acciones premium">
            <button className="bo-previewUpgradeBtn bo-previewUpgradeBtn--primary" type="button" aria-label="Accion principal de upgrade" data-testid="menu-preview-upgrade-primary" />
            <button className="bo-previewUpgradeBtn" type="button" aria-label="Accion secundaria de upgrade" data-testid="menu-preview-upgrade-secondary" />
          </div>
        </section>
      ) : (
        <iframe
          ref={previewFrameRef}
          className="bo-previewFrame"
          title="Preview menu"
          src={previewUrl}
          data-testid="menu-preview-iframe"
          onLoad={() => {
            const win = previewFrameRef.current?.contentWindow;
            if (!win) return;
            win.postMessage(
              {
                type: "vc_preview:init",
                theme_id: previewThemeId,
                menu_type: menuType || "closed_conventional",
                menu: previewMenuPayload,
              },
              "*",
            );
          }}
        />
      )}
    </aside>
  );
}
