import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { sitesApi, pagesApi, componentsApi } from "../../../../api/site-builder-client";
import { DEFAULT_THEME } from "../constants";
import type { ViewportSize } from "../constants";
import type {
  ComponentDefinition,
  NodeStyle,
  PageNode,
  PageTree,
  SitePage,
  Site,
} from "../../../../api/site-builder-types";
import type { DropPlacement, DragData, LayerItem, ContextMenuState } from "../types/siteBuilder.types";
import { VIEWPORT_CANVAS_WIDTH, DRAG_DATA_MIME } from "../constants";
import {
  clonePageTree,
  ensurePageTree,
  makeNodeId,
  createNodeByType,
  findNodeInTree,
  findNodeLocation,
  removeNodeFromTree,
  insertNodeInTree,
  updateNodeInTree,
  flattenNodesForLayers,
  allowsType,
  getNestingRules,
  parseNodeStyle,
  parseNodeProps,
  buildPlacementCandidates,
  getPlacementKey,
  isRootLayoutOrderValid,
  parseDragPayload,
  isDescendantNode,
} from "../helpers/siteBuilder.helpers";

export type UseSiteBuilderReturn = {
  // State
  site: Site | null;
  pages: SitePage[];
  currentPage: SitePage | null;
  components: ComponentDefinition[];
  loading: boolean;
  saving: boolean;
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  viewportSize: ViewportSize;
  selectedNodeId: string | null;
  activeLeftTab: "components" | "pages" | "layers";
  activeDropPlacement: DropPlacement | null;
  dragData: DragData | null;
  contextMenu: ContextMenuState;
  clipboardNode: PageNode | null;
  contextMenuRef: React.RefObject<HTMLDivElement | null>;

  // Computed
  componentByType: Map<string, ComponentDefinition>;
  layerItems: LayerItem[];
  viewportWidth: string | number;
  selectedNode: PageNode | null;
  selectedNodeStyle: NodeStyle;
  isDraggingCanvas: boolean;
  validDropPlacementKeys: Set<string>;

  // Setters
  setSite: React.Dispatch<React.SetStateAction<Site | null>>;
  setPages: React.Dispatch<React.SetStateAction<SitePage[]>>;
  setCurrentPage: React.Dispatch<React.SetStateAction<SitePage | null>>;
  setComponents: React.Dispatch<React.SetStateAction<ComponentDefinition[]>>;
  setLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setSaving: React.Dispatch<React.SetStateAction<boolean>>;
  setLeftPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setRightPanelOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setViewportSize: React.Dispatch<React.SetStateAction<ViewportSize>>;
  setSelectedNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setActiveLeftTab: React.Dispatch<React.SetStateAction<"components" | "pages" | "layers">>;
  setActiveDropPlacement: React.Dispatch<React.SetStateAction<DropPlacement | null>>;
  setDragData: React.Dispatch<React.SetStateAction<DragData | null>>;
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>;
  setClipboardNode: React.Dispatch<React.SetStateAction<PageNode | null>>;

  // Handlers
  handleDragEnd: () => void;
  handleDragStartComponent: (event: React.DragEvent, componentType: string) => void;
  handleDragStartNode: (event: React.DragEvent, nodeId: string) => void;
  handleSavePage: () => Promise<void>;
  handleAddComponent: (componentType: string) => void;
  handleDeleteNode: (nodeId: string) => void;
  handleContextMenu: (event: React.MouseEvent, nodeId: string) => void;
  handleCloseContextMenu: () => void;
  handleCopyNode: (nodeId: string) => void;
  handlePasteNode: (targetNodeId: string | null) => void;
  handleDuplicateNode: (nodeId: string) => void;
  handleUpdateNode: (nodeId: string, updates: Partial<PageNode>) => void;
  updateSelectedNodeProps: (patch: Record<string, unknown>) => void;
  updateSelectedNodeStyle: (patch: Partial<NodeStyle>) => void;
  handleDropZoneDragOver: (event: React.DragEvent, placement: DropPlacement) => void;
  handleDropOnPlacement: (event: React.DragEvent, placement: DropPlacement) => void;
  handleSwitchPage: (page: SitePage) => void;
};

