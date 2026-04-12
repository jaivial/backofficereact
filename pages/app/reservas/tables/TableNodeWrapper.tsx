import React, { useCallback, useRef } from "react";
import type { TableNodeData, DrawNodeData } from "./types/tables";

interface TouchNodeWrapperProps {
  children: React.ReactNode;
  nodeId: string;
  nodeType: "restaurantTable" | "drawElement";
  interactionMode: "select" | "pan";
  mapMode: "tables" | "draw";
  onLongPressStart?: () => void;
  onLongPressEnd?: () => void;
}

interface TouchState {
  startX: number;
  startY: number;
  startTime: number;
  isLongPressing: boolean;
}

const LONG_PRESS_DELAY = 300;
const MOVEMENT_THRESHOLD = 10;

export const TouchNodeWrapper: React.FC<TouchNodeWrapperProps> = ({
  children,
  nodeId,
  nodeType,
  interactionMode,
  mapMode,
  onLongPressStart,
  onLongPressEnd,
}) => {
  const touchStateRef = useRef<TouchState | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggable =
    nodeType === "restaurantTable"
      ? interactionMode === "select"
      : interactionMode === "select" && mapMode === "draw";

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!isDraggable) return;
      if (event.touches.length > 1) return;

      const touch = event.touches[0];
      touchStateRef.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isLongPressing: false,
      };

      longPressTimerRef.current = setTimeout(() => {
        if (touchStateRef.current) {
          const elapsed = Date.now() - touchStateRef.current.startTime;
          if (elapsed >= LONG_PRESS_DELAY) {
            touchStateRef.current.isLongPressing = true;
            onLongPressStart?.();
          }
        }
      }, LONG_PRESS_DELAY);
    },
    [isDraggable, onLongPressStart]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!touchStateRef.current) return;
      if (event.touches.length > 1) return;

      const touch = event.touches[0];
      const dx = touch.clientX - touchStateRef.current.startX;
      const dy = touch.clientY - touchStateRef.current.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > MOVEMENT_THRESHOLD && !touchStateRef.current.isLongPressing) {
        clearLongPressTimer();
        touchStateRef.current = null;
        event.preventDefault();
        return;
      }

      if (touchStateRef.current.isLongPressing) {
        event.preventDefault();
      }
    },
    [clearLongPressTimer]
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      clearLongPressTimer();

      if (touchStateRef.current?.isLongPressing) {
        onLongPressEnd?.();
      }

      touchStateRef.current = null;
    },
    [clearLongPressTimer, onLongPressEnd]
  );

  return (
    <div
      data-touch-draggable={isDraggable ? "true" : "false"}
      data-node-id={nodeId}
      data-slot="reservas-table-node"
      data-node-type={nodeType}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{ touchAction: isDraggable ? "none" : "auto" }}
    >
      {children}
    </div>
  );
};

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function getDeviceCapabilities(): {
  isTouchDevice: boolean;
  supportsPointerEvents: boolean;
  prefersTouch: boolean;
} {
  if (typeof window === "undefined") {
    return { isTouchDevice: false, supportsPointerEvents: false, prefersTouch: false };
  }

  return {
    isTouchDevice:
      "ontouchstart" in window || navigator.maxTouchPoints > 0,
    supportsPointerEvents: typeof PointerEvent !== "undefined",
    prefersTouch:
      window.matchMedia?.("(pointer: coarse)").matches ?? false,
  };
}
