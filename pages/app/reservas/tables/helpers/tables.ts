import type {
  ChairPosition,
  ColorPreset,
  DrawElement,
  DrawElementPreset,
  PreviewGeometry,
  RectShortSides,
  TableShape,
  TableDraft,
  RectShortSide,
  DateView,
} from "../types/tables";

type LinePoint = { x: number; y: number };
import { COLOR_PRESETS, RECT_SEAT_OFFSET } from "../constants/tables";

// === Date helpers ===

export function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function normalizeDateView(iso: string): DateView {
  const [y, m] = String(iso).split("-").map((n) => Number(n));
  return {
    year: Number.isFinite(y) ? y : new Date().getFullYear(),
    month: Number.isFinite(m) ? m : new Date().getMonth() + 1,
  };
}

// === Capacity helpers ===

export function clampCapacity(n: number): number {
  return Math.max(2, Math.min(16, Math.round(n)));
}

// === Rect short sides helpers ===

export function maxRectShortSeatsForCapacity(capacity: number): number {
  const c = clampCapacity(capacity);
  return Math.max(0, Math.min(2, c - 2));
}

export function defaultRectShortSides(capacity: number): RectShortSides {
  if (clampCapacity(capacity) >= 8) return { left: true, right: true };
  return { left: false, right: false };
}

export function normalizeRectShortSides(capacity: number, value: RectShortSides): RectShortSides {
  const max = maxRectShortSeatsForCapacity(capacity);
  if (max <= 0) return { left: false, right: false };

  let left = Boolean(value.left);
  let right = Boolean(value.right);
  const selected = Number(left) + Number(right);
  if (selected <= max) return { left, right };

  if (left && right && max === 1) {
    right = false;
  } else if (left && max === 0) {
    left = false;
  } else if (right && max === 0) {
    right = false;
  }
  return { left, right };
}

export function shortSidesToMetadata(value: RectShortSides): RectShortSide[] {
  const out: RectShortSide[] = [];
  if (value.left) out.push("left");
  if (value.right) out.push("right");
  return out;
}

export function shortSidesFromMetadata(raw: unknown, capacity: number): RectShortSides {
  if (!Array.isArray(raw)) return defaultRectShortSides(capacity);
  const parsed: RectShortSides = {
    left: raw.some((v) => v === "left"),
    right: raw.some((v) => v === "right"),
  };
  return normalizeRectShortSides(capacity, parsed);
}

// === Table draft helpers ===

export function defaultDraft(nextNumber: number): TableDraft {
  const preset = COLOR_PRESETS[0];
  const capacity = 4;
  return {
    name: `Mesa ${nextNumber}`,
    capacity,
    shape: "round",
    fillColor: preset.fill,
    outlineColor: preset.outline,
    stylePreset: preset.id,
    textureImageUrl: "",
    texturePreview: "",
    rotationDeg: 0,
    rectShortSides: defaultRectShortSides(capacity),
  };
}

// === Chair layout helpers ===

export function buildRoundChairs(
  capacity: number,
  width: number,
  height: number,
): ChairPosition[] {
  const count = clampCapacity(capacity);
  const radius = Math.max(width, height) / 2 + 22;
  const out: ChairPosition[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const side: ChairPosition["side"] =
      Math.abs(cos) >= Math.abs(sin) ? (cos >= 0 ? "right" : "left") : sin >= 0 ? "bottom" : "top";
    out.push({ x: cos * radius, y: sin * radius, side });
  }
  return out;
}

function spreadPoints(items: number, span: number): number[] {
  if (items <= 0) return [];
  const edgeInset = 20;
  const usable = Math.max(24, span - edgeInset * 2);
  const step = usable / items;
  const start = -usable / 2 + step / 2;
  return Array.from({ length: items }, (_, idx) => start + step * idx);
}

