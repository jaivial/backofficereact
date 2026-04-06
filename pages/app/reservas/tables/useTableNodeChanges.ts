import { useCallback, useRef } from "react";
import type { Node, NodeChange, XYPosition } from "reactflow";
import { applyNodeChanges } from "reactflow";
import type { TableNodeData, DrawNodeData, DrawElement, LinePoint, BookingState } from "./+Page";
import { previewGeometry } from "./+Page";

const TABLE_LIMIT_PADDING = 40;

interface UseTableNodeChangesOptions {
  mapMode: "tables" | "draw";
  activeDrawElements: DrawElement[];
  activeLimitPoints: LinePoint[] | null;
  savePosition: (id: string, x: number, y: number) => void;
  queuePersistLayout: (
    elements: DrawElement[],
    states: Record<string, BookingState>,
    limitPoints: LinePoint[]
  ) => void;
  setNodes: (nodes: Node[] | ((prev: Node[]) => Node[])) => void;
}

interface PositionTracker {
  lastPosition: Map<string, XYPosition>;
  pendingSaves: Map<string, { x: number; y: number }>;
}

export function useTableNodeChanges(options: UseTableNodeChangesOptions) {
  const { mapMode, activeDrawElements, activeLimitPoints, savePosition, queuePersistLayout, setNodes } = options;

  const positionTrackerRef = useRef<PositionTracker>({
    lastPosition: new Map(),
    pendingSaves: new Map(),
  });

  const clampRectMoveToLimit = useCallback(
    (
      from: XYPosition,
      to: XYPosition,
      size: { width: number; height: number },
      polygon: LinePoint[]
    ): XYPosition => {
      const toRectInside = isRectInsideLimitArea(
        { x: to.x, y: to.y, width: size.width, height: size.height },
        polygon
      );
      if (toRectInside) return to;

      const fromRectInside = isRectInsideLimitArea(
        { x: from.x, y: from.y, width: size.width, height: size.height },
        polygon
      );
      if (!fromRectInside) {
        return (
          findNearestRectInsideLimitArea(to, size, polygon) ||
          findNearestRectInsideLimitArea(from, size, polygon) ||
          from
        );
      }

      let low = 0;
      let high = 1;
      for (let i = 0; i < 14; i++) {
        const mid = (low + high) / 2;
        const point = {
          x: from.x + (to.x - from.x) * mid,
          y: from.y + (to.y - from.y) * mid,
        };
        const inside = isRectInsideLimitArea(
          { x: point.x, y: point.y, width: size.width, height: size.height },
          polygon
        );
        if (inside) {
          low = mid;
        } else {
          high = mid;
        }
      }
      const candidate = {
        x: from.x + (to.x - from.x) * low,
        y: from.y + (to.y - from.y) * low,
      };
      if (isRectInsideLimitArea({ x: candidate.x, y: candidate.y, width: size.width, height: size.height }, polygon)) {
        return candidate;
      }
      return (
        findNearestRectInsideLimitArea(candidate, size, polygon) ||
        findNearestRectInsideLimitArea(from, size, polygon) ||
        from
      );
    },
    []
  );

  const rotatedRectFrameFromPosition = useCallback(
    (
      position: XYPosition,
      width: number,
      height: number,
      rotationDeg: number,
      padding: number
    ) => {
      const paddedWidth = width + padding * 2;
      const paddedHeight = height + padding * 2;
      const rad = (rotationDeg * Math.PI) / 180;
      const absCos = Math.abs(Math.cos(rad));
      const absSin = Math.abs(Math.sin(rad));
      const bboxWidth = paddedWidth * absCos + paddedHeight * absSin;
      const bboxHeight = paddedWidth * absSin + paddedHeight * absCos;

      const centerX = position.x + width / 2;
      const centerY = position.y + height / 2;

      return {
        x: centerX - bboxWidth / 2,
        y: centerY - bboxHeight / 2,
        width: bboxWidth,
        height: bboxHeight,
      };
    },
    []
  );

  const positionFromRectFrame = useCallback(
    (frame: { x: number; y: number; width: number; height: number }, width: number, height: number): XYPosition => {
      const centerX = frame.x + frame.width / 2;
      const centerY = frame.y + frame.height / 2;
      return {
        x: centerX - width / 2,
        y: centerY - height / 2,
      };
    },
    []
  );

  const isRectInsideLimitArea = useCallback(
    (
      rect: { x: number; y: number; width: number; height: number },
      polygon: LinePoint[]
    ): boolean => {
      if (polygon.length < 3) return true;

      const corners = [
        { x: rect.x, y: rect.y },
        { x: rect.x + rect.width, y: rect.y },
        { x: rect.x + rect.width, y: rect.y + rect.height },
        { x: rect.x, y: rect.y + rect.height },
      ];

      for (const corner of corners) {
        if (!isPointInPolygon(corner, polygon)) {
          return false;
        }
      }
      return true;
    },
    []
  );

  const isPointInPolygon = useCallback((point: XYPosition, polygon: LinePoint[]): boolean => {
    let inside = false;
    const n = polygon.length;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = polygon[i].x;
      const yi = polygon[i].y;
      const xj = polygon[j].x;
      const yj = polygon[j].y;

      const intersect = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }, []);

  const findNearestRectInsideLimitArea = useCallback(
    (pos: XYPosition, size: { width: number; height: number }, polygon: LinePoint[]): XYPosition | null => {
      if (!isRectInsideLimitArea({ x: pos.x, y: pos.y, width: size.width, height: size.height }, polygon)) {
        return null;
      }
      return pos;
    },
    [isRectInsideLimitArea]
  );

  const elementIntersectsRect = useCallback(
    (el: DrawElement, left: number, top: number, width: number, height: number): boolean => {
      const elLeft = el.x;
      const elTop = el.y;
      const elRight = elLeft + el.width;
      const elBottom = elTop + el.height;
      const right = left + width;
      const bottom = top + height;
      return left < elRight && right > elLeft && top < elBottom && bottom > elTop;
    },
    []
  );

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const tracker = positionTrackerRef.current;
      const activeElements = activeDrawElements;
      const activeLimits = activeLimitPoints;

      const immediateSaves: Array<{ id: string; x: number; y: number }> = [];
      let drawElementsChanged = false;

      for (const c of changes) {
        if (c.type === "position" && c.position) {
          if (c.dragging === false) {
            immediateSaves.push({
              id: c.id,
              x: Math.round(c.position.x),
              y: Math.round(c.position.y),
            });
          }
          tracker.lastPosition.set(c.id, c.position);
        }
      }

      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds) as Node<any>[];

        for (const c of changes) {
          if (c.type !== "position" || !c.position) continue;

          const prevNode = nds.find((n) => n.id === c.id);
          const node = next.find((n) => n.id === c.id);
          if (!node || !prevNode || !node.position) continue;

          if (node.type === "restaurantTable") {
            const data = node.data as TableNodeData;
            const geom = previewGeometry(data.shape, data.capacity, data.rectShortSides);
            const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
            const fromFrame = rotatedRectFrameFromPosition(
              prevNode.position,
              geom.width,
              geom.height,
              rotationDeg,
              TABLE_LIMIT_PADDING
            );
            const toFrame = rotatedRectFrameFromPosition(
              node.position,
              geom.width,
              geom.height,
              rotationDeg,
              TABLE_LIMIT_PADDING
            );

            const constrainedFramePosition = activeLimits
              ? clampRectMoveToLimit(
                  { x: fromFrame.x, y: fromFrame.y },
                  { x: toFrame.x, y: toFrame.y },
                  { width: toFrame.width, height: toFrame.height },
                  activeLimits
                )
              : { x: fromFrame.x, y: fromFrame.y };

            const constrainedPosition = activeLimits
              ? positionFromRectFrame(
                  {
                    x: constrainedFramePosition.x,
                    y: constrainedFramePosition.y,
                    width: toFrame.width,
                    height: toFrame.height,
                  },
                  geom.width,
                  geom.height
                )
              : prevNode.position;

            const blockedByObstacle = activeElements.some((el) =>
              elementIntersectsRect(el, constrainedPosition.x, constrainedPosition.y, geom.width, geom.height)
            );

            if (blockedByObstacle) {
              node.position = prevNode.position;
            } else {
              node.position = constrainedPosition;
            }

            if (c.dragging === false) {
              const saveIndex = immediateSaves.findIndex((s) => s.id === c.id);
              if (saveIndex !== -1) {
                immediateSaves[saveIndex] = {
                  id: c.id,
                  x: Math.round(node.position.x),
                  y: Math.round(node.position.y),
                };
              }
            }
          }

          if (node.type === "drawElement" && mapMode === "draw") {
            if (activeLimits) {
              const data = node.data as DrawNodeData;
              const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
              const frame = rotatedRectFrameFromPosition(node.position, data.width, data.height, rotationDeg, 0);
              if (!isRectInsideLimitArea(frame, activeLimits)) {
                const nearestFrame = findNearestRectInsideLimitArea(
                  { x: frame.x, y: frame.y },
                  { width: frame.width, height: frame.height },
                  activeLimits
                );
                node.position = nearestFrame
                  ? positionFromRectFrame({ ...nearestFrame, width: frame.width, height: frame.height }, data.width, data.height)
                  : prevNode.position;
              }
            }
          }
        }

        return next;
      });

      for (const save of immediateSaves) {
        if (/^\d+$/.test(save.id) && !save.id.startsWith("draw-")) {
          savePosition(save.id, save.x, save.y);
        }
      }

      for (const c of changes) {
        if (c.type === "position" && c.dragging !== true && String(c.id).startsWith("draw-")) {
          drawElementsChanged = true;
        }
        if (c.type === "dimensions" && String(c.id).startsWith("draw-")) {
          drawElementsChanged = true;
        }
      }

      if (drawElementsChanged && mapMode === "draw") {
        queuePersistLayout(activeElements, {}, activeLimits || []);
      }
    },
    [
      mapMode,
      activeDrawElements,
      activeLimitPoints,
      savePosition,
      queuePersistLayout,
      setNodes,
      clampRectMoveToLimit,
      rotatedRectFrameFromPosition,
      positionFromRectFrame,
      elementIntersectsRect,
      isRectInsideLimitArea,
      findNearestRectInsideLimitArea,
    ]
  );

  const flushPendingSaves = useCallback(() => {
    const tracker = positionTrackerRef.current;
    tracker.pendingSaves.forEach((pos, id) => {
      if (/^\d+$/.test(id) && !id.startsWith("draw-")) {
        savePosition(id, pos.x, pos.y);
      }
    });
    tracker.pendingSaves.clear();
  }, [savePosition]);

  return {
    onNodesChange,
    flushPendingSaves,
    getLastPosition: (nodeId: string) => positionTrackerRef.current.lastPosition.get(nodeId),
  };
}
