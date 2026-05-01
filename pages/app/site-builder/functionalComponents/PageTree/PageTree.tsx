import React from "react";
import { Blocks, FileText, Layers, Square, Trash2 } from "lucide-react";
import type { ComponentDefinition, SitePage } from "../../../../../api/site-builder-types";
import type { LayerItem } from "../../types/siteBuilder.types";
import { cn } from "../../../../../ui/shadcn/utils";

export type PageTreeProps = {
  components: ComponentDefinition[];
  pages: SitePage[];
  currentPage: SitePage | null;
  activeLeftTab: "components" | "pages" | "layers";
  layerItems: LayerItem[];
  selectedNodeId: string | null;
  onSetActiveLeftTab: (tab: "components" | "pages" | "layers") => void;
  onAddComponent: (type: string) => void;
  onDragStartComponent: (event: React.DragEvent, componentType: string) => void;
  onDragEnd: () => void;
  onSwitchPage: (page: SitePage) => void;
  onSelectLayer: (nodeId: string) => void;
  onDeleteLayerNode: (nodeId: string) => void;
  onDragStartNode: (event: React.DragEvent, nodeId: string) => void;
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void;
};

export function PageTree({
  components,
  pages,
  currentPage,
  activeLeftTab,
  layerItems,
  selectedNodeId,
  onSetActiveLeftTab,
  onAddComponent,
  onDragStartComponent,
  onDragEnd,
  onSwitchPage,
  onSelectLayer,
  onDeleteLayerNode,
  onDragStartNode,
  onContextMenu,
}: PageTreeProps) {
  return (
    <aside className="bo-siteBuilderLeftPanel" data-ui="left-panel">
      <div className="bo-siteBuilderPanelTabs" data-ui="left-panel-tabs">
        <button
          className={cn("bo-siteBuilderPanelTab", activeLeftTab === "components" && "is-active")}
          type="button"
          onClick={() => onSetActiveLeftTab("components")}
          data-ui="left-tab-components"
        >
          <Blocks size={16}>
          <span data-ui="left-tab-components-label">Componentes</span>
        </button>
        <button
          className={cn("bo-siteBuilderPanelTab", activeLeftTab === "pages" && "is-active")}
          type="button"
          onClick={() => onSetActiveLeftTab("pages")}
          data-ui="left-tab-pages"
        >
          <FileText size={16}>
          <span data-ui="left-tab-pages-label">Paginas</span>
        </button>
        <button
          className={cn("bo-siteBuilderPanelTab", activeLeftTab === "layers" && "is-active")}
          type="button"
          onClick={() => onSetActiveLeftTab("layers")}
          data-ui="left-tab-layers"
        >
          <Layers size={16}>
          <span data-ui="left-tab-layers-label">Capas</span>
        </button>
      </div>

      <div className="bo-siteBuilderPanelContent" data-ui="left-panel-content">
        {activeLeftTab === "components" ? (
          <div className="bo-siteBuilderComponents" data-ui="components-list">
            {components.map((component) => (
              <button
                key={component.id}
                className="bo-siteBuilderComponentItem"
                type="button"
                draggable
                onDragStart={(event) => onDragStartComponent(event, component.type)}
                onDragEnd={onDragEnd}
                onClick={() => onAddComponent(component.type)}
                title={component.description || component.label}
                data-ui="component-item"
                data-component-type={component.type}
              >
                <span className="bo-siteBuilderComponentIcon" data-ui="component-item-icon">
                  <Square size={16}>
                </span>
                <span className="bo-siteBuilderComponentLabel" data-ui="component-item-label">
                  {component.label}
                </span>
              </button>
            ))}
            {components.length === 0 ? (
              <div className="bo-emptyState" data-ui="components-empty-state">
                <Blocks size={32}>
                <p data-ui="components-empty-text">No hay componentes disponibles</p>
              </div>
            ) : null}
          </div>
        ) : null}

        {activeLeftTab === "pages" ? (
          <div className="bo-siteBuilderPages" data-ui="pages-list">
            {pages.map((page) => (
              <button
                key={page.id}
                className={cn("bo-siteBuilderPageItem", currentPage?.id === page.id && "is-active")}
                type="button"
                onClick={() => onSwitchPage(page)}
                data-ui="page-item"
                data-page-id={page.id}
              >
                <FileText size={16}>
                <span data-ui="page-item-name">{page.name}</span>
                {page.is_home ? (
                  <span className="bo-siteBuilderPageBadge" data-ui="page-item-badge">Home</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}

        {activeLeftTab === "layers" ? (
          <div className="bo-siteBuilderLayers" data-ui="layers-list">
            {layerItems.map((layer) => (
              <div
                key={layer.node.id}
                className={cn("bo-siteBuilderLayerItem", selectedNodeId === layer.node.id && "is-selected")}
                onClick={() => onSelectLayer(layer.node.id)}
                onContextMenu={(event) => onContextMenu(event, layer.node.id)}
                draggable
                onDragStart={(event) => onDragStartNode(event, layer.node.id)}
                onDragEnd={onDragEnd}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelectLayer(layer.node.id);
                  }
                }}
                data-ui="layer-item"
                data-layer-id={layer.node.id}
                data-layer-depth={layer.depth}
              >
                <span className="bo-siteBuilderLayerIcon" data-ui="layer-item-icon">
                  <Square size={12}>
                </span>
                <span className="bo-siteBuilderLayerItemContent" style={{ paddingLeft: `${layer.depth * 14}px` }} data-ui="layer-item-content">
                  <span className="bo-siteBuilderLayerName" data-ui="layer-item-name">
                    {layer.node.type}
                  </span>
                </span>
                <span className="bo-siteBuilderLayerBranch" data-ui="layer-item-branch">
                  {layer.branch}
                </span>
                <button
                  className="bo-siteBuilderLayerDelete"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteLayerNode(layer.node.id);
                  }}
                  title="Eliminar"
                  aria-label={`Eliminar ${layer.node.type}`}
                  data-ui="layer-item-delete"
                >
                  <Trash2 size={14}>
                </button>
              </div>
            ))}
            {layerItems.length === 0 ? (
              <div className="bo-emptyState" data-ui="layers-empty-state">
                <Layers size={32}>
                <p data-ui="layers-empty-text">Arrastra componentes al canvas para empezar</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}
