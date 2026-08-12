import React, { useRef } from "react";
import type { LinePoint } from "../../lineDrawing";
import {
  DRAG_START_DIST,
  isDoubleTap,
  makeTapRecord,
  type LimitTapRecord,
  type LimitTapTarget,
} from "./limitAreaGestures";

interface LimitAreaOverlayProps {
  /** Limit-area points already projected into overlay (screen) coordinates. */
  points: LinePoint[];
  isEditing: boolean;
  isDrawing: boolean;
  /** Joint currently being dragged (used only for visual emphasis). */
  activeVertexIndex: number | null;
  /** Converts a pointer client position into flow coordinates. */
  screenToFlow: (client: { x: number; y: number }) => LinePoint;
  onVertexActivate: (index: number) => void;
  onVertexDragStart: (index: number) => void;
  onVertexDragMove: (index: number, flowPoint: LinePoint) => void;
  onVertexDragEnd: () => void;
  onVertexDeactivate: () => void;
  onDeleteVertex: (index: number) => void;
  onAddVertexOnSegment: (index: number) => void;
  onAddVertexOnClosingSegment: () => void;
}

/** Fat-finger hit area for line segments (invisible stroke). */
const HIT_STROKE_WIDTH = 28;

/**
 * Renders the limit-area polygon overlay and owns its pointer gestures.
 *
 * Mouse keeps native `dblclick` semantics (delete joint / add joint). Touch
 * and pen have no native `dblclick`, so drag + double-tap are handled with
 * window-level Pointer Events: move/up are observed on `window` so the gesture
 * keeps working even when the finger leaves the joint or pointer capture is
 * unavailable.
 */
