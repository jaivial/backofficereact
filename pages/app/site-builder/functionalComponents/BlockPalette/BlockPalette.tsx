import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Monitor,
  Save,
  Smartphone,
  Tablet,
  Undo,
} from "lucide-react";
import type { ViewportSize } from "../../constants";
import type { Site, SitePage } from "../../../../../api/site-builder-types";
import { cn } from "../../../../../ui/shadcn/utils";

export type BlockPaletteProps = {
  site: Site | null;
  currentPage: SitePage | null;
  viewportSize: ViewportSize;
  saving: boolean;
  leftPanelOpen: boolean;
  onSetViewportSize: (size: ViewportSize) => void;
  onToggleLeftPanel: () => void;
  onSave: () => void;
};

export function BlockPalette({
  site,
  currentPage,
  viewportSize,
  saving,
  leftPanelOpen,
  onSetViewportSize,
  onToggleLeftPanel,
  onSave,
}: BlockPaletteProps) {
  return (
    <header className="bo-siteBuilderToolbar" data-ui="site-builder-toolbar">
      <div className="bo-siteBuilderToolbarLeft" data-ui="toolbar-left">
        <span className="bo-siteBuilderTitle" data-ui="toolbar-title">
          {site?.name || "Site Builder"}
        </span>
        <span className="bo-siteBuilderPageName" data-ui="toolbar-page-name">
          <svg data-ui="toolbar-page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          {currentPage?.name || "Sin página"}
        </span>
      </div>

      <div className="bo-siteBuilderToolbarCenter" data-ui="toolbar-center">
        <div className="bo-siteBuilderViewportToggle" data-ui="viewport-toggle">
          <button
            className={cn("bo-siteBuilderViewportBtn", viewportSize === "desktop" && "is-active")}
            type="button"
            onClick={() => onSetViewportSize("desktop")}
            title="Desktop"
            aria-label="Viewport desktop"
            data-ui="viewport-btn-desktop"
          >
            <Monitor size={18}>
          </button>
          <button
            className={cn("bo-siteBuilderViewportBtn", viewportSize === "tablet" && "is-active")}
            type="button"
            onClick={() => onSetViewportSize("tablet")}
            title="Tablet"
            aria-label="Viewport tablet"
            data-ui="viewport-btn-tablet"
          >
            <Tablet size={18}>
          </button>
          <button
            className={cn("bo-siteBuilderViewportBtn", viewportSize === "mobile" && "is-active")}
            type="button"
            onClick={() => onSetViewportSize("mobile")}
            title="Mobile"
            aria-label="Viewport mobile"
            data-ui="viewport-btn-mobile"
          >
            <Smartphone size={18}>
          </button>
        </div>
      </div>

      <div className="bo-siteBuilderToolbarRight" data-ui="toolbar-right">
        <button
          className="bo-btn bo-btn--ghost"
          type="button"
          onClick={onToggleLeftPanel}
          title={leftPanelOpen ? "Ocultar panel izquierdo" : "Mostrar panel izquierdo"}
          aria-label={leftPanelOpen ? "Ocultar panel izquierdo" : "Mostrar panel izquierdo"}
          data-ui="toolbar-toggle-left-panel"
        >
          {leftPanelOpen ? <ChevronLeft size={18}> : <ChevronRight size={18}>}
        </button>
        <button className="bo-btn bo-btn--ghost" type="button" title="Deshacer" aria-label="Deshacer" data-ui="toolbar-undo">
          <Undo size={18}>
        </button>
        <button
          className="bo-btn bo-btn--primary"
          type="button"
          onClick={onSave}
          disabled={saving}
          data-ui="toolbar-save"
        >
          {saving ? <Loader2 className="bo-spinnerIcon" size={16}> : <Save size={16}>}
          <span data-ui="toolbar-save-label">Guardar</span>
        </button>
      </div>
    </header>
  );
}
