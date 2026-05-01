import React, { useCallback } from "react";
import { GripVertical, LayoutGrid, Square, Trash2 } from "lucide-react";
import type { PageNode, PageTree, SitePage } from "../../../../../api/site-builder-types";
import type { DropPlacement, DragData, ContextMenuState } from "../../types/siteBuilder.types";
import { cn } from "../../../../../ui/shadcn/utils";
import {
  hasChildrenArray,
  hasColumnsArray,
  nodeStyleToInlineStyle,
  parseNodeStyle,
  toInputValue,
  isSamePlacement,
  getPlacementKey,
} from "../../helpers/siteBuilder.helpers";

export type BlockEditorProps = {
  currentPage: SitePage | null;
  selectedNodeId: string | null;
  viewportWidth: string | number;
  isDraggingCanvas: boolean;
  validDropPlacementKeys: Set<string>;
  activeDropPlacement: DropPlacement | null;
  contextMenu: ContextMenuState;
  contextMenuRef: React.RefObject<HTMLDivElement | null>;
  clipboardNode: PageNode | null;
  onSelectNode: (nodeId: string) => void;
  onOpenRightPanel: () => void;
  onDeleteNode: (nodeId: string) => void;
  onDragStartNode: (event: React.DragEvent, nodeId: string) => void;
  onDragEnd: () => void;
  onContextMenu: (event: React.MouseEvent, nodeId: string) => void;
  onDropZoneDragOver: (event: React.DragEvent, placement: DropPlacement) => void;
  onDropOnPlacement: (event: React.DragEvent, placement: DropPlacement) => void;
  onDuplicateNode: (nodeId: string) => void;
  onCopyNode: (nodeId: string) => void;
  onPasteNode: (nodeId: string) => void;
  onCloseContextMenu: () => void;
};

