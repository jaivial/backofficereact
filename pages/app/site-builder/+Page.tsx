// Site Builder Visual Editor Page
// Main editor interface for JSON tree-based site builder with nested drag-and-drop canvas
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Blocks,
  ChevronLeft,
  ChevronRight,
  Copy,
  EyeOff,
  FileText,
  GripVertical,
  Layers,
  LayoutGrid,
  Loader2,
  Monitor,
  MoreHorizontal,
  Move,
  Save,
  Settings,
  Smartphone,
  Square,
  Tablet,
  Trash2,
  Undo,
} from "lucide-react";

import "../../../components/bo.css";

import { componentsApi, pagesApi, sitesApi } from "../../../api/site-builder-client";
import type {
  ComponentDefinition,
  NestingRules,
  NodeStyle,
  PageNode,
  PageTree,
  Site,
  SitePage,
  ThemeConfig,
} from "../../../api/site-builder-types";
import { useErrorToast } from "../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../ui/feedback/useToasts";
import { cn } from "../../../ui/shadcn/utils";

const DEFAULT_THEME: ThemeConfig = {
  colors: {
    primary: "#1f4ed8",
    secondary: "#0f172a",
    accent: "#8b5cf6",
    background: "#ffffff",
    surface: "#f8fafc",
    text: "#0f172a",
    textMuted: "#64748b",
    border: "#e2e8f0",
  },
  fonts: {
    heading: "Inter",
    body: "Inter",
    headingWeights: [600, 700],
    bodyWeights: [400, 500],
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 48,
    "2xl": 80,
  },
  radius: {
    none: 0,
    sm: 4,
    md: 8,
    lg: 16,
    full: 9999,
  },
  shadows: {
    none: "none",
    sm: "0 1px 2px rgba(0,0,0,0.05)",
    md: "0 4px 6px rgba(0,0,0,0.1)",
    lg: "0 10px 15px rgba(0,0,0,0.1)",
  },
};

const DEFAULT_PAGE_TREE: PageTree = {
  id: "page_root",
  type: "page",
  children: [],
};

type ViewportSize = "desktop" | "tablet" | "mobile";

type DropPlacement = {
  targetId: string | null;
  position: "before" | "after" | "inside";
  columnIndex?: number;
};

type DragData =
  | {
      kind: "existing-node";
      sourceNodeId: string;
    }
  | {
      kind: "new-component";
      componentType: string;
    };

type NodeLocation = {
  node: PageNode;
  parentType: string | "page";
  parentId: string | null;
  parentColumnIndex?: number;
  index: number;
};

type LayerItem = {
  node: PageNode;
  depth: number;
  branch: string;
};

const DRAG_DATA_MIME = "application/x-site-builder-node";
const ROOT_PARENT_TYPE = "page";
const WILDCARD = "*";

const VIEWPORT_CANVAS_WIDTH: Record<ViewportSize, string> = {
  desktop: "min(100%, 1200px)",
  tablet: "768px",
  mobile: "375px",
};

