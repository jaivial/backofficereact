import type { PageNode, PageTree, SitePage, Site, ComponentDefinition, NestingRules, NodeStyle } from "../../../../api/site-builder-types";

export type { PageNode, PageTree, SitePage, Site, ComponentDefinition, NestingRules, NodeStyle };

export type DropPlacement = {
  targetId: string | null;
  position: "before" | "after" | "inside";
  columnIndex?: number;
};

export type DragData =
  | {
      kind: "existing-node";
      sourceNodeId: string;
    }
  | {
      kind: "new-component";
      componentType: string;
    };

export type NodeLocation = {
  node: PageNode;
  parentType: string | "page";
  parentId: string | null;
  parentColumnIndex?: number;
  index: number;
};

export type LayerItem = {
  node: PageNode;
  depth: number;
  branch: string;
};

export type ContextMenuState = {
  nodeId: string;
  x: number;
  y: number;
} | null;

export type SiteBuilderState = {
  site: Site | null;
  pages: SitePage[];
  currentPage: SitePage | null;
  components: ComponentDefinition[];
  loading: boolean;
  saving: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  viewportSize: "desktop" | "tablet" | "mobile";
  selectedNodeId: string | null;
  activeLeftTab: "components" | "pages" | "layers";
  activeDropPlacement: DropPlacement | null;
  dragData: DragData | null;
  contextMenu: ContextMenuState;
  clipboardNode: PageNode | null;
};

export type SiteBuilderComputed = {
  componentByType: Map<string, ComponentDefinition>;
  layerItems: LayerItem[];
  viewportWidth: string | number;
  selectedNode: PageNode | null;
  selectedNodeStyle: NodeStyle;
  isDraggingCanvas: boolean;
  validDropPlacementKeys: Set<string>;
};
