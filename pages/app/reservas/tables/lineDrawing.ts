export type LinePoint = {
  x: number;
  y: number;
};

export type FlowViewportTransform = {
  x: number;
  y: number;
  zoom: number;
};

export function projectFlowPointToOverlay(point: LinePoint, viewport: FlowViewportTransform): LinePoint {
  return {
    x: point.x * viewport.zoom + viewport.x,
    y: point.y * viewport.zoom + viewport.y,
  };
}
