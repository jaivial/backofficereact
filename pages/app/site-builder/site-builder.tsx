// Site Builder Visual Editor Page
// Main editor interface for JSON tree-based site builder with nested drag-and-drop canvas
import React from "react";
import { Settings } from "lucide-react";

import "../../../components/bo.css";

import { useSiteBuilder } from "./hooks/useSiteBuilder";
import { BlockPalette } from "./functionalComponents/BlockPalette/BlockPalette";
import { PageTree } from "./functionalComponents/PageTree/PageTree";
import { SiteSettings } from "./functionalComponents/SiteSettings/SiteSettings";
import { BlockEditor } from "./functionalComponents/BlockEditor/BlockEditor";
import { SITE_BUILDER_PAGE_STYLES } from "./helpers/siteBuilder.styles";

function SiteBuilderEditorPage() {
  const {
    // State
    site,
    pages,
    currentPage,
    components,
    loading,
    saving,
    leftPanelOpen,
    rightPanelOpen,
    viewportSize,
    selectedNodeId,
    activeLeftTab,
    activeDropPlacement,
    dragData,
    contextMenu,
    clipboardNode,
    contextMenuRef,
    // Computed
    layerItems,
    viewportWidth,
    selectedNode,
    selectedNodeStyle,
    isDraggingCanvas,
    validDropPlacementKeys,
    // Setters
    setLeftPanelOpen,
    setRightPanelOpen,
    setViewportSize,
    setSelectedNodeId,
    setActiveLeftTab,
    // Handlers
    handleDragEnd,
    handleDragStartComponent,
    handleDragStartNode,
    handleSavePage,
    handleAddComponent,
    handleDeleteNode,
    handleContextMenu,
    handleCloseContextMenu,
    handleCopyNode,
    handlePasteNode,
    handleDuplicateNode,
    updateSelectedNodeProps,
    updateSelectedNodeStyle,
    handleDropZoneDragOver,
    handleDropOnPlacement,
    handleSwitchPage,
  } = useSiteBuilder();

  if (loading) {
    return (
      <div className="bo-loadingState" data-ui="site-builder-loading">
        <svg className="bo-spinnerIcon" data-ui="site-builder-loading-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        <span data-ui="site-builder-loading-text">Cargando editor...</span>
      </div>
    );
  }

  return (
    <>
      <style data-ui="site-builder-inline-styles" dangerouslySetInnerHTML={{ __html: SITE_BUILDER_PAGE_STYLES }} />
      <div className="bo-siteBuilder" data-ui="site-builder">
        {/* Toolbar */}
        <BlockPalette
          site={site}
          currentPage={currentPage}
          viewportSize={viewportSize}
          saving={saving}
          leftPanelOpen={leftPanelOpen}
          onSetViewportSize={setViewportSize}
          onToggleLeftPanel={() => setLeftPanelOpen((prev) => !prev)}
          onSave={handleSavePage}
        />

        {/* Main layout */}
        <div className="bo-siteBuilderMain" data-ui="site-builder-main">
          {/* Left Panel: Components / Pages / Layers */}
          {leftPanelOpen ? (
            <PageTree
              components={components}
              pages={pages}
              currentPage={currentPage}
              activeLeftTab={activeLeftTab}
              layerItems={layerItems}
              selectedNodeId={selectedNodeId}
              onSetActiveLeftTab={setActiveLeftTab}
              onAddComponent={handleAddComponent}
              onDragStartComponent={handleDragStartComponent}
              onDragEnd={handleDragEnd}
              onSwitchPage={handleSwitchPage}
              onSelectLayer={(nodeId) => {
                setSelectedNodeId(nodeId);
                setRightPanelOpen(true);
              }}
              onDeleteLayerNode={handleDeleteNode}
              onDragStartNode={handleDragStartNode}
              onContextMenu={handleContextMenu}
            />
          ) : null}

          {/* Canvas: Node editing area */}
          <BlockEditor
            currentPage={currentPage}
            selectedNodeId={selectedNodeId}
            viewportWidth={viewportWidth}
            isDraggingCanvas={isDraggingCanvas}
            validDropPlacementKeys={validDropPlacementKeys}
            activeDropPlacement={activeDropPlacement}
            contextMenu={contextMenu}
            contextMenuRef={contextMenuRef}
            clipboardNode={clipboardNode}
            onSelectNode={(nodeId) => {
              if (nodeId === "") {
                // Allow deselecting
              }
              setSelectedNodeId(nodeId || null);
            }}
            onOpenRightPanel={() => setRightPanelOpen(true)}
            onDeleteNode={handleDeleteNode}
            onDragStartNode={handleDragStartNode}
            onDragEnd={handleDragEnd}
            onContextMenu={handleContextMenu}
            onDropZoneDragOver={handleDropZoneDragOver}
            onDropOnPlacement={handleDropOnPlacement}
            onDuplicateNode={handleDuplicateNode}
            onCopyNode={handleCopyNode}
            onPasteNode={handlePasteNode}
            onCloseContextMenu={handleCloseContextMenu}
          />

          {/* Right Panel: Properties */}
          {rightPanelOpen && selectedNode ? (
            <SiteSettings
              selectedNode={selectedNode}
              selectedNodeStyle={selectedNodeStyle}
              onClose={() => setRightPanelOpen(false)}
              onDeleteNode={handleDeleteNode}
              onUpdateProps={updateSelectedNodeProps}
              onUpdateStyle={updateSelectedNodeStyle}
            />
          ) : null}

          {/* Toggle right panel button */}
          {!rightPanelOpen ? (
            <button
              className="bo-siteBuilderToggleRight"
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
      </div>
    </>
  );
}

export { SiteBuilderEditorPage as SiteBuilderPage };
export default SiteBuilderEditorPage;
