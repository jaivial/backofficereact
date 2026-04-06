export const SITE_BUILDER_PAGE_STYLES = `
.bo-siteBuilder {
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-4);
  padding: var(--bo-space-4);
  min-height: calc(100dvh - 140px);
}

.bo-siteBuilderToolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--bo-space-3);
  padding: var(--bo-space-3) var(--bo-space-4);
  background: var(--bo-surface);
  border: 1px solid var(--bo-border);
  border-radius: var(--bo-radius-md);
  box-shadow: var(--bo-shadow-soft);
}

.bo-siteBuilderToolbarLeft,
.bo-siteBuilderToolbarCenter,
.bo-siteBuilderToolbarRight {
  display: flex;
  align-items: center;
  gap: var(--bo-space-3);
}

.bo-siteBuilderToolbarCenter {
  flex: 1;
  justify-content: center;
}

.bo-siteBuilderTitle {
  color: var(--bo-text);
  font-size: var(--bo-text-base);
  font-weight: var(--bo-weight-semibold);
}

.bo-siteBuilderPageName {
  display: inline-flex;
  align-items: center;
  gap: var(--bo-space-2);
  color: var(--bo-muted);
  font-size: var(--bo-text-sm);
}

.bo-siteBuilderViewportToggle {
  display: inline-flex;
  align-items: center;
  gap: var(--bo-space-1);
  padding: 2px;
  border: 1px solid var(--bo-border);
  border-radius: var(--bo-radius-sm);
  background: var(--bo-surface-3);
}

.bo-siteBuilderViewportBtn {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: var(--bo-radius-sm);
  background: transparent;
  color: var(--bo-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--bo-transition-base) var(--bo-ease), color var(--bo-transition-base) var(--bo-ease);
}

.bo-siteBuilderViewportBtn:hover,
.bo-siteBuilderViewportBtn:focus-visible {
  background: var(--bo-surface-2);
  color: var(--bo-text);
}

.bo-siteBuilderViewportBtn.is-active {
  background: color-mix(in srgb, var(--bo-accent) 24%, transparent);
  color: var(--bo-text);
}

.bo-siteBuilderMain {
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  gap: var(--bo-space-4);
  min-height: 0;
  flex: 1;
}

.bo-siteBuilderLeftPanel,
.bo-siteBuilderRightPanel,
.bo-siteBuilderCanvas {
  min-height: 0;
  background: var(--bo-surface);
  border: 1px solid var(--bo-border);
  border-radius: var(--bo-radius-md);
  box-shadow: var(--bo-shadow-soft);
}

.bo-siteBuilderLeftPanel,
.bo-siteBuilderRightPanel {
  display: flex;
  flex-direction: column;
}

.bo-siteBuilderPanelTabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--bo-space-1);
  padding: var(--bo-space-2);
  border-bottom: 1px solid var(--bo-border);
}

.bo-siteBuilderPanelTab {
  height: 36px;
  border: 0;
  border-radius: var(--bo-radius-sm);
  background: transparent;
  color: var(--bo-muted);
  font-size: var(--bo-text-sm);
  font-weight: var(--bo-weight-medium);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--bo-space-2);
  cursor: pointer;
  transition: background-color var(--bo-transition-base) var(--bo-ease), color var(--bo-transition-base) var(--bo-ease);
}

.bo-siteBuilderPanelTab:hover,
.bo-siteBuilderPanelTab:focus-visible {
  background: var(--bo-surface-2);
  color: var(--bo-text);
}

.bo-siteBuilderPanelTab.is-active {
  background: color-mix(in srgb, var(--bo-accent) 22%, transparent);
  color: var(--bo-text);
}

.bo-siteBuilderPanelContent,
.bo-siteBuilderProperties {
  padding: var(--bo-space-3);
  min-height: 0;
  overflow: auto;
}

.bo-siteBuilderComponents,
.bo-siteBuilderPages,
.bo-siteBuilderLayers,
.bo-siteBuilderProperties {
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
}

.bo-siteBuilderComponentItem,
.bo-siteBuilderPageItem,
.bo-siteBuilderLayerItem {
  width: 100%;
  min-height: 40px;
  padding: var(--bo-space-2) var(--bo-space-3);
  border: 1px solid var(--bo-border);
  border-radius: var(--bo-radius-sm);
  background: var(--bo-surface-2);
  color: var(--bo-text);
  display: flex;
  align-items: center;
  gap: var(--bo-space-2);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--bo-transition-base) var(--bo-ease), background-color var(--bo-transition-base) var(--bo-ease);
}

.bo-siteBuilderComponentItem {
  cursor: grab;
}

.bo-siteBuilderComponentItem:active {
  cursor: grabbing;
}

.bo-siteBuilderComponentItem:hover,
.bo-siteBuilderPageItem:hover,
.bo-siteBuilderLayerItem:hover,
.bo-siteBuilderComponentItem:focus-visible,
.bo-siteBuilderPageItem:focus-visible,
.bo-siteBuilderLayerItem:focus-visible {
  border-color: var(--bo-border-2);
  background: var(--bo-surface-3);
}

.bo-siteBuilderPageItem.is-active,
.bo-siteBuilderLayerItem.is-selected,
.bo-siteBuilderNode.is-selected {
  border-color: color-mix(in srgb, var(--bo-accent) 58%, var(--bo-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bo-accent) 30%, transparent);
}

.bo-siteBuilderComponentIcon,
.bo-siteBuilderLayerIcon {
  color: var(--bo-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.bo-siteBuilderComponentLabel,
.bo-siteBuilderLayerName {
  font-size: var(--bo-text-sm);
  color: var(--bo-text);
}

.bo-siteBuilderLayerItemContent {
  display: inline-flex;
  align-items: center;
  gap: var(--bo-space-2);
}

.bo-siteBuilderLayerBranch {
  color: var(--bo-faint);
  font-size: var(--bo-text-xs);
  margin-left: auto;
}

.bo-siteBuilderPageBadge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  padding: 2px var(--bo-space-2);
  border-radius: var(--bo-radius-full);
  font-size: var(--bo-text-xs);
  font-weight: var(--bo-weight-semibold);
  color: var(--bo-accent);
  background: color-mix(in srgb, var(--bo-accent) 18%, transparent);
}

.bo-siteBuilderLayerDelete {
  margin-left: auto;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--bo-radius-sm);
  background: transparent;
  color: var(--bo-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.bo-siteBuilderLayerDelete:hover,
.bo-siteBuilderLayerDelete:focus-visible {
  color: var(--bo-text-danger);
  background: color-mix(in srgb, var(--bo-color-danger) 16%, transparent);
}

.bo-siteBuilderCanvas {
  overflow: auto;
  padding: var(--bo-space-3);
}

.bo-siteBuilderPreview {
  margin: 0 auto;
  min-height: 100%;
  width: 100%;
  padding: var(--bo-space-3);
  background: color-mix(in srgb, var(--bo-bg) 72%, var(--bo-surface));
  border: 1px solid var(--bo-border);
  border-radius: var(--bo-radius-md);
  display: flex;
  justify-content: center;
}

.bo-siteBuilderPageSurface {
  width: 100%;
  min-height: 100%;
  padding: clamp(18px, 2.8vw, 34px);
  border-radius: var(--bo-radius-md);
  border: 1px solid color-mix(in srgb, var(--bo-border) 76%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bo-surface) 86%, white 14%), var(--bo-surface)),
    var(--bo-surface);
  box-shadow: 0 20px 55px rgba(9, 11, 18, 0.24);
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
}

.bo-siteBuilderPageSurface.is-active {
  border-color: color-mix(in srgb, var(--bo-accent) 58%, var(--bo-border));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--bo-accent) 26%, transparent),
    0 20px 55px rgba(9, 11, 18, 0.22);
}

.bo-siteBuilderDropZone {
  min-height: 18px;
  border: 1px dashed transparent;
  border-radius: var(--bo-radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--bo-transition-base) var(--bo-ease), background-color var(--bo-transition-base) var(--bo-ease), min-height var(--bo-transition-base) var(--bo-ease);
}

.bo-siteBuilderDropZone.is-visible {
  min-height: 24px;
}

.bo-siteBuilderDropZone.is-active {
  border-color: color-mix(in srgb, var(--bo-accent) 56%, var(--bo-border));
  background: color-mix(in srgb, var(--bo-accent) 14%, transparent);
}

.bo-siteBuilderDropZoneLabel {
  font-size: var(--bo-text-xs);
  color: var(--bo-faint);
  opacity: 0;
  transition: opacity var(--bo-transition-fast) var(--bo-ease);
}

.bo-siteBuilderDropZone.is-visible .bo-siteBuilderDropZoneLabel,
.bo-siteBuilderDropZone.is-active .bo-siteBuilderDropZoneLabel {
  opacity: 1;
}

.bo-siteBuilderNode {
  position: relative;
  border-radius: var(--bo-radius-sm);
  border: 1px solid transparent;
  background: transparent;
  transition: border-color var(--bo-transition-fast) var(--bo-ease), box-shadow var(--bo-transition-fast) var(--bo-ease), background-color var(--bo-transition-fast) var(--bo-ease);
}

.bo-siteBuilderNode:hover {
  border-color: color-mix(in srgb, var(--bo-accent) 30%, var(--bo-border));
}

.bo-siteBuilderNode.is-selected {
  border-color: color-mix(in srgb, var(--bo-accent) 58%, var(--bo-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bo-accent) 28%, transparent);
  background: color-mix(in srgb, var(--bo-accent) 8%, transparent);
}

.bo-siteBuilderSelectionOutline {
  position: absolute;
  inset: -2px;
  border: 2px dashed var(--bo-accent);
  border-radius: calc(var(--bo-radius-sm) + 2px);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--bo-transition-fast) var(--bo-ease);
  z-index: 10;
}

.bo-siteBuilderNode.is-selected .bo-siteBuilderSelectionOutline {
  opacity: 1;
  animation: bo-selection-dash 0.6s linear infinite;
}

@keyframes bo-selection-dash {
  to {
    stroke-dashoffset: -12px;
  }
}

.bo-siteBuilderResizeHandles {
  position: absolute;
  inset: -6px;
  pointer-events: none;
  z-index: 12;
  opacity: 0;
  transition: opacity var(--bo-transition-fast) var(--bo-ease);
}

.bo-siteBuilderNode.is-selected .bo-siteBuilderResizeHandles {
  opacity: 1;
  pointer-events: auto;
}

.bo-siteBuilderResizeHandle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--bo-surface);
  border: 2px solid var(--bo-accent);
  border-radius: 2px;
  pointer-events: auto;
  cursor: pointer;
  transition: transform var(--bo-transition-fast) var(--bo-ease), background-color var(--bo-transition-fast) var(--bo-ease);
}

.bo-siteBuilderResizeHandle:hover {
  background: var(--bo-accent);
  transform: scale(1.2);
}

.bo-siteBuilderResizeHandle[data-handle="nw"] { top: 0; left: 0; cursor: nwse-resize; }
.bo-siteBuilderResizeHandle[data-handle="n"] { top: 0; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
.bo-siteBuilderResizeHandle[data-handle="ne"] { top: 0; right: 0; cursor: nesw-resize; }
.bo-siteBuilderResizeHandle[data-handle="e"] { top: 50%; right: 0; transform: translateY(-50%); cursor: ew-resize; }
.bo-siteBuilderResizeHandle[data-handle="se"] { bottom: 0; right: 0; cursor: nwse-resize; }
.bo-siteBuilderResizeHandle[data-handle="s"] { bottom: 0; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
.bo-siteBuilderResizeHandle[data-handle="sw"] { bottom: 0; left: 0; cursor: nesw-resize; }
.bo-siteBuilderResizeHandle[data-handle="w"] { top: 50%; left: 0; transform: translateY(-50%); cursor: ew-resize; }

.bo-siteBuilderResizeHandle[data-handle="n"]:hover,
.bo-siteBuilderResizeHandle[data-handle="s"]:hover { transform: translateX(-50%) scale(1.2); }
.bo-siteBuilderResizeHandle[data-handle="e"]:hover,
.bo-siteBuilderResizeHandle[data-handle="w"]:hover { transform: translateY(-50%) scale(1.2); }

.bo-siteBuilderContextMenu {
  position: fixed;
  min-width: 180px;
  padding: var(--bo-space-1);
  background: var(--bo-surface);
  border: 1px solid var(--bo-border);
  border-radius: var(--bo-radius-md);
  box-shadow: var(--bo-shadow-soft), 0 8px 32px rgba(0, 0, 0, 0.24);
  z-index: 1000;
  animation: bo-context-menu-enter 120ms ease-out;
}

@keyframes bo-context-menu-enter {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.bo-siteBuilderContextMenuItem {
  display: flex;
  align-items: center;
  gap: var(--bo-space-2);
  width: 100%;
  padding: var(--bo-space-2) var(--bo-space-3);
  border: 0;
  border-radius: var(--bo-radius-sm);
  background: transparent;
  color: var(--bo-text);
  font-size: var(--bo-text-sm);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--bo-transition-fast) var(--bo-ease);
}

.bo-siteBuilderContextMenuItem:hover,
.bo-siteBuilderContextMenuItem:focus-visible {
  background: var(--bo-surface-2);
}

.bo-siteBuilderContextMenuItem.is-danger {
  color: var(--bo-text-danger);
}

.bo-siteBuilderContextMenuItem.is-danger:hover {
  background: color-mix(in srgb, var(--bo-color-danger) 14%, transparent);
}

.bo-siteBuilderContextMenuDivider {
  height: 1px;
  margin: var(--bo-space-1) 0;
  background: var(--bo-border);
}

.bo-siteBuilderContextMenuShortcut {
  margin-left: auto;
  color: var(--bo-faint);
  font-size: var(--bo-text-xs);
}

.bo-siteBuilderNodeChrome {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--bo-space-2);
  padding: var(--bo-space-1) var(--bo-space-2);
  border-bottom: 1px solid color-mix(in srgb, var(--bo-border) 72%, transparent);
  background: color-mix(in srgb, var(--bo-surface-3) 88%, transparent);
  backdrop-filter: blur(8px);
}

.bo-siteBuilderNodeHeaderLeft,
.bo-siteBuilderNodeHeaderRight {
  display: inline-flex;
  align-items: center;
  gap: var(--bo-space-2);
}

.bo-siteBuilderNodeHeaderRight {
  margin-left: auto;
}

.bo-siteBuilderDragHandle {
  width: 24px;
  height: 24px;
  border: 1px solid var(--bo-border);
  border-radius: 8px;
  background: transparent;
  color: var(--bo-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: grab;
  touch-action: none;
}

.bo-siteBuilderDragHandle:active {
  cursor: grabbing;
}

.bo-siteBuilderNodeType {
  color: var(--bo-text);
  font-size: var(--bo-text-sm);
  font-weight: var(--bo-weight-semibold);
}

.bo-siteBuilderNodeId {
  color: var(--bo-faint);
  font-size: var(--bo-text-xs);
}

.bo-siteBuilderNodeBody {
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
  padding: var(--bo-space-3);
}

.bo-siteBuilderNodeChildren {
  border: 1px dashed color-mix(in srgb, var(--bo-border) 84%, transparent);
  border-radius: var(--bo-radius-sm);
  padding: var(--bo-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
  background: color-mix(in srgb, var(--bo-bg) 21%, transparent);
}

.bo-siteBuilderColumns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: var(--bo-space-2);
}

.bo-siteBuilderColumn {
  border: 1px dashed color-mix(in srgb, var(--bo-border) 84%, transparent);
  border-radius: var(--bo-radius-sm);
  background: color-mix(in srgb, var(--bo-bg) 24%, transparent);
  padding: var(--bo-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
}

.bo-siteBuilderColumnTitle {
  color: var(--bo-faint);
  font-size: var(--bo-text-xs);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.bo-siteBuilderNodeActions {
  display: inline-flex;
  align-items: center;
}

.bo-siteBuilderNodeDelete {
  width: 24px;
  height: 24px;
  border: 0;
  border-radius: var(--bo-radius-sm);
  background: transparent;
  color: var(--bo-faint);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.bo-siteBuilderNodeDelete:hover,
.bo-siteBuilderNodeDelete:focus-visible {
  color: var(--bo-text-danger);
  background: color-mix(in srgb, var(--bo-color-danger) 16%, transparent);
}

.bo-siteBuilderCanvasEmpty {
  min-height: 280px;
  border: 1px dashed var(--bo-border-2);
  border-radius: var(--bo-radius-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--bo-space-2);
  color: var(--bo-muted);
  text-align: center;
}

.bo-nodePreviewHero,
.bo-nodePreviewText,
.bo-nodePreviewHeading,
.bo-nodePreviewButton,
.bo-nodePreviewGeneric {
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
}

.bo-nodePreviewHero h3,
.bo-nodePreviewHeading h1,
.bo-nodePreviewHeading h2,
.bo-nodePreviewHeading h3,
.bo-nodePreviewHeading h4,
.bo-nodePreviewHeading h5,
.bo-nodePreviewHeading h6 {
  margin: 0;
  color: var(--bo-text);
}

.bo-nodePreviewHero p,
.bo-nodePreviewText p {
  margin: 0;
  color: var(--bo-muted);
}

.bo-nodePreviewImage img {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  border-radius: var(--bo-radius-sm);
  border: 1px solid var(--bo-border);
}

.bo-nodePreviewSpacer {
  border-radius: var(--bo-radius-sm);
  border: 1px dashed var(--bo-border);
  background: color-mix(in srgb, var(--bo-accent) 10%, transparent);
}

.bo-nodePreviewDivider {
  margin: 0;
  border: 0;
  border-top: 1px solid var(--bo-border);
}

.bo-nodePreviewGeneric {
  min-height: 86px;
  align-items: center;
  justify-content: center;
  color: var(--bo-muted);
}

.bo-siteBuilderPanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--bo-space-2);
  padding: var(--bo-space-3);
  border-bottom: 1px solid var(--bo-border);
}

.bo-siteBuilderPanelHeader h3 {
  margin: 0;
  color: var(--bo-text);
  font-size: var(--bo-text-base);
  font-weight: var(--bo-weight-semibold);
}

.bo-siteBuilderPropertyGroup {
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-1);
}

.bo-siteBuilderPropertyLabel {
  color: var(--bo-muted);
  font-size: var(--bo-text-xs);
  font-weight: var(--bo-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.bo-siteBuilderPropertyType {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px var(--bo-space-2);
  border-radius: var(--bo-radius-full);
  border: 1px solid var(--bo-border);
  background: var(--bo-surface-3);
  color: var(--bo-text);
  font-size: var(--bo-text-xs);
}

.bo-siteBuilderPropertyActions {
  margin-top: var(--bo-space-2);
  display: flex;
  justify-content: flex-end;
}

.bo-siteBuilderToggleRight {
  position: fixed;
  right: var(--bo-space-4);
  bottom: calc(var(--bo-space-4) + env(safe-area-inset-bottom));
  width: 40px;
  height: 40px;
  border: 1px solid var(--bo-border);
  border-radius: var(--bo-radius-full);
  background: var(--bo-surface);
  color: var(--bo-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--bo-shadow-soft);
  cursor: pointer;
}

@media (max-width: 1280px) {
  .bo-siteBuilderMain {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .bo-siteBuilderRightPanel {
    position: fixed;
    right: var(--bo-space-4);
    top: 128px;
    bottom: var(--bo-space-4);
    width: min(360px, calc(100vw - 32px));
    z-index: 20;
  }
}

@media (max-width: 980px) {
  .bo-siteBuilder {
    padding: var(--bo-space-3);
  }

  .bo-siteBuilderToolbar {
    flex-wrap: wrap;
  }

  .bo-siteBuilderToolbarCenter {
    order: 3;
    flex-basis: 100%;
    justify-content: flex-start;
  }

  .bo-siteBuilderMain {
    grid-template-columns: 1fr;
  }

  .bo-siteBuilderLeftPanel {
    max-height: 300px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .bo-siteBuilder *,
  .bo-siteBuilderToggleRight {
    animation: none !important;
    transition: none !important;
  }
}
`;
