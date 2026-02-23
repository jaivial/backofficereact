import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  ControlButton,
  Controls,
  type CoordinateExtent,
  type Node,
  type NodeChange,
  NodeResizer,
  applyNodeChanges,
  type XYPosition,
  useEdgesState,
  useNodesState,
} from "reactflow";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronLeft, DoorOpen, Ellipsis, FileText, Hand, ImagePlus, Leaf, MousePointer2, PanelRightClose, PanelRightOpen, Pencil, Plus, RotateCcw, RotateCw, Sofa, Square, Trash2, X } from "lucide-react";
import "reactflow/dist/style.css";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { Booking, CalendarDay, ConfigDailyLimit, ConfigFloor, DashboardMetrics, TableMapArea, TableMapItem } from "../../../../api/types";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { formatHHMM } from "../../../../ui/lib/format";
import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";
import { Modal } from "../../../../ui/overlays/Modal";
import { MonthCalendar } from "../../../../ui/widgets/MonthCalendar";
import { PlusMinusCounter } from "../../../../ui/widgets/PlusMinusCounter";
import { compressImageToWebP, isValidImageFile } from "../../../../lib/imageCompressor";

type TableShape = "round" | "square";
type RectShortSide = "left" | "right";
type RectShortSides = Record<RectShortSide, boolean>;

type TableDraft = {
  name: string;
  capacity: number;
  shape: TableShape;
  fillColor: string;
  outlineColor: string;
  stylePreset: string;
  textureImageUrl: string;
  texturePreview: string;
  rotationDeg: number;
  rectShortSides: RectShortSides;
};

type TableNodeData = {
  id: number;
  name: string;
  capacity: number;
  status: "available" | "occupied" | "reserved";
  shape: TableShape;
  fillColor: string;
  outlineColor: string;
  textureImageUrl: string;
  rotationDeg: number;
  rectShortSides: RectShortSides;
};

type DrawElementKind = "wall" | "obstacle" | "image";

type DrawElementPreset = "wall" | "plant" | "door" | "arch_door" | "sofa";

type DrawElement = {
  id: string;
  kind: DrawElementKind;
  preset: DrawElementPreset;
  x: number;
  y: number;
  width: number;
  height: number;
  rotationDeg: number;
  label: string;
};

type DrawNodeData = {
  id: string;
  kind: DrawElementKind;
  preset: DrawElementPreset;
  label: string;
  width: number;
  height: number;
  rotationDeg: number;
  editable: boolean;
};

type BookingState = {
  seated: boolean;
};

const COLOR_PRESETS: Array<{ id: string; fill: string; outline: string }> = [
  { id: "lavanda", fill: "rgba(185, 168, 255, 0.28)", outline: "rgba(185, 168, 255, 0.72)" },
  { id: "cian", fill: "rgba(147, 239, 231, 0.24)", outline: "rgba(147, 239, 231, 0.74)" },
  { id: "amber", fill: "rgba(245, 181, 109, 0.25)", outline: "rgba(245, 181, 109, 0.7)" },
  { id: "grafito", fill: "rgba(125, 129, 157, 0.22)", outline: "rgba(125, 129, 157, 0.7)" },
];

const STATUS_LABEL: Record<TableMapItem["status"], string> = {
  available: "Libre",
  reserved: "Reservada",
  occupied: "Ocupada",
};

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clampCapacity(n: number): number {
  return Math.max(2, Math.min(16, Math.round(n)));
}

const RECT_SEAT_OFFSET = 18;
const MAP_EXTENT: CoordinateExtent = [
  [0, 0],
  [1800, 1200],
];

function maxRectShortSeatsForCapacity(capacity: number): number {
  const c = clampCapacity(capacity);
  return Math.max(0, Math.min(2, c - 2));
}

function defaultRectShortSides(capacity: number): RectShortSides {
  if (clampCapacity(capacity) >= 8) return { left: true, right: true };
  return { left: false, right: false };
}

