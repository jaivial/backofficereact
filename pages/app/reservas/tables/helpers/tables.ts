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

/**
 * True only for real calendar dates in `YYYY-MM-DD` format. Rejects malformed
 * strings, non-strings, impossible months/days and fake dates like Feb 30.
 */
export function isValidISODate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Resolves the initial table-map date from the `?date=` search param.
 * Invalid, missing or impossible values fall back to `fallback` (today).
 */
export function initialDateFromSearch(search: unknown, fallback: string = todayISO()): string {
  return isValidISODate(search) ? search : fallback;
}

/**
 * Returns `url` with the `date` query param set (replacing an existing value,
 * preserving other params). Accepts absolute or relative URLs.
 */
export function withDateParam(url: string, date: string): string {
  const [base, search = ""] = url.split("?");
  const params = new URLSearchParams(search);
  params.set("date", date);
  const query = params.toString();
  return query ? `${base}?${query}` : base;
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

export type ExplicitTableSize = { width?: number; height?: number };

/** Capacity-based default canvas size for a table. */
export function defaultTableSize(shape: TableShape, capacity: number): { width: number; height: number } {
  const c = clampCapacity(capacity);
  if (shape === "round") {
    const size = 148 + c * 2;
    return { width: size, height: size };
  }
  if (c <= 4) {
    return { width: 164, height: 164 };
  }
  return {
    width: Math.min(290, 164 + (c - 4) * 18),
    height: Math.max(138, 164 - Math.min(36, (c - 4) * 4)),
  };
}

/**
 * Resolves the canvas size for a table. Explicit width/height (set by the
 * editor resize feature) win; otherwise the capacity-based default is used.
 */
export function normalizeTableSize(
  shape: TableShape,
  capacity: number,
  _rectShortSides: RectShortSides,
  explicit?: ExplicitTableSize,
): { width: number; height: number } {
  const fallback = defaultTableSize(shape, capacity);
  const width =
    typeof explicit?.width === "number" && Number.isFinite(explicit.width) && explicit.width > 0
      ? Math.round(explicit.width)
      : fallback.width;
  const height =
    typeof explicit?.height === "number" && Number.isFinite(explicit.height) && explicit.height > 0
      ? Math.round(explicit.height)
      : fallback.height;
  return { width, height };
}

export function previewGeometry(
  shape: TableShape,
  capacity: number,
  rectShortSides: RectShortSides,
  explicit?: ExplicitTableSize,
): PreviewGeometry {
  const c = clampCapacity(capacity);
  const size = normalizeTableSize(shape, c, rectShortSides, explicit);
  const chairs =
    shape === "round"
      ? buildRoundChairs(c, size.width, size.height)
      : buildRectChairs(c, size.width, size.height, rectShortSides);
  return { width: size.width, height: size.height, chairs };
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

// === Booking table assignment helpers ===

export function sumAssignmentSeats(assignments: Array<{ seats: number }> | undefined | null): number {
  return (assignments || []).reduce((sum, item) => sum + Math.max(0, Number(item.seats) || 0), 0);
}

/** Clamps seats to a party of `partySize`, redistributing the difference. */
export function normalizeAssignmentSeats(
  assignments: Array<{ seats: number }>,
  partySize: number,
): Array<{ seats: number }> {
  const total = clampCapacity(partySize);
  if (assignments.length === 0 || total <= 0) return assignments;

  let remaining = total;
  const next = assignments.map((item, idx) => {
    if (idx === assignments.length - 1) {
      return { ...item, seats: remaining };
    }
    const seats = Math.max(1, Math.min(remaining - (assignments.length - idx - 1), Math.round(Number(item.seats) || 1)));
    remaining -= seats;
    return { ...item, seats };
  });
  return next;
}

/**
 * Splits `partySize` across `tableCount` assignments, keeping the sum exact.
 * Earlier rows get the extra seat when the party does not divide evenly.
 */
export function splitPartyAcrossTables(
  partySize: number,
  tables: Array<{ table_id: number | null; table_name: string }>,
  existing?: Array<{ seats: number; names?: string[] }>,
): Array<{ table_id: number | null; table_name: string; seats: number; names: string[] }> {
  const total = clampCapacity(partySize);
  const count = Math.max(1, tables.length);
  const base = Math.floor(total / count);
  const extra = total % count;
  return tables.map((table, idx) => ({
    table_id: table.table_id,
    table_name: table.table_name,
    seats: base + (idx < extra ? 1 : 0),
    names: existing?.[idx]?.names || [],
  }));
}

/**
 * Resolves the assignments for a booking. Prefers the structured assignments
 * stored in the booking state; legacy bookings with only a `table_number` are
 * derived as a single full-party assignment.
 */
export function resolveAssignments(
  state: { assignments?: Array<{ table_id: number | null; table_name: string; seats: number; names: string[] }> } | undefined,
  tableNumber: string | null | undefined,
  partySize: number,
): Array<{ table_id: number | null; table_name: string; seats: number; names: string[] }> {
  if (state?.assignments && state.assignments.length > 0) {
    return state.assignments;
  }
  const name = normalizeTableKey(tableNumber);
  if (!name) return [];
  return [{ table_id: null, table_name: name, seats: Math.max(1, Math.round(Number(partySize) || 1)), names: [] }];
}

export function assignmentsDisplayName(
  assignments: Array<{ table_name: string }> | undefined | null,
  fallback: string,
): string {
  const names = (assignments || []).map((item) => normalizeTableKey(item.table_name)).filter(Boolean);
  if (names.length === 0) return fallback;
  return names.join(" + ");
}

/** Names seated at a specific table, gathered from assignments. */
export function seatedNamesForTable(
  assignments: Array<{ table_name: string; names: string[] }> | undefined | null,
  tableName: string,
): string[] {
  const key = normalizeTableKey(tableName);
  if (!assignments) return [];
  const out: string[] = [];
  for (const item of assignments) {
    if (normalizeTableKey(item.table_name) !== key) continue;
    for (const name of item.names || []) {
      const trimmed = String(name || "").trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}