export function useSiteBuilder(): UseSiteBuilderReturn {
  const { addToast } = useToasts();
  const { handleError } = useErrorToast();

  // State
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
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [clipboardNode, setClipboardNode] = useState<PageNode | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);

  // Computed
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

  // Context menu click outside
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

  // Nesting/drop logic helpers
  const canNodeTypeBeChild = useCallback(
    (childType: string, parentType: string | "page") => {
      const childRules = getNestingRules(componentByType.get(childType));
      const parentRules = parentType === "page" ? null : getNestingRules(componentByType.get(parentType));

      const parentAllowsChild = parentType === "page"
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
        return "page";
      }

      const targetLocation = findNodeLocation(tree, placement.targetId);
      if (!targetLocation) {
        return null;
      }

      if (placement.position === "inside") {
        if (Array.isArray((targetLocation.node as unknown as Record<string, unknown>).children)) {
          return targetLocation.node.type;
        }

        if (targetLocation.node.type === "columns") {
          const destinationColumn = placement.columnIndex ?? 0;
          return (targetLocation.node as unknown as Record<string, unknown>).columns && Array.isArray((targetLocation.node as unknown as Record<string, unknown>).columns) ? targetLocation.node.type : null;
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

      if ((nodeType === "header" || nodeType === "footer") && parentType !== "page") {
        return false;
      }

      const needsRootOrderValidation =
        parentType === "page" ||
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
      .filter((placement) => {
        if (!currentPage) return false;
        if (dragData.kind === "existing-node" && placement.targetId === dragData.sourceNodeId) return false;
        if (dragData.kind === "existing-node" && placement.targetId) {
          if (isDescendantNode(currentPage.tree, dragData.sourceNodeId, placement.targetId)) return false;
        }
        const nodeType = dragData.kind === "existing-node"
          ? findNodeInTree(currentPage.tree, dragData.sourceNodeId)?.type
          : dragData.componentType;
        if (!nodeType) return false;
        const parentType = getPlacementParentType(currentPage.tree, placement);
        if (!parentType) return false;
        if (!canNodeTypeBeChild(nodeType, parentType)) return false;
        if ((nodeType === "header" || nodeType === "footer") && parentType !== "page") return false;
        return true;
      })
      .map((placement) => getPlacementKey(placement));

    return new Set<string>(validKeys);
  }, [canNodeTypeBeChild, currentPage, dragData, getPlacementParentType]);

  // Drag handlers
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

  // Save
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

  // Add component
  const handleAddComponent = useCallback(
    (componentType: string) => {
      if (!currentPage) {
        return;
      }

      const nextTree = clonePageTree(currentPage.tree);
      const newNode = createNodeByType(componentType);

      if (componentType === "header" || componentType === "footer") {
        const alreadyExists = nextTree.children.some((node: PageNode) => node.type === componentType);
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
        const footerIndex = nextTree.children.findIndex((node: PageNode) => node.type === "footer");
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

  // Delete node
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

      if (contextMenu?.nodeId === nodeId) {
        setContextMenu(null);
      }
    },
    [addToast, commitCurrentPage, currentPage, selectedNodeId, contextMenu],
  );

  // Context menu
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

    const newNode = clonePageTree({ id: "temp", type: "page", children: [clipboardNode] }).children[0];
    newNode.id = makeNodeId();

    if (targetNodeId === null) {
      const footerIndex = nextTree.children.findIndex((n: PageNode) => n.type === "footer");
      if (footerIndex >= 0) {
        nextTree.children.splice(footerIndex, 0, newNode);
      } else {
        nextTree.children.push(newNode);
      }
    } else {
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

    const clonedNode = clonePageTree({ id: "temp", type: "page", children: [node] }).children[0];
    setClipboardNode(clonedNode);

    handlePasteNode(nodeId);
  }, [currentPage, handlePasteNode]);

  // Update node
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

  // Drop handlers
  const handleDropZoneDragOver = useCallback(
    (event: React.DragEvent, placement: DropPlacement) => {
      const incomingDragData = parseDragPayload(event, dragData);
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
    [canDropAtPlacement, dragData],
  );

  const handleDropOnPlacement = useCallback(
    (event: React.DragEvent, placement: DropPlacement) => {
      event.preventDefault();

      if (!currentPage) {
        return;
      }

      const incomingDragData = parseDragPayload(event, dragData);
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
    [addToast, canDropAtPlacement, commitCurrentPage, currentPage, dragData],
  );

  // Switch page
  const handleSwitchPage = useCallback((page: SitePage) => {
    setCurrentPage({
      ...page,
      tree: ensurePageTree(page.tree),
    });
    setSelectedNodeId(null);
  }, []);

  return {
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
    componentByType,
    layerItems,
    viewportWidth,
    selectedNode,
    selectedNodeStyle,
    isDraggingCanvas,
    validDropPlacementKeys,
    // Setters
    setSite,
    setPages,
    setCurrentPage,
    setComponents,
    setLoading,
    setSaving,
    setLeftPanelOpen,
    setRightPanelOpen,
    setViewportSize,
    setSelectedNodeId,
    setActiveLeftTab,
    setActiveDropPlacement,
    setDragData,
    setContextMenu,
    setClipboardNode,
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
    handleUpdateNode,
    updateSelectedNodeProps,
    updateSelectedNodeStyle,
    handleDropZoneDragOver,
    handleDropOnPlacement,
    handleSwitchPage,
  };
}