const SITE_BUILDER_PAGE_STYLES = `
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
  border: 1px solid var(--border);
  border-radius: var(--rounded-md);
  box-shadow: var(--shadow-soft);
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
  font-size: var(--text-base);
  font-weight: var(--bo-weight-semibold);
}

.bo-siteBuilderPageName {
  display: inline-flex;
  align-items: center;
  gap: var(--bo-space-2);
  color: var(--text-muted);
  font-size: var(--text-sm);
}

.bo-siteBuilderViewportToggle {
  display: inline-flex;
  align-items: center;
  gap: var(--bo-space-1);
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--rounded-sm);
  background: var(--bo-surface-3);
}

.bo-siteBuilderViewportBtn {
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: var(--rounded-sm);
  background: transparent;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color var(--transition-base) var(--bo-ease), color var(--transition-base) var(--bo-ease);
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
  border: 1px solid var(--border);
  border-radius: var(--rounded-md);
  box-shadow: var(--shadow-soft);
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
  border-bottom: 1px solid var(--border);
}

.bo-siteBuilderPanelTab {
  height: 36px;
  border: 0;
  border-radius: var(--rounded-sm);
  background: transparent;
  color: var(--text-muted);
  font-size: var(--text-sm);
  font-weight: var(--bo-weight-medium);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--bo-space-2);
  cursor: pointer;
  transition: background-color var(--transition-base) var(--bo-ease), color var(--transition-base) var(--bo-ease);
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
  border: 1px solid var(--border);
  border-radius: var(--rounded-sm);
  background: var(--bo-surface-2);
  color: var(--bo-text);
  display: flex;
  align-items: center;
  gap: var(--bo-space-2);
  text-align: left;
  cursor: pointer;
  transition: border-color var(--transition-base) var(--bo-ease), background-color var(--transition-base) var(--bo-ease);
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
  border-color: var(--border-2);
  background: var(--bo-surface-3);
}

.bo-siteBuilderPageItem.is-active,
.bo-siteBuilderLayerItem.is-selected,
.bo-siteBuilderNode.is-selected {
  border-color: color-mix(in srgb, var(--bo-accent) 58%, var(--border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bo-accent) 30%, transparent);
}

.bo-siteBuilderComponentIcon,
.bo-siteBuilderLayerIcon {
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.bo-siteBuilderComponentLabel,
.bo-siteBuilderLayerName {
  font-size: var(--text-sm);
  color: var(--bo-text);
}

.bo-siteBuilderLayerItemContent {
  display: inline-flex;
  align-items: center;
  gap: var(--bo-space-2);
}

.bo-siteBuilderLayerBranch {
  color: var(--text-faint);
  font-size: var(--text-xs);
  margin-left: auto;
}

.bo-siteBuilderPageBadge {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  padding: 2px var(--bo-space-2);
  border-radius: var(--rounded-full);
  font-size: var(--text-xs);
  font-weight: var(--bo-weight-semibold);
  color: var(--bo-accent);
  background: color-mix(in srgb, var(--bo-accent) 18%, transparent);
}

.bo-siteBuilderLayerDelete {
  margin-left: auto;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: var(--rounded-sm);
  background: transparent;
  color: var(--text-muted);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.bo-siteBuilderLayerDelete:hover,
.bo-siteBuilderLayerDelete:focus-visible {
  color: var(--text-danger);
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
  border: 1px solid var(--border);
  border-radius: var(--rounded-md);
  display: flex;
  justify-content: center;
}

.bo-siteBuilderPageSurface {
  width: 100%;
  min-height: 100%;
  padding: clamp(18px, 2.8vw, 34px);
  border-radius: var(--rounded-md);
  border: 1px solid color-mix(in srgb, var(--border) 76%, transparent);
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--bo-surface) 86%, white 14%), var(--bo-surface)),
    var(--bo-surface);
  box-shadow: 0 20px 55px rgba(9, 11, 18, 0.24);
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
}

.bo-siteBuilderPageSurface.is-active {
  border-color: color-mix(in srgb, var(--bo-accent) 58%, var(--border));
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--bo-accent) 26%, transparent),
    0 20px 55px rgba(9, 11, 18, 0.22);
}

.bo-siteBuilderDropZone {
  min-height: 18px;
  border: 1px dashed transparent;
  border-radius: var(--rounded-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: border-color var(--transition-base) var(--bo-ease), background-color var(--transition-base) var(--bo-ease), min-height var(--transition-base) var(--bo-ease);
}

.bo-siteBuilderDropZone.is-visible {
  min-height: 24px;
}

.bo-siteBuilderDropZone.is-active {
  border-color: color-mix(in srgb, var(--bo-accent) 56%, var(--border));
  background: color-mix(in srgb, var(--bo-accent) 14%, transparent);
}

.bo-siteBuilderDropZoneLabel {
  font-size: var(--text-xs);
  color: var(--text-faint);
  opacity: 0;
  transition: opacity var(--transition-fast) var(--bo-ease);
}

.bo-siteBuilderDropZone.is-visible .bo-siteBuilderDropZoneLabel,
.bo-siteBuilderDropZone.is-active .bo-siteBuilderDropZoneLabel {
  opacity: 1;
}

.bo-siteBuilderNode {
  position: relative;
  border-radius: var(--rounded-sm);
  border: 1px solid transparent;
  background: transparent;
  transition: border-color var(--transition-fast) var(--bo-ease), box-shadow var(--transition-fast) var(--bo-ease), background-color var(--transition-fast) var(--bo-ease);
}

.bo-siteBuilderNode:hover {
  border-color: color-mix(in srgb, var(--bo-accent) 30%, var(--border));
}

.bo-siteBuilderNode.is-selected {
  border-color: color-mix(in srgb, var(--bo-accent) 58%, var(--border));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--bo-accent) 28%, transparent);
  background: color-mix(in srgb, var(--bo-accent) 8%, transparent);
}

/* Webflow-like selection outline with animated dashed border */
.bo-siteBuilderSelectionOutline {
  position: absolute;
  inset: -2px;
  border: 2px dashed var(--bo-accent);
  border-radius: calc(var(--rounded-sm) + 2px);
  pointer-events: none;
  opacity: 0;
  transition: opacity var(--transition-fast) var(--bo-ease);
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

/* 8-point resize handles */
.bo-siteBuilderResizeHandles {
  position: absolute;
  inset: -6px;
  pointer-events: none;
  z-index: 12;
  opacity: 0;
  transition: opacity var(--transition-fast) var(--bo-ease);
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
  transition: transform var(--transition-fast) var(--bo-ease), background-color var(--transition-fast) var(--bo-ease);
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

/* Context menu */
.bo-siteBuilderContextMenu {
  position: fixed;
  min-width: 180px;
  padding: var(--bo-space-1);
  background: var(--bo-surface);
  border: 1px solid var(--border);
  border-radius: var(--rounded-md);
  box-shadow: var(--shadow-soft), 0 8px 32px rgba(0, 0, 0, 0.24);
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
  border-radius: var(--rounded-sm);
  background: transparent;
  color: var(--bo-text);
  font-size: var(--text-sm);
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast) var(--bo-ease);
}

.bo-siteBuilderContextMenuItem:hover,
.bo-siteBuilderContextMenuItem:focus-visible {
  background: var(--bo-surface-2);
}

.bo-siteBuilderContextMenuItem.is-danger {
  color: var(--text-danger);
}

.bo-siteBuilderContextMenuItem.is-danger:hover {
  background: color-mix(in srgb, var(--bo-color-danger) 14%, transparent);
}

.bo-siteBuilderContextMenuDivider {
  height: 1px;
  margin: var(--bo-space-1) 0;
  background: var(--border);
}

.bo-siteBuilderContextMenuShortcut {
  margin-left: auto;
  color: var(--text-faint);
  font-size: var(--text-xs);
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
  border-bottom: 1px solid color-mix(in srgb, var(--border) 72%, transparent);
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
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted);
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
  font-size: var(--text-sm);
  font-weight: var(--bo-weight-semibold);
}

.bo-siteBuilderNodeId {
  color: var(--text-faint);
  font-size: var(--text-xs);
}

.bo-siteBuilderNodeBody {
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
  padding: var(--bo-space-3);
}

.bo-siteBuilderNodeChildren {
  border: 1px dashed color-mix(in srgb, var(--border) 84%, transparent);
  border-radius: var(--rounded-sm);
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
  border: 1px dashed color-mix(in srgb, var(--border) 84%, transparent);
  border-radius: var(--rounded-sm);
  background: color-mix(in srgb, var(--bo-bg) 24%, transparent);
  padding: var(--bo-space-2);
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-2);
}

.bo-siteBuilderColumnTitle {
  color: var(--text-faint);
  font-size: var(--text-xs);
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
  border-radius: var(--rounded-sm);
  background: transparent;
  color: var(--text-faint);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.bo-siteBuilderNodeDelete:hover,
.bo-siteBuilderNodeDelete:focus-visible {
  color: var(--text-danger);
  background: color-mix(in srgb, var(--bo-color-danger) 16%, transparent);
}

.bo-siteBuilderCanvasEmpty {
  min-height: 280px;
  border: 1px dashed var(--border-2);
  border-radius: var(--rounded-md);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--bo-space-2);
  color: var(--text-muted);
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
  color: var(--text-muted);
}

.bo-nodePreviewImage img {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  border-radius: var(--rounded-sm);
  border: 1px solid var(--border);
}

.bo-nodePreviewSpacer {
  border-radius: var(--rounded-sm);
  border: 1px dashed var(--border);
  background: color-mix(in srgb, var(--bo-accent) 10%, transparent);
}

.bo-nodePreviewDivider {
  margin: 0;
  border: 0;
  border-top: 1px solid var(--border);
}

.bo-nodePreviewGeneric {
  min-height: 86px;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.bo-siteBuilderPanelHeader {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--bo-space-2);
  padding: var(--bo-space-3);
  border-bottom: 1px solid var(--border);
}

.bo-siteBuilderPanelHeader h3 {
  margin: 0;
  color: var(--bo-text);
  font-size: var(--text-base);
  font-weight: var(--bo-weight-semibold);
}

.bo-siteBuilderPropertyGroup {
  display: flex;
  flex-direction: column;
  gap: var(--bo-space-1);
}

.bo-siteBuilderPropertyLabel {
  color: var(--text-muted);
  font-size: var(--text-xs);
  font-weight: var(--bo-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.bo-siteBuilderPropertyType {
  display: inline-flex;
  align-self: flex-start;
  padding: 2px var(--bo-space-2);
  border-radius: var(--rounded-full);
  border: 1px solid var(--border);
  background: var(--bo-surface-3);
  color: var(--bo-text);
  font-size: var(--text-xs);
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
  border: 1px solid var(--border);
  border-radius: var(--rounded-full);
  background: var(--bo-surface);
  color: var(--bo-text);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-soft);
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

function hasChildrenArray(node: PageNode): node is PageNode & { children: PageNode[] } {
  return Array.isArray((node as { children?: PageNode[] }).children);
}

function hasColumnsArray(node: PageNode): node is PageNode & { columns: PageNode[][] } {
  return node.type === "columns" && Array.isArray((node as { columns?: PageNode[][] }).columns);
}

function clonePageTree(tree: PageTree): PageTree {
  if (typeof structuredClone === "function") {
    return structuredClone(tree);
  }
  return JSON.parse(JSON.stringify(tree)) as PageTree;
}

function ensurePageTree(tree: PageTree | null | undefined): PageTree {
  if (!tree || tree.type !== "page" || !Array.isArray(tree.children)) {
    return clonePageTree(DEFAULT_PAGE_TREE);
  }
  return tree;
}

function makeNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createNodeByType(componentType: string): PageNode {
  const baseNode = {
    id: makeNodeId(),
    type: componentType,
    props: {},
    style: {},
  };

  switch (componentType) {
    case "header":
    case "footer":
    case "section":
      return {
        ...baseNode,
        children: [],
      } as PageNode;
    case "columns":
      return {
        ...baseNode,
        columns: [[], []],
      } as PageNode;
    case "hero":
      return {
        ...baseNode,
        props: {
          title: "Hero Title",
          subtitle: "Subtítulo de ejemplo",
        },
      } as PageNode;
    case "heading":
      return {
        ...baseNode,
        props: {
          text: "Heading",
          level: 2,
        },
      } as PageNode;
    case "text":
      return {
        ...baseNode,
        props: {
          content: "Texto de ejemplo",
        },
      } as PageNode;
    case "button":
      return {
        ...baseNode,
        props: {
          text: "Button",
          variant: "primary",
        },
      } as PageNode;
    case "spacer":
      return {
        ...baseNode,
        props: {
          height: 40,
        },
      } as PageNode;
    default:
      return baseNode as PageNode;
  }
}

function findNodeInNodes(nodes: PageNode[], nodeId: string): PageNode | null {
  for (const node of nodes) {
    if (node.id === nodeId) {
      return node;
    }

    if (hasChildrenArray(node)) {
      const childMatch = findNodeInNodes(node.children, nodeId);
      if (childMatch) {
        return childMatch;
      }
    }

    if (hasColumnsArray(node)) {
      for (const column of node.columns) {
        const columnMatch = findNodeInNodes(column, nodeId);
        if (columnMatch) {
          return columnMatch;
        }
      }
    }
  }

  return null;
}

function findNodeInTree(tree: PageTree, nodeId: string): PageNode | null {
  return findNodeInNodes(tree.children, nodeId);
}

function findNodeLocationInNodes(
  nodes: PageNode[],
  nodeId: string,
  parentType: string | "page",
  parentId: string | null,
  parentColumnIndex?: number,
): NodeLocation | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    if (node.id === nodeId) {
      return {
        node,
        parentType,
        parentId,
        parentColumnIndex,
        index,
      };
    }

    if (hasChildrenArray(node)) {
      const childLocation = findNodeLocationInNodes(node.children, nodeId, node.type, node.id);
      if (childLocation) {
        return childLocation;
      }
    }

    if (hasColumnsArray(node)) {
      for (let columnIndex = 0; columnIndex < node.columns.length; columnIndex += 1) {
        const columnLocation = findNodeLocationInNodes(node.columns[columnIndex], nodeId, node.type, node.id, columnIndex);
        if (columnLocation) {
          return columnLocation;
        }
      }
    }
  }

  return null;
}

function findNodeLocation(tree: PageTree, nodeId: string): NodeLocation | null {
  return findNodeLocationInNodes(tree.children, nodeId, ROOT_PARENT_TYPE, null);
}

function nodeContainsId(node: PageNode, targetId: string): boolean {
  if (node.id === targetId) {
    return true;
  }

  if (hasChildrenArray(node) && node.children.some((child) => nodeContainsId(child, targetId))) {
    return true;
  }

  if (hasColumnsArray(node)) {
    return node.columns.some((column) => column.some((columnNode) => nodeContainsId(columnNode, targetId)));
  }

  return false;
}

function isDescendantNode(tree: PageTree, sourceNodeId: string, targetId: string): boolean {
  const sourceNode = findNodeInTree(tree, sourceNodeId);
  if (!sourceNode) {
    return false;
  }

  if (sourceNode.id === targetId) {
    return true;
  }

  if (hasChildrenArray(sourceNode)) {
    for (const child of sourceNode.children) {
      if (nodeContainsId(child, targetId)) {
        return true;
      }
    }
  }

  if (hasColumnsArray(sourceNode)) {
    for (const column of sourceNode.columns) {
      for (const columnNode of column) {
        if (nodeContainsId(columnNode, targetId)) {
          return true;
        }
      }
    }
  }

  return false;
}

function removeNodeFromNodes(nodes: PageNode[], nodeId: string): PageNode | null {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    if (node.id === nodeId) {
      const [removedNode] = nodes.splice(index, 1);
      return removedNode;
    }

    if (hasChildrenArray(node)) {
      const removedFromChildren = removeNodeFromNodes(node.children, nodeId);
      if (removedFromChildren) {
        return removedFromChildren;
      }
    }

    if (hasColumnsArray(node)) {
      for (let columnIndex = 0; columnIndex < node.columns.length; columnIndex += 1) {
        const removedFromColumn = removeNodeFromNodes(node.columns[columnIndex], nodeId);
        if (removedFromColumn) {
          return removedFromColumn;
        }
      }
    }
  }

  return null;
}

function removeNodeFromTree(tree: PageTree, nodeId: string): PageNode | null {
  return removeNodeFromNodes(tree.children, nodeId);
}

function insertNodeInNodes(nodes: PageNode[], nodeToInsert: PageNode, placement: DropPlacement): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    if (node.id === placement.targetId) {
      if (placement.position === "before") {
        nodes.splice(index, 0, nodeToInsert);
        return true;
      }

      if (placement.position === "after") {
        nodes.splice(index + 1, 0, nodeToInsert);
        return true;
      }

      if (placement.position === "inside") {
        if (hasColumnsArray(node)) {
          const destinationColumn = placement.columnIndex ?? 0;
          if (!node.columns[destinationColumn]) {
            return false;
          }
          node.columns[destinationColumn].push(nodeToInsert);
          return true;
        }

        if (hasChildrenArray(node)) {
          node.children.push(nodeToInsert);
          return true;
        }

        return false;
      }
    }

    if (hasChildrenArray(node) && insertNodeInNodes(node.children, nodeToInsert, placement)) {
      return true;
    }

    if (hasColumnsArray(node)) {
      for (const column of node.columns) {
        if (insertNodeInNodes(column, nodeToInsert, placement)) {
          return true;
        }
      }
    }
  }

  return false;
}

function insertNodeInTree(tree: PageTree, nodeToInsert: PageNode, placement: DropPlacement): boolean {
  if (placement.targetId === null) {
    tree.children.push(nodeToInsert);
    return true;
  }

  return insertNodeInNodes(tree.children, nodeToInsert, placement);
}

function updateNodeInNodes(nodes: PageNode[], nodeId: string, updates: Partial<PageNode>): boolean {
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];

    if (node.id === nodeId) {
      nodes[index] = {
        ...node,
        ...updates,
      } as PageNode;
      return true;
    }

    if (hasChildrenArray(node) && updateNodeInNodes(node.children, nodeId, updates)) {
      return true;
    }

    if (hasColumnsArray(node)) {
      for (const column of node.columns) {
        if (updateNodeInNodes(column, nodeId, updates)) {
          return true;
        }
      }
    }
  }

  return false;
}

function updateNodeInTree(tree: PageTree, nodeId: string, updates: Partial<PageNode>): boolean {
  return updateNodeInNodes(tree.children, nodeId, updates);
}

function flattenNodesForLayers(nodes: PageNode[], depth = 0, branch = "root"): LayerItem[] {
  const flattened: LayerItem[] = [];

  for (const node of nodes) {
    flattened.push({ node, depth, branch });

    if (hasChildrenArray(node)) {
      flattened.push(...flattenNodesForLayers(node.children, depth + 1, node.type));
    }

    if (hasColumnsArray(node)) {
      for (let columnIndex = 0; columnIndex < node.columns.length; columnIndex += 1) {
        const column = node.columns[columnIndex];
        flattened.push(...flattenNodesForLayers(column, depth + 1, `col ${columnIndex + 1}`));
      }
    }
  }

  return flattened;
}

function allowsType(rules: string[] | undefined, type: string): boolean {
  if (!rules || rules.length === 0) {
    return true;
  }
  return rules.includes(WILDCARD) || rules.includes(type);
}

function isSamePlacement(a: DropPlacement | null, b: DropPlacement): boolean {
  if (!a) {
    return false;
  }

  return (
    a.targetId === b.targetId &&
    a.position === b.position &&
    (a.columnIndex ?? -1) === (b.columnIndex ?? -1)
  );
}

function getPlacementKey(placement: DropPlacement): string {
  return `${placement.targetId ?? "root"}:${placement.position}:${placement.columnIndex ?? -1}`;
}

function appendPlacementIfMissing(placements: DropPlacement[], placement: DropPlacement): void {
  const key = getPlacementKey(placement);
  const exists = placements.some((candidate) => getPlacementKey(candidate) === key);
  if (!exists) {
    placements.push(placement);
  }
}

function collectPlacementCandidatesFromNodes(nodes: PageNode[], placements: DropPlacement[]): void {
  for (const node of nodes) {
    appendPlacementIfMissing(placements, { targetId: node.id, position: "before" });

    if (hasChildrenArray(node)) {
      appendPlacementIfMissing(placements, { targetId: node.id, position: "inside" });
      collectPlacementCandidatesFromNodes(node.children, placements);
    }

    if (hasColumnsArray(node)) {
      for (let columnIndex = 0; columnIndex < node.columns.length; columnIndex += 1) {
        appendPlacementIfMissing(placements, { targetId: node.id, position: "inside", columnIndex });
        collectPlacementCandidatesFromNodes(node.columns[columnIndex], placements);
      }
    }

    appendPlacementIfMissing(placements, { targetId: node.id, position: "after" });
  }
}

function buildPlacementCandidates(tree: PageTree): DropPlacement[] {
  const placements: DropPlacement[] = [{ targetId: null, position: "inside" }];
  collectPlacementCandidatesFromNodes(tree.children, placements);
  return placements;
}

function getNestingRules(component?: ComponentDefinition): NestingRules | null {
  return component?.nesting_rules ?? null;
}

function parseNodeProps(node: PageNode): Record<string, unknown> {
  return node.props && typeof node.props === "object" ? (node.props as Record<string, unknown>) : {};
}

function parseNodeStyle(node: PageNode): NodeStyle {
  if (node.style && typeof node.style === "object") {
    return node.style as NodeStyle;
  }
  return {};
}

function toInputValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toCssDimension(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value === "number") {
    return `${value}px`;
  }
  if (typeof value === "string") {
    return value;
  }
  return undefined;
}

function nodeStyleToInlineStyle(style: NodeStyle): React.CSSProperties {
  return {
    paddingTop: toCssDimension(style.paddingTop),
    paddingBottom: toCssDimension(style.paddingBottom),
    paddingLeft: toCssDimension(style.paddingLeft),
    paddingRight: toCssDimension(style.paddingRight),
    marginTop: toCssDimension(style.marginTop),
    marginBottom: toCssDimension(style.marginBottom),
    backgroundColor: toInputValue(style.backgroundColor),
    color: toInputValue(style.textColor),
    borderRadius: toCssDimension(style.borderRadius),
    borderWidth: style.borderWidth,
    borderStyle: style.borderWidth ? "solid" : undefined,
    borderColor: toInputValue(style.borderColor),
    boxShadow: toInputValue(style.boxShadow),
    textAlign: style.textAlign,
    maxWidth: toCssDimension(style.maxWidth),
    minHeight: toCssDimension(style.minHeight),
  };
}

function isRootLayoutOrderValid(nodes: PageNode[]): boolean {
  const headerIndexes = nodes
    .map((node, index) => ({ type: node.type, index }))
    .filter((entry) => entry.type === "header")
    .map((entry) => entry.index);

  const footerIndexes = nodes
    .map((node, index) => ({ type: node.type, index }))
    .filter((entry) => entry.type === "footer")
    .map((entry) => entry.index);

  if (headerIndexes.length > 1 || footerIndexes.length > 1) {
    return false;
  }

  if (headerIndexes.length === 1 && headerIndexes[0] !== 0) {
    return false;
  }

  if (footerIndexes.length === 1 && footerIndexes[0] !== nodes.length - 1) {
    return false;
  }

  return true;
}

export default function SiteBuilderEditorPage() {
  const { addToast } = useToasts();
  const { handleError } = useErrorToast();

  const [site, setSite] = useState<Site | null>(null);
  const [pages, setPages] = useState<SitePage[]>([]);
  const [currentPage, setCurrentPage] = useState<SitePage | null>(null);
  const [components, setComponents] = useState<ComponentDefinition[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [viewportSize, setViewportSize] = useState<ViewportSize>("desktop");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeLeftTab, setActiveLeftTab] = useState<"components" | "pages" | "layers">("components");
  const [activeDropPlacement, setActiveDropPlacement] = useState<DropPlacement | null>(null);
  const [dragData, setDragData] = useState<DragData | null>(null);
  
  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  
  // Clipboard for copy/paste
  const [clipboardNode, setClipboardNode] = useState<PageNode | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  const componentByType = useMemo(() => {
    const entries = components.map((component) => [component.type, component] as const);
    return new Map<string, ComponentDefinition>(entries);
  }, [components]);

  const layerItems = useMemo(() => {
    if (!currentPage) {
      return [];
    }
    return flattenNodesForLayers(currentPage.tree.children);
  }, [currentPage]);

  const viewportWidth = useMemo(() => VIEWPORT_CANVAS_WIDTH[viewportSize], [viewportSize]);

  const selectedNode = useMemo(() => {
    if (!currentPage || !selectedNodeId) {
      return null;
    }
    return findNodeInTree(currentPage.tree, selectedNodeId);
  }, [currentPage, selectedNodeId]);

  const selectedNodeStyle = useMemo<NodeStyle>(() => {
    if (!selectedNode) {
      return {};
    }
    return parseNodeStyle(selectedNode);
  }, [selectedNode]);

  const isDraggingCanvas = useMemo(() => dragData !== null, [dragData]);

  const commitCurrentPage = useCallback((nextPage: SitePage) => {
    setCurrentPage(nextPage);
    setPages((prevPages) => prevPages.map((page) => (page.id === nextPage.id ? nextPage : page)));
  }, []);

  const loadInitialData = useCallback(async () => {
    try {
      setLoading(true);

      const sitesList = await sitesApi.list();
      let currentSite = sitesList[0];

      if (!currentSite) {
        const { id } = await sitesApi.create({
          name: "Mi Sitio Web",
          subdomain: `site-${Date.now()}`,
          theme_config: DEFAULT_THEME,
        });
        currentSite = await sitesApi.get(id);
      }

      setSite(currentSite);

      const pagesList = await pagesApi.list(currentSite.id);
      const normalizedPages = pagesList.map((page) => ({
        ...page,
        tree: ensurePageTree(page.tree),
      }));
      setPages(normalizedPages);

      const homePage = normalizedPages.find((page) => page.is_home) || normalizedPages[0] || null;
      setCurrentPage(homePage);

      const componentsList = await componentsApi.list();
      setComponents(componentsList);
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  const canNodeTypeBeChild = useCallback(
    (childType: string, parentType: string | "page") => {
      const childRules = getNestingRules(componentByType.get(childType));
      const parentRules = parentType === ROOT_PARENT_TYPE ? null : getNestingRules(componentByType.get(parentType));

      const parentAllowsChild = parentType === ROOT_PARENT_TYPE
        ? true
        : allowsType(parentRules?.allowedChildren, childType);

      const childAllowsParent = allowsType(childRules?.allowedParents, parentType);

      return parentAllowsChild && childAllowsParent;
    },
    [componentByType],
  );

  const getPlacementParentType = useCallback(
    (tree: PageTree, placement: DropPlacement): string | "page" | null => {
      if (placement.targetId === null) {
        return ROOT_PARENT_TYPE;
      }

      const targetLocation = findNodeLocation(tree, placement.targetId);
      if (!targetLocation) {
        return null;
      }

      if (placement.position === "inside") {
        if (hasChildrenArray(targetLocation.node)) {
          return targetLocation.node.type;
        }

        if (hasColumnsArray(targetLocation.node)) {
          const destinationColumn = placement.columnIndex ?? 0;
          return targetLocation.node.columns[destinationColumn] ? targetLocation.node.type : null;
        }

        return null;
      }

      return targetLocation.parentType;
    },
    [],
  );

  const canDropAtPlacement = useCallback(
    (incomingDragData: DragData, placement: DropPlacement): boolean => {
      if (!currentPage) {
        return false;
      }

      if (incomingDragData.kind === "existing-node" && placement.targetId === incomingDragData.sourceNodeId) {
        return false;
      }

      if (
        incomingDragData.kind === "existing-node" &&
        placement.targetId &&
        isDescendantNode(currentPage.tree, incomingDragData.sourceNodeId, placement.targetId)
      ) {
        return false;
      }

      const nodeType = incomingDragData.kind === "existing-node"
        ? findNodeInTree(currentPage.tree, incomingDragData.sourceNodeId)?.type
        : incomingDragData.componentType;

      if (!nodeType) {
        return false;
      }

      const parentType = getPlacementParentType(currentPage.tree, placement);
      if (!parentType) {
        return false;
      }

      if (!canNodeTypeBeChild(nodeType, parentType)) {
        return false;
      }

      if ((nodeType === "header" || nodeType === "footer") && parentType !== ROOT_PARENT_TYPE) {
        return false;
      }

      const needsRootOrderValidation =
        parentType === ROOT_PARENT_TYPE ||
        nodeType === "header" ||
        nodeType === "footer";

      if (!needsRootOrderValidation) {
        return true;
      }

      const simulatedTree = clonePageTree(currentPage.tree);
      let simulatedNode: PageNode;

      if (incomingDragData.kind === "existing-node") {
        const removedNode = removeNodeFromTree(simulatedTree, incomingDragData.sourceNodeId);
        if (!removedNode) {
          return false;
        }
        simulatedNode = removedNode;
      } else {
        simulatedNode = createNodeByType(incomingDragData.componentType);
      }

      if (!insertNodeInTree(simulatedTree, simulatedNode, placement)) {
        return false;
      }

      return isRootLayoutOrderValid(simulatedTree.children);
    },
    [canNodeTypeBeChild, currentPage, getPlacementParentType],
  );

  const validDropPlacementKeys = useMemo(() => {
    if (!currentPage || !dragData) {
      return new Set<string>();
    }

    const candidatePlacements = buildPlacementCandidates(currentPage.tree);
    const validKeys = candidatePlacements
      .filter((placement) => canDropAtPlacement(dragData, placement))
      .map((placement) => getPlacementKey(placement));

    return new Set<string>(validKeys);
  }, [canDropAtPlacement, currentPage, dragData]);

  const parseDragPayload = useCallback((event: React.DragEvent): DragData | null => {
    const payload = event.dataTransfer.getData(DRAG_DATA_MIME);
    if (!payload) {
      return dragData;
    }

    try {
      const decoded = JSON.parse(payload) as DragData;
      return decoded;
    } catch {
      return dragData;
    }
  }, [dragData]);

  const handleDropOnPlacement = useCallback(
    (event: React.DragEvent, placement: DropPlacement) => {
      event.preventDefault();

      if (!currentPage) {
        return;
      }

      const incomingDragData = parseDragPayload(event);
      if (!incomingDragData) {
        return;
      }

      if (!canDropAtPlacement(incomingDragData, placement)) {
        setActiveDropPlacement(null);
        setDragData(null);
        addToast({
          kind: "info",
          title: "Movimiento no permitido",
          description: "La posición de destino rompe las reglas de layout o anidación.",
          timeoutMs: 2400,
        });
        return;
      }

      const nextTree = clonePageTree(currentPage.tree);
      let droppedNodeId: string | null = null;

      if (incomingDragData.kind === "existing-node") {
        const removedNode = removeNodeFromTree(nextTree, incomingDragData.sourceNodeId);
        if (!removedNode) {
          setActiveDropPlacement(null);
          setDragData(null);
          return;
        }

        const inserted = insertNodeInTree(nextTree, removedNode, placement);
        if (!inserted) {
          setActiveDropPlacement(null);
          setDragData(null);
          return;
        }

        droppedNodeId = removedNode.id;
      } else {
        const newNode = createNodeByType(incomingDragData.componentType);
        const inserted = insertNodeInTree(nextTree, newNode, placement);
        if (!inserted) {
          setActiveDropPlacement(null);
          setDragData(null);
          return;
        }

        droppedNodeId = newNode.id;
      }

      if (!isRootLayoutOrderValid(nextTree.children)) {
        setActiveDropPlacement(null);
        setDragData(null);
        addToast({
          kind: "info",
          title: "Estructura inválida",
          description: "Header debe ir arriba y footer al final de la página.",
          timeoutMs: 2400,
        });
        return;
      }

      const nextPage: SitePage = {
        ...currentPage,
        tree: nextTree,
      };

      commitCurrentPage(nextPage);
      if (droppedNodeId) {
        setSelectedNodeId(droppedNodeId);
        setRightPanelOpen(true);
      }

      setActiveLeftTab("layers");
      setActiveDropPlacement(null);
      setDragData(null);
    },
    [addToast, canDropAtPlacement, commitCurrentPage, currentPage, parseDragPayload],
  );

  const handleDropZoneDragOver = useCallback(
    (event: React.DragEvent, placement: DropPlacement) => {
      const incomingDragData = parseDragPayload(event);
      if (!incomingDragData) {
        return;
      }

      if (!canDropAtPlacement(incomingDragData, placement)) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = incomingDragData.kind === "new-component" ? "copy" : "move";
      setActiveDropPlacement(placement);
    },
    [canDropAtPlacement, parseDragPayload],
  );

  const handleDragEnd = useCallback(() => {
    setDragData(null);
    setActiveDropPlacement(null);
  }, []);

  const handleDragStartComponent = useCallback((event: React.DragEvent, componentType: string) => {
    const payload: DragData = {
      kind: "new-component",
      componentType,
    };
    event.dataTransfer.setData(DRAG_DATA_MIME, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copy";
    setDragData(payload);
  }, []);

  const handleDragStartNode = useCallback((event: React.DragEvent, nodeId: string) => {
    const payload: DragData = {
      kind: "existing-node",
      sourceNodeId: nodeId,
    };
    event.dataTransfer.setData(DRAG_DATA_MIME, JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "move";
    setDragData(payload);
    setSelectedNodeId(nodeId);
  }, []);

  const handleSavePage = useCallback(async () => {
    if (!currentPage) {
      return;
    }

    try {
      setSaving(true);
      await pagesApi.update(currentPage.id, {
        tree: currentPage.tree,
      });
      addToast({
        title: "Guardado",
        description: "Página guardada correctamente",
      });
    } catch (err) {
      handleError(err);
    } finally {
      setSaving(false);
    }
  }, [addToast, currentPage, handleError]);

  const handleAddComponent = useCallback(
    (componentType: string) => {
      if (!currentPage) {
        return;
      }

      const nextTree = clonePageTree(currentPage.tree);
      const newNode = createNodeByType(componentType);

      if (componentType === "header" || componentType === "footer") {
        const alreadyExists = nextTree.children.some((node) => node.type === componentType);
        if (alreadyExists) {
          addToast({
            kind: "info",
            title: "Componente único",
            description: componentType === "header" ? "Solo puede haber un header" : "Solo puede haber un footer",
            timeoutMs: 2200,
          });
          return;
        }
      }

      if (componentType === "header") {
        nextTree.children.unshift(newNode);
      } else if (componentType === "footer") {
        nextTree.children.push(newNode);
      } else {
        const footerIndex = nextTree.children.findIndex((node) => node.type === "footer");
        if (footerIndex >= 0) {
          nextTree.children.splice(footerIndex, 0, newNode);
        } else {
          nextTree.children.push(newNode);
        }
      }

      if (!isRootLayoutOrderValid(nextTree.children)) {
        addToast({
          kind: "info",
          title: "Layout inválido",
          description: "Header debe ir arriba y footer al final.",
          timeoutMs: 2200,
        });
        return;
      }

      const nextPage: SitePage = {
        ...currentPage,
        tree: nextTree,
      };

      commitCurrentPage(nextPage);
      setSelectedNodeId(newNode.id);
      setRightPanelOpen(true);
      setActiveLeftTab("layers");
    },
    [addToast, commitCurrentPage, currentPage],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (!currentPage) {
        return;
      }

      const nextTree = clonePageTree(currentPage.tree);
      const removedNode = removeNodeFromTree(nextTree, nodeId);
      if (!removedNode) {
        return;
      }

      if (!isRootLayoutOrderValid(nextTree.children)) {
        addToast({
          kind: "info",
          title: "Estructura inválida",
          description: "No se pudo aplicar el cambio sin romper el orden de layout.",
          timeoutMs: 2200,
        });
        return;
      }

      const nextPage: SitePage = {
        ...currentPage,
        tree: nextTree,
      };
      commitCurrentPage(nextPage);

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
      
      // Close context menu if open for this node
      if (contextMenu?.nodeId === nodeId) {
        setContextMenu(null);
      }
    },
    [addToast, commitCurrentPage, currentPage, selectedNodeId, contextMenu],
  );
  
  // Context menu handlers
  const handleContextMenu = useCallback((event: React.MouseEvent, nodeId: string) => {
    event.preventDefault();
    event.stopPropagation();
    
    setContextMenu({
      nodeId,
      x: event.clientX,
      y: event.clientY,
    });
    setSelectedNodeId(nodeId);
  }, []);
  
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);
  
  const handleCopyNode = useCallback((nodeId: string) => {
    if (!currentPage) return;
    
    const node = findNodeInTree(currentPage.tree, nodeId);
    if (node) {
      // Deep clone the node with a new ID tree
      const clonedNode = clonePageTree({ id: "temp", type: "page", children: [node] }).children[0];
      setClipboardNode(clonedNode);
      addToast({
        title: "Copiado",
        description: `${node.type} copiado al portapapeles`,
        timeoutMs: 1500,
      });
    }
    setContextMenu(null);
  }, [currentPage, addToast]);
  
  const handlePasteNode = useCallback((targetNodeId: string | null) => {
    if (!currentPage || !clipboardNode) return;
    
    const nextTree = clonePageTree(currentPage.tree);
    
    // Create a deep copy with new IDs
    const newNode = clonePageTree({ id: "temp", type: "page", children: [clipboardNode] }).children[0];
    newNode.id = makeNodeId();
    
    // Determine where to insert
    if (targetNodeId === null) {
      // Paste at root level
      const footerIndex = nextTree.children.findIndex((n) => n.type === "footer");
      if (footerIndex >= 0) {
        nextTree.children.splice(footerIndex, 0, newNode);
      } else {
        nextTree.children.push(newNode);
      }
    } else {
      // Find target location
      const targetLocation = findNodeLocation(nextTree, targetNodeId);
      if (!targetLocation) {
        addToast({
          kind: "info",
          title: "No se puede pegar",
          description: "No se encontró el destino",
          timeoutMs: 2000,
        });
        return;
      }
      
      // Insert after the target node
      const placement: DropPlacement = {
        targetId: targetNodeId,
        position: "after",
        columnIndex: targetLocation.parentColumnIndex,
      };
      
      if (!insertNodeInTree(nextTree, newNode, placement)) {
        addToast({
          kind: "info",
          title: "No se puede pegar",
          description: "No se pudo insertar en la posición",
          timeoutMs: 2000,
        });
        return;
      }
    }
    
    if (!isRootLayoutOrderValid(nextTree.children)) {
      addToast({
        kind: "info",
        title: "Estructura inválida",
        description: "La operación rompería el layout",
        timeoutMs: 2000,
      });
      return;
    }
    
    const nextPage: SitePage = {
      ...currentPage,
      tree: nextTree,
    };
    commitCurrentPage(nextPage);
    setSelectedNodeId(newNode.id);
    addToast({
      title: "Pegado",
      description: `${newNode.type} pegado correctamente`,
      timeoutMs: 1500,
    });
    setContextMenu(null);
  }, [currentPage, clipboardNode, commitCurrentPage, addToast]);
  
  const handleDuplicateNode = useCallback((nodeId: string) => {
    if (!currentPage) return;
    
    const node = findNodeInTree(currentPage.tree, nodeId);
    if (!node) return;
    
    // Copy to clipboard first
    const clonedNode = clonePageTree({ id: "temp", type: "page", children: [node] }).children[0];
    setClipboardNode(clonedNode);
    
    // Then paste after the current node
    handlePasteNode(nodeId);
  }, [currentPage, handlePasteNode]);
  
  // Click outside to close context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenu && contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };
    
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && contextMenu) {
        setContextMenu(null);
      }
    };
    
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [contextMenu]);

  const handleUpdateNode = useCallback(
    (nodeId: string, updates: Partial<PageNode>) => {
      if (!currentPage) {
        return;
      }

      const nextTree = clonePageTree(currentPage.tree);
      const updated = updateNodeInTree(nextTree, nodeId, updates);
      if (!updated) {
        return;
      }

      const nextPage: SitePage = {
        ...currentPage,
        tree: nextTree,
      };
      commitCurrentPage(nextPage);
    },
    [commitCurrentPage, currentPage],
  );

  const updateSelectedNodeProps = useCallback(
    (patch: Record<string, unknown>) => {
      if (!selectedNode) {
        return;
      }

      handleUpdateNode(selectedNode.id, {
        props: {
          ...parseNodeProps(selectedNode),
          ...patch,
        },
      });
    },
    [handleUpdateNode, selectedNode],
  );

  const updateSelectedNodeStyle = useCallback(
    (patch: Partial<NodeStyle>) => {
      if (!selectedNode) {
        return;
      }

      handleUpdateNode(selectedNode.id, {
        style: {
          ...parseNodeStyle(selectedNode),
          ...patch,
        },
      });
    },
    [handleUpdateNode, selectedNode],
  );

  const renderNodePreview = useCallback((node: PageNode) => {
    const props = parseNodeProps(node);

    if (node.type === "hero") {
      return (
        <div className="flex flex-col gap-2" data-ui="node-preview-hero">
          <h3 className="m-0 text-bo-text" data-ui="node-preview-hero-title">{toInputValue(props.title) || "Hero Title"}</h3>
          {toInputValue(props.subtitle) ? <p className="m-0 text-muted" data-ui="node-preview-hero-subtitle">{toInputValue(props.subtitle)}</p> : null}
        </div>
      );
    }

    if (node.type === "text") {
      return (
        <div className="flex flex-col gap-2" data-ui="node-preview-text">
          <p className="m-0 text-muted" data-ui="node-preview-text-content">{toInputValue(props.content) || "Texto..."}</p>
        </div>
      );
    }

    if (node.type === "heading") {
      const level = Number(props.level) || 2;
      const headingText = toInputValue(props.text) || "Heading";
      const clampedLevel = Math.min(6, Math.max(1, level));

      return (
        <div className="flex flex-col gap-2" data-ui="node-preview-heading">
          {clampedLevel === 1 && <h1 className="m-0 text-bo-text" data-ui="node-preview-heading-h1">{headingText}</h1>}
          {clampedLevel === 2 && <h2 className="m-0 text-bo-text" data-ui="node-preview-heading-h2">{headingText}</h2>}
          {clampedLevel === 3 && <h3 className="m-0 text-bo-text" data-ui="node-preview-heading-h3">{headingText}</h3>}
          {clampedLevel === 4 && <h4 className="m-0 text-bo-text" data-ui="node-preview-heading-h4">{headingText}</h4>}
          {clampedLevel === 5 && <h5 className="m-0 text-bo-text" data-ui="node-preview-heading-h5">{headingText}</h5>}
          {clampedLevel === 6 && <h6 className="m-0 text-bo-text" data-ui="node-preview-heading-h6">{headingText}</h6>}
        </div>
      );
    }

    if (node.type === "image") {
      return (
        <div className="flex flex-col gap-2" data-ui="node-preview-image">
          <img
            data-ui="node-preview-image-tag"
            src={toInputValue(props.src) || "/placeholder.jpg"}
            alt={toInputValue(props.alt)}
            loading="lazy"
            className="w-full max-h-[280px] object-cover rounded-sm border border-border"
          />
        </div>
      );
    }

    if (node.type === "button") {
      return (
        <div className="flex flex-col gap-2" data-ui="node-preview-button">
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text text-sm font-bold transition-all hover:border-white/[0.09] hover:bg-white/[0.06] disabled:opacity-55 disabled:cursor-not-allowed" data-ui="node-preview-button-tag" type="button">
            {toInputValue(props.text) || "Button"}
          </button>
        </div>
      );
    }

    if (node.type === "spacer") {
      return (
        <div
          className="rounded-sm border border-dashed border-border bg-bo-accent/10"
          data-ui="node-preview-spacer"
          style={{ height: Number(props.height) || 40 }}
        />
      );
    }

    if (node.type === "divider") {
      return <hr className="m-0 border-0 border-t border-border" data-ui="node-preview-divider" />;
    }

    return (
      <div className="flex flex-col gap-2 min-h-[86px] items-center justify-center text-muted" data-ui="node-preview-generic">
        <Square size={20} />
        <span data-ui="node-preview-generic-label">{node.type}</span>
      </div>
    );
  }, []);

  const renderDropZone = useCallback(
    (placement: DropPlacement, key: string, options?: { forceVisible?: boolean }) => {
      const isActive = isSamePlacement(activeDropPlacement, placement);
      const placementKey = getPlacementKey(placement);
      const isAllowedPlacement = validDropPlacementKeys.has(placementKey);
      const shouldShow = isActive || (isDraggingCanvas ? isAllowedPlacement : Boolean(options?.forceVisible));

      return (
        <div
          key={key}
          className={cn(
            "min-h-[18px] border border-dashed rounded-sm flex items-center justify-center transition-colors duration-150",
            shouldShow && "min-h-6",
            isActive && "border-bo-accent/56 bg-bo-accent/14",
          )}
          data-ui="drop-zone"
          data-drop-target={placement.targetId ?? "root"}
          data-drop-position={placement.position}
          data-drop-column={placement.columnIndex ?? "none"}
          data-drop-allowed={isAllowedPlacement ? "true" : "false"}
          onDragOver={(event) => handleDropZoneDragOver(event, placement)}
          onDrop={(event) => handleDropOnPlacement(event, placement)}
        >
          <span className="text-xs text-faint opacity-0 transition-opacity duration-100" data-ui="drop-zone-label">
            {shouldShow || isActive ? "Soltar aquí" : ""}
          </span>
        </div>
      );
    },
    [activeDropPlacement, handleDropOnPlacement, handleDropZoneDragOver, isDraggingCanvas, validDropPlacementKeys],
  );

  const renderNodeCard = (node: PageNode, depth: number, pathKey: string): React.ReactNode => {
    const isSelected = selectedNodeId === node.id;
    const inlineNodeStyle = nodeStyleToInlineStyle(parseNodeStyle(node));

    return (
      <div
        key={`${pathKey}-${node.id}`}
        className={cn("relative rounded-sm border border-transparent bg-transparent transition-all duration-100 hover:border-bo-accent/30", isSelected && "border-bo-accent/58 shadow-[0_0_0_1px_rgba(185,168,255,0.28)] bg-bo-accent/8")}
        data-ui="canvas-node"
        data-node-id={node.id}
        data-node-type={node.type}
        data-node-depth={depth}
        draggable
        onDragStart={(event) => handleDragStartNode(event, node.id)}
        onDragEnd={handleDragEnd}
        onClick={() => {
          setSelectedNodeId(node.id);
          setRightPanelOpen(true);
        }}
        onContextMenu={(event) => handleContextMenu(event, node.id)}
      >
        {/* Webflow-like selection outline */}
        {isSelected && <div className="absolute inset-[-2px] border-2 border-dashed bo-accent rounded-[calc(0.25rem+2px)] pointer-events-none opacity-0 animate-pulse" data-ui="selection-outline" />}
        
        {/* 8-point resize handles */}
        {isSelected && (
          <div className="absolute inset-[-6px] pointer-events-none z-[12] opacity-100" data-ui="resize-handles">
            <div className="absolute w-2.5 h-2.5 bg-bo-surface border-2 border-bo-accent rounded-[2px] pointer-events-auto cursor-nwse-resize" data-handle="nw" title="Resize" />
            <div className="absolute w-2.5 h-2.5 bg-bo-surface border-2 border-bo-accent rounded-[2px] pointer-events-auto cursor-ns-resize top-0 left-1/2 -translate-x-1/2" data-handle="n" title="Resize" />
            <div className="absolute w-2.5 h-2.5 bg-bo-surface border-2 border-bo-accent rounded-[2px] pointer-events-auto cursor-nesw-resize" data-handle="ne" title="Resize" />
            <div className="absolute w-2.5 h-2.5 bg-bo-surface border-2 border-bo-accent rounded-[2px] pointer-events-auto cursor-ew-resize top-1/2 right-0 -translate-y-1/2" data-handle="e" title="Resize" />
            <div className="absolute w-2.5 h-2.5 bg-bo-surface border-2 border-bo-accent rounded-[2px] pointer-events-auto cursor-nwse-resize right-0 bottom-0" data-handle="se" title="Resize" />
            <div className="absolute w-2.5 h-2.5 bg-bo-surface border-2 border-bo-accent rounded-[2px] pointer-events-auto cursor-ns-resize bottom-0 left-1/2 -translate-x-1/2" data-handle="s" title="Resize" />
            <div className="absolute w-2.5 h-2.5 bg-bo-surface border-2 border-bo-accent rounded-[2px] pointer-events-auto cursor-nesw-resize bottom-0 left-0" data-handle="sw" title="Resize" />
            <div className="absolute w-2.5 h-2.5 bg-bo-surface border-2 border-bo-accent rounded-[2px] pointer-events-auto cursor-ew-resize top-1/2 left-0 -translate-y-1/2" data-handle="w" title="Resize" />
          </div>
        )}
        
        <div className="flex items-center justify-between p-1" data-ui="canvas-node-chrome">
          <div className="flex items-center gap-1" data-ui="canvas-node-header-left">
            <button
              type="button"
              className="p-1 rounded cursor-grab active:cursor-grabbing text-muted hover:text-bo-text"
              title="Arrastrar"
              aria-label={`Arrastrar ${node.type}`}
              data-ui="canvas-node-drag-handle"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              <GripVertical size={14} />
            </button>
            <span className="text-xs text-bo-text font-medium" data-ui="canvas-node-type">
              {node.type}
            </span>
            <span className="text-xs text-faint" data-ui="canvas-node-id">
              #{node.id.slice(-5)}
            </span>
          </div>
          <div className="flex items-center gap-1" data-ui="canvas-node-header-right">
            <div className="flex items-center gap-1" data-ui="canvas-node-actions">
              <button
                className="p-1.5 rounded text-muted hover:text-danger hover:bg-bo-color-danger/14"
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleDeleteNode(node.id);
                }}
                title="Eliminar"
                aria-label={`Eliminar ${node.type}`}
                data-ui="canvas-node-delete"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        </div>

        <div className="p-2" data-ui="canvas-node-body" style={inlineNodeStyle}>
          {renderNodePreview(node)}

          {hasChildrenArray(node) ? (
            <div className="flex flex-col gap-2" data-ui="canvas-node-children">
              {renderNodeCollection(node.children, { targetId: node.id, position: "inside" }, depth + 1, `${pathKey}-${node.id}-children`)}
            </div>
          ) : null}

          {hasColumnsArray(node) ? (
            <div className="grid grid-cols-2 gap-2" data-ui="canvas-node-columns">
              {node.columns.map((column, columnIndex) => (
                <div
                  key={`${node.id}-column-${columnIndex}`}
                  className="flex flex-col gap-2"
                  data-ui="canvas-node-column"
                  data-column-index={columnIndex}
                >
                  <div className="text-xs text-bo-text font-medium" data-ui="canvas-node-column-title">
                    Columna {columnIndex + 1}
                  </div>
                  {renderNodeCollection(
                    column,
                    {
                      targetId: node.id,
                      position: "inside",
                      columnIndex,
                    },
                    depth + 1,
                    `${pathKey}-${node.id}-column-${columnIndex}`,
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    );
  };

  const renderNodeCollection = (
    nodes: PageNode[],
    emptyPlacement: DropPlacement,
    depth: number,
    pathKey: string,
  ): React.ReactNode => {
    const emptyPlacementIsAllowed = !isDraggingCanvas || validDropPlacementKeys.has(getPlacementKey(emptyPlacement));

    if (nodes.length === 0) {
      if (!emptyPlacementIsAllowed) {
        return null;
      }
      return renderDropZone(emptyPlacement, `${pathKey}-empty`, { forceVisible: true });
    }

    return nodes.map((node) => (
      <React.Fragment key={node.id}>
        {renderDropZone({ targetId: node.id, position: "before", columnIndex: emptyPlacement.columnIndex }, `${pathKey}-${node.id}-before`)}
        {renderNodeCard(node, depth, pathKey)}
        {renderDropZone({ targetId: node.id, position: "after", columnIndex: emptyPlacement.columnIndex }, `${pathKey}-${node.id}-after`)}
      </React.Fragment>
    ));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-bo-muted" data-ui="site-builder-loading">
        <Loader2 className="animate-spin h-4 w-4" size={32} />
        <span data-ui="site-builder-loading-text">Cargando editor...</span>
      </div>
    );
  }

  return (
    <>
      <style data-ui="site-builder-inline-styles" dangerouslySetInnerHTML={{ __html: SITE_BUILDER_PAGE_STYLES }} />
      <div className="flex flex-col gap-4 p-4 min-h-[calc(100dvh-140px)]" data-ui="site-builder">
        <header className="flex items-center justify-between gap-3 p-3 bg-bo-surface border border-bo-border rounded-lg shadow-soft" data-ui="site-builder-toolbar">
          <div className="flex items-center gap-3" data-ui="toolbar-left">
            <span className="text-base font-semibold text-bo-text" data-ui="toolbar-title">
              {site?.name || "Site Builder"}
            </span>
            <span className="inline-flex items-center gap-2 text-sm text-bo-muted" data-ui="toolbar-page-name">
              <FileText size={14} />
              {currentPage?.name || "Sin página"}
            </span>
          </div>

          <div className="flex-1 flex justify-center" data-ui="toolbar-center">
            <div className="inline-flex items-center gap-1 p-0.5 border border-bo-border rounded bg-bo-surface-3" data-ui="viewport-toggle">
              <button
                className={cn("w-9 h-9 rounded-sm border-0 bg-transparent text-muted inline-flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-bo-surface-2 hover:text-bo-text focus:outline-none focus-visible:ring-2 focus-visible:ring-bo-accent", viewportSize === "desktop" && "bg-bo-accent/24 text-bo-text")}
                type="button"
                onClick={() => setViewportSize("desktop")}
                title="Desktop"
                aria-label="Viewport desktop"
                data-ui="viewport-btn-desktop"
              >
                <Monitor size={18} />
              </button>
              <button
                className={cn("w-9 h-9 rounded-sm border-0 bg-transparent text-muted inline-flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-bo-surface-2 hover:text-bo-text focus:outline-none focus-visible:ring-2 focus-visible:ring-bo-accent", viewportSize === "tablet" && "bg-bo-accent/24 text-bo-text")}
                type="button"
                onClick={() => setViewportSize("tablet")}
                title="Tablet"
                aria-label="Viewport tablet"
                data-ui="viewport-btn-tablet"
              >
                <Tablet size={18} />
              </button>
              <button
                className={cn("w-9 h-9 rounded-sm border-0 bg-transparent text-muted inline-flex items-center justify-center cursor-pointer transition-colors duration-150 hover:bg-bo-surface-2 hover:text-bo-text focus:outline-none focus-visible:ring-2 focus-visible:ring-bo-accent", viewportSize === "mobile" && "bg-bo-accent/24 text-bo-text")}
                type="button"
                onClick={() => setViewportSize("mobile")}
                title="Mobile"
                aria-label="Viewport mobile"
                data-ui="viewport-btn-mobile"
              >
                <Smartphone size={18} />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3" data-ui="toolbar-right">
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-transparent text-bo-text text-sm font-bold transition-all hover:bg-white/[0.04]"
              type="button"
              onClick={() => setLeftPanelOpen((prev) => !prev)}
              title={leftPanelOpen ? "Ocultar panel izquierdo" : "Mostrar panel izquierdo"}
              aria-label={leftPanelOpen ? "Ocultar panel izquierdo" : "Mostrar panel izquierdo"}
              data-ui="toolbar-toggle-left-panel"
            >
              {leftPanelOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-transparent text-bo-text text-sm font-bold transition-all hover:bg-white/[0.04]" type="button" title="Deshacer" aria-label="Deshacer" data-ui="toolbar-undo">
              <Undo size={18} />
            </button>
            <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[rgba(185,168,255,0.30)] bg-[rgba(185,168,255,0.16)] text-bo-text text-sm font-bold transition-all hover:border-[rgba(185,168,255,0.40)] hover:bg-[rgba(185,168,255,0.24)] disabled:opacity-55 disabled:cursor-not-allowed"
              type="button"
              onClick={handleSavePage}
              disabled={saving}
              data-ui="toolbar-save"
            >
              {saving ? <Loader2 className="animate-spin h-4 w-4" size={16} /> : <Save size={16} />}
              <span data-ui="toolbar-save-label">Guardar</span>
            </button>
          </div>
        </header>

        <div className="grid grid-cols-[280px_minmax(0,1fr)_320px] gap-4 flex-1 min-h-0" data-ui="site-builder-main">
          {leftPanelOpen ? (
            <aside className="flex flex-col min-h-0 bg-bo-surface border border-bo-border rounded-lg shadow-soft" data-ui="left-panel">
              <div className="grid grid-cols-3 gap-1 p-2 border-b border-bo-border" data-ui="left-panel-tabs">
                <button
                  className={cn("h-9 rounded-sm border-0 bg-transparent text-muted text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150 hover:bg-bo-surface-2 hover:text-bo-text focus:outline-none focus-visible:ring-2 focus-visible:ring-bo-accent", activeLeftTab === "components" && "bg-bo-accent/22 text-bo-text")}
                  type="button"
                  onClick={() => setActiveLeftTab("components")}
                  data-ui="left-tab-components"
                >
                  <Blocks size={16} />
                  <span data-ui="left-tab-components-label">Componentes</span>
                </button>
                <button
                  className={cn("h-9 rounded-sm border-0 bg-transparent text-muted text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150 hover:bg-bo-surface-2 hover:text-bo-text focus:outline-none focus-visible:ring-2 focus-visible:ring-bo-accent", activeLeftTab === "pages" && "bg-bo-accent/22 text-bo-text")}
                  type="button"
                  onClick={() => setActiveLeftTab("pages")}
                  data-ui="left-tab-pages"
                >
                  <FileText size={16} />
                  <span data-ui="left-tab-pages-label">Páginas</span>
                </button>
                <button
                  className={cn("h-9 rounded-sm border-0 bg-transparent text-muted text-sm font-medium inline-flex items-center justify-center gap-2 cursor-pointer transition-colors duration-150 hover:bg-bo-surface-2 hover:text-bo-text focus:outline-none focus-visible:ring-2 focus-visible:ring-bo-accent", activeLeftTab === "layers" && "bg-bo-accent/22 text-bo-text")}
                  type="button"
                  onClick={() => setActiveLeftTab("layers")}
                  data-ui="left-tab-layers"
                >
                  <Layers size={16} />
                  <span data-ui="left-tab-layers-label">Capas</span>
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-auto p-3" data-ui="left-panel-content">
                {activeLeftTab === "components" ? (
                  <div className="flex flex-col gap-2" data-ui="components-list">
                    {components.map((component) => (
                      <button
                        key={component.id}
                        className="w-full min-h-[40px] p-2 border border-bo-border rounded bg-bo-surface-2 text-bo-text flex items-center gap-2 text-left cursor-pointer hover:bg-bo-surface-3 transition-colors"
                        type="button"
                        draggable
                        onDragStart={(event) => handleDragStartComponent(event, component.type)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleAddComponent(component.type)}
                        title={component.description || component.label}
                        data-ui="component-item"
                        data-component-type={component.type}
                      >
                        <span className="text-bo-muted" data-ui="component-item-icon">
                          <Square size={16} />
                        </span>
                        <span className="text-bo-text" data-ui="component-item-label">
                          {component.label}
                        </span>
                      </button>
                    ))}
                    {components.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-bo-muted text-center gap-3" data-ui="components-empty-state">
                        <Blocks size={32} />
                        <p data-ui="components-empty-text">No hay componentes disponibles</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {activeLeftTab === "pages" ? (
                  <div className="flex flex-col gap-2" data-ui="pages-list">
                    {pages.map((page) => (
                      <button
                        key={page.id}
                        className={cn("w-full min-h-[40px] p-2 border border-border rounded-sm bg-bo-surface-2 text-bo-text flex items-center gap-2 text-left cursor-pointer transition-colors duration-150 hover:border-border-2 hover:bg-bo-surface-3", currentPage?.id === page.id && "border-bo-accent/58 shadow-[0_0_0_1px_rgba(185,168,255,0.30)]")}
                        type="button"
                        onClick={() => {
                          setCurrentPage({
                            ...page,
                            tree: ensurePageTree(page.tree),
                          });
                          setSelectedNodeId(null);
                        }}
                        data-ui="page-item"
                        data-page-id={page.id}
                      >
                        <FileText size={16} />
                        <span data-ui="page-item-name">{page.name}</span>
                        {page.is_home ? <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-semibold text-bo-accent bg-bo-accent/18" data-ui="page-item-badge">Home</span> : null}
                      </button>
                    ))}
                  </div>
                ) : null}

                {activeLeftTab === "layers" ? (
                  <div className="flex flex-col gap-2" data-ui="layers-list">
                    {layerItems.map((layer) => (
                      <div
                        key={layer.node.id}
                        className={cn("w-full min-h-[40px] p-2 border border-border rounded-sm bg-bo-surface-2 text-bo-text flex items-center gap-2 text-left cursor-pointer transition-colors duration-150 hover:border-border-2 hover:bg-bo-surface-3", selectedNodeId === layer.node.id && "border-bo-accent/58 shadow-[0_0_0_1px_rgba(185,168,255,0.30)]")}
                        onClick={() => {
                          setSelectedNodeId(layer.node.id);
                          setRightPanelOpen(true);
                        }}
                        onContextMenu={(event) => handleContextMenu(event, layer.node.id)}
                        draggable
                        onDragStart={(event) => handleDragStartNode(event, layer.node.id)}
                        onDragEnd={handleDragEnd}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedNodeId(layer.node.id);
                            setRightPanelOpen(true);
                          }
                        }}
                        data-ui="layer-item"
                        data-layer-id={layer.node.id}
                        data-layer-depth={layer.depth}
                      >
                        <span className="text-muted inline-flex items-center justify-center" data-ui="layer-item-icon">
                          <Square size={12} />
                        </span>
                        <span className="inline-flex items-center gap-2" style={{ paddingLeft: `${layer.depth * 14}px` }} data-ui="layer-item-content">
                          <span className="text-sm text-bo-text" data-ui="layer-item-name">
                            {layer.node.type}
                          </span>
                        </span>
                        <span className="ml-auto text-xs text-faint" data-ui="layer-item-branch">
                          {layer.branch}
                        </span>
                        <button
                          className="ml-auto w-[30px] h-[30px] rounded-sm border-0 bg-transparent text-muted inline-flex items-center justify-center cursor-pointer hover:text-danger hover:bg-bo-color-danger/16"
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteNode(layer.node.id);
                          }}
                          title="Eliminar"
                          aria-label={`Eliminar ${layer.node.type}`}
                          data-ui="layer-item-delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    {layerItems.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 px-4 text-bo-muted text-center gap-3" data-ui="layers-empty-state">
                        <Layers size={32} />
                        <p data-ui="layers-empty-text">Arrastra componentes al canvas para empezar</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </aside>
          ) : null}

          <main 
            className="overflow-auto p-3" 
            data-ui="canvas"
            onClick={(event) => {
              // Deselect when clicking on canvas background (not on nodes)
              if (event.target === event.currentTarget) {
                setSelectedNodeId(null);
              }
            }}
          >
            <div 
              className="mx-auto min-h-full w-full py-3 px-4 bg-bo-surface/72 border border-border rounded-md flex flex-col gap-2" 
              style={{ maxWidth: viewportWidth }} 
              data-ui="canvas-preview"
              onClick={(event) => {
                // Deselect when clicking on preview background
                if (event.target === event.currentTarget) {
                  setSelectedNodeId(null);
                }
              }}
            >
              <div 
                className={cn("w-full min-h-full p-[18px_2.8vw_34px] rounded-md border border-border/76 bg-gradient-to-b from-bo-surface/86 to-bo-surface shadow-[0_20px_55px_rgba(9,11,18,0.24)] flex flex-col gap-2", isDraggingCanvas && "border-bo-accent/58 shadow-[0_0_0_1px_rgba(185,168,255,0.26),0_20px_55px_rgba(9,11,18,0.22)]")} 
                data-ui="canvas-page-surface"
                onClick={(event) => {
                  // Deselect when clicking on page surface background
                  if (event.target === event.currentTarget) {
                    setSelectedNodeId(null);
                  }
                }}
              >
                {currentPage ? (
                  renderNodeCollection(
                    currentPage.tree.children,
                    {
                      targetId: null,
                      position: "inside",
                    },
                    0,
                    "root",
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-muted text-center gap-3" data-ui="canvas-empty-no-page">
                    <LayoutGrid size={48} />
                    <h3 data-ui="canvas-empty-no-page-title">Sin página activa</h3>
                    <p data-ui="canvas-empty-no-page-description">Selecciona una página para editar su estructura</p>
                  </div>
                )}

                {currentPage && currentPage.tree.children.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted text-center gap-3" data-ui="canvas-empty">
                    <LayoutGrid size={48} />
                    <h3 data-ui="canvas-empty-title">Canvas vacío</h3>
                    <p data-ui="canvas-empty-description">Arrastra componentes desde la izquierda para construir la página</p>
                  </div>
                ) : null}
              </div>
            </div>
          </main>

          {rightPanelOpen && selectedNode ? (
            <aside className="flex flex-col min-h-0 bg-bo-surface border border-bo-border rounded-lg shadow-soft" data-ui="right-panel">
              <div className="flex items-center justify-between gap-2 p-3 border-b border-bo-border" data-ui="right-panel-header">
                <h3 data-ui="right-panel-title">Propiedades</h3>
                <button
                  className="inline-flex h-8 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-transparent text-bo-text text-xs font-bold transition-all hover:bg-white/[0.04]"
                  type="button"
                  onClick={() => setRightPanelOpen(false)}
                  aria-label="Ocultar propiedades"
                  data-ui="right-panel-hide"
                >
                  <EyeOff size={16} />
                </button>
              </div>

              <div className="p-3 min-h-0 overflow-auto" data-ui="properties">
                <div className="flex flex-col gap-1 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-type">
                  <span className="text-xs text-bo-muted font-semibold uppercase tracking-wide" data-ui="property-label-type">
                    Tipo
                  </span>
                  <span className="inline-flex self-start px-2 py-0.5 rounded-full border border-border bg-bo-surface-3 text-bo-text text-xs" data-ui="property-value-type">
                    {selectedNode.type}
                  </span>
                </div>

                {selectedNode.type === "hero" ? (
                  <>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-hero-title">
                      <label className="text-bo-sm text-bo-muted" htmlFor="hero-title" data-ui="property-label-hero-title">
                        Título
                      </label>
                      <input
                        id="hero-title"
                        type="text"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).title)}
                        onChange={(event) => updateSelectedNodeProps({ title: event.target.value })}
                        data-ui="property-input-hero-title"
                      />
                    </div>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-hero-subtitle">
                      <label className="text-bo-sm text-bo-muted" htmlFor="hero-subtitle" data-ui="property-label-hero-subtitle">
                        Subtítulo
                      </label>
                      <textarea
                        id="hero-subtitle"
                        className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors w-full h-32 resize-y bg-bo-bg"
                        value={toInputValue(parseNodeProps(selectedNode).subtitle)}
                        onChange={(event) => updateSelectedNodeProps({ subtitle: event.target.value })}
                        data-ui="property-input-hero-subtitle"
                      />
                    </div>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-hero-button-text">
                      <label className="text-bo-sm text-bo-muted" htmlFor="hero-button-text" data-ui="property-label-hero-button-text">
                        Texto del botón
                      </label>
                      <input
                        id="hero-button-text"
                        type="text"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).buttonText)}
                        onChange={(event) => updateSelectedNodeProps({ buttonText: event.target.value })}
                        data-ui="property-input-hero-button-text"
                      />
                    </div>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-hero-button-href">
                      <label className="text-bo-sm text-bo-muted" htmlFor="hero-button-href" data-ui="property-label-hero-button-href">
                        URL del botón
                      </label>
                      <input
                        id="hero-button-href"
                        type="text"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).buttonHref)}
                        onChange={(event) => updateSelectedNodeProps({ buttonHref: event.target.value })}
                        data-ui="property-input-hero-button-href"
                      />
                    </div>
                  </>
                ) : null}

                {selectedNode.type === "text" ? (
                  <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-text-content">
                    <label className="text-bo-sm text-bo-muted" htmlFor="text-content" data-ui="property-label-text-content">
                      Contenido
                    </label>
                    <textarea
                      id="text-content"
                      className="h-10 rounded-bo-md border border-bo-border bg-white/5 text-bo-text px-3 outline-none min-w-0 transition-colors w-full h-40 resize-y bg-bo-bg"
                      value={toInputValue(parseNodeProps(selectedNode).content)}
                      onChange={(event) => updateSelectedNodeProps({ content: event.target.value })}
                      data-ui="property-input-text-content"
                    />
                  </div>
                ) : null}

                {selectedNode.type === "heading" ? (
                  <>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-heading-text">
                      <label className="text-bo-sm text-bo-muted" htmlFor="heading-text" data-ui="property-label-heading-text">
                        Texto
                      </label>
                      <input
                        id="heading-text"
                        type="text"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).text)}
                        onChange={(event) => updateSelectedNodeProps({ text: event.target.value })}
                        data-ui="property-input-heading-text"
                      />
                    </div>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-heading-level">
                      <label className="text-bo-sm text-bo-muted" htmlFor="heading-level" data-ui="property-label-heading-level">
                        Nivel
                      </label>
                      <select
                        id="heading-level"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={Number(parseNodeProps(selectedNode).level) || 2}
                        onChange={(event) => updateSelectedNodeProps({ level: Number(event.target.value) })}
                        data-ui="property-input-heading-level"
                      >
                        <option value={1} data-ui="property-input-heading-level-option-h1">H1</option>
                        <option value={2} data-ui="property-input-heading-level-option-h2">H2</option>
                        <option value={3} data-ui="property-input-heading-level-option-h3">H3</option>
                        <option value={4} data-ui="property-input-heading-level-option-h4">H4</option>
                        <option value={5} data-ui="property-input-heading-level-option-h5">H5</option>
                        <option value={6} data-ui="property-input-heading-level-option-h6">H6</option>
                      </select>
                    </div>
                  </>
                ) : null}

                {selectedNode.type === "image" ? (
                  <>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-image-src">
                      <label className="text-bo-sm text-bo-muted" htmlFor="image-src" data-ui="property-label-image-src">
                        URL de imagen
                      </label>
                      <input
                        id="image-src"
                        type="text"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).src)}
                        onChange={(event) => updateSelectedNodeProps({ src: event.target.value })}
                        data-ui="property-input-image-src"
                      />
                    </div>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-image-alt">
                      <label className="text-bo-sm text-bo-muted" htmlFor="image-alt" data-ui="property-label-image-alt">
                        Texto alternativo
                      </label>
                      <input
                        id="image-alt"
                        type="text"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).alt)}
                        onChange={(event) => updateSelectedNodeProps({ alt: event.target.value })}
                        data-ui="property-input-image-alt"
                      />
                    </div>
                  </>
                ) : null}

                {selectedNode.type === "button" ? (
                  <>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-button-text">
                      <label className="text-bo-sm text-bo-muted" htmlFor="button-text" data-ui="property-label-button-text">
                        Texto
                      </label>
                      <input
                        id="button-text"
                        type="text"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).text)}
                        onChange={(event) => updateSelectedNodeProps({ text: event.target.value })}
                        data-ui="property-input-button-text"
                      />
                    </div>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-button-href">
                      <label className="text-bo-sm text-bo-muted" htmlFor="button-href" data-ui="property-label-button-href">
                        URL
                      </label>
                      <input
                        id="button-href"
                        type="text"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).href)}
                        onChange={(event) => updateSelectedNodeProps({ href: event.target.value })}
                        data-ui="property-input-button-href"
                      />
                    </div>
                    <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-button-variant">
                      <label className="text-bo-sm text-bo-muted" htmlFor="button-variant" data-ui="property-label-button-variant">
                        Variante
                      </label>
                      <select
                        id="button-variant"
                        className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                        value={toInputValue(parseNodeProps(selectedNode).variant) || "primary"}
                        onChange={(event) => updateSelectedNodeProps({ variant: event.target.value })}
                        data-ui="property-input-button-variant"
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="outline">Outline</option>
                        <option value="ghost">Ghost</option>
                      </select>
                    </div>
                  </>
                ) : null}

                {selectedNode.type === "spacer" ? (
                  <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-spacer-height">
                    <label className="text-bo-sm text-bo-muted" htmlFor="spacer-height" data-ui="property-label-spacer-height">
                      Altura (px)
                    </label>
                    <input
                      id="spacer-height"
                      type="number"
                      className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                      value={Number(parseNodeProps(selectedNode).height) || 40}
                      onChange={(event) => updateSelectedNodeProps({ height: Number(event.target.value) || 0 })}
                      data-ui="property-input-spacer-height"
                    />
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-style-padding-top">
                  <label className="text-bo-sm text-bo-muted" htmlFor="style-padding-top" data-ui="property-label-style-padding-top">
                    Padding superior (px)
                  </label>
                  <input
                    id="style-padding-top"
                    type="number"
                    className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                    value={Number(selectedNodeStyle.paddingTop ?? 0)}
                    onChange={(event) => updateSelectedNodeStyle({ paddingTop: Number(event.target.value) || 0 })}
                    data-ui="property-input-style-padding-top"
                  />
                </div>

                <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-style-padding-bottom">
                  <label className="text-bo-sm text-bo-muted" htmlFor="style-padding-bottom" data-ui="property-label-style-padding-bottom">
                    Padding inferior (px)
                  </label>
                  <input
                    id="style-padding-bottom"
                    type="number"
                    className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                    value={Number(selectedNodeStyle.paddingBottom ?? 0)}
                    onChange={(event) => updateSelectedNodeStyle({ paddingBottom: Number(event.target.value) || 0 })}
                    data-ui="property-input-style-padding-bottom"
                  />
                </div>

                <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-style-background-color">
                  <label className="text-bo-sm text-bo-muted" htmlFor="style-background-color" data-ui="property-label-style-background-color">
                    Fondo
                  </label>
                  <input
                    id="style-background-color"
                    type="text"
                    className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                    placeholder="#ffffff o var(--token)"
                    value={toInputValue(selectedNodeStyle.backgroundColor)}
                    onChange={(event) => updateSelectedNodeStyle({ backgroundColor: event.target.value })}
                    data-ui="property-input-style-background-color"
                  />
                </div>

                <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-style-text-color">
                  <label className="text-bo-sm text-bo-muted" htmlFor="style-text-color" data-ui="property-label-style-text-color">
                    Color de texto
                  </label>
                  <input
                    id="style-text-color"
                    type="text"
                    className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                    placeholder="#111111 o var(--token)"
                    value={toInputValue(selectedNodeStyle.textColor)}
                    onChange={(event) => updateSelectedNodeStyle({ textColor: event.target.value })}
                    data-ui="property-input-style-text-color"
                  />
                </div>

                <div className="flex flex-col gap-2 p-3 bg-bo-surface-2 rounded-bo-sm" data-ui="property-group-style-max-width">
                  <label className="text-bo-sm text-bo-muted" htmlFor="style-max-width" data-ui="property-label-style-max-width">
                    Ancho máximo
                  </label>
                  <input
                    id="style-max-width"
                    type="text"
                    className="h-10 rounded-xl border border-white/[0.06] bg-white/[0.03] text-bo-text px-3 outline-none transition-colors hover:border-white/[0.09] focus:border-primary/38 focus:shadow-[0_0_0_3px_rgba(185,168,255,0.10)]"
                    placeholder="1200px, 80ch, min(100%, 960px)"
                    value={toInputValue(selectedNodeStyle.maxWidth)}
                    onChange={(event) => updateSelectedNodeStyle({ maxWidth: event.target.value })}
                    data-ui="property-input-style-max-width"
                  />
                </div>

                <div className="flex items-center" data-ui="property-actions">
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-red-500/35 bg-red-500/14 text-red-400 text-sm font-bold transition-all hover:border-red-500/50 hover:bg-red-500/20 disabled:opacity-55 disabled:cursor-not-allowed"
                    type="button"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                    data-ui="property-delete-node"
                  >
                    <Trash2 size={16} />
                    <span data-ui="property-delete-node-label">Eliminar componente</span>
                  </button>
                </div>
              </div>
            </aside>
          ) : null}

          {!rightPanelOpen ? (
            <button
              className="fixed right-4 bottom-4 w-10 h-10 rounded-full border border-border bg-bo-surface text-bo-text inline-flex items-center justify-center shadow-soft cursor-pointer"
              type="button"
              onClick={() => setRightPanelOpen(true)}
              title="Mostrar propiedades"
              aria-label="Mostrar propiedades"
              data-ui="toggle-right-panel"
            >
              <Settings size={18} />
            </button>
          ) : null}
        </div>
        
        {/* Context Menu */}
        {contextMenu ? (
          <div
            ref={contextMenuRef}
            className="fixed min-w-[180px] p-1 bg-bo-surface border border-border rounded-md shadow-soft shadow-[0_8px_32px_rgba(0,0,0,0.24)] z-[1000] animate-in fade-in zoom-in-95 slide-in-from-location-[var(--x)_var(--y)] duration-100"
            data-ui="context-menu"
            role="menu"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
            }}
          >
            <button
              className="flex items-center gap-2 w-full p-2 rounded-sm border-0 bg-transparent text-bo-text text-sm text-left cursor-pointer transition-colors duration-100 hover:bg-bo-surface-2"
              type="button"
              role="menuitem"
              onClick={() => handleDuplicateNode(contextMenu.nodeId)}
            >
              <Copy size={14} />
              <span>Duplicar</span>
              <span className="ml-auto text-xs text-muted">⌘D</span>
            </button>
            <button
              className="flex items-center gap-2 w-full p-2 rounded-sm border-0 bg-transparent text-bo-text text-sm text-left cursor-pointer transition-colors duration-100 hover:bg-bo-surface-2"
              type="button"
              role="menuitem"
              onClick={() => handleCopyNode(contextMenu.nodeId)}
            >
              <Copy size={14} />
              <span>Copiar</span>
              <span className="ml-auto text-xs text-muted">⌘C</span>
            </button>
            {clipboardNode ? (
              <button
                className="flex items-center gap-2 w-full p-2 rounded-sm border-0 bg-transparent text-bo-text text-sm text-left cursor-pointer transition-colors duration-100 hover:bg-bo-surface-2"
                type="button"
                role="menuitem"
                onClick={() => handlePasteNode(contextMenu.nodeId)}
              >
                <Copy size={14} />
                <span>Pegar después</span>
                <span className="ml-auto text-xs text-muted">⌘V</span>
              </button>
            ) : null}
            <div className="h-px bg-border my-1" />
            <button
              className="flex items-center gap-2 w-full p-2 rounded-sm border-0 bg-transparent text-red-400 text-sm text-left cursor-pointer transition-colors duration-100 hover:bg-bo-color-danger/14"
              type="button"
              role="menuitem"
              onClick={() => handleDeleteNode(contextMenu.nodeId)}
            >
              <Trash2 size={14} />
              <span>Eliminar</span>
              <span className="ml-auto text-xs text-muted">Del</span>
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