function normalizeRectShortSides(capacity: number, value: RectShortSides): RectShortSides {
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

function shortSidesToMetadata(value: RectShortSides): RectShortSide[] {
  const out: RectShortSide[] = [];
  if (value.left) out.push("left");
  if (value.right) out.push("right");
  return out;
}

function shortSidesFromMetadata(raw: unknown, capacity: number): RectShortSides {
  if (!Array.isArray(raw)) return defaultRectShortSides(capacity);
  const parsed: RectShortSides = {
    left: raw.some((v) => v === "left"),
    right: raw.some((v) => v === "right"),
  };
  return normalizeRectShortSides(capacity, parsed);
}

function toFileFromDataURL(dataUrl: string, filename: string): File {
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

function tableFromRFNode(data: TableNodeData): React.JSX.Element {
  const geom = previewGeometry(data.shape, data.capacity, data.rectShortSides);
  const shape = data.shape === "square" ? "is-square" : "is-round";
  const style: React.CSSProperties = {
    ["--bo-table-fill" as any]: data.fillColor || "var(--bo-surface-2)",
    ["--bo-table-outline" as any]: data.outlineColor || "var(--bo-border-2)",
    ["--bo-table-texture" as any]: data.textureImageUrl ? `url(${data.textureImageUrl})` : "none",
    transform: `rotate(${Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0}deg)`,
    width: `${geom.width}px`,
    height: `${geom.height}px`,
  };
  return (
    <div className={`bo-tableMapNode ${shape}`} style={style}>
      {geom.chairs.map((chair, idx) => (
        <span key={`node-chair-${idx}`} className="bo-tableMapChair" style={{ transform: `translate(${chair.x}px, ${chair.y}px)` }} />
      ))}
      <div className="bo-tableMapNodeName">{data.name}</div>
      <div className="bo-tableMapNodeCap">{data.capacity}</div>
      <div className={`bo-tableMapNodeStatus is-${data.status}`}>{STATUS_LABEL[data.status]}</div>
    </div>
  );
}

const TableNode = ({ data }: { data: TableNodeData }) => tableFromRFNode(data);

const DRAW_PRESET_LABEL: Record<DrawElementPreset, string> = {
  wall: "Muro",
  plant: "Planta",
  door: "Puerta",
  arch_door: "Puerta arco",
  sofa: "Sofa",
};

const DRAW_PRESET_ICON: Record<DrawElementPreset, React.JSX.Element> = {
  wall: <Square size={15} strokeWidth={1.8} />,
  plant: <Leaf size={15} strokeWidth={1.8} />,
  door: <DoorOpen size={15} strokeWidth={1.8} />,
  arch_door: <DoorOpen size={15} strokeWidth={1.8} />,
  sofa: <Sofa size={15} strokeWidth={1.8} />,
};

const DrawElementNode = ({ data }: { data: DrawNodeData }) => {
  const style: React.CSSProperties = {
    width: `${data.width}px`,
    height: `${data.height}px`,
    transform: `rotate(${data.rotationDeg}deg)`,
  };
  const cls = data.kind === "wall" ? "is-wall" : data.kind === "image" ? "is-image" : "is-obstacle";
  return (
    <div className={`bo-drawElementNode ${cls}`} style={style}>
      <NodeResizer
        isVisible={data.editable}
        minWidth={24}
        minHeight={24}
        lineStyle={{ borderColor: "var(--bo-accent)" }}
        handleStyle={{ width: 10, height: 10, border: "1px solid var(--bo-accent)", background: "var(--bo-surface)" }}
      />
      <span className="bo-drawElementNodeIcon" aria-hidden="true">{DRAW_PRESET_ICON[data.preset]}</span>
      <span className="bo-drawElementNodeLabel">{data.label}</span>
    </div>
  );
};

const NODE_TYPES = {
  restaurantTable: TableNode,
  drawElement: DrawElementNode,
};

function floorNumberForArea(area: TableMapArea): number {
  const m = (area.metadata || {}) as Record<string, unknown>;
  const fromMeta = Number(m.floorNumber);
  if (Number.isFinite(fromMeta) && fromMeta >= 0) return fromMeta;
  return 0;
}

function defaultDraft(nextNumber: number): TableDraft {
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

type PreviewGeometry = {
  width: number;
  height: number;
  chairs: Array<{ x: number; y: number; side: "top" | "right" | "bottom" | "left" }>;
};

function buildRoundChairs(
  capacity: number,
  width: number,
  height: number,
): Array<{ x: number; y: number; side: "top" | "right" | "bottom" | "left" }> {
  const count = clampCapacity(capacity);
  const radius = Math.max(width, height) / 2 + 22;
  const out: Array<{ x: number; y: number; side: "top" | "right" | "bottom" | "left" }> = [];
  for (let i = 0; i < count; i += 1) {
    const angle = (Math.PI * 2 * i) / count;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const side = Math.abs(cos) >= Math.abs(sin) ? (cos >= 0 ? "right" : "left") : sin >= 0 ? "bottom" : "top";
    out.push({ x: cos * radius, y: sin * radius, side });
  }
  return out;
}

function buildRectChairs(
  capacity: number,
  width: number,
  height: number,
  rectShortSides: RectShortSides,
): Array<{ x: number; y: number; side: "top" | "right" | "bottom" | "left" }> {
  const count = clampCapacity(capacity);
  const halfW = width / 2;
  const halfH = height / 2;
  const isRectangular = Math.abs(width - height) > 0.5;
  const edgeInset = 20;
  const out: Array<{ x: number; y: number; side: "top" | "right" | "bottom" | "left" }> = [];

  const spreadPoints = (items: number, span: number): number[] => {
    if (items <= 0) return [];
    const usable = Math.max(24, span - edgeInset * 2);
    const step = usable / items;
    const start = -usable / 2 + step / 2;
    return Array.from({ length: items }, (_, idx) => start + step * idx);
  };

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

function previewGeometry(shape: TableShape, capacity: number, rectShortSides: RectShortSides): PreviewGeometry {
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

function normalizeDateView(iso: string): { year: number; month: number } {
  const [y, m] = String(iso).split("-").map((n) => Number(n));
  return {
    year: Number.isFinite(y) ? y : new Date().getFullYear(),
    month: Number.isFinite(m) ? m : new Date().getMonth() + 1,
  };
}

function makeDrawElement(kind: DrawElementKind, preset: DrawElementPreset, base: XYPosition, index: number): DrawElement {
  const id = `draw-${kind}-${Date.now()}-${index}`;
  const dims = kind === "wall" ? { w: 220, h: 26 } : kind === "image" ? { w: 92, h: 92 } : { w: 128, h: 92 };
  return {
    id,
    kind,
    preset,
    x: base.x,
    y: base.y,
    width: dims.w,
    height: dims.h,
    rotationDeg: 0,
    label: DRAW_PRESET_LABEL[preset],
  };
}

function elementIntersectsRect(el: DrawElement, left: number, top: number, width: number, height: number): boolean {
  const elLeft = el.x;
  const elTop = el.y;
  const elRight = elLeft + el.width;
  const elBottom = elTop + el.height;
  const right = left + width;
  const bottom = top + height;
  return left < elRight && right > elLeft && top < elBottom && bottom > elTop;
}

function clampToExtent(position: XYPosition, extent: CoordinateExtent, size: { width: number; height: number }): XYPosition {
  const minX = extent[0][0];
  const minY = extent[0][1];
  const maxX = extent[1][0] - size.width;
  const maxY = extent[1][1] - size.height;
  return {
    x: Math.max(minX, Math.min(maxX, position.x)),
    y: Math.max(minY, Math.min(maxY, position.y)),
  };
}

export default function TableManagerPage() {
  const pageContext = usePageContext();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const initialDate = useMemo(() => {
    const fromSearch = typeof pageContext.urlParsed?.search?.date === "string" ? pageContext.urlParsed.search.date : "";
    if (fromSearch && /^\d{4}-\d{2}-\d{2}$/.test(fromSearch)) return fromSearch;
    return todayISO();
  }, [pageContext.urlParsed?.search?.date]);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [calendarView, setCalendarView] = useState(() => normalizeDateView(initialDate));
  const [calendarDays, setCalendarDays] = useState<CalendarDay[]>([]);

  const [areas, setAreas] = useState<TableMapArea[]>([]);
  const [floors, setFloors] = useState<ConfigFloor[]>([]);
  const [dailyLimit, setDailyLimit] = useState<ConfigDailyLimit | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingStates, setBookingStates] = useState<Record<string, BookingState>>({});
  const [drawElements, setDrawElements] = useState<DrawElement[]>([]);
  const [sheetTab, setSheetTab] = useState<"reservas" | "mesas">("reservas");
  const [mapMode, setMapMode] = useState<"tables" | "draw">("tables");
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">("select");
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingTableDraft, setBookingTableDraft] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTooltipStyle, setMenuTooltipStyle] = useState<React.CSSProperties>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useErrorToast(error);

  const [nodes, setNodes] = useNodesState<any>([]);
  const [edges] = useEdgesState([]);

  const [rightSheetOpen, setRightSheetOpen] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<number>(0);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<TableDraft>(() => defaultDraft(1));
  const [draftTextureFile, setDraftTextureFile] = useState<File | null>(null);
  const [shortSideHover, setShortSideHover] = useState<RectShortSide | null>(null);
  const nodeTypes = useMemo(() => NODE_TYPES, []);
  const reduceMotion = useReducedMotion();

  const ws = useRef<WebSocket | null>(null);
  const drawElementsRef = useRef<DrawElement[]>([]);
  const bookingStatesRef = useRef<Record<string, BookingState>>({});
  const persistLayoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const geom = useMemo(
    () => previewGeometry(draft.shape, draft.capacity, draft.rectShortSides),
    [draft.capacity, draft.rectShortSides, draft.shape],
  );
  const isRectangularPreview = useMemo(
    () => draft.shape === "square" && Math.abs(geom.width - geom.height) > 0.5,
    [draft.shape, geom.height, geom.width],
  );
  const normalizedRectShortSides = useMemo(
    () => normalizeRectShortSides(draft.capacity, draft.rectShortSides),
    [draft.capacity, draft.rectShortSides],
  );
  const shortSideCount = useMemo(
    () => Number(normalizedRectShortSides.left) + Number(normalizedRectShortSides.right),
    [normalizedRectShortSides.left, normalizedRectShortSides.right],
  );
  const shortSideMax = useMemo(() => maxRectShortSeatsForCapacity(draft.capacity), [draft.capacity]);
  const canAddLeftShortSide = isRectangularPreview && !normalizedRectShortSides.left && shortSideCount < shortSideMax;
  const canAddRightShortSide = isRectangularPreview && !normalizedRectShortSides.right && shortSideCount < shortSideMax;

  useEffect(() => {
    drawElementsRef.current = drawElements;
  }, [drawElements]);

  useEffect(() => {
    bookingStatesRef.current = bookingStates;
  }, [bookingStates]);

  const setDraftCapacity = useCallback((nextCapacity: number) => {
    const capacity = clampCapacity(nextCapacity);
    setDraft((prev) => ({
      ...prev,
      capacity,
      rectShortSides: normalizeRectShortSides(capacity, prev.rectShortSides),
    }));
  }, []);

  const armShortSide = useCallback((side: RectShortSide) => {
    setShortSideHover(side);
  }, []);

  const disarmShortSide = useCallback((side: RectShortSide) => {
    setShortSideHover((prev) => (prev === side ? null : prev));
  }, []);

  const mutateShortSide = useCallback((side: RectShortSide, action: "add" | "remove") => {
    setDraft((prev) => {
      const normalized = normalizeRectShortSides(prev.capacity, prev.rectShortSides);
      const currentCount = Number(normalized.left) + Number(normalized.right);
      const max = maxRectShortSeatsForCapacity(prev.capacity);

      if (action === "add") {
        if (normalized[side] || currentCount >= max) return { ...prev, rectShortSides: normalized };
        const next = { ...normalized, [side]: true };
        return { ...prev, rectShortSides: normalizeRectShortSides(prev.capacity, next) };
      }

      if (!normalized[side]) return { ...prev, rectShortSides: normalized };
      const next = { ...normalized, [side]: false };
      return { ...prev, rectShortSides: normalizeRectShortSides(prev.capacity, next) };
    });
  }, []);

  const onAddShortSide = useCallback(
    (side: RectShortSide) => {
      const canAdd = side === "left" ? canAddLeftShortSide : canAddRightShortSide;
      if (!canAdd) return;
      if (shortSideHover !== side) {
        setShortSideHover(side);
        return;
      }
      mutateShortSide(side, "add");
      setShortSideHover(null);
    },
    [canAddLeftShortSide, canAddRightShortSide, mutateShortSide, shortSideHover],
  );

  const onRemoveShortSide = useCallback(
    (side: RectShortSide) => {
      if (!normalizedRectShortSides[side]) return;
      if (shortSideHover !== side) {
        setShortSideHover(side);
        return;
      }
      mutateShortSide(side, "remove");
      setShortSideHover(null);
    },
    [mutateShortSide, normalizedRectShortSides, shortSideHover],
  );

  useEffect(() => {
    if (editorOpen) return;
    setShortSideHover(null);
  }, [editorOpen]);

  useEffect(() => {
    if (isRectangularPreview) return;
    setShortSideHover(null);
  }, [isRectangularPreview]);

  useEffect(() => {
    setBookingTableDraft(selectedBooking?.table_number || "");
  }, [selectedBooking?.table_number]);

  const floorAreas = useMemo(() => {
    const map = new Map<number, TableMapArea[]>();
    for (const area of areas) {
      const n = floorNumberForArea(area);
      map.set(n, [...(map.get(n) || []), area]);
    }
    return map;
  }, [areas]);

  const floorTabs = useMemo(() => {
    const active = floors
      .filter((f) => f.active)
      .map((f) => ({ floorNumber: Number(f.floorNumber), label: f.name }))
      .filter((f) => Number.isFinite(f.floorNumber));
    if (!active.length) {
      return [{ floorNumber: 0, label: "Principal" }];
    }
    return active;
  }, [floors]);

  const visibleAreas = useMemo(() => floorAreas.get(selectedFloor) || [], [floorAreas, selectedFloor]);
  const visibleTables = useMemo(() => visibleAreas.flatMap((a) => a.tables || []), [visibleAreas]);

  const nextTableNumber = useMemo(() => {
    const total = areas.flatMap((a) => a.tables || []).length;
    return total + 1;
  }, [areas]);

  const occupancy = useMemo(() => {
    const totalPeople = dailyLimit?.totalPeople ?? metrics?.totalPeople ?? 0;
    const limit = dailyLimit?.limit ?? 0;
    const percent = limit > 0 ? Math.max(0, Math.min(100, Math.round((totalPeople / limit) * 100))) : 0;
    return { totalPeople, limit, percent };
  }, [dailyLimit, metrics?.totalPeople]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tablesRes, floorsRes, limitRes, metricsRes, monthRes, bookingsRes] = await Promise.all([
        api.tables.list({ date: selectedDate, floor_number: Number.isFinite(selectedFloor) ? selectedFloor : 0 }),
        api.config.getFloors(selectedDate),
        api.config.getDailyLimit(selectedDate),
        api.dashboard.getMetrics(selectedDate),
        api.calendar.getMonth({ year: calendarView.year, month: calendarView.month }),
        api.reservas.exportDay(selectedDate),
      ]);

      let loadedAreas: TableMapArea[] = [];
      if (!tablesRes.success) {
        setError(tablesRes.message || "Error cargando mesas");
      } else {
        loadedAreas = (tablesRes.areas || tablesRes.data || []).map((a: any) => ({ ...a, tables: Array.isArray(a.tables) ? a.tables : [] }));
        setAreas(loadedAreas);
        const mapLayout = ((tablesRes.layout as any)?.map || (tablesRes.layout as any) || {}) as Record<string, unknown>;
        const loadedElements = Array.isArray(mapLayout.elements)
          ? (mapLayout.elements as any[])
              .map((item) => {
                const id = String(item?.id || "").trim();
                if (!id) return null;
                const kind = item?.kind === "wall" || item?.kind === "image" ? item.kind : "obstacle";
                const preset: DrawElementPreset =
                  item?.preset === "wall" || item?.preset === "plant" || item?.preset === "door" || item?.preset === "arch_door" || item?.preset === "sofa"
                    ? item.preset
                    : "wall";
                return {
                  id,
                  kind,
                  preset,
                  x: Number(item?.x || 0),
                  y: Number(item?.y || 0),
                  width: Math.max(24, Number(item?.width || 92)),
                  height: Math.max(24, Number(item?.height || 92)),
                  rotationDeg: Number(item?.rotationDeg || 0),
                  label: String(item?.label || DRAW_PRESET_LABEL[preset]),
                } as DrawElement;
              })
              .filter(Boolean) as DrawElement[]
          : [];
        drawElementsRef.current = loadedElements;
        setDrawElements(loadedElements);

        const loadedBookingStates: Record<string, BookingState> = {};
        const rawBookingStates = mapLayout.booking_states as Record<string, unknown> | undefined;
        if (rawBookingStates && typeof rawBookingStates === "object") {
          for (const [key, value] of Object.entries(rawBookingStates)) {
            loadedBookingStates[key] = { seated: Boolean((value as any)?.seated) };
          }
        }
        bookingStatesRef.current = loadedBookingStates;
        setBookingStates(loadedBookingStates);
      }

      if (floorsRes.success) {
        const normalizedFloors = (floorsRes.floors || []).map((f) => ({
          ...f,
          floorNumber: Number(f.floorNumber),
          active: Boolean(f.active),
        })) as ConfigFloor[];
        setFloors(normalizedFloors);
      } else if (loadedAreas.length > 0) {
        const numbers = new Set<number>();
        for (const area of loadedAreas) numbers.add(floorNumberForArea(area));
        const fallback = [...numbers].sort((a, b) => a - b).map((n, idx) => ({
          id: idx + 1,
          floorNumber: n,
          name: n === 0 ? "Salón principal" : `Planta ${n}`,
          isGround: n === 0,
          active: true,
        })) as ConfigFloor[];
        setFloors(fallback);
      }
      if (limitRes.success) {
        setDailyLimit(limitRes as any);
      }
      if (metricsRes.success) {
        setMetrics((metricsRes as any).metrics || null);
      }
      if (monthRes.success) {
        setCalendarDays(((monthRes as any).data || []) as CalendarDay[]);
      }
      if (bookingsRes.success) {
        setBookings((bookingsRes.bookings || []) as Booking[]);
      }
    } catch (err) {
      if (err instanceof Error && err.message.trim()) {
        setError(err.message);
      } else {
        setError("Error cargando mapa de mesas");
      }
    } finally {
      setLoading(false);
    }
  }, [api.calendar, api.config, api.dashboard, api.reservas, api.tables, calendarView.month, calendarView.year, selectedDate, selectedFloor]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!floorTabs.length) return;
    const current = Number(selectedFloor);
    const exists = floorTabs.some((f) => f.floorNumber === current);
    if (exists) return;
    const nextFloor = floorTabs[0]?.floorNumber ?? 0;
    if (nextFloor === current) return;
    setSelectedFloor(nextFloor);
  }, [floorTabs, selectedFloor]);

  useEffect(() => {
    setNodes(
      [
        ...visibleTables.map((table) => ({
          id: String(table.id),
          type: "restaurantTable",
          draggable: true,
          position: { x: table.x_pos || 0, y: table.y_pos || 0 },
          extent: MAP_EXTENT,
          data: {
            id: table.id,
            name: table.name || `Mesa ${table.id}`,
            capacity: clampCapacity(table.capacity || 4),
            status: (table.status || "available") as TableMapItem["status"],
            shape: (table.shape || "round") as TableShape,
            fillColor: table.fill_color || "",
            outlineColor: table.outline_color || "",
            textureImageUrl: table.texture_image_url || "",
            rotationDeg: Number((table.metadata as any)?.rotation_deg || 0),
            rectShortSides: shortSidesFromMetadata((table.metadata as any)?.short_side_seats, table.capacity || 4),
          } as TableNodeData,
        })),
        ...drawElements.map((item) => ({
          id: item.id,
          type: "drawElement",
          draggable: mapMode === "draw",
          position: { x: item.x, y: item.y },
          extent: MAP_EXTENT,
          data: {
            id: item.id,
            kind: item.kind,
            preset: item.preset,
            label: item.label,
            width: item.width,
            height: item.height,
            rotationDeg: item.rotationDeg,
            editable: mapMode === "draw",
          } as DrawNodeData,
        })),
      ],
    );
  }, [drawElements, mapMode, setNodes, visibleTables]);

  useEffect(() => {
    const secure = typeof window !== "undefined" && window.location.protocol === "https:";
    const wsURL = `${secure ? "wss" : "ws"}://${window.location.host}/api/admin/tables/ws`;
    const socket = new WebSocket(wsURL);
    ws.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "snapshot" && Array.isArray(payload.areas)) {
          setAreas(payload.areas.map((a: any) => ({ ...a, tables: Array.isArray(a.tables) ? a.tables : [] })));
          return;
        }
        if (payload.type === "table_created" || payload.type === "table_updated") {
          const table = payload.table as TableMapItem | undefined;
          if (!table?.id) return;
          setAreas((prev) => {
            const next = prev.map((area) => ({ ...area, tables: [...(area.tables || [])] }));
            for (const area of next) {
              area.tables = area.tables.filter((t) => t.id !== table.id);
            }
            const target = next.find((area) => area.id === table.area_id);
            if (target) {
              target.tables.push({ ...table });
            }
            return next;
          });
        }
      } catch {
        // ignore malformed payloads
      }
    };

    return () => {
      socket.close();
      ws.current = null;
    };
  }, []);

  const savePosition = useCallback(
    async (id: string, x: number, y: number) => {
      const tableId = Number(id);
      if (!Number.isFinite(tableId) || tableId <= 0) return;
      const nextX = Math.round(x);
      const nextY = Math.round(y);
      setAreas((prev) =>
        prev.map((area) => {
          const source = area.tables || [];
          let touched = false;
          const tables = source.map((table) => {
            if (table.id !== tableId) return table;
            if (table.x_pos === nextX && table.y_pos === nextY) return table;
            touched = true;
            return { ...table, x_pos: nextX, y_pos: nextY };
          });
          return touched ? { ...area, tables } : area;
        }),
      );
      try {
        await api.tables.update({ id: tableId, x_pos: nextX, y_pos: nextY, date: selectedDate, floor_number: selectedFloor });
      } catch {
        // keep UX smooth, websocket snapshot will reconcile if needed
      }
    },
    [api.tables, selectedDate, selectedFloor],
  );

  const persistLayout = useCallback(
    async (patch: Record<string, unknown>) => {
      await api.tables.saveLayout({ date: selectedDate, floor_number: selectedFloor, metadata: patch });
    },
    [api.tables, selectedDate, selectedFloor],
  );

  const queuePersistLayout = useCallback(
    (elements: DrawElement[], states: Record<string, BookingState>) => {
      if (persistLayoutTimerRef.current) {
        clearTimeout(persistLayoutTimerRef.current);
      }
      // Debounce layout persistence to avoid network spam from drag/resize event bursts.
      persistLayoutTimerRef.current = setTimeout(() => {
        persistLayoutTimerRef.current = null;
        void persistLayout({ elements, booking_states: states });
      }, 120);
    },
    [persistLayout],
  );

  useEffect(() => {
    return () => {
      if (!persistLayoutTimerRef.current) return;
      clearTimeout(persistLayoutTimerRef.current);
      persistLayoutTimerRef.current = null;
    };
  }, []);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const activeDrawElements = drawElementsRef.current;
      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds) as Node<any>[];
        for (const c of changes as any[]) {
          if (c.type !== "position" || !c.position) continue;
          const prevNode = nds.find((n) => n.id === c.id);
          const node = next.find((n) => n.id === c.id);
          if (!node || !prevNode) continue;

          if (node.type === "restaurantTable") {
            const data = node.data as TableNodeData;
            const geom = previewGeometry(data.shape, data.capacity, data.rectShortSides);
            const clamped = clampToExtent(node.position, MAP_EXTENT, { width: geom.width, height: geom.height });
            const blocked = activeDrawElements.some((el) => elementIntersectsRect(el, clamped.x, clamped.y, geom.width, geom.height));
            node.position = blocked ? prevNode.position : clamped;
            continue;
          }

          if (node.type === "drawElement") {
            if (mapMode !== "draw") {
              node.position = prevNode.position;
              continue;
            }
            const data = node.data as DrawNodeData;
            node.position = clampToExtent(node.position, MAP_EXTENT, { width: data.width, height: data.height });
          }
        }
        return next;
      });

      let nextDrawElements = drawElementsRef.current;
      let drawElementsChanged = false;

      for (const c of changes as any[]) {
        if (c.type === "position" && c.dragging === false && c.position) {
          if (String(c.id).startsWith("draw-")) {
            if (mapMode !== "draw") continue;
            const x = Math.round(c.position.x);
            const y = Math.round(c.position.y);
            let changed = false;
            const updated = nextDrawElements.map((el) => {
              if (el.id !== c.id) return el;
              if (el.x === x && el.y === y) return el;
              changed = true;
              return { ...el, x, y };
            });
            if (changed) {
              nextDrawElements = updated;
              drawElementsChanged = true;
            }
          } else {
            void savePosition(c.id, c.position.x, c.position.y);
          }
        }
        if (c.type === "dimensions" && String(c.id).startsWith("draw-")) {
          if (mapMode !== "draw") continue;
          if (c.resizing !== false || !c.dimensions) continue;
          let changed = false;
          const updated = nextDrawElements.map((el) => {
            if (el.id !== c.id) return el;
            const width = Math.max(24, Number(c.dimensions.width || el.width));
            const height = Math.max(24, Number(c.dimensions.height || el.height));
            if (el.width === width && el.height === height) return el;
            changed = true;
            return { ...el, width, height };
          });
          if (changed) {
            nextDrawElements = updated;
            drawElementsChanged = true;
          }
        }
      }

      if (drawElementsChanged) {
        drawElementsRef.current = nextDrawElements;
        setDrawElements(nextDrawElements);
        queuePersistLayout(nextDrawElements, bookingStatesRef.current);
      }
    },
    [mapMode, queuePersistLayout, savePosition, setNodes],
  );

  const openAddModal = useCallback(() => {
    setEditingTableId(null);
    setDraft(defaultDraft(nextTableNumber));
    setDraftTextureFile(null);
    setShortSideHover(null);
    setEditorOpen(true);
    setMenuVisible(false);
  }, [nextTableNumber]);

  const openEditModal = useCallback((table: TableMapItem) => {
    const capacity = clampCapacity(table.capacity || 4);
    const metadata = (table.metadata || {}) as Record<string, unknown>;
    setEditingTableId(table.id);
    setDraft({
      name: table.name || "",
      capacity,
      shape: (table.shape || "round") as TableShape,
      fillColor: table.fill_color || COLOR_PRESETS[0].fill,
      outlineColor: table.outline_color || COLOR_PRESETS[0].outline,
      stylePreset: table.style_preset || "",
      textureImageUrl: table.texture_image_url || "",
      texturePreview: table.texture_image_url || "",
      rotationDeg: Number(metadata.rotation_deg || 0),
      rectShortSides: shortSidesFromMetadata(metadata.short_side_seats, capacity),
    });
    setDraftTextureFile(null);
    setShortSideHover(null);
    setEditorOpen(true);
  }, []);

  const ensureAreaForFloor = useCallback(async (): Promise<number | null> => {
    const existing = (floorAreas.get(selectedFloor) || [])[0];
    if (existing?.id) return existing.id;
    const createRes = await api.tables.create({
      entity: "area",
      name: selectedFloor === 0 ? "Salón principal" : `Salón ${selectedFloor}`,
      metadata: { floorNumber: selectedFloor },
    } as any);
    if (!createRes.success) {
      pushToast({ kind: "error", title: "Error", message: createRes.message || "No se pudo crear área" });
      return null;
    }
    const created = (createRes.item || {}) as any;
    if (created?.id) {
      setAreas((prev) => [...prev, { ...created, tables: [] } as TableMapArea]);
    }
    return typeof created.id === "number" ? created.id : null;
  }, [api.tables, floorAreas, pushToast, selectedFloor]);

  const saveDraft = useCallback(async () => {
    const name = draft.name.trim();
    if (!name) {
      pushToast({ kind: "error", title: "Error", message: "Nombre de mesa requerido" });
      return;
    }

    setSaving(true);
    try {
      const areaId = await ensureAreaForFloor();
      if (!areaId) return;

      let tableId = editingTableId;
      const payload: any = {
        entity: "table",
        area_id: areaId,
        name,
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
        const res = await api.tables.update({ id: editingTableId, ...payload, date: selectedDate, floor_number: selectedFloor });
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar" });
          return;
        }
        const updated = ((res.table || res.item) as TableMapItem | undefined) || null;
        if (updated) {
          setAreas((prev) =>
            prev.map((area) => ({
              ...area,
              tables: (area.tables || []).map((table) => (table.id === updated.id ? { ...table, ...updated } : table)),
            })),
          );
        }
      } else {
        payload.x_pos = 140 + visibleTables.length * 24;
        payload.y_pos = 140 + visibleTables.length * 24;
        payload.date = selectedDate;
        payload.floor_number = selectedFloor;
        const res = await api.tables.create(payload);
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo crear mesa" });
          return;
        }
        tableId = Number((res.table as any)?.id || (res.item as any)?.id || 0);
        const created = ((res.table || res.item) as TableMapItem | undefined) || null;
        if (created) {
          setAreas((prev) => {
            const next = prev.map((area) => ({ ...area, tables: [...(area.tables || [])] }));
            const target = next.find((area) => area.id === areaId);
            if (target) {
              target.tables.push(created);
            }
            return next;
          });
        }
      }

      if (draftTextureFile && tableId) {
        const uploadRes = await api.tables.uploadTextureImage(tableId, draftTextureFile);
        if (!uploadRes.success) {
          pushToast({ kind: "error", title: "Imagen", message: uploadRes.message || "No se pudo subir imagen" });
        }
      }

      pushToast({ kind: "success", title: editingTableId ? "Mesa actualizada" : "Mesa creada" });
      setEditorOpen(false);
    } finally {
      setSaving(false);
    }
  }, [api.tables, draft, draftTextureFile, editingTableId, ensureAreaForFloor, pushToast, selectedDate, selectedFloor, visibleTables.length]);

  const onPickPreset = useCallback((presetId: string) => {
    const preset = COLOR_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setDraft((prev) => ({ ...prev, stylePreset: preset.id, fillColor: preset.fill, outlineColor: preset.outline }));
  }, []);

  const onTextureInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!isValidImageFile(file)) {
        pushToast({ kind: "error", title: "Imagen", message: "Formato no válido" });
        return;
      }
      try {
        const compressed = await compressImageToWebP(file, 150);
        const webpFile = toFileFromDataURL(compressed, `${(draft.name || "table").replace(/\s+/g, "-")}.webp`);
        setDraftTextureFile(webpFile);
        setDraft((prev) => ({ ...prev, texturePreview: compressed }));
      } catch {
        pushToast({ kind: "error", title: "Imagen", message: "No se pudo procesar imagen" });
      }
    },
    [draft.name, pushToast],
  );

  const onBack = useCallback(() => {
    if (typeof window === "undefined") return;
    window.location.assign(`/app/reservas?date=${encodeURIComponent(selectedDate)}`);
  }, [selectedDate]);

  const onSelectDate = useCallback(
    (nextDate: string) => {
      setSelectedDate(nextDate);
      const nextView = normalizeDateView(nextDate);
      if (nextView.year !== calendarView.year || nextView.month !== calendarView.month) {
        setCalendarView(nextView);
      }
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("date", nextDate);
        window.history.replaceState(null, "", url.toString());
      }
    },
    [calendarView.month, calendarView.year],
  );

  const onPrevMonth = useCallback(() => {
    setCalendarView((prev) => (prev.month === 1 ? { year: prev.year - 1, month: 12 } : { year: prev.year, month: prev.month - 1 }));
  }, []);

  const onNextMonth = useCallback(() => {
    setCalendarView((prev) => (prev.month === 12 ? { year: prev.year + 1, month: 1 } : { year: prev.year, month: prev.month + 1 }));
  }, []);

  const markBookingSeated = useCallback(
    (booking: Booking, seated: boolean) => {
      const next = { ...bookingStatesRef.current, [String(booking.id)]: { seated } };
      bookingStatesRef.current = next;
      setBookingStates(next);
      queuePersistLayout(drawElementsRef.current, next);
    },
    [queuePersistLayout],
  );

  const addDrawElement = useCallback(
    (kind: DrawElementKind, preset: DrawElementPreset) => {
      const current = drawElementsRef.current;
      const next = makeDrawElement(kind, preset, { x: 180 + current.length * 24, y: 180 + current.length * 24 }, current.length + 1);
      const updated = [...current, next];
      drawElementsRef.current = updated;
      setDrawElements(updated);
      queuePersistLayout(updated, bookingStatesRef.current);
      setMapMode("draw");
      setMenuVisible(false);
    },
    [queuePersistLayout],
  );

  const reservasTabItems = useMemo<TabItem[]>(
    () => [
      { id: "reservas", label: "Reservas", href: "#reservas", icon: <CalendarDays className="bo-ico" /> },
      { id: "mesas", label: "Mesas", href: "#mesas", icon: <Square className="bo-ico" /> },
    ],
    [],
  );

  const tableOccupancyMap = useMemo(() => {
    const out = new Map<string, { booked: number; seated: number }>();
    for (const booking of bookings) {
      const key = String(booking.table_number || "").trim();
      if (!key) continue;
      const row = out.get(key) || { booked: 0, seated: 0 };
      row.booked += Number(booking.party_size || 0);
      if (bookingStates[String(booking.id)]?.seated) row.seated += Number(booking.party_size || 0);
      out.set(key, row);
    }
    return out;
  }, [bookingStates, bookings]);

  const cancelBooking = useCallback(
    async (booking: Booking) => {
      const res = await api.reservas.cancel(booking.id);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cancelar" });
        return;
      }
      setBookings((prev) => prev.filter((row) => row.id !== booking.id));
      pushToast({ kind: "success", title: "Reserva cancelada" });
    },
    [api.reservas, pushToast],
  );

  const setBookingTable = useCallback(
    async (booking: Booking, tableNumber: string) => {
      const res = await api.reservas.patch(booking.id, { table_number: tableNumber });
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo editar reserva" });
        return;
      }
      setBookings((prev) => prev.map((row) => (row.id === booking.id ? { ...row, table_number: tableNumber } : row)));
      pushToast({ kind: "success", title: "Reserva actualizada" });
    },
    [api.reservas, pushToast],
  );

  useEffect(() => {
    if (!menuVisible) return;
    const updateMenuPosition = () => {
      const wrap = flowWrapRef.current;
      const btn = menuButtonRef.current;
      if (!wrap || !btn) return;
      const wrapRect = wrap.getBoundingClientRect();
      const btnRect = btn.getBoundingClientRect();
      const centerX = wrapRect.left + wrapRect.width / 2;
      const top = btnRect.bottom + 10;
      setMenuTooltipStyle({
        left: `${centerX}px`,
        top: `${top}px`,
      });
    };
    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [menuVisible, rightSheetOpen]);

  const onToggleMenu = useCallback(() => {
    setMenuVisible((prev) => {
      const next = !prev;
      if (next) setRightSheetOpen(false);
      return next;
    });
  }, []);

  const onToggleDrawMode = useCallback(() => {
    setMapMode((prev) => (prev === "draw" ? "tables" : "draw"));
    setMenuVisible(false);
  }, []);

  if (loading) {
    return <div className="bo-tableMapLoading">Cargando mapa...</div>;
  }

  return (
    <section className="bo-tableMapPage" aria-label="Mapa de mesas">
      <div className="bo-tableMapTopControls">
        <button className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={onBack} aria-label="Volver a reservas">
          <ChevronLeft size={18} strokeWidth={1.8} />
        </button>

        <div className="bo-tableMapTopCenter">
          <button
            ref={menuButtonRef}
            className="bo-actionBtn bo-actionBtn--glass"
            type="button"
            aria-label="Abrir menú de mapa"
            aria-expanded={menuVisible}
            onClick={onToggleMenu}
          >
            <Ellipsis size={18} strokeWidth={1.8} />
          </button>

          <AnimatePresence>
            {menuVisible ? (
              <motion.div
                className="bo-tableMapTooltip"
                role="menu"
                aria-label="Opciones del mapa"
                style={menuTooltipStyle}
                initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeInOut" }}
              >
              <div className="bo-tableMapTooltipHead">
                <div className="bo-tableMapTooltipTitle">Mapa de mesas</div>
                <div className="bo-tableMapTooltipSub">Acciones rapidas</div>
              </div>

              <div className="bo-tableMapTooltipActions" role="group" aria-label="Acciones de mapa">
                <button className="bo-menuItem" type="button" onClick={openAddModal} role="menuitem">
                <span className="bo-menuIcon" aria-hidden="true">
                  <Plus size={16} strokeWidth={1.8} />
                </span>
                <span className="bo-menuLabel">Añadir mesa</span>
              </button>

              <button className="bo-menuItem" type="button" onClick={onToggleDrawMode} role="menuitem">
                <span className="bo-menuIcon" aria-hidden="true">
                  <Square size={16} strokeWidth={1.8} />
                </span>
                <span className="bo-menuLabel">{mapMode === "draw" ? "Salir de dibujo" : "Dibujar"}</span>
              </button>
              </div>

              <div className="bo-tableMapTooltipStats" aria-label="Resumen del día">
                <div>
                  Personas / Límite: <strong>{occupancy.totalPeople} / {occupancy.limit || "-"}</strong>
                </div>
                <div>
                  Ocupación: <strong>{occupancy.percent}%</strong>
                </div>
              </div>

              {floorTabs.length > 1 ? (
                <div className="bo-tableMapFloorTabs" role="tablist" aria-label="Seleccionar planta">
                  {floorTabs.map((f) => {
                    const active = f.floorNumber === selectedFloor;
                    return (
                      <button
                        key={f.floorNumber}
                        type="button"
                        className={`bo-tableMapFloorTab${active ? " is-active" : ""}`}
                        role="tab"
                        aria-selected={active}
                        onClick={() => setSelectedFloor(f.floorNumber)}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        <button
          className="bo-actionBtn bo-actionBtn--glass"
          type="button"
          aria-label="Abrir panel derecho"
          aria-expanded={rightSheetOpen}
          onClick={() => setRightSheetOpen((v) => !v)}
        >
          {rightSheetOpen ? <PanelRightClose size={18} strokeWidth={1.8} /> : <PanelRightOpen size={18} strokeWidth={1.8} />}
        </button>
      </div>

      <div ref={flowWrapRef} className="bo-tableMapFlowWrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
          nodeExtent={MAP_EXTENT}
          nodesDraggable={interactionMode === "select"}
          panOnDrag={interactionMode === "pan"}
          selectionOnDrag={interactionMode === "select"}
          className="bo-tableMapFlow"
        >
          <Background gap={20} />
          <Controls>
            <ControlButton
              onClick={() => setInteractionMode("select")}
              className={interactionMode === "select" ? "is-active" : ""}
              title="Seleccionar (cursor)"
              aria-label="Seleccionar (cursor)"
            >
              <MousePointer2 size={14} strokeWidth={1.9} />
            </ControlButton>
            <ControlButton
              onClick={() => setInteractionMode("pan")}
              className={interactionMode === "pan" ? "is-active" : ""}
              title="Mover lienzo (mano)"
              aria-label="Mover lienzo (mano)"
            >
              <Hand size={14} strokeWidth={1.9} />
            </ControlButton>
          </Controls>
        </ReactFlow>
      </div>

      <aside className={`bo-tableMapDrawPanel${mapMode === "draw" ? " is-open" : ""}`} aria-label="Panel de dibujo">
        <div className="bo-tableMapDrawPanelHead">
          <div className="bo-panelTitle">Dibujo</div>
          <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setMapMode("tables")}>Cerrar</button>
        </div>
        <div className="bo-tableMapDrawPanelBody">
          <div className="bo-tableMapDrawHint">En modo dibujo puedes crear y editar muros/obstaculos. Las mesas quedan bloqueadas por estos limites.</div>
          <div className="bo-tableMapDrawTools" aria-label="Herramientas de dibujo">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => addDrawElement("wall", "wall")}>Muro</button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => addDrawElement("obstacle", "plant")}>Planta</button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => addDrawElement("image", "door")}>Puerta</button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => addDrawElement("image", "arch_door")}>Puerta arco</button>
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => addDrawElement("image", "sofa")}>Sofa</button>
          </div>
        </div>
      </aside>

      <aside className={`bo-tableMapSheet${rightSheetOpen ? " is-open" : ""}`} aria-label="Panel de mesas">
        <div className="bo-tableMapSheetHead">
          <div className="bo-panelTitle">Booking manager</div>
          <div className="bo-panelMeta">{selectedDate} · {visibleTables.length} mesas</div>
        </div>
        <div className="bo-tableMapSheetBody">
          <button className="bo-btn bo-btn--ghost bo-tableMapCalendarToggle" type="button" onClick={() => setCalendarExpanded((v) => !v)} aria-expanded={calendarExpanded}>
            {calendarExpanded ? "Ocultar calendario" : "Cambiar fecha"}
          </button>
          {calendarExpanded ? (
            <MonthCalendar
              year={calendarView.year}
              month={calendarView.month}
              days={calendarDays}
              selectedDateISO={selectedDate}
              onSelectDate={onSelectDate}
              onPrevMonth={onPrevMonth}
              onNextMonth={onNextMonth}
              loading={loading}
            />
          ) : null}

          <div className="bo-tableMapFloorTabs" role="tablist" aria-label="Seleccionar salon/planta">
            {floorTabs.map((floor) => {
              const active = floor.floorNumber === selectedFloor;
              return (
                <button
                  key={`sheet-floor-${floor.floorNumber}`}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`bo-tableMapFloorTab${active ? " is-active" : ""}`}
                  onClick={() => setSelectedFloor(floor.floorNumber)}
                >
                  {floor.label}
                </button>
              );
            })}
          </div>

          <Tabs
            tabs={reservasTabItems}
            activeId={sheetTab}
            ariaLabel="Reservas o mesas"
            className="bo-tabs--reservas bo-tabs--compact"
            onNavigate={(href, id, ev) => {
              ev.preventDefault();
              setSheetTab(id === "mesas" ? "mesas" : "reservas");
            }}
          />

          {sheetTab === "reservas" ? (
            <div className="bo-tableMapBookingsList">
              {bookings.map((booking) => {
                const seated = bookingStates[String(booking.id)]?.seated;
                return (
                  <button key={booking.id} className={`bo-tableMapBookingRow${seated ? " is-seated" : " is-pending"}`} type="button" onClick={() => setSelectedBooking(booking)}>
                    <div className="bo-tableMapBookingMain">
                      <strong>{booking.table_number || "—"}</strong>
                      <span>{booking.customer_name}</span>
                    </div>
                    <div className="bo-tableMapBookingMeta">
                      <span>{booking.party_size} pax · {formatHHMM(booking.reservation_time)}</span>
                      <DropdownMenu
                        label="Acciones reserva"
                        triggerClassName="bo-actionBtn bo-actionBtn--glass"
                        items={[
                          { id: "details", label: "Reserva completa", icon: <FileText size={16} strokeWidth={1.8} />, onSelect: () => setSelectedBooking(booking) },
                          { id: "edit", label: "Editar reserva", icon: <Pencil size={16} strokeWidth={1.8} />, onSelect: () => setSelectedBooking(booking) },
                          { id: "cancel", label: "Cancelar", tone: "danger", icon: <Trash2 size={16} strokeWidth={1.8} />, onSelect: () => void cancelBooking(booking) },
                        ]}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="bo-tableMapTablesState">
              <div className="bo-tableMapLegend">Libre · Reservada · Reservada + sentada</div>
              {visibleTables.map((table) => {
                const key = String(table.name || table.id).replace(/^Mesa\s+/i, "");
                const occ = tableOccupancyMap.get(key);
                const cls = occ ? (occ.seated > 0 ? "is-seated" : "is-booked") : "is-free";
                return (
                  <div key={`table-state-${table.id}`} className={`bo-tableMapTableStateRow ${cls}`}>
                    <strong>{table.name}</strong>
                    <span>{table.capacity} pax</span>
                    <span>{occ ? `${occ.booked} ocup.` : "Libre"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      <Modal open={editorOpen} title={editingTableId ? "Editar mesa" : "Nueva mesa"} onClose={() => setEditorOpen(false)} widthPx={980} className="bo-tableEditorModal">
        <div className="bo-modalHead">
          <div className="bo-modalTitle">{editingTableId ? "Editar mesa" : "Nueva mesa"}</div>
          <button className="bo-modalX" type="button" onClick={() => setEditorOpen(false)} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>

        <div className="bo-tableEditorGrid">
          <div className="bo-tableEditorPreviewWrap">
            <div className="bo-tableEditorRotate" role="group" aria-label="Giro de mesa">
              <button
                type="button"
                className="bo-actionBtn bo-actionBtn--glass bo-tableEditorRotateBtn"
                onClick={() => setDraft((prev) => ({ ...prev, rotationDeg: Math.max(-180, prev.rotationDeg - 22.5) }))}
                aria-label="Girar 22,5 grados a la izquierda"
              >
                <RotateCcw size={16} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                className="bo-actionBtn bo-actionBtn--glass bo-tableEditorRotateBtn"
                onClick={() => setDraft((prev) => ({ ...prev, rotationDeg: Math.min(180, prev.rotationDeg + 22.5) }))}
                aria-label="Girar 22,5 grados a la derecha"
              >
                <RotateCw size={16} strokeWidth={1.9} />
              </button>
            </div>
            <div className={`bo-tableEditorPreviewTable is-${draft.shape}`} style={{
              ["--bo-table-fill" as any]: draft.fillColor,
              ["--bo-table-outline" as any]: draft.outlineColor,
              ["--bo-table-texture" as any]: draft.texturePreview ? `url(${draft.texturePreview})` : "none",
              width: `${geom.width}px`,
              height: `${geom.height}px`,
              transform: `rotate(${draft.rotationDeg}deg)`,
            }}>
              <span className="bo-tableEditorCapacity">{clampCapacity(draft.capacity)}</span>
              {isRectangularPreview
                ? ([
                    { side: "left" as const, canAdd: canAddLeftShortSide, x: -(geom.width / 2 + RECT_SEAT_OFFSET) },
                    { side: "right" as const, canAdd: canAddRightShortSide, x: geom.width / 2 + RECT_SEAT_OFFSET },
                  ] as const).map((slot) => {
                    if (!slot.canAdd) return null;
                    const armed = shortSideHover === slot.side;
                    const label = slot.side === "left" ? "Anadir silla en lado corto izquierdo" : "Anadir silla en lado corto derecho";
                    return (
                      <button
                        key={`add-short-${slot.side}`}
                        type="button"
                        className={`bo-tableEditorSideAction bo-tableEditorSideAction--add${armed ? " is-armed" : ""}`}
                        style={{ transform: `translate(${slot.x}px, 0px)` }}
                        onMouseEnter={() => armShortSide(slot.side)}
                        onMouseLeave={() => disarmShortSide(slot.side)}
                        onFocus={() => armShortSide(slot.side)}
                        onBlur={() => disarmShortSide(slot.side)}
                        onClick={() => onAddShortSide(slot.side)}
                        aria-label={label}
                      >
                        <Plus size={11} strokeWidth={2.2} />
                      </button>
                    );
                  })
                : null}
              {geom.chairs.map((chair, idx) => {
                const shortSide: RectShortSide | null =
                  chair.side === "left" || chair.side === "right" ? chair.side : null;
                if (isRectangularPreview && shortSide) {
                  return (
                    <button
                      key={`chair-${shortSide}-${idx}`}
                      type="button"
                      className={`bo-tableEditorChair bo-tableEditorChair--short${shortSideHover === shortSide ? " is-armed" : ""}`}
                      style={{ transform: `translate(${chair.x}px, ${chair.y}px)` }}
                      onMouseEnter={() => armShortSide(shortSide)}
                      onMouseLeave={() => disarmShortSide(shortSide)}
                      onFocus={() => armShortSide(shortSide)}
                      onBlur={() => disarmShortSide(shortSide)}
                      onClick={() => onRemoveShortSide(shortSide)}
                      aria-label={
                        shortSide === "left"
                          ? "Quitar silla del lado corto izquierdo"
                          : "Quitar silla del lado corto derecho"
                      }
                    >
                      <span className="bo-tableEditorChairAction" aria-hidden="true">
                        <X size={10} strokeWidth={2.3} />
                      </span>
                    </button>
                  );
                }
                return (
                  <span
                    key={idx}
                    className="bo-tableEditorChair"
                    style={{ transform: `translate(${chair.x}px, ${chair.y}px)` }}
                  />
                );
              })}
            </div>
          </div>

          <div className="bo-tableEditorConfig">
            <div className="bo-field">
              <label className="bo-label" htmlFor="table-name">Nombre/numero</label>
              <input
                id="table-name"
                className="bo-input"
                value={draft.name}
                onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="bo-field">
              <label className="bo-label">Forma</label>
              <div className="bo-tableEditorShapeBtns">
                <button type="button" className={`bo-btn bo-btn--ghost${draft.shape === "round" ? " is-active" : ""}`} onClick={() => setDraft((prev) => ({ ...prev, shape: "round" }))}>
                  Redonda
                </button>
                <button type="button" className={`bo-btn bo-btn--ghost${draft.shape === "square" ? " is-active" : ""}`} onClick={() => setDraft((prev) => ({ ...prev, shape: "square" }))}>
                  Cuadrada
                </button>
              </div>
            </div>

            <div className="bo-field">
              <label className="bo-label">Colores</label>
              <div className="bo-tableEditorPresetGrid">
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`bo-tableColorPreset${draft.stylePreset === preset.id ? " is-active" : ""}`}
                    onClick={() => onPickPreset(preset.id)}
                    aria-label={`Preset ${preset.id}`}
                    style={{ ["--bo-preset-fill" as any]: preset.fill, ["--bo-preset-outline" as any]: preset.outline }}
                  />
                ))}
              </div>
            </div>

            <div className="bo-field">
              <label className="bo-label">Subir textura</label>
              <label className="bo-btn bo-btn--ghost bo-tableUploadBtn">
                <ImagePlus size={16} strokeWidth={1.8} />
                <span>Subir imagen</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onTextureInput} hidden />
              </label>
            </div>

            <PlusMinusCounter
              label="Capacidad maxima"
              value={clampCapacity(draft.capacity)}
              onDecrease={() => setDraftCapacity(draft.capacity - 1)}
              onIncrease={() => setDraftCapacity(draft.capacity + 1)}
              canDecrease={draft.capacity > 2}
              canIncrease={draft.capacity < 16}
            />
          </div>
        </div>

        <div className="bo-modalActions">
          <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setEditorOpen(false)} disabled={saving}>
            Cancelar
          </button>
          <button className="bo-btn bo-btn--primary" type="button" onClick={() => void saveDraft()} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </Modal>

      <Modal open={Boolean(selectedBooking)} title="Reserva" onClose={() => setSelectedBooking(null)} widthPx={760} className="bo-tableBookingModal">
        {selectedBooking ? (
          <div className="bo-stack" style={{ gap: 12 }}>
            <div className="bo-tableMapBookingModalHero">
              <div className="bo-tableMapBookingTableNumber">Mesa {selectedBooking.table_number || "—"}</div>
              <div className="bo-tableMapBookingHeroMeta">{selectedBooking.customer_name} · {selectedBooking.party_size} pax · {formatHHMM(selectedBooking.reservation_time)}</div>
            </div>
            <div className="bo-kvGrid">
              <div className="bo-kv">
                <div className="bo-kvLabel">Nombre</div>
                <div className="bo-kvValue">{selectedBooking.customer_name}</div>
              </div>
              <div className="bo-kv">
                <div className="bo-kvLabel">Hora</div>
                <div className="bo-kvValue">{formatHHMM(selectedBooking.reservation_time)}</div>
              </div>
              <div className="bo-kv">
                <div className="bo-kvLabel">Comensales</div>
                <div className="bo-kvValue">{selectedBooking.party_size}</div>
              </div>
              <div className="bo-kv bo-kv--wide">
                <div className="bo-kvLabel">Comentario</div>
                <div className="bo-kvValue bo-kvValue--wrap">{selectedBooking.commentary || "—"}</div>
              </div>
            </div>
            <div className="bo-field">
              <label className="bo-label" htmlFor="booking-table-edit">Mesa</label>
              <input id="booking-table-edit" className="bo-input" value={bookingTableDraft} onChange={(e) => setBookingTableDraft(e.target.value)} />
            </div>
            <div className="bo-modalActions">
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setSelectedBooking(null)}>Cerrar</button>
              <button
                className="bo-btn bo-btn--ghost"
                type="button"
                onClick={() => markBookingSeated(selectedBooking, !bookingStates[String(selectedBooking.id)]?.seated)}
              >
                {bookingStates[String(selectedBooking.id)]?.seated ? "Marcar no sentada" : "Marcar sentada"}
              </button>
              <button
                className="bo-btn bo-btn--primary"
                type="button"
                onClick={() => void setBookingTable(selectedBooking, bookingTableDraft.trim())}
              >
                Guardar reserva
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