export function buildRectChairs(
  capacity: number,
  width: number,
  height: number,
  rectShortSides: RectShortSides,
): ChairPosition[] {
  const count = clampCapacity(capacity);
  const halfW = width / 2;
  const halfH = height / 2;
  const isRectangular = Math.abs(width - height) > 0.5;
  const out: ChairPosition[] = [];

  if (!isRectangular) {
    const sideWeights = [width, height, width, height]; // top, right, bottom, left
    const sideCounts = [0, 0, 0, 0];
    const pickOrder = [0, 2, 1, 3];

    for (let i = 0; i < count; i += 1) {
      let bestSide = pickOrder[0];
      let bestScore = -Infinity;
      for (const side of pickOrder) {
        const score = sideWeights[side] / (sideCounts[side] + 1);
        if (score > bestScore + 0.0001) {
          bestScore = score;
          bestSide = side;
          continue;
        }
        if (Math.abs(score - bestScore) <= 0.0001 && sideCounts[side] < sideCounts[bestSide]) {
          bestSide = side;
        }
      }
      sideCounts[bestSide] += 1;
    }

    const [topCount, rightCount, bottomCount, leftCount] = sideCounts;
    for (const x of spreadPoints(topCount, width)) out.push({ x, y: -halfH - RECT_SEAT_OFFSET, side: "top" });
    for (const y of spreadPoints(rightCount, height)) out.push({ x: halfW + RECT_SEAT_OFFSET, y, side: "right" });
    for (const x of spreadPoints(bottomCount, width)) out.push({ x, y: halfH + RECT_SEAT_OFFSET, side: "bottom" });
    for (const y of spreadPoints(leftCount, height)) out.push({ x: -halfW - RECT_SEAT_OFFSET, y, side: "left" });
    return out;
  }

  const normalizedShortSides = normalizeRectShortSides(count, rectShortSides);
  const shortSideSeats = Number(normalizedShortSides.left) + Number(normalizedShortSides.right);
  const longSeats = count - shortSideSeats;
  const topCount = Math.ceil(longSeats / 2);
  const bottomCount = longSeats - topCount;

  for (const x of spreadPoints(topCount, width)) {
    out.push({ x, y: -halfH - RECT_SEAT_OFFSET, side: "top" });
  }
  for (const x of spreadPoints(bottomCount, width)) {
    out.push({ x, y: halfH + RECT_SEAT_OFFSET, side: "bottom" });
  }

  if (normalizedShortSides.left) out.push({ x: -halfW - RECT_SEAT_OFFSET, y: 0, side: "left" });
  if (normalizedShortSides.right) out.push({ x: halfW + RECT_SEAT_OFFSET, y: 0, side: "right" });

  return out;
}

export function previewGeometry(shape: TableShape, capacity: number, rectShortSides: RectShortSides): PreviewGeometry {
  const c = clampCapacity(capacity);
  if (shape === "round") {
    const size = 148 + c * 2;
    return {
      width: size,
      height: size,
      chairs: buildRoundChairs(c, size, size),
    };
  }

  if (c <= 4) {
    const size = 164;
    return {
      width: size,
      height: size,
      chairs: buildRectChairs(c, size, size, rectShortSides),
    };
  }

  const width = Math.min(290, 164 + (c - 4) * 18);
  const height = Math.max(138, 164 - Math.min(36, (c - 4) * 4));
  return {
    width,
    height,
    chairs: buildRectChairs(c, width, height, rectShortSides),
  };
}

// === Geometry helpers ===

export function interpolatePosition(a: { x: number; y: number }, b: { x: number; y: number }, t: number) {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function cloneLinePoints(points: LinePoint[]): LinePoint[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

export function elementIntersectsRect(
  el: DrawElement,
  left: number,
  top: number,
  width: number,
  height: number,
): boolean {
  const elLeft = el.x;
  const elTop = el.y;
  const elRight = elLeft + el.width;
  const elBottom = elTop + el.height;
  const right = left + width;
  const bottom = top + height;
  return left < elRight && right > elLeft && top < elBottom && bottom > elTop;
}

// === File helpers ===

export function toFileFromDataURL(dataUrl: string, filename: string): File {
  const parts = dataUrl.split(",");
  const mimeMatch = parts[0]?.match(/:(.*?);/);
  const mime = mimeMatch?.[1] || "image/webp";
  const b64 = parts[1] || "";
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

// === Table key helpers ===

export function normalizeTableKey(name: string | number | null | undefined): string {
  return String(name || "").trim();
}

// === Color preset helpers ===

export function pickColorPreset(presetId: string): ColorPreset | undefined {
  return COLOR_PRESETS.find((p) => p.id === presetId);
}
