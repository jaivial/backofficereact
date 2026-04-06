import type React from "react";
import type { PageNode, PageTree, ComponentDefinition, NestingRules, NodeStyle } from "../../../../api/site-builder-types";
import type { DropPlacement, DragData, LayerItem, NodeLocation } from "../types/siteBuilder.types";
import { ROOT_PARENT_TYPE, WILDCARD } from "../constants";

export const DEFAULT_PAGE_TREE: PageTree = {
  id: "page_root",
  type: "page",
  children: [],
};

// Type guards
export function hasChildrenArray(node: PageNode): node is PageNode & { children: PageNode[] } {
  return Array.isArray((node as { children?: PageNode[] }).children);
}

export function hasColumnsArray(node: PageNode): node is PageNode & { columns: PageNode[][] } {
  return node.type === "columns" && Array.isArray((node as { columns?: PageNode[][] }).columns);
}

// Clone and ensure
export function clonePageTree(tree: PageTree): PageTree {
  if (typeof structuredClone === "function") {
    return structuredClone(tree);
  }
  return JSON.parse(JSON.stringify(tree)) as PageTree;
}

export function ensurePageTree(tree: PageTree | null | undefined): PageTree {
  if (!tree || tree.type !== "page" || !Array.isArray(tree.children)) {
    return clonePageTree(DEFAULT_PAGE_TREE);
  }
  return tree;
}

// Node creation
export function makeNodeId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createNodeByType(componentType: string): PageNode {
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

// Find nodes
export function findNodeInNodes(nodes: PageNode[], nodeId: string): PageNode | null {
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

export function findNodeInTree(tree: PageTree, nodeId: string): PageNode | null {
  return findNodeInNodes(tree.children, nodeId);
}

// Find node location
export function findNodeLocationInNodes(
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

export function findNodeLocation(tree: PageTree, nodeId: string) {
  return findNodeLocationInNodes(tree.children, nodeId, ROOT_PARENT_TYPE, null);
}

// Node containment
export function nodeContainsId(node: PageNode, targetId: string): boolean {
  if (node.id === targetId) {
    return true;
  }

  if (hasChildrenArray(node) && node.children.some((child: PageNode) => nodeContainsId(child, targetId))) {
    return true;
  }

  if (hasColumnsArray(node)) {
    return node.columns.some((column: PageNode[]) => column.some((columnNode: PageNode) => nodeContainsId(columnNode, targetId)));
  }

  return false;
}

export function isDescendantNode(tree: PageTree, sourceNodeId: string, targetId: string): boolean {
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

// Remove nodes
export function removeNodeFromNodes(nodes: PageNode[], nodeId: string): PageNode | null {
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

export function removeNodeFromTree(tree: PageTree, nodeId: string): PageNode | null {
  return removeNodeFromNodes(tree.children, nodeId);
}

// Insert nodes
export function insertNodeInNodes(nodes: PageNode[], nodeToInsert: PageNode, placement: DropPlacement): boolean {
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

export function insertNodeInTree(tree: PageTree, nodeToInsert: PageNode, placement: DropPlacement): boolean {
  if (placement.targetId === null) {
    tree.children.push(nodeToInsert);
    return true;
  }

  return insertNodeInNodes(tree.children, nodeToInsert, placement);
}

// Update nodes
export function updateNodeInNodes(nodes: PageNode[], nodeId: string, updates: Partial<PageNode>): boolean {
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

export function updateNodeInTree(tree: PageTree, nodeId: string, updates: Partial<PageNode>): boolean {
  return updateNodeInNodes(tree.children, nodeId, updates);
}

// Flatten nodes for layers
export function flattenNodesForLayers(nodes: PageNode[], depth = 0, branch = "root"): LayerItem[] {
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

// Nesting rules
export function allowsType(rules: string[] | undefined, type: string): boolean {
  if (!rules || rules.length === 0) {
    return true;
  }
  return rules.includes(WILDCARD) || rules.includes(type);
}

export function getNestingRules(component?: ComponentDefinition): NestingRules | null {
  return component?.nesting_rules ?? null;
}

// Placement helpers
export function isSamePlacement(a: DropPlacement | null, b: DropPlacement): boolean {
  if (!a) {
    return false;
  }

  return (
    a.targetId === b.targetId &&
    a.position === b.position &&
    (a.columnIndex ?? -1) === (b.columnIndex ?? -1)
  );
}

export function getPlacementKey(placement: DropPlacement): string {
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

export function buildPlacementCandidates(tree: PageTree): DropPlacement[] {
  const placements: DropPlacement[] = [{ targetId: null, position: "inside" }];
  collectPlacementCandidatesFromNodes(tree.children, placements);
  return placements;
}

// Layout validation
export function isRootLayoutOrderValid(nodes: PageNode[]): boolean {
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

// Node props/style parsing
export function parseNodeProps(node: PageNode): Record<string, unknown> {
  return node.props && typeof node.props === "object" ? (node.props as Record<string, unknown>) : {};
}

export function parseNodeStyle(node: PageNode): NodeStyle {
  if (node.style && typeof node.style === "object") {
    return node.style as NodeStyle;
  }
  return {};
}

export function toInputValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function toCssDimension(value: unknown): string | undefined {
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

export function nodeStyleToInlineStyle(style: NodeStyle): React.CSSProperties {
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

// Drag data helpers
export function parseDragPayload(event: React.DragEvent, existingDragData: DragData | null): DragData | null {
  const payload = event.dataTransfer.getData("application/x-site-builder-node");
  if (!payload) {
    return existingDragData;
  }

  try {
    const decoded = JSON.parse(payload) as DragData;
    return decoded;
  } catch {
    return existingDragData;
  }
}

export function createDragDataPayload(data: DragData): string {
  return JSON.stringify(data);
}