export function BlockEditor({
  currentPage,
  selectedNodeId,
  viewportWidth,
  isDraggingCanvas,
  validDropPlacementKeys,
  activeDropPlacement,
  contextMenu,
  contextMenuRef,
  clipboardNode,
  onSelectNode,
  onOpenRightPanel,
  onDeleteNode,
  onDragStartNode,
  onDragEnd,
  onContextMenu,
  onDropZoneDragOver,
  onDropOnPlacement,
  onDuplicateNode,
  onCopyNode,
  onPasteNode,
  onCloseContextMenu,
}: BlockEditorProps) {
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
            "bo-siteBuilderDropZone",
            shouldShow && "is-visible",
            isActive && "is-active",
          )}
          data-ui="drop-zone"
          data-drop-target={placement.targetId ?? "root"}
          data-drop-position={placement.position}
          data-drop-column={placement.columnIndex ?? "none"}
          data-drop-allowed={isAllowedPlacement ? "true" : "false"}
          onDragOver={(event) => onDropZoneDragOver(event, placement)}
          onDrop={(event) => onDropOnPlacement(event, placement)}
        >
          <span className="bo-siteBuilderDropZoneLabel" data-ui="drop-zone-label">Soltar aqui</span>
        </div>
      );
    },
    [activeDropPlacement, isDraggingCanvas, onDropOnPlacement, onDropZoneDragOver, validDropPlacementKeys],
  );

  const renderNodePreview = useCallback((node: PageNode) => {
    const props = node.props && typeof node.props === "object" ? (node.props as Record<string, unknown>) : {};

    if (node.type === "hero") {
      return (
        <div className="bo-nodePreviewHero" data-ui="node-preview-hero">
          <h3 data-ui="node-preview-hero-title">{toInputValue(props.title) || "Hero Title"}</h3>
          {toInputValue(props.subtitle) ? <p data-ui="node-preview-hero-subtitle">{toInputValue(props.subtitle)}</p> : null}
        </div>
      );
    }

    if (node.type === "text") {
      return (
        <div className="bo-nodePreviewText" data-ui="node-preview-text">
          <p data-ui="node-preview-text-content">{toInputValue(props.content) || "Texto..."}</p>
        </div>
      );
    }

    if (node.type === "heading") {
      const level = Number(props.level) || 2;
      const headingText = toInputValue(props.text) || "Heading";
      const clampedLevel = Math.min(6, Math.max(1, level));
      const HeadingTag = `h${clampedLevel}` as keyof JSX.IntrinsicElements;
      return (
        <div className="bo-nodePreviewHeading" data-ui="node-preview-heading">
          {React.createElement(HeadingTag, { "data-ui": `node-preview-heading-h${clampedLevel}` }, headingText)}
        </div>
      );
    }

    if (node.type === "image") {
      return (
        <div className="bo-nodePreviewImage" data-ui="node-preview-image">
          <img
            data-ui="node-preview-image-tag"
            src={toInputValue(props.src) || "/placeholder.jpg"}
            alt={toInputValue(props.alt)}
            loading="lazy"
          />
        </div>
      );
    }

    if (node.type === "button") {
      return (
        <div className="bo-nodePreviewButton" data-ui="node-preview-button">
          <button className="bo-btn" data-ui="node-preview-button-tag" type="button">
            {toInputValue(props.text) || "Button"}
          </button>
        </div>
      );
    }

    if (node.type === "spacer") {
      return (
        <div
          className="bo-nodePreviewSpacer"
          data-ui="node-preview-spacer"
          style={{ height: Number(props.height) || 40 }}
        />
      );
    }

    if (node.type === "divider") {
      return <hr className="bo-nodePreviewDivider" data-ui="node-preview-divider" />;
    }

    return (
      <div className="bo-nodePreviewGeneric" data-ui="node-preview-generic">
        <Square size={20}>
        <span data-ui="node-preview-generic-label">{node.type}</span>
      </div>
    );
  }, []);

  const renderNodeCard = useCallback(
    (node: PageNode, depth: number, pathKey: string): React.ReactNode => {
      const isSelected = selectedNodeId === node.id;
      const inlineNodeStyle = nodeStyleToInlineStyle(parseNodeStyle(node));

      return (
        <div
          key={`${pathKey}-${node.id}`}
          className={cn("bo-siteBuilderNode", isSelected && "is-selected")}
          data-ui="canvas-node"
          data-node-id={node.id}
          data-node-type={node.type}
          data-node-depth={depth}
          draggable
          onDragStart={(event) => onDragStartNode(event, node.id)}
          onDragEnd={onDragEnd}
          onClick={() => {
            onSelectNode(node.id);
            onOpenRightPanel();
          }}
          onContextMenu={(event) => onContextMenu(event, node.id)}
        >
          {isSelected && <div className="bo-siteBuilderSelectionOutline" data-ui="selection-outline" />}

          {isSelected && (
            <div className="bo-siteBuilderResizeHandles" data-ui="resize-handles">
              {(["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const).map((handle) => (
                <div key={handle} className="bo-siteBuilderResizeHandle" data-handle={handle} title="Resize" data-slot="blockEditor-siteBuilderResizeHandle" />
              ))}
            </div>
          )}

          <div className="bo-siteBuilderNodeChrome" data-ui="canvas-node-chrome">
            <div className="bo-siteBuilderNodeHeaderLeft" data-ui="canvas-node-header-left">
              <button
                className="bo-siteBuilderDragHandle"
                type="button"
                title="Arrastrar"
                aria-label={`Arrastrar ${node.type}`}
                data-ui="canvas-node-drag-handle"
                onPointerDown={(event) => { event.stopPropagation(); }}
              >
                <GripVertical size={14}>
              </button>
              <span className="bo-siteBuilderNodeType" data-ui="canvas-node-type">{node.type}</span>
              <span className="bo-siteBuilderNodeId" data-ui="canvas-node-id">#{node.id.slice(-5)}</span>
            </div>
            <div className="bo-siteBuilderNodeHeaderRight" data-ui="canvas-node-header-right">
              <div className="bo-siteBuilderNodeActions" data-ui="canvas-node-actions">
                <button
                  className="bo-siteBuilderNodeDelete"
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onDeleteNode(node.id);
                  }}
                  title="Eliminar"
                  aria-label={`Eliminar ${node.type}`}
                  data-ui="canvas-node-delete"
                >
                  <Trash2 size={13}>
                </button>
              </div>
            </div>
          </div>

          <div className="bo-siteBuilderNodeBody" data-ui="canvas-node-body" style={inlineNodeStyle}>
            {renderNodePreview(node)}

            {hasChildrenArray(node) ? (
              <div className="bo-siteBuilderNodeChildren" data-ui="canvas-node-children">
                {renderNodeCollection(node.children, { targetId: node.id, position: "inside" }, depth + 1, `${pathKey}-${node.id}-children`)}
              </div>
            ) : null}

            {hasColumnsArray(node) ? (
              <div className="bo-siteBuilderColumns" data-ui="canvas-node-columns">
                {node.columns.map((column: PageNode[], columnIndex: number) => (
                  <div
                    key={`${node.id}-column-${columnIndex}`}
                    className="bo-siteBuilderColumn"
                    data-ui="canvas-node-column"
                    data-column-index={columnIndex}
                  >
                    <div className="bo-siteBuilderColumnTitle" data-ui="canvas-node-column-title">
                      Columna {columnIndex + 1}
                    </div>
                    {renderNodeCollection(
                      column,
                      { targetId: node.id, position: "inside", columnIndex },
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
    },
    [selectedNodeId, onDeleteNode, onDragStartNode, onDragEnd, onSelectNode, onOpenRightPanel, onContextMenu, renderNodePreview],
  );

  const renderNodeCollection = useCallback(
    (nodes: PageNode[], emptyPlacement: DropPlacement, depth: number, pathKey: string): React.ReactNode => {
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
    },
    [isDraggingCanvas, validDropPlacementKeys, renderDropZone, renderNodeCard],
  );

  return (
    <>
      <main
        className="bo-siteBuilderCanvas"
        data-ui="canvas"
        data-testid="block-editor-canvas"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onSelectNode("");
          }
        }}
      >
        <div
          className="bo-siteBuilderPreview"
          style={{ maxWidth: viewportWidth }}
          data-ui="canvas-preview"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              onSelectNode("");
            }
          }}
        >
          <div
            className={cn("bo-siteBuilderPageSurface", isDraggingCanvas && "is-active")}
            data-ui="canvas-page-surface"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                onSelectNode("");
              }
            }}
          >
            {currentPage ? (
              renderNodeCollection(
                currentPage.tree.children,
                { targetId: null, position: "inside" },
                0,
                "root",
              )
            ) : (
              <div className="bo-siteBuilderCanvasEmpty" data-ui="canvas-empty-no-page">
                <LayoutGrid size={48}>
                <h3 data-ui="canvas-empty-no-page-title">Sin pagina activa</h3>
                <p data-ui="canvas-empty-no-page-description">Selecciona una pagina para editar su estructura</p>
              </div>
            )}

            {currentPage && currentPage.tree.children.length === 0 ? (
              <div className="bo-siteBuilderCanvasEmpty" data-ui="canvas-empty">
                <LayoutGrid size={48}>
                <h3 data-ui="canvas-empty-title">Canvas vacio</h3>
                <p data-ui="canvas-empty-description">Arrastra componentes desde la izquierda para construir la pagina</p>
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {/* Context Menu */}
      {contextMenu ? (
        <div
          ref={contextMenuRef}
          className="bo-siteBuilderContextMenu"
          data-ui="context-menu"
          role="menu"
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="bo-siteBuilderContextMenuItem"
            type="button"
            role="menuitem"
            onClick={() => onDuplicateNode(contextMenu.nodeId)}
            data-testid="block-editor-context-menu-duplicate"
          >
            <Square size={14}>
            <span data-slot="blockEditor-car">Duplicar</span>
            <span className="bo-siteBuilderContextMenuShortcut" data-slot="blockEditor-siteBuilderContextMenuShortcut">D</span>
          </button>
          <button
            className="bo-siteBuilderContextMenuItem"
            type="button"
            role="menuitem"
            onClick={() => onCopyNode(contextMenu.nodeId)}
            data-testid="block-editor-context-menu-copy"
          >
            <Square size={14}>
            <span data-slot="blockEditor-iar">Copiar</span>
            <span className="bo-siteBuilderContextMenuShortcut" data-slot="blockEditor-siteBuilderContextMenuShortcut">C</span>
          </button>
          {clipboardNode ? (
            <button
              className="bo-siteBuilderContextMenuItem"
              type="button"
              role="menuitem"
              onClick={() => onPasteNode(contextMenu.nodeId)}
              data-testid="block-editor-context-menu-paste"
            >
              <Square size={14}>
              <span data-slot="blockEditor-ues">Pegar despues</span>
              <span className="bo-siteBuilderContextMenuShortcut" data-slot="blockEditor-siteBuilderContextMenuShortcut">V</span>
            </button>
          ) : null}
          <div className="bo-siteBuilderContextMenuDivider" data-slot="blockEditor-siteBuilderContextMenuDivider" />
          <button
            className="bo-siteBuilderContextMenuItem is-danger"
            type="button"
            role="menuitem"
            onClick={() => onDeleteNode(contextMenu.nodeId)}
            data-testid="block-editor-context-menu-delete"
          >
            <Trash2 size={14}>
            <span data-slot="blockEditor-nar">Eliminar</span>
            <span className="bo-siteBuilderContextMenuShortcut" data-slot="blockEditor-siteBuilderContextMenuShortcut">Del</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
