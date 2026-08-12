export const DOUBLE_TAP_MAX_MS = 500;
export const DOUBLE_TAP_MAX_DIST = 12;
export const DRAG_START_DIST = 6;

export type LimitTapTarget = "vertex" | "segment" | "closing";

export interface LimitTapRecord {
  target: LimitTapTarget;
  index: number;
  x: number;
  y: number;
  time: number;
}

export function makeTapRecord(
  target: LimitTapTarget,
  index: number,
  x: number,
  y: number,
  time: number = Date.now(),
): LimitTapRecord {
  return { target, index, x, y, time };
}

/**
 * A double-tap is two taps on the same target within 300ms and 12px.
 * Native `dblclick` does not fire on touch, so this drives add/delete
 * joint gestures on touch/pen pointers.
 */
export function isDoubleTap(prev: LimitTapRecord | null, next: LimitTapRecord): boolean {
  if (!prev) return false;
  return (
    prev.target === next.target &&
    prev.index === next.index &&
    next.time - prev.time <= DOUBLE_TAP_MAX_MS &&
    Math.hypot(next.x - prev.x, next.y - prev.y) <= DOUBLE_TAP_MAX_DIST
  );
}
