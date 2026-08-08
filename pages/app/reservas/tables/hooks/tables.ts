import { useCallback, useRef } from "react";
import type { RectShortSide } from "../types/tables";
import {
  clampCapacity,
  defaultDraft,
  normalizeRectShortSides,
  shortSidesFromMetadata,
  shortSidesToMetadata,
} from "../helpers/tables";
import { TABLE_LIMIT_PADDING } from "../constants/tables";
import type { TableDraft, TableShape } from "../types/tables";
import type { BookingState } from "../types/tables";
type LinePoint = { x: number; y: number };
import type { XYPosition } from "reactflow";

// === Draft state helpers ===

export function useDraftCapacity() {
  return useCallback((nextCapacity: number, prev: TableDraft): TableDraft => {
    const capacity = clampCapacity(nextCapacity);
    return {
      ...prev,
      capacity,
      rectShortSides: normalizeRectShortSides(capacity, prev.rectShortSides),
    };
  }, []);
}

export function useMutateShortSide() {
  return useCallback(
    (side: RectShortSide, action: "add" | "remove", draft: TableDraft): TableDraft => {
      const normalized = normalizeRectShortSides(draft.capacity, draft.rectShortSides);
      const currentCount = Number(normalized.left) + Number(normalized.right);
      const max = Math.max(0, Math.min(2, draft.capacity - 2));

      if (action === "add") {
        if (normalized[side] || currentCount >= max) return { ...draft, rectShortSides: normalized };
        const next = { ...normalized, [side]: true };
        return { ...draft, rectShortSides: normalizeRectShortSides(draft.capacity, next) };
      }

      if (!normalized[side]) return { ...draft, rectShortSides: normalized };
      const next = { ...normalized, [side]: false };
      return { ...draft, rectShortSides: normalizeRectShortSides(draft.capacity, next) };
    },
    [],
  );
}

// === Geometry helpers ===

export function useBuildDraftState() {
  return useCallback(
    (table: { id: number; name?: string; numero_mesa?: string; capacity?: number; shape?: string; fill_color?: string; outline_color?: string; style_preset?: string; texture_image_url?: string; metadata?: Record<string, unknown> }) => {
      const capacity = clampCapacity(table.capacity || 4);
      const metadata = (table.metadata || {}) as Record<string, unknown>;
      return {
        name: table.name || "",
        numeroMesa: table.numero_mesa || "",
        capacity,
        shape: (table.shape || "round") as TableShape,
        fillColor: table.fill_color || "",
        outlineColor: table.outline_color || "",
        stylePreset: table.style_preset || "",
        textureImageUrl: table.texture_image_url || "",
        texturePreview: table.texture_image_url || "",
        rotationDeg: Number(metadata.rotation_deg || 0),
        rectShortSides: shortSidesFromMetadata(metadata.short_side_seats, capacity),
      } as TableDraft;
    },
    [],
  );
}

// === Payload helpers ===

export function useBuildTablePayload() {
  return useCallback(
    (draft: TableDraft, editingTableId: number | null, areaId: number, selectedDate: string, selectedFloor: number, tableId: number | null) => {
      const name = draft.name.trim();
      const numeroMesa = draft.numeroMesa.trim();
      const payload: Record<string, unknown> = {
        entity: "table",
        area_id: areaId,
        name,
        numero_mesa: numeroMesa,
        capacity: clampCapacity(draft.capacity),
        shape: draft.shape,
        fill_color: draft.fillColor,
        outline_color: draft.outlineColor,
        style_preset: draft.stylePreset,
        metadata: {
          rotation_deg: draft.rotationDeg,
          short_side_seats: shortSidesToMetadata(normalizeRectShortSides(draft.capacity, draft.rectShortSides)),
        },
      };
      if (draft.textureImageUrl) payload.texture_image_url = draft.textureImageUrl;
      if (editingTableId) {
        payload.id = editingTableId;
        payload.date = selectedDate;
        payload.floor_number = selectedFloor;
      }
      return payload;
    },
    [],
  );
}

// === Position constraint helpers ===

export function rotatedRectFrameFromPosition(
  position: XYPosition,
  width: number,
  height: number,
  rotationDeg: number,
  padding: number,
) {
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
}

export function positionFromRectFrame(
  frame: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): XYPosition {
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
  };
}

// === Drag debouncer ===

export function createPersistLayoutDebouncer(onFlush: (elements: unknown[], states: Record<string, BookingState>, limitPoints: LinePoint[]) => void, delay = 120) {
  const timerRef = { current: null as ReturnType<typeof setTimeout> | null };

  const queue = useCallback(
    (elements: unknown[], states: Record<string, BookingState>, limitPoints: LinePoint[]) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        onFlush(elements, states, limitPoints);
      }, delay);
    },
    [onFlush, delay],
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  return { queue, cancel };
}

// === Menu tooltip position helpers ===

export function useMenuTooltipPosition(menuVisible: boolean) {
  const tooltipStyleRef = useRef<React.CSSProperties>({});
  return tooltipStyleRef;
}
