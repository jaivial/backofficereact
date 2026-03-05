import type { XYPosition } from "reactflow";

import type { LinePoint } from "./lineDrawing";

export type RectSize = {
  width: number;
  height: number;
};

export type RectPosition = XYPosition & RectSize;

function isFinitePoint(value: unknown): value is LinePoint {
  return (
    Boolean(value) &&
    typeof (value as any).x === "number" &&
    Number.isFinite((value as any).x) &&
    typeof (value as any).y === "number" &&
    Number.isFinite((value as any).y)
  );
}

export function normalizeLimitPoints(raw: unknown): LinePoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(isFinitePoint).map((point) => ({ x: Number(point.x), y: Number(point.y) }));
}

export function hasClosedLimitArea(points: LinePoint[]): boolean {
  return Array.isArray(points) && points.length >= 3;
}

function isPointOnSegment(point: LinePoint, a: LinePoint, b: LinePoint): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > 1e-6) return false;

  const dot = (point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y);
  if (dot < 0) return false;

  const lenSq = (b.x - a.x) * (b.x - a.x) + (b.y - a.y) * (b.y - a.y);
  return dot <= lenSq;
}

function orientation(a: LinePoint, b: LinePoint, c: LinePoint): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function segmentsProperlyIntersect(a1: LinePoint, a2: LinePoint, b1: LinePoint, b2: LinePoint): boolean {
  const eps = 1e-6;
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);

  const proper =
    ((o1 > eps && o2 < -eps) || (o1 < -eps && o2 > eps)) &&
    ((o3 > eps && o4 < -eps) || (o3 < -eps && o4 > eps));
  if (proper) return true;

  // Treat endpoint/collinear touches as non-crossing so borders are allowed.
  return false;
}

export function isPointInsideLimitArea(point: LinePoint, polygon: LinePoint[]): boolean {
  if (!hasClosedLimitArea(polygon)) return false;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const pi = polygon[i];
    const pj = polygon[j];
    if (isPointOnSegment(point, pj, pi)) return true;

    const intersects =
      (pi.y > point.y) !== (pj.y > point.y) &&
      point.x < ((pj.x - pi.x) * (point.y - pi.y)) / (pj.y - pi.y) + pi.x;
    if (intersects) inside = !inside;
  }

  return inside;
}

export function isRectInsideLimitArea(rect: RectPosition, polygon: LinePoint[]): boolean {
  if (!hasClosedLimitArea(polygon)) return false;
  if (!Number.isFinite(rect.width) || !Number.isFinite(rect.height) || rect.width < 0 || rect.height < 0) {
    return false;
  }

  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;

  const rectCorners: LinePoint[] = [
    { x: left, y: top },
    { x: right, y: top },
    { x: right, y: bottom },
    { x: left, y: bottom },
  ];
  if (!rectCorners.every((corner) => isPointInsideLimitArea(corner, polygon))) {
    return false;
  }

  const rectEdges: Array<[LinePoint, LinePoint]> = [
    [rectCorners[0], rectCorners[1]],
    [rectCorners[1], rectCorners[2]],
    [rectCorners[2], rectCorners[3]],
    [rectCorners[3], rectCorners[0]],
  ];
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const polyA = polygon[j];
    const polyB = polygon[i];
    for (const [rectA, rectB] of rectEdges) {
      if (segmentsProperlyIntersect(rectA, rectB, polyA, polyB)) {
        return false;
      }
    }
  }

  const points: LinePoint[] = [];
  const seen = new Set<string>();
  const pushPoint = (x: number, y: number) => {
    const key = `${Math.round(x * 1000)}:${Math.round(y * 1000)}`;
    if (seen.has(key)) return;
    seen.add(key);
    points.push({ x, y });
  };

  // Always check corners + center and edge centers.
  pushPoint(left, top);
  pushPoint(right, top);
  pushPoint(left, bottom);
  pushPoint(right, bottom);
  pushPoint((left + right) / 2, (top + bottom) / 2);
  pushPoint((left + right) / 2, top);
  pushPoint((left + right) / 2, bottom);
  pushPoint(left, (top + bottom) / 2);
  pushPoint(right, (top + bottom) / 2);

  // Sample perimeter points to catch concave intrusions where corners remain inside.
  const sampleStep = 8;
  for (let x = left + sampleStep; x < right; x += sampleStep) {
    pushPoint(x, top);
    pushPoint(x, bottom);
  }
  for (let y = top + sampleStep; y < bottom; y += sampleStep) {
    pushPoint(left, y);
    pushPoint(right, y);
  }

  return points.every((point) => isPointInsideLimitArea(point, polygon));
}

function polygonBounds(points: LinePoint[]): { minX: number; maxX: number; minY: number; maxY: number } {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  return { minX, maxX, minY, maxY };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function findNearestRectInsideLimitArea(
  preferred: XYPosition,
  size: RectSize,
  polygon: LinePoint[],
): XYPosition | null {
  if (!hasClosedLimitArea(polygon)) return null;

  const bounds = polygonBounds(polygon);
  const start = {
    x: Math.round(clamp(preferred.x, bounds.minX - size.width, bounds.maxX)),
    y: Math.round(clamp(preferred.y, bounds.minY - size.height, bounds.maxY)),
  };

  const initialRect: RectPosition = { ...start, ...size };
  if (isRectInsideLimitArea(initialRect, polygon)) return start;

  const step = 12;
  const maxRadius = 2400;

  for (let radius = step; radius <= maxRadius; radius += step) {
    const minX = start.x - radius;
    const maxX = start.x + radius;
    const minY = start.y - radius;
    const maxY = start.y + radius;

    for (let x = minX; x <= maxX; x += step) {
      const top: RectPosition = { x, y: minY, ...size };
      if (isRectInsideLimitArea(top, polygon)) return { x, y: minY };
      const bottom: RectPosition = { x, y: maxY, ...size };
      if (isRectInsideLimitArea(bottom, polygon)) return { x, y: maxY };
    }

    for (let y = minY + step; y <= maxY - step; y += step) {
      const left: RectPosition = { x: minX, y, ...size };
      if (isRectInsideLimitArea(left, polygon)) return { x: minX, y };
      const right: RectPosition = { x: maxX, y, ...size };
      if (isRectInsideLimitArea(right, polygon)) return { x: maxX, y };
    }
  }

  return null;
}