export function LimitAreaOverlay({
  points,
  isEditing,
  isDrawing,
  activeVertexIndex,
  screenToFlow,
  onVertexActivate,
  onVertexDragStart,
  onVertexDragMove,
  onVertexDragEnd,
  onVertexDeactivate,
  onDeleteVertex,
  onAddVertexOnSegment,
  onAddVertexOnClosingSegment,
}: LimitAreaOverlayProps) {
  const lastTapRef = useRef<LimitTapRecord | null>(null);
  // Chromium synthesizes a native `dblclick` after a touch double-tap. Since we
  // already handle the gesture manually, suppress the native event so add/delete
  // don't fire twice (the second fire can hit the just-created vertex and undo it).
  const suppressDblClickUntilRef = useRef(0);

  const suppressNativeDblClick = () => {
    suppressDblClickUntilRef.current = Date.now() + 500;
  };

  const isDblClickSuppressed = () => Date.now() < suppressDblClickUntilRef.current;

  const handleVertexPointerDown = (index: number) => (event: React.PointerEvent<SVGCircleElement>) => {
    if (!isEditing) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    const pointerId = event.pointerId;
    const pointerType = event.pointerType;
    const startX = event.clientX;
    const startY = event.clientY;
    let moved = false;

    onVertexActivate(index);

    const handleMove = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
      if (distance < DRAG_START_DIST) return;
      if (!moved) {
        moved = true;
        onVertexDragStart(index);
      }
      onVertexDragMove(index, screenToFlow({ x: e.clientX, y: e.clientY }));
    };

    const handleUp = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);

      if (moved) {
        onVertexDragEnd();
        return;
      }

      onVertexDeactivate();

      // Mouse keeps dblclick; touch/pen need manual double-tap detection.
      if (pointerType === "mouse") return;

      const tap = makeTapRecord("vertex", index, e.clientX, e.clientY);
      if (isDoubleTap(lastTapRef.current, tap)) {
        lastTapRef.current = null;
        suppressNativeDblClick();
        onDeleteVertex(index);
      } else {
        lastTapRef.current = tap;
      }
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
  };

  const handleSegmentPointerDown =
    (target: LimitTapTarget, index: number) => (event: React.PointerEvent<SVGLineElement>) => {
      if (!isEditing) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;
      event.preventDefault();
      const pointerId = event.pointerId;
      const pointerType = event.pointerType;
      const startX = event.clientX;
      const startY = event.clientY;

      const handleUp = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        window.removeEventListener("pointerup", handleUp);
        window.removeEventListener("pointercancel", handleUp);

        const distance = Math.hypot(e.clientX - startX, e.clientY - startY);
        if (distance >= DRAG_START_DIST) return; // not a tap

        if (pointerType === "mouse") return; // dblclick handles add

        const tap = makeTapRecord(target, index, e.clientX, e.clientY);
        if (isDoubleTap(lastTapRef.current, tap)) {
          lastTapRef.current = null;
          suppressNativeDblClick();
          if (target === "closing") {
            onAddVertexOnClosingSegment();
          } else {
            onAddVertexOnSegment(index);
          }
        } else {
          lastTapRef.current = tap;
        }
      };

      window.addEventListener("pointerup", handleUp);
      window.addEventListener("pointercancel", handleUp);
    };

  return (
    <svg
      data-ui="line-draw-overlay"
      className="bo-tableMapLineDrawOverlay"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        // The overlay must not create a full-screen hit target. Only the joint
        // circles and the fat-finger segment hit lines below handle input.
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {points.map((point, idx) => {
        const prev = idx > 0 ? points[idx - 1] : null;
        return (
          <g key={idx} data-ui="line-segment-group">
            {prev && (
              <line
                data-ui="line-segment-hit"
                x1={prev.x}
                y1={prev.y}
                x2={point.x}
                y2={point.y}
                stroke="transparent"
                strokeWidth={HIT_STROKE_WIDTH}
                strokeLinecap="round"
                style={{
                  cursor: isEditing ? "copy" : "default",
                  pointerEvents: isEditing ? "all" : "none",
                  touchAction: "none",
                }}
                onPointerDown={handleSegmentPointerDown("segment", idx)}
                onDoubleClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (isDblClickSuppressed()) return;
                  onAddVertexOnSegment(idx);
                }}
              />
            )}
            {prev && (
              <line
                data-ui="line-segment"
                x1={prev.x}
                y1={prev.y}
                x2={point.x}
                y2={point.y}
                stroke="var(--bo-accent)"
                strokeWidth={isEditing ? 5 : 2}
                strokeOpacity={isEditing ? 0.5 : 1}
                strokeLinecap="round"
                strokeDasharray={isDrawing ? "5,5" : "none"}
                style={{ pointerEvents: "none" }}
              />
            )}
          </g>
        );
      })}

      {points.length >= 2 && !isDrawing && (() => {
        const first = points[0];
        const last = points[points.length - 1];
        return (
          <line
            data-ui="line-closing-hit"
            x1={last.x}
            y1={last.y}
            x2={first.x}
            y2={first.y}
            stroke="transparent"
            strokeWidth={HIT_STROKE_WIDTH}
            strokeLinecap="round"
            style={{
              cursor: isEditing ? "copy" : "default",
              pointerEvents: isEditing ? "all" : "none",
              touchAction: "none",
            }}
            onPointerDown={handleSegmentPointerDown("closing", 0)}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (isDblClickSuppressed()) return;
              onAddVertexOnClosingSegment();
            }}
          />
        );
      })()}

      {points.length >= 2 && !isDrawing && (() => {
        const first = points[0];
        const last = points[points.length - 1];
        return (
          <line
            data-ui="line-segment-closing"
            x1={last.x}
            y1={last.y}
            x2={first.x}
            y2={first.y}
            stroke="var(--bo-accent)"
            strokeWidth={isEditing ? 5 : 2}
            strokeOpacity={isEditing ? 0.5 : 1}
            strokeLinecap="round"
            style={{ pointerEvents: "none" }}
          />
        );
      })()}

      {points.map((point, idx) => {
        const isActive = activeVertexIndex === idx;
        return (
          <circle
            key={idx}
            data-ui="line-vertex"
            cx={point.x}
            cy={point.y}
            r={isEditing ? (isActive ? 18 : 14) : 6}
            fill={isEditing ? "color-mix(in srgb, var(--bo-accent) 70%, var(--bo-surface))" : "var(--bo-accent)"}
            stroke="var(--bo-surface)"
            strokeWidth={2}
            style={{
              cursor: isEditing ? "grab" : "default",
              pointerEvents: isEditing ? "all" : "none",
              touchAction: "none",
            }}
            onPointerDown={handleVertexPointerDown(idx)}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (isDblClickSuppressed()) return;
              onDeleteVertex(idx);
            }}
          />
        );
      })}

      {points.length >= 2 && !isDrawing && (
        <polygon
          data-ui="limit-area-polygon"
          points={points.map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke="var(--bo-accent)"
          strokeWidth={2}
          style={{ pointerEvents: "none" }}
        />
      )}
    </svg>
  );
}
