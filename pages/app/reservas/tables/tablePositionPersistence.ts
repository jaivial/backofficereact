import type { XYPosition } from "reactflow";
import type { DrawElement, BookingState } from "./types/tables";
import type { LinePoint } from "./lineDrawing";

export interface PositionSavePayload {
  id: number;
  x_pos: number;
  y_pos: number;
  date: string;
  floor_number: number;
}

export interface LayoutPersistPayload {
  elements: Array<DrawElement & { display_mode: DrawElement["displayMode"] }>;
  booking_states: Record<string, BookingState>;
  limit_points: LinePoint[];
}

export interface PositionConstraints {
  tableSize: { width: number; height: number };
  limitPoints: LinePoint[];
  padding?: number;
}

export function roundPosition(pos: XYPosition): XYPosition {
  return {
    x: Math.round(pos.x),
    y: Math.round(pos.y),
  };
}

export function buildPositionSavePayload(
  tableId: number,
  position: XYPosition,
  date: string,
  floorNumber: number
): PositionSavePayload {
  const rounded = roundPosition(position);
  return {
    id: tableId,
    x_pos: rounded.x,
    y_pos: rounded.y,
    date,
    floor_number: floorNumber,
  };
}

export function clampPositionToLimitArea(
  position: XYPosition,
  constraints: PositionConstraints
): XYPosition | null {
  const { tableSize, limitPoints, padding = 0 } = constraints;

  if (limitPoints.length < 3) {
    return position;
  }

  const minX = Math.min(...limitPoints.map((p) => p.x)) + padding;
  const maxX = Math.max(...limitPoints.map((p) => p.x)) - padding;
  const minY = Math.min(...limitPoints.map((p) => p.y)) + padding;
  const maxY = Math.max(...limitPoints.map((p) => p.y)) - padding;

  const maxTableX = maxX - tableSize.width;
  const maxTableY = maxY - tableSize.height;

  if (tableSize.width > maxX - minX || tableSize.height > maxY - minY) {
    return null;
  }

  return {
    x: Math.max(minX, Math.min(position.x, maxTableX)),
    y: Math.max(minY, Math.min(position.y, maxTableY)),
  };
}

export function serializeLayoutForPersist(
  elements: DrawElement[],
  bookingStates: Record<string, BookingState>,
  limitPoints: LinePoint[]
): LayoutPersistPayload {
  return {
    elements: elements.map((el) => ({
      ...el,
      display_mode: el.displayMode,
    })),
    booking_states: bookingStates,
    limit_points: limitPoints,
  };
}

export function createPersistDebouncer(
  onFlush: (payload: LayoutPersistPayload) => void,
  delay = 120
): {
  queue: (payload: LayoutPersistPayload) => void;
  flush: () => void;
  cancel: () => void;
} {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let lastPayload: LayoutPersistPayload | null = null;

  return {
    queue(payload: LayoutPersistPayload) {
      lastPayload = payload;
      if (timerId) {
        clearTimeout(timerId);
      }
      timerId = setTimeout(() => {
        timerId = null;
        if (lastPayload) {
          onFlush(lastPayload);
          lastPayload = null;
        }
      }, delay);
    },
    flush() {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      if (lastPayload) {
        onFlush(lastPayload);
        lastPayload = null;
      }
    },
    cancel() {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      lastPayload = null;
    },
  };
}

export function positionChanged(
  currentPos: XYPosition,
  newPos: XYPosition,
  threshold = 0.5
): boolean {
  const dx = Math.abs(currentPos.x - newPos.x);
  const dy = Math.abs(currentPos.y - newPos.y);
  return dx > threshold || dy > threshold;
}

export function isTableNode(nodeId: string): boolean {
  return /^\d+$/.test(nodeId) && !nodeId.startsWith("draw-");
}

export function isDrawElementNode(nodeId: string): boolean {
  return nodeId.startsWith("draw-");
}
