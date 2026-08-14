import React, { useCallback, useEffect, useRef } from "react";
import { NodeResizer } from "reactflow";

/**
 * NodeResizer wrapper with STABLE resize callbacks.
 *
 * Why: node-resizer binds d3-drag whose TOUCH move/end listeners live on the
 * handle element itself. The ResizeControl effect re-runs whenever any prop
 * in its dependency array changes identity — including the `onResize*`
 * callbacks. Every resize step triggers node dimension changes -> React
 * re-render. With inline arrow callbacks (new identity per render) the effect
 * re-binds d3-drag mid-gesture, orphaning the in-flight touch gesture state
 * (kept in the old handler's closure). Result on touch devices: the node
 * resizes a few pixels and then the gesture dies. Mouse gestures survive
 * because their move/end listeners live on `window`, untouched by the handle
 * re-bind — hence desktop worked while mobile was broken.
 *
 * Fix: keep the latest callbacks in refs and pass NodeResizer a single
 * `useCallback([])`-stable wrapper so its effect never re-runs mid-gesture.
 */

export interface StableNodeResizerProps {
  isVisible: boolean;
  minWidth: number;
  minHeight: number;
  /** Fired on every resize step (live visual size, no persistence). */
  onResize?: (width: number, height: number) => void;
  /** Fired once when the gesture ends, with rounded pixel sizes. */
  onResizeEnd?: (width: number, height: number) => void;
}

interface ResizeParams {
  width?: number | string;
  height?: number | string;
}

export function StableNodeResizer({
  isVisible,
  minWidth,
  minHeight,
  onResize,
  onResizeEnd,
}: StableNodeResizerProps) {
  const onResizeRef = useRef(onResize);
  const onResizeEndRef = useRef(onResizeEnd);
  useEffect(() => {
    onResizeRef.current = onResize;
  }, [onResize]);
  useEffect(() => {
    onResizeEndRef.current = onResizeEnd;
  }, [onResizeEnd]);

  const handleResize = useCallback((_event: unknown, params?: ResizeParams) => {
    const width = Number(params?.width);
    const height = Number(params?.height);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      onResizeRef.current?.(Math.round(width), Math.round(height));
    }
  }, []);

  const handleResizeEnd = useCallback((_event: unknown, params?: ResizeParams) => {
    const width = Number(params?.width);
    const height = Number(params?.height);
    if (Number.isFinite(width) && Number.isFinite(height)) {
      onResizeEndRef.current?.(Math.round(width), Math.round(height));
    }
  }, []);

  return (
    <NodeResizer
      isVisible={isVisible}
      minWidth={minWidth}
      minHeight={minHeight}
      lineStyle={{ borderColor: "var(--bo-accent)" }}
      handleStyle={{ width: 10, height: 10, border: "1px solid var(--bo-accent)", background: "var(--bo-surface)" }}
      onResize={handleResize}
      onResizeEnd={handleResizeEnd}
    />
  );
}

export default StableNodeResizer;
