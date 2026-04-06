import { useCallback, useRef, useEffect } from "react";

export interface TouchDragOptions {
  longPressDelay?: number;
  movementThreshold?: number;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  enabled?: boolean;
}

interface TouchStartState {
  x: number;
  y: number;
  time: number;
}

interface TouchDragHandlers {
  onTouchStart: (event: React.TouchEvent) => void;
  onTouchMove: (event: React.TouchEvent) => void;
  onTouchEnd: (event: React.TouchEvent) => void;
  isDragging: boolean;
  isLongPressing: boolean;
}

export function useTouchDrag(options: TouchDragOptions = {}): TouchDragHandlers {
  const {
    longPressDelay = 300,
    movementThreshold = 10,
    onDragStart,
    onDragEnd,
    enabled = true,
  } = options;

  const touchStartRef = useRef<TouchStartState | null>(null);
  const isLongPressingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;
      if (event.touches.length > 1) return;

      const touch = event.touches[0];
      const state: TouchStartState = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
      touchStartRef.current = state;
      isLongPressingRef.current = false;
      isDraggingRef.current = false;

      longPressTimerRef.current = setTimeout(() => {
        if (touchStartRef.current) {
          const elapsed = Date.now() - touchStartRef.current.time;
          if (elapsed >= longPressDelay) {
            isLongPressingRef.current = true;
            isDraggingRef.current = true;
            onDragStart?.();
          }
        }
      }, longPressDelay);
    },
    [enabled, longPressDelay, onDragStart]
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;
      if (!touchStartRef.current) return;

      const touch = event.touches[0];
      const dx = touch.clientX - touchStartRef.current.x;
      const dy = touch.clientY - touchStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > movementThreshold && !isLongPressingRef.current) {
        clearLongPressTimer();
        touchStartRef.current = null;
        event.preventDefault();
        return;
      }

      if (isDraggingRef.current) {
        event.preventDefault();
      }
    },
    [enabled, movementThreshold, clearLongPressTimer]
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent) => {
      clearLongPressTimer();

      if (isDraggingRef.current) {
        onDragEnd?.();
      }

      touchStartRef.current = null;
      isLongPressingRef.current = false;
      isDraggingRef.current = false;
    },
    [clearLongPressTimer, onDragEnd]
  );

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, [clearLongPressTimer]);

  return {
    onTouchStart: handleTouchStart,
    onTouchMove: handleTouchMove,
    onTouchEnd: handleTouchEnd,
    isDragging: isDraggingRef.current,
    isLongPressing: isLongPressingRef.current,
  };
}

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

export function getTouchStatus(): {
  isTouchDevice: boolean;
  hasMouse: boolean;
  hasFinePointer: boolean;
} {
  if (typeof window === "undefined") {
    return { isTouchDevice: false, hasMouse: false, hasFinePointer: false };
  }

  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  const hasMouse =
    window.matchMedia?.("(hover: hover) and (pointer: fine)").matches ?? false;

  const hasFinePointer =
    window.matchMedia?.("(pointer: fine)").matches ?? false;

  return { isTouchDevice, hasMouse, hasFinePointer };
}
