import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  ControlButton,
  Controls,
  type Node,
  type NodeChange,
  NodeResizer,
  ReactFlowProvider,
  applyNodeChanges,
  type XYPosition,
  useEdgesState,
  useNodesState,
} from "reactflow";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarDays, ChevronLeft, DoorOpen, Ellipsis, FileText, GripVertical, Hand, ImagePlus, Leaf, MousePointer2, PanelRightClose, PanelRightOpen, Pencil, Plus, RotateCcw, RotateCw, Sofa, Square, SquareMinus, Trash2, Undo, X, Circle, CalendarRange, Users, LayoutGrid, MapPin } from "lucide-react";
import "reactflow/dist/style.css";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { Booking, CalendarDay, ConfigDailyLimit, ConfigDayStatus, ConfigFloor, DashboardMetrics, TableMapArea, TableMapItem } from "../../../../api/types";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { formatHHMM } from "../../../../ui/lib/format";
import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";
import { Modal } from "../../../../ui/overlays/Modal";
import { MonthCalendar } from "../../../../ui/widgets/MonthCalendar";
import { PlusMinusCounter } from "../../../../ui/widgets/PlusMinusCounter";
import { ReservationDayPanel } from "../../../../ui/widgets/ReservationDayPanel";
import { compressImageToWebP, isValidImageFile } from "../../../../lib/imageCompressor";
import {
  drawElementSizeForPreset,
  drawPresetAssetImageUrl,
  drawPresetKind,
  drawPresetLabel,
  normalizeDrawElementDisplayMode,
  normalizeDrawElementKind,
  normalizeDrawElementPreset,
  type DrawElementDisplayMode,
  type DrawElementKind,
  type DrawElementPreset,
} from "./drawPresets";
import { projectFlowPointToOverlay, type FlowViewportTransform, type LinePoint } from "./lineDrawing";
import {
  findNearestRectInsideLimitArea,
  hasClosedLimitArea,
  isRectInsideLimitArea,
  normalizeLimitPoints,
  type RectSize,
} from "./mapLimits";
import { areaMetadata, floorNumberForArea, limitAreaTemplatePointsForFloor, normalizeTableArea } from "./areaLayout";

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
  assignMode?: boolean;
  isSelected?: boolean;
};

type DrawElement = {
  id: string;
  kind: DrawElementKind;
  preset: DrawElementPreset;
  displayMode: DrawElementDisplayMode;
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
  displayMode: DrawElementDisplayMode;
  isSelected?: boolean;
  label: string;
  width: number;
  height: number;
  rotationDeg: number;
  editable: boolean;
};

type LineDrawingState = {
  points: LinePoint[];
  isDrawing: boolean;
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
const DRAW_ROTATE_STEP = 10;
const DEFAULT_TABLE_MAP_FIT_VIEW_OPTIONS = {
  padding: 0.5,
  maxZoom: 0.45,
};

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
    ["--bo-table-outline" as any]: data.outlineColor || "var(--border-2)",
    ["--bo-table-texture" as any]: data.textureImageUrl ? `url(${data.textureImageUrl})` : "none",
    transform: `rotate(${Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0}deg)`,
    width: `${geom.width}px`,
    height: `${geom.height}px`,
  };
  return (
    <div 
      className={`bo-tableMapNode ${shape}${data.assignMode ? " is-assign-mode" : ""}${data.isSelected ? " is-selected" : ""}`} 
      style={style}
    >
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

const DRAW_PRESET_ICON: Record<DrawElementPreset, React.JSX.Element> = {
  wall: <Square size={15} strokeWidth={1.8} />,
  wall_corner: <Square size={15} strokeWidth={1.8} />,
  wall_window: <Square size={15} strokeWidth={1.8} />,
  plant: <Leaf size={15} strokeWidth={1.8} />,
  plant_tall: <Leaf size={15} strokeWidth={1.8} />,
  chair: <Users size={15} strokeWidth={1.8} />,
  bench: <Sofa size={15} strokeWidth={1.8} />,
  column: <GripVertical size={15} strokeWidth={1.8} />,
  lamp: <Circle size={15} strokeWidth={1.8} />,
  trashcan: <Trash2 size={15} strokeWidth={1.8} />,
  door: <DoorOpen size={15} strokeWidth={1.8} />,
  door_wide: <DoorOpen size={15} strokeWidth={1.8} />,
  arch_door: <DoorOpen size={15} strokeWidth={1.8} />,
  sofa: <Sofa size={15} strokeWidth={1.8} />,
};

const DRAW_PANEL_GROUPS: Array<{ id: string; title: string; presets: DrawElementPreset[] }> = [
  { id: "structure", title: "Estructura", presets: ["wall", "wall_corner", "wall_window", "column"] },
  { id: "obstacles", title: "Obstáculos", presets: ["plant", "plant_tall", "lamp", "chair", "bench", "trashcan"] },
  { id: "openings", title: "Aberturas y muebles", presets: ["door", "door_wide", "arch_door", "sofa"] },
];

const DrawElementNode = ({ data }: { data: DrawNodeData }) => {
  const assetImageUrl = drawPresetAssetImageUrl(data.preset);
  const showAsset = data.displayMode === "asset" || data.displayMode === "both";
  const showText = data.displayMode === "text" || data.displayMode === "both";
  const style: React.CSSProperties = {
    width: `${data.width}px`,
    height: `${data.height}px`,
    transform: `rotate(${data.rotationDeg}deg)`,
  };
  const cls = data.kind === "wall" ? "is-wall" : data.kind === "image" ? "is-image" : "is-obstacle";
  return (
    <div className={`bo-drawElementNode ${cls}${data.isSelected ? " is-selected" : ""}${assetImageUrl && showAsset ? " has-asset" : ""}${showText ? " has-text" : " no-text"}`} style={style}>
      <NodeResizer
        isVisible={data.editable}
        minWidth={24}
        minHeight={24}
        lineStyle={{ borderColor: "var(--bo-accent)" }}
        handleStyle={{ width: 10, height: 10, border: "1px solid var(--bo-accent)", background: "var(--bo-surface)" }}
      />
      {showAsset ? (
        assetImageUrl ? (
          <img className="bo-drawElementNodeAsset" src={assetImageUrl} alt="" aria-hidden="true" />
        ) : (
          <span className="bo-drawElementNodeIcon" aria-hidden="true">{DRAW_PRESET_ICON[data.preset]}</span>
        )
      ) : null}
      {showText ? <span className="bo-drawElementNodeLabel">{data.label}</span> : null}
    </div>
  );
};

const NODE_TYPES = {
  restaurantTable: TableNode,
  drawElement: DrawElementNode,
};

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

function drawElementSize(preset: DrawElementPreset): RectSize {
  return drawElementSizeForPreset(preset);
}

function makeDrawElement(kind: DrawElementKind, preset: DrawElementPreset, base: XYPosition, index: number): DrawElement {
  const id = `draw-${kind}-${Date.now()}-${index}`;
  const dims = drawElementSize(preset);
  return {
    id,
    kind,
    preset,
    displayMode: "both",
    x: base.x,
    y: base.y,
    width: dims.width,
    height: dims.height,
    rotationDeg: 0,
    label: drawPresetLabel(preset),
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

function cloneLinePoints(points: LinePoint[]): LinePoint[] {
  return points.map((point) => ({ x: point.x, y: point.y }));
}

function interpolatePosition(a: XYPosition, b: XYPosition, t: number): XYPosition {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function clampRectMoveToLimit(
  from: XYPosition,
  to: XYPosition,
  size: RectSize,
  polygon: LinePoint[],
): XYPosition {
  const toRectInside = isRectInsideLimitArea({ x: to.x, y: to.y, width: size.width, height: size.height }, polygon);
  if (toRectInside) return to;

  const fromRectInside = isRectInsideLimitArea({ x: from.x, y: from.y, width: size.width, height: size.height }, polygon);
  if (!fromRectInside) {
    return findNearestRectInsideLimitArea(to, size, polygon) || findNearestRectInsideLimitArea(from, size, polygon) || from;
  }

  let low = 0;
  let high = 1;
  for (let i = 0; i < 14; i += 1) {
    const mid = (low + high) / 2;
    const point = interpolatePosition(from, to, mid);
    const inside = isRectInsideLimitArea({ x: point.x, y: point.y, width: size.width, height: size.height }, polygon);
    if (inside) {
      low = mid;
    } else {
      high = mid;
    }
  }
  const candidate = interpolatePosition(from, to, low);
  if (isRectInsideLimitArea({ x: candidate.x, y: candidate.y, width: size.width, height: size.height }, polygon)) {
    return candidate;
  }
  return findNearestRectInsideLimitArea(candidate, size, polygon) || findNearestRectInsideLimitArea(from, size, polygon) || from;
}

function rotatedRectFrameFromPosition(
  position: XYPosition,
  width: number,
  height: number,
  rotationDeg: number,
  padding: number,
): { x: number; y: number; width: number; height: number } {
  const paddedWidth = width + padding * 2;
  const paddedHeight = height + padding * 2;
  const rad = (rotationDeg * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(rad));
  const absSin = Math.abs(Math.sin(rad));
  const bboxWidth = paddedWidth * absCos + paddedHeight * absSin;
  const bboxHeight = paddedWidth * absSin + paddedHeight * absCos;

  const centerX = position.x + width / 2;
  const centerY = position.y + height / 2;

  return {
    x: centerX - bboxWidth / 2,
    y: centerY - bboxHeight / 2,
    width: bboxWidth,
    height: bboxHeight,
  };
}

function positionFromRectFrame(
  frame: { x: number; y: number; width: number; height: number },
  width: number,
  height: number,
): XYPosition {
  const centerX = frame.x + frame.width / 2;
  const centerY = frame.y + frame.height / 2;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
  };
}

const TABLE_LIMIT_PADDING = 40;

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
  const [day, setDay] = useState<ConfigDayStatus | null>(null);
  const [dailyLimit, setDailyLimit] = useState<ConfigDailyLimit | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingStates, setBookingStates] = useState<Record<string, BookingState>>({});
  const [drawElements, setDrawElements] = useState<DrawElement[]>([]);
  const [sheetTab, setSheetTab] = useState<"reservas" | "mesas">("reservas");
  const [mapMode, setMapMode] = useState<"tables" | "draw">("tables");
  const [lineDrawing, setLineDrawing] = useState<LineDrawingState>({ points: [], isDrawing: false });
  const [isEditingLimitArea, setIsEditingLimitArea] = useState(false);
  const [draggingLimitVertexIndex, setDraggingLimitVertexIndex] = useState<number | null>(null);
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">("pan");
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingForAssignment, setBookingForAssignment] = useState<Booking | null>(null);
  const [assignMode, setAssignMode] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedDrawElementId, setSelectedDrawElementId] = useState<string | null>(null);
  const [bookingTableDraft, setBookingTableDraft] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTooltipStyle, setMenuTooltipStyle] = useState<React.CSSProperties>({});
  const [drawPanelHover, setDrawPanelHover] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dayBusy, setDayBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [savingLimitTemplate, setSavingLimitTemplate] = useState(false);

  // Toggle body class for drag state
  useEffect(() => {
    if (isDragging) {
      document.body.classList.add("is-dragging");
    } else {
      document.body.classList.remove("is-dragging");
    }
    return () => {
      document.body.classList.remove("is-dragging");
    };
  }, [isDragging]);

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
  const isDayOpen = day?.isOpen !== false;
  const dayVisibilityTransition = reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" as const };

  const ws = useRef<WebSocket | null>(null);
  const drawElementsRef = useRef<DrawElement[]>([]);
  const lineDrawingPointsRef = useRef<LinePoint[]>([]);
  const limitEditHistoryRef = useRef<LinePoint[][]>([]);
  const bookingStatesRef = useRef<Record<string, BookingState>>({});
  const persistLayoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawPanelHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const assignmentInProgress = useRef(false);
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
    if (!selectedDrawElementId) return;
    if (drawElements.some((item) => item.id === selectedDrawElementId)) return;
    setSelectedDrawElementId(null);
  }, [drawElements, selectedDrawElementId]);

  useEffect(() => {
    bookingStatesRef.current = bookingStates;
  }, [bookingStates]);

  useEffect(() => {
    lineDrawingPointsRef.current = lineDrawing.points;
  }, [lineDrawing.points]);

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
  const selectedFloorTemplatePoints = useMemo(
    () => limitAreaTemplatePointsForFloor(areas, selectedFloor),
    [areas, selectedFloor],
  );

  const bookingStats = useMemo(() => {
    const total = bookings.length;
    let seated = 0;
    let pending = 0;
    for (const b of bookings) {
      if (bookingStates[String(b.id)]?.seated) {
        seated++;
      } else {
        pending++;
      }
    }
    return { total, seated, pending };
  }, [bookings, bookingStates]);

  const hasUnassignedBookings = useMemo(() => bookings.some(b => !b.table_number), [bookings]);

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
      const [tablesRes, floorsRes, limitRes, metricsRes, monthRes, bookingsRes, dayRes] = await Promise.all([
        api.tables.list({ date: selectedDate, floor_number: Number.isFinite(selectedFloor) ? selectedFloor : 0 }),
        api.config.getFloors(selectedDate),
        api.config.getDailyLimit(selectedDate),
        api.dashboard.getMetrics(selectedDate),
        api.calendar.getMonth({ year: calendarView.year, month: calendarView.month }),
        api.reservas.exportDay(selectedDate),
        api.config.getDay(selectedDate),
      ]);

      let loadedAreas: TableMapArea[] = [];
      if (!tablesRes.success) {
        setError(tablesRes.message || "Error cargando mesas");
      } else {
        loadedAreas = (tablesRes.areas || tablesRes.data || []).map((a: any) => normalizeTableArea(a));
        setAreas(loadedAreas);
        const mapLayout = ((tablesRes.layout as any)?.map || (tablesRes.layout as any) || {}) as Record<string, unknown>;
        const loadedElements = Array.isArray(mapLayout.elements)
          ? (mapLayout.elements as any[])
              .map((item) => {
                const id = String(item?.id || "").trim();
                if (!id) return null;
                const kind = normalizeDrawElementKind(item?.kind);
                const preset = normalizeDrawElementPreset(item?.preset);
                const displayMode = normalizeDrawElementDisplayMode(item?.display_mode ?? item?.displayMode);
                const defaultSize = drawElementSizeForPreset(preset);
                return {
                  id,
                  kind,
                  preset,
                  displayMode,
                  x: Number(item?.x || 0),
                  y: Number(item?.y || 0),
                  width: Math.max(24, Number(item?.width || defaultSize.width)),
                  height: Math.max(24, Number(item?.height || defaultSize.height)),
                  rotationDeg: Number(item?.rotationDeg || 0),
                  label: String(item?.label || drawPresetLabel(preset)),
                } as DrawElement;
              })
              .filter(Boolean) as DrawElement[]
          : [];
        drawElementsRef.current = loadedElements;
        setDrawElements(loadedElements);

        const loadedLimitPoints = normalizeLimitPoints(mapLayout.limit_points);
        const templateLimitPoints = limitAreaTemplatePointsForFloor(loadedAreas, selectedFloor);
        const activeLimitPoints = hasClosedLimitArea(loadedLimitPoints) ? loadedLimitPoints : templateLimitPoints;
        lineDrawingPointsRef.current = activeLimitPoints;
        limitEditHistoryRef.current = [];
        setLineDrawing({ points: activeLimitPoints, isDrawing: false });

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
      if (dayRes.success) {
        setDay(dayRes);
      } else {
        setDay(null);
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
    if (day?.isOpen !== false) return;
    setMenuVisible(false);
    setDrawPanelHover(false);
    setRightSheetOpen(false);
    setCalendarExpanded(false);
    setAssignMode(false);
    setBookingForAssignment(null);
    setSelectedBooking(null);
    setSelectedBookingId(null);
    setSelectedTableId(null);
    setSelectedDrawElementId(null);
    setEditorOpen(false);
    setMapMode("tables");
  }, [day?.isOpen]);

  useEffect(() => {
    if (!floorTabs.length) return;
    const current = Number(selectedFloor);
    const exists = floorTabs.some((f) => f.floorNumber === current);
    if (exists) return;
    const nextFloor = floorTabs[0]?.floorNumber ?? 0;
    if (nextFloor === current) return;
    setSelectedFloor(nextFloor);
  }, [floorTabs, selectedFloor]);

  // Helper to normalize table key for consistent lookups
  const normalizeTableKey = (name: string | number | null | undefined): string => {
    return String(name || "").trim();
  };

  // Table occupancy map - must be declared before tablesByStatus
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

  // Get bookings for a specific table
  const getTableBookings = useCallback((tableName: string): Booking[] => {
    const key = normalizeTableKey(tableName);
    return bookings.filter(b => normalizeTableKey(b.table_number) === key);
  }, [bookings]);

  // Group tables by status
  const tablesByStatus = useMemo(() => {
    const free: typeof visibleTables = [];
    const booked: typeof visibleTables = [];
    const seated: typeof visibleTables = [];
    
    for (const table of visibleTables) {
      const key = normalizeTableKey(table.name);
      const occ = tableOccupancyMap.get(key);
      if ((occ?.seated ?? 0) > 0) {
        seated.push(table);
      } else if ((occ?.booked ?? 0) > 0) {
        booked.push(table);
      } else {
        free.push(table);
      }
    }
    return { free, booked, seated };
  }, [visibleTables, tableOccupancyMap]);

  // Summary counts
  const tableSummary = useMemo(() => ({
    total: visibleTables.length,
    free: tablesByStatus.free.length,
    booked: tablesByStatus.booked.length,
    seated: tablesByStatus.seated.length,
  }), [visibleTables.length, tablesByStatus]);

  useEffect(() => {
    setNodes(
      [
        ...visibleTables.map((table) => {
          const tableKey = normalizeTableKey(table.name);
          const occ = tableOccupancyMap.get(tableKey);
          const hasBookings = occ && occ.booked > 0;
          const hasSeated = occ && occ.seated > 0;
          // Override status based on bookings if there are any
          const nodeStatus = hasSeated ? "occupied" : hasBookings ? "reserved" : (table.status || "available");
          return {
            id: String(table.id),
            type: "restaurantTable",
            draggable: true,
            position: { x: table.x_pos || 0, y: table.y_pos || 0 },
            data: {
              id: table.id,
              name: table.name || `Mesa ${table.id}`,
              capacity: clampCapacity(table.capacity || 4),
              status: nodeStatus as TableMapItem["status"],
              shape: (table.shape || "round") as TableShape,
              fillColor: table.fill_color || "",
              outlineColor: table.outline_color || "",
              textureImageUrl: table.texture_image_url || "",
              rotationDeg: Number((table.metadata as any)?.rotation_deg || 0),
              rectShortSides: shortSidesFromMetadata((table.metadata as any)?.short_side_seats, table.capacity || 4),
              assignMode,
              isSelected: selectedTableId === table.id,
            } as TableNodeData,
          };
        }),
        ...drawElements.map((item) => ({
          id: item.id,
          type: "drawElement",
          draggable: mapMode === "draw",
          position: { x: item.x, y: item.y },
          data: {
            id: item.id,
            kind: item.kind,
            preset: item.preset,
            displayMode: item.displayMode,
            isSelected: selectedDrawElementId === item.id,
            label: item.label,
            width: item.width,
            height: item.height,
            rotationDeg: item.rotationDeg,
            editable: mapMode === "draw",
          } as DrawNodeData,
        })),
      ],
    );
  }, [assignMode, drawElements, mapMode, selectedDrawElementId, selectedTableId, setNodes, tableOccupancyMap, visibleTables]);

  useEffect(() => {
    const secure = typeof window !== "undefined" && window.location.protocol === "https:";
    const wsURL = `${secure ? "wss" : "ws"}://${window.location.host}/api/admin/tables/ws`;
    const socket = new WebSocket(wsURL);
    ws.current = socket;

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "snapshot" && Array.isArray(payload.areas)) {
          setAreas(payload.areas.map((a: any) => normalizeTableArea(a)));
          return;
        }
        if (payload.type === "table_created" || payload.type === "table_updated") {
          const table = payload.table as TableMapItem | undefined;
          if (!table?.id) return;
          setAreas((prev) => {
            const existingTable = prev.flatMap((area) => area.tables || []).find((entry) => entry.id === table.id);
            const mergedTable = existingTable
              ? ({ ...existingTable, ...table, x_pos: existingTable.x_pos, y_pos: existingTable.y_pos } as TableMapItem)
              : ({ ...table } as TableMapItem);
            const next = prev.map((area) => ({ ...area, tables: [...(area.tables || [])] }));
            for (const area of next) {
              area.tables = area.tables.filter((t) => t.id !== table.id);
            }
            const targetAreaID = Number(mergedTable.area_id || existingTable?.area_id || 0);
            const target = next.find((area) => area.id === targetAreaID);
            if (target) {
              target.tables.push(mergedTable);
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
      } catch (err) {
        console.error("Failed to save table position:", err);
        pushToast({ kind: "error", title: "Error", message: "No se pudo guardar la posición" });
      }
    },
    [api.tables, pushToast, selectedDate, selectedFloor],
  );

  const persistLayout = useCallback(
    async (patch: Record<string, unknown>) => {
      try {
        await api.tables.saveLayout({ date: selectedDate, floor_number: selectedFloor, metadata: patch });
      } catch (err) {
        console.error("Failed to save layout:", err);
        pushToast({ kind: "error", title: "Error", message: "No se pudo guardar el layout" });
      }
    },
    [api.tables, pushToast, selectedDate, selectedFloor],
  );

  const queuePersistLayout = useCallback(
    (elements: DrawElement[], states: Record<string, BookingState>, limitPoints: LinePoint[]) => {
      if (persistLayoutTimerRef.current) {
        clearTimeout(persistLayoutTimerRef.current);
      }
      // Debounce layout persistence to avoid network spam from drag/resize event bursts.
      persistLayoutTimerRef.current = setTimeout(() => {
        persistLayoutTimerRef.current = null;
        const layoutElements = elements.map((item) => ({
          ...item,
          display_mode: item.displayMode,
        }));
        void persistLayout({ elements: layoutElements, booking_states: states, limit_points: limitPoints });
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
      const activeLimitPoints = hasClosedLimitArea(lineDrawingPointsRef.current)
        ? lineDrawingPointsRef.current
        : null;
      let nextNodesSnapshot: Node<any>[] = [];

      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds) as Node<any>[];
        for (const c of changes as any[]) {
          if (c.type === "position") {
            const prevNode = nds.find((n) => n.id === c.id);
            const node = next.find((n) => n.id === c.id);
            if (!node || !prevNode || !node.position) continue;

            if (node.type === "restaurantTable") {
              const data = node.data as TableNodeData;
              const geom = previewGeometry(data.shape, data.capacity, data.rectShortSides);
              const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
              const fromFrame = rotatedRectFrameFromPosition(
                prevNode.position,
                geom.width,
                geom.height,
                rotationDeg,
                TABLE_LIMIT_PADDING,
              );
              const toFrame = rotatedRectFrameFromPosition(
                node.position,
                geom.width,
                geom.height,
                rotationDeg,
                TABLE_LIMIT_PADDING,
              );
              const constrainedFramePosition = activeLimitPoints
                ? clampRectMoveToLimit(
                    { x: fromFrame.x, y: fromFrame.y },
                    { x: toFrame.x, y: toFrame.y },
                    { width: toFrame.width, height: toFrame.height },
                    activeLimitPoints,
                  )
                : { x: fromFrame.x, y: fromFrame.y };
              const constrainedPosition = activeLimitPoints
                ? positionFromRectFrame(
                    {
                      x: constrainedFramePosition.x,
                      y: constrainedFramePosition.y,
                      width: toFrame.width,
                      height: toFrame.height,
                    },
                    geom.width,
                    geom.height,
                  )
                : prevNode.position;
              const blockedByObstacle = activeDrawElements.some((el) =>
                elementIntersectsRect(el, constrainedPosition.x, constrainedPosition.y, geom.width, geom.height),
              );
              node.position = blockedByObstacle ? prevNode.position : constrainedPosition;
              continue;
            }

            if (node.type === "drawElement") {
              if (mapMode !== "draw") {
                node.position = prevNode.position;
                continue;
              }
              const data = node.data as DrawNodeData;
              const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
              const fromFrame = rotatedRectFrameFromPosition(prevNode.position, data.width, data.height, rotationDeg, 0);
              const toFrame = rotatedRectFrameFromPosition(node.position, data.width, data.height, rotationDeg, 0);
              node.position = activeLimitPoints
                ? positionFromRectFrame(
                    {
                      ...(clampRectMoveToLimit(
                        { x: fromFrame.x, y: fromFrame.y },
                        { x: toFrame.x, y: toFrame.y },
                        { width: toFrame.width, height: toFrame.height },
                        activeLimitPoints,
                      )),
                      width: toFrame.width,
                      height: toFrame.height,
                    },
                    data.width,
                    data.height,
                  )
                : prevNode.position;
            }
            continue;
          }

          if (c.type === "dimensions" && String(c.id).startsWith("draw-")) {
            const prevNode = nds.find((n) => n.id === c.id);
            const node = next.find((n) => n.id === c.id);
            if (!node || !prevNode || node.type !== "drawElement" || !node.position) continue;

            const prevData = prevNode.data as DrawNodeData;
            const nextWidth = Math.max(24, Number(c.dimensions?.width || prevData.width));
            const nextHeight = Math.max(24, Number(c.dimensions?.height || prevData.height));
            const rotationDeg = Number.isFinite(prevData.rotationDeg) ? prevData.rotationDeg : 0;

            if (mapMode !== "draw") {
              node.data = { ...node.data, width: prevData.width, height: prevData.height };
              continue;
            }

            const nextFrame = rotatedRectFrameFromPosition(node.position, nextWidth, nextHeight, rotationDeg, 0);
            const insideLimit = activeLimitPoints
              ? isRectInsideLimitArea(
                  { x: nextFrame.x, y: nextFrame.y, width: nextFrame.width, height: nextFrame.height },
                  activeLimitPoints,
                )
              : false;
            if (!insideLimit) {
              node.data = { ...node.data, width: prevData.width, height: prevData.height };
            } else {
              node.data = { ...node.data, width: nextWidth, height: nextHeight };
            }
          }
        }

        if (activeLimitPoints) {
          for (const node of next) {
            if (!node.position) continue;
            const prevNode = nds.find((n) => n.id === node.id) || node;

            if (node.type === "restaurantTable") {
              const data = node.data as TableNodeData;
              const geom = previewGeometry(data.shape, data.capacity, data.rectShortSides);
              const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
              const frame = rotatedRectFrameFromPosition(
                node.position,
                geom.width,
                geom.height,
                rotationDeg,
                TABLE_LIMIT_PADDING,
              );

              if (!isRectInsideLimitArea(frame, activeLimitPoints)) {
                const nearestFrame = findNearestRectInsideLimitArea(
                  { x: frame.x, y: frame.y },
                  { width: frame.width, height: frame.height },
                  activeLimitPoints,
                );
                if (!nearestFrame) {
                  node.position = prevNode.position;
                } else {
                  node.position = positionFromRectFrame(
                    { ...nearestFrame, width: frame.width, height: frame.height },
                    geom.width,
                    geom.height,
                  );
                }
              }

              const blockedByObstacle = activeDrawElements.some((el) =>
                elementIntersectsRect(el, node.position.x, node.position.y, geom.width, geom.height),
              );
              if (blockedByObstacle) {
                node.position = prevNode.position;
              }
              continue;
            }

            if (node.type === "drawElement") {
              if (mapMode !== "draw") {
                node.position = prevNode.position;
                continue;
              }
              const data = node.data as DrawNodeData;
              const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
              const frame = rotatedRectFrameFromPosition(node.position, data.width, data.height, rotationDeg, 0);
              if (!isRectInsideLimitArea(frame, activeLimitPoints)) {
                const nearestFrame = findNearestRectInsideLimitArea(
                  { x: frame.x, y: frame.y },
                  { width: frame.width, height: frame.height },
                  activeLimitPoints,
                );
                node.position = nearestFrame
                  ? positionFromRectFrame(
                      { ...nearestFrame, width: frame.width, height: frame.height },
                      data.width,
                      data.height,
                    )
                  : prevNode.position;
              }
            }
          }
        }
        nextNodesSnapshot = next;
        return next;
      });

      let nextDrawElements = drawElementsRef.current;
      let drawElementsChanged = false;

      for (const c of changes as any[]) {
        if (c.type === "position" && c.dragging !== true) {
          const updatedNode = nextNodesSnapshot.find((n) => n.id === c.id);
          if (!updatedNode?.position) continue;

          if (String(c.id).startsWith("draw-") && updatedNode.type === "drawElement") {
            if (mapMode !== "draw") continue;
            const x = Math.round(updatedNode.position.x);
            const y = Math.round(updatedNode.position.y);
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
          } else if (updatedNode.type === "restaurantTable") {
            void savePosition(c.id, updatedNode.position.x, updatedNode.position.y);
          }
        }
        if (c.type === "dimensions" && String(c.id).startsWith("draw-")) {
          if (mapMode !== "draw") continue;
          if (c.resizing !== false) continue;
          const updatedNode = nextNodesSnapshot.find((n) => n.id === c.id);
          if (!updatedNode || updatedNode.type !== "drawElement") continue;
          const updatedData = updatedNode.data as DrawNodeData;
          let changed = false;
          const updated = nextDrawElements.map((el) => {
            if (el.id !== c.id) return el;
            const width = Math.max(24, Number(updatedData.width || el.width));
            const height = Math.max(24, Number(updatedData.height || el.height));
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
        queuePersistLayout(nextDrawElements, bookingStatesRef.current, lineDrawingPointsRef.current);
      }
    },
    [lineDrawing.isDrawing, mapMode, queuePersistLayout, savePosition, setNodes],
  );

  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);
  const [flowViewport, setFlowViewport] = useState<FlowViewportTransform>({ x: 0, y: 0, zoom: 1 });

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const onDropBooking = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const bookingId = event.dataTransfer.getData("application/booking-id");
      const currentTable = event.dataTransfer.getData("application/booking-current-table");
      if (!bookingId) return;
      if (!reactFlowInstance) return;

      // Get drop position and find the table at that position
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // Find the table node at drop position
      const targetNode = nodes.find((n) => {
        if (n.type !== "restaurantTable" || !n.position) return false;
        const data = n.data as TableNodeData;
        const width = data.capacity >= 6 ? 80 : 60;
        const height = data.capacity >= 6 ? 80 : 60;
        return (
          position.x >= n.position.x &&
          position.x <= n.position.x + width &&
          position.y >= n.position.y &&
          position.y <= n.position.y + height
        );
      });

      if (!targetNode) {
        pushToast({ kind: "error", title: "Error", message: "Suelta la reserva sobre una mesa" });
        return;
      }

      const tableName = (targetNode.data as TableNodeData).name;
      const booking = bookings.find((b) => String(b.id) === bookingId);
      if (!booking) return;

      // Optimistic update
      setBookings((prev) =>
        prev.map((b) => (b.id === Number(bookingId) ? { ...b, table_number: tableName } : b))
      );

      // Send via WebSocket
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: "assign_booking_to_table",
            booking_id: Number(bookingId),
            table_id: targetNode.id,
            table_name: tableName,
            date: selectedDate,
          })
        );
        pushToast({ kind: "success", title: "Reserva asignada", message: `${booking.customer_name} → ${tableName}` });
      } else {
        pushToast({ kind: "error", title: "Error", message: "Conexión no disponible" });
        // Revert optimistic update on error
        setBookings((prev) =>
          prev.map((b) => (b.id === Number(bookingId) ? { ...b, table_number: booking.table_number } : b))
        );
      }
    },
    [bookings, nodes, pushToast, reactFlowInstance, selectedDate]
  );

  const onDragStart = useCallback((event: React.DragEvent, booking: Booking) => {
    // Allow dragging all bookings to reassign to different tables
    event.dataTransfer.setData("application/booking-id", String(booking.id));
    event.dataTransfer.setData("application/booking-current-table", booking.table_number || "");
    event.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  }, []);

  const onDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

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
        const activeLimitPoints = hasClosedLimitArea(lineDrawing.points) ? lineDrawing.points : null;
        if (!activeLimitPoints) {
          pushToast({ kind: "error", title: "Límites requeridos", message: "Dibuja y cierra el área de límites primero." });
          return;
        }

        const normalizedCapacity = clampCapacity(draft.capacity);
        const tableGeom = previewGeometry(draft.shape, normalizedCapacity, normalizeRectShortSides(draft.capacity, draft.rectShortSides));
        const preferredPosition = { x: 140 + visibleTables.length * 24, y: 140 + visibleTables.length * 24 };
        const boundedPosition = findNearestRectInsideLimitArea(
          preferredPosition,
          { width: tableGeom.width, height: tableGeom.height },
          activeLimitPoints,
        );
        if (!boundedPosition) {
          pushToast({ kind: "error", title: "Sin espacio", message: "No hay espacio dentro del área límite para una nueva mesa." });
          return;
        }

        payload.x_pos = Math.round(boundedPosition.x);
        payload.y_pos = Math.round(boundedPosition.y);
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
  }, [api.tables, draft, draftTextureFile, editingTableId, ensureAreaForFloor, lineDrawing.isDrawing, lineDrawing.points, pushToast, selectedDate, selectedFloor, visibleTables.length]);

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

  const openDay = useCallback(async () => {
    if (day?.isOpen) return;
    setDayBusy(true);
    setError(null);
    try {
      const res = await api.config.setDay(selectedDate, true);
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo abrir el día" });
        return;
      }
      setDay(res);
      pushToast({ kind: "success", title: "Guardado", message: "Día abierto" });
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el día");
    } finally {
      setDayBusy(false);
    }
  }, [api.config, day?.isOpen, loadData, pushToast, selectedDate]);

  const onSelectDate = useCallback(
    (nextDate: string) => {
      setSelectedDate(nextDate);
      setDay(null);
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
      queuePersistLayout(drawElementsRef.current, next, lineDrawingPointsRef.current);
    },
    [queuePersistLayout],
  );

  const addDrawElement = useCallback(
    (preset: DrawElementPreset) => {
      const activeLimitPoints = hasClosedLimitArea(lineDrawing.points) ? lineDrawing.points : null;
      if (!activeLimitPoints) {
        pushToast({ kind: "error", title: "Límites requeridos", message: "Dibuja y cierra el área de límites primero." });
        return;
      }
      const current = drawElementsRef.current;
      const kind = drawPresetKind(preset);
      const size = drawElementSize(preset);
      const preferred = { x: 180 + current.length * 24, y: 180 + current.length * 24 };
      const base = findNearestRectInsideLimitArea(preferred, size, activeLimitPoints);
      if (!base) {
        pushToast({ kind: "error", title: "Sin espacio", message: "No hay espacio dentro del área límite para ese elemento." });
        return;
      }
      const next = makeDrawElement(kind, preset, base, current.length + 1);
      const updated = [...current, next];
      drawElementsRef.current = updated;
      setDrawElements(updated);
      setSelectedDrawElementId(next.id);
      queuePersistLayout(updated, bookingStatesRef.current, activeLimitPoints);
      setMapMode("draw");
      setMenuVisible(false);
    },
    [lineDrawing.isDrawing, lineDrawing.points, pushToast, queuePersistLayout],
  );

  const selectedDrawElement = useMemo(
    () => (selectedDrawElementId ? drawElements.find((item) => item.id === selectedDrawElementId) || null : null),
    [drawElements, selectedDrawElementId],
  );

  const updateSelectedDrawElementDisplayMode = useCallback(
    (displayMode: DrawElementDisplayMode) => {
      if (!selectedDrawElementId) return;
      const current = drawElementsRef.current;
      let changed = false;
      const updated = current.map((item) => {
        if (item.id !== selectedDrawElementId) return item;
        if (item.displayMode === displayMode) return item;
        changed = true;
        return { ...item, displayMode };
      });
      if (!changed) return;
      drawElementsRef.current = updated;
      setDrawElements(updated);
      queuePersistLayout(updated, bookingStatesRef.current, lineDrawingPointsRef.current);
    },
    [queuePersistLayout, selectedDrawElementId],
  );

  const rotateSelectedDrawElement = useCallback(
    (direction: -1 | 1) => {
      if (!selectedDrawElementId) return;
      const current = drawElementsRef.current;
      let changed = false;
      const updated = current.map((item) => {
        if (item.id !== selectedDrawElementId) return item;
        const base = Math.round((Number.isFinite(item.rotationDeg) ? item.rotationDeg : 0) / DRAW_ROTATE_STEP) * DRAW_ROTATE_STEP;
        const next = ((base + direction * DRAW_ROTATE_STEP) % 360 + 360) % 360;
        if (next === item.rotationDeg) return item;
        changed = true;
        return { ...item, rotationDeg: next };
      });
      if (!changed) return;
      drawElementsRef.current = updated;
      setDrawElements(updated);
      queuePersistLayout(updated, bookingStatesRef.current, lineDrawingPointsRef.current);
    },
    [queuePersistLayout, selectedDrawElementId],
  );

  const reservasTabItems = useMemo<TabItem[]>(
    () => [
      { id: "reservas", label: "Reservas", href: "#reservas", icon: <CalendarDays className="bo-ico" /> },
      { id: "mesas", label: "Mesas", href: "#mesas", icon: <LayoutGrid className="bo-ico" /> },
    ],
    [],
  );

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

  const assignBookingToTable = useCallback(
    async (booking: Booking, tableName: string, tableId: string) => {
      // Optimistic update
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, table_number: tableName } : b))
      );
      setBookingForAssignment(null);

      // Send via WebSocket
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(
          JSON.stringify({
            type: "assign_booking_to_table",
            booking_id: booking.id,
            table_id: Number(tableId),
            table_name: tableName,
            date: selectedDate,
          })
        );
        pushToast({ kind: "success", title: "Reserva asignada", message: `${booking.customer_name} → ${tableName}` });
      } else {
        // Fallback to API
        const res = await api.reservas.patch(booking.id, { table_number: tableName });
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo asignar" });
          // Revert
          setBookings((prev) =>
            prev.map((b) => (b.id === booking.id ? { ...b, table_number: booking.table_number } : b))
          );
        } else {
          pushToast({ kind: "success", title: "Reserva asignada", message: `${booking.customer_name} → ${tableName}` });
        }
      }
    },
    [api.reservas, pushToast, selectedDate, ws]
  );

  const handleAssignModeSelect = useCallback(async (bookingId: number, tableId: number) => {
    const booking = bookings.find(b => b.id === bookingId);
    const table = visibleTables.find(t => t.id === tableId);
    
    if (!booking || !table) return;

    // Optimistic update
    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? { ...b, table_number: table.name } : b))
    );

    // Use API - PATCH /api/admin/bookings/{id}
    const res = await api.reservas.patch(booking.id, { table_number: table.name });
    if (!res.success) {
      pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo asignar" });
      // Revert
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, table_number: booking.table_number } : b))
      );
    } else {
      pushToast({ kind: "success", title: "Reserva asignada", message: `${booking.customer_name} → ${table.name}` });
    }
    
    // Reset selections
    setSelectedBookingId(null);
    setSelectedTableId(null);
    setAssignMode(false);
  }, [api.reservas, bookings, pushToast, visibleTables]);

  // Auto-trigger assignment when both booking and table are selected
  useEffect(() => {
    if (assignmentInProgress.current) return;
    if (assignMode && selectedBookingId && selectedTableId) {
      assignmentInProgress.current = true;
      handleAssignModeSelect(selectedBookingId, selectedTableId);
      // Reset ref after a delay to allow next assignment
      setTimeout(() => {
        assignmentInProgress.current = false;
      }, 100);
    }
  }, [assignMode, selectedBookingId, selectedTableId, handleAssignModeSelect]);

  const cancelAssignmentMode = useCallback(() => {
    setBookingForAssignment(null);
    setAssignMode(false);
    setSelectedBookingId(null);
    setSelectedTableId(null);
  }, []);

  // ESC key handler to cancel assignment mode
  useEffect(() => {
    if (!bookingForAssignment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelAssignmentMode();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [bookingForAssignment, cancelAssignmentMode]);

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

  const openRightSheet = useCallback(() => {
    setMenuVisible(false);
    setRightSheetOpen(true);
  }, []);

  const closeRightSheet = useCallback(() => {
    setRightSheetOpen(false);
  }, []);

  const openDrawPanelHover = useCallback(() => {
    if (drawPanelHoverTimerRef.current) {
      clearTimeout(drawPanelHoverTimerRef.current);
      drawPanelHoverTimerRef.current = null;
    }
    setDrawPanelHover(true);
  }, []);

  const closeDrawPanelHoverSoon = useCallback(() => {
    if (drawPanelHoverTimerRef.current) {
      clearTimeout(drawPanelHoverTimerRef.current);
    }
    drawPanelHoverTimerRef.current = setTimeout(() => {
      drawPanelHoverTimerRef.current = null;
      setDrawPanelHover(false);
    }, 140);
  }, []);

  useEffect(() => {
    return () => {
      if (!drawPanelHoverTimerRef.current) return;
      clearTimeout(drawPanelHoverTimerRef.current);
      drawPanelHoverTimerRef.current = null;
    };
  }, []);

  const onToggleDrawMode = useCallback(() => {
    setMapMode((prev) => {
      const next = prev === "draw" ? "tables" : "draw";
      if (next !== "draw") {
        setSelectedDrawElementId(null);
        setIsEditingLimitArea(false);
        setDraggingLimitVertexIndex(null);
        limitEditHistoryRef.current = [];
      }
      return next;
    });
    setMenuVisible(false);
  }, []);

  const closeDrawPanel = useCallback(() => {
    setSelectedDrawElementId(null);
    setIsEditingLimitArea(false);
    setDraggingLimitVertexIndex(null);
    limitEditHistoryRef.current = [];
    setMapMode("tables");
  }, []);

  const startLineDrawing = useCallback(() => {
    setIsEditingLimitArea(false);
    setDraggingLimitVertexIndex(null);
    limitEditHistoryRef.current = [];
    setLineDrawing({ points: [], isDrawing: true });
    lineDrawingPointsRef.current = [];
    setMapMode("draw");
    setMenuVisible(false);
  }, []);

  const addLinePoint = useCallback((point: LinePoint) => {
    setLineDrawing((prev) => ({
      ...prev,
      points: [...prev.points, point],
    }));
  }, []);

  const undoCreateAreaLastAction = useCallback(() => {
    setLineDrawing((prev) => {
      if (!prev.isDrawing || prev.points.length === 0) return prev;
      const nextPoints = prev.points.slice(0, -1);
      lineDrawingPointsRef.current = nextPoints;
      return { ...prev, points: nextPoints };
    });
  }, []);

  const closeLineDrawing = useCallback(() => {
    if (lineDrawing.points.length < 3) {
      pushToast({ kind: "error", title: "Área inválida", message: "Necesitas al menos 3 puntos para cerrar el área." });
      return;
    }
    const closedPoints = cloneLinePoints(lineDrawing.points);
    lineDrawingPointsRef.current = closedPoints;
    setIsEditingLimitArea(false);
    setLineDrawing({ points: closedPoints, isDrawing: false });
    limitEditHistoryRef.current = [];
    queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, closedPoints);
  }, [lineDrawing.points, pushToast, queuePersistLayout]);

  const cancelLineDrawing = useCallback(() => {
    setIsEditingLimitArea(false);
    setDraggingLimitVertexIndex(null);
    limitEditHistoryRef.current = [];
    setLineDrawing({ points: [], isDrawing: false });
    lineDrawingPointsRef.current = [];
    queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, []);
  }, [queuePersistLayout]);

  const startLimitAreaEditing = useCallback(() => {
    if (!hasClosedLimitArea(lineDrawing.points) || lineDrawing.isDrawing) return;
    limitEditHistoryRef.current = [];
    setIsEditingLimitArea(true);
    setMapMode("draw");
    setMenuVisible(false);
  }, [lineDrawing.isDrawing, lineDrawing.points]);

  const stopLimitAreaEditing = useCallback(() => {
    setIsEditingLimitArea(false);
    setDraggingLimitVertexIndex(null);
    limitEditHistoryRef.current = [];
    queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, lineDrawingPointsRef.current);
  }, [queuePersistLayout]);

  const saveLimitAreaTemplate = useCallback(async () => {
    if (lineDrawing.isDrawing || !hasClosedLimitArea(lineDrawing.points)) {
      pushToast({ kind: "error", title: "Área inválida", message: "Cierra el área antes de guardar la plantilla." });
      return;
    }

    setSavingLimitTemplate(true);
    try {
      const areaId = await ensureAreaForFloor();
      if (!areaId) return;

      const currentArea = (floorAreas.get(selectedFloor) || []).find((area) => area.id === areaId) || null;
      const metadata: Record<string, unknown> = {
        ...areaMetadata(currentArea),
        floorNumber: selectedFloor,
        limit_area_template_points: cloneLinePoints(lineDrawing.points),
      };

      const res = await api.tables.update({
        entity: "area",
        id: areaId,
        metadata,
      });
      if (!res.success) {
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar la plantilla" });
        return;
      }

      setAreas((prev) => prev.map((area) => (area.id === areaId ? { ...area, metadata } : area)));
      pushToast({
        kind: "success",
        title: "Plantilla guardada",
        message: "Se aplicará por defecto para este salón en todos los días.",
      });
    } finally {
      setSavingLimitTemplate(false);
    }
  }, [api.tables, ensureAreaForFloor, floorAreas, lineDrawing.isDrawing, lineDrawing.points, pushToast, selectedFloor]);

  const undoEditAreaLastAction = useCallback(() => {
    if (!isEditingLimitArea || lineDrawing.isDrawing) return;
    const previous = limitEditHistoryRef.current.pop();
    if (!previous) return;
    const restoredPoints = cloneLinePoints(previous);
    lineDrawingPointsRef.current = restoredPoints;
    setDraggingLimitVertexIndex(null);
    setLineDrawing((prev) => ({ ...prev, points: restoredPoints, isDrawing: false }));
    queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, restoredPoints);
  }, [isEditingLimitArea, lineDrawing.isDrawing, queuePersistLayout]);

  const onLimitVertexMouseDown = useCallback(
    (index: number, event: React.MouseEvent<SVGCircleElement>) => {
      if (!isEditingLimitArea || !reactFlowInstance) return;
      event.preventDefault();
      event.stopPropagation();
      limitEditHistoryRef.current.push(cloneLinePoints(lineDrawingPointsRef.current));
      setDraggingLimitVertexIndex(index);
    },
    [isEditingLimitArea, reactFlowInstance],
  );

  useEffect(() => {
    if (draggingLimitVertexIndex === null || !isEditingLimitArea || !reactFlowInstance) return;

    const handleMouseMove = (event: MouseEvent) => {
      const flowPoint = reactFlowInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY }) as LinePoint;
      setLineDrawing((prev) => {
        if (!prev.points[draggingLimitVertexIndex]) return prev;
        const nextPoints = prev.points.map((point, idx) => (idx === draggingLimitVertexIndex ? flowPoint : point));
        lineDrawingPointsRef.current = nextPoints;
        return { ...prev, points: nextPoints, isDrawing: false };
      });
    };

    const handleMouseUp = () => {
      setDraggingLimitVertexIndex(null);
      queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, lineDrawingPointsRef.current);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingLimitVertexIndex, isEditingLimitArea, queuePersistLayout, reactFlowInstance]);

  const lineOverlayPoints = useMemo(
    () => lineDrawing.points.map((point) => projectFlowPointToOverlay(point, flowViewport)),
    [flowViewport, lineDrawing.points],
  );

  if (loading) {
    return <div className="bo-tableMapLoading">Cargando mapa...</div>;
  }

  return (
    <ReactFlowProvider>
      <section className="bo-tableMapPage" aria-label="Mapa de mesas">
        <AnimatePresence mode="wait" initial={false}>
          {isDayOpen ? (
            <motion.div
              key="table-map-open"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
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
        <div className="bo-tableMapTopRight">
          <div
            className="bo-tableMapDrawTrigger"
            onMouseEnter={openDrawPanelHover}
            onMouseLeave={closeDrawPanelHoverSoon}
          >
            <button
              className={`bo-actionBtn bo-actionBtn--glass${mapMode === "draw" ? " is-active" : ""}`}
              type="button"
              aria-label="Modo dibujo"
              onClick={onToggleDrawMode}
            >
              <Pencil size={18} strokeWidth={1.8} />
            </button>
          </div>
          {!rightSheetOpen ? (
            <button
              className="bo-actionBtn bo-actionBtn--glass"
              type="button"
              aria-label="Abrir panel derecho"
              aria-expanded={rightSheetOpen}
              onClick={openRightSheet}
            >
              <PanelRightOpen size={18} strokeWidth={1.8} />
            </button>
          ) : null}
        </div>
      </div>

      <div ref={flowWrapRef} className="bo-tableMapFlowWrap">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onInit={(instance) => {
            setReactFlowInstance(instance);
            setFlowViewport(instance.getViewport());
          }}
          onMove={(_event, viewport) => {
            setFlowViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom });
          }}
          onNodeClick={(_event, node) => {
            if (node.type === "restaurantTable") {
              setSelectedDrawElementId(null);
              const tableData = node.data as TableNodeData;
              // Priority: new assignMode takes precedence
              if (assignMode) {
                setSelectedTableId(prev => prev === tableData.id ? null : tableData.id);
              } else if (bookingForAssignment) {
                assignBookingToTable(bookingForAssignment, tableData.name, node.id);
              }
              return;
            }
            if (node.type === "drawElement") {
              if (mapMode !== "draw") return;
              setSelectedDrawElementId((prev) => (prev === node.id ? null : node.id));
            }
          }}
          onPaneClick={(event) => {
            setSelectedDrawElementId(null);
            if (lineDrawing.isDrawing && reactFlowInstance && !isEditingLimitArea) {
              const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              });
              addLinePoint(position);
            }
          }}
          onDragOver={onDragOver}
          onDrop={onDropBooking}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={DEFAULT_TABLE_MAP_FIT_VIEW_OPTIONS}
          minZoom={0.08}
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

        {lineDrawing.points.length > 0 && (
          <svg
            className="bo-tableMapLineDrawOverlay"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              pointerEvents: isEditingLimitArea && mapMode === "draw" ? "auto" : "none",
              overflow: "visible",
            }}
          >
            {lineOverlayPoints.map((point, idx) => (
              <g key={idx}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isEditingLimitArea && mapMode === "draw" ? 9 : 6}
                  fill={isEditingLimitArea && mapMode === "draw" ? "color-mix(in srgb, var(--bo-accent) 70%, var(--bo-surface))" : "var(--bo-accent)"}
                  stroke="var(--bo-surface)"
                  strokeWidth={2}
                  style={{
                    cursor: isEditingLimitArea && mapMode === "draw" ? "grab" : "default",
                    pointerEvents: isEditingLimitArea && mapMode === "draw" ? "all" : "none",
                  }}
                  onMouseDown={(event) => onLimitVertexMouseDown(idx, event)}
                />
                {idx > 0 && (
                  <line
                    x1={lineOverlayPoints[idx - 1].x}
                    y1={lineOverlayPoints[idx - 1].y}
                    x2={point.x}
                    y2={point.y}
                    stroke="var(--bo-accent)"
                    strokeWidth={2}
                    strokeDasharray={lineDrawing.isDrawing ? "5,5" : "none"}
                  />
                )}
              </g>
            ))}
            {lineDrawing.points.length >= 2 && !lineDrawing.isDrawing && (
              <polygon
                points={lineOverlayPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="var(--bo-accent)"
                strokeWidth={2}
              />
            )}
          </svg>
        )}
      </div>

      <aside
        className={`bo-tableMapDrawPanel${mapMode === "draw" || drawPanelHover ? " is-open" : ""}`}
        aria-label="Panel de dibujo"
        onMouseEnter={openDrawPanelHover}
        onMouseLeave={closeDrawPanelHoverSoon}
      >
        <div className="bo-tableMapDrawPanelHead">
          <div className="bo-panelTitle">Dibujo</div>
          <button className="bo-btn bo-btn--ghost" type="button" onClick={closeDrawPanel}>Cerrar</button>
        </div>
        <div className="bo-tableMapDrawPanelBody">
          <div className="bo-tableMapDrawHint">En modo dibujo puedes crear y editar muros/obstaculos. Las mesas quedan bloqueadas por estos limites.</div>

          <div className="bo-tableMapDrawSection">
            <div className="bo-tableMapDrawSectionHead">
              <div className="bo-tableMapDrawSectionTitle">Elementos</div>
              <div className="bo-tableMapDrawHint">Añade objetos con un solo click. Los nuevos quedan seleccionados.</div>
            </div>
            <div className="bo-drawPresetGroups" aria-label="Herramientas de dibujo">
              {DRAW_PANEL_GROUPS.map((group) => (
                <section key={group.id} className="bo-drawPresetGroup" aria-label={group.title}>
                  <div className="bo-drawPresetGroupTitle">{group.title}</div>
                  <div className="bo-drawPresetGrid">
                    {group.presets.map((preset) => {
                      const previewUrl = drawPresetAssetImageUrl(preset);
                      const isActivePreset = selectedDrawElement?.preset === preset;
                      return (
                        <button
                          key={preset}
                          className={`bo-drawPresetBtn${isActivePreset ? " is-active" : ""}`}
                          type="button"
                          onClick={() => addDrawElement(preset)}
                        >
                          <span className="bo-drawPresetBtnIcon" aria-hidden="true">
                            {previewUrl ? (
                              <img className="bo-drawPresetBtnAsset" src={previewUrl} alt="" />
                            ) : (
                              DRAW_PRESET_ICON[preset]
                            )}
                          </span>
                          <span className="bo-drawPresetBtnLabel">{drawPresetLabel(preset)}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          <div className="bo-tableMapDrawSection">
            <div className="bo-tableMapDrawSectionTitle">Visual del elemento</div>
            {selectedDrawElement ? (
              <>
                <div className="bo-tableMapDrawHint bo-tableMapDrawHint--compact">
                  Seleccionado: <strong>{selectedDrawElement.label}</strong>
                </div>
                <div className="bo-drawRotationControls" role="group" aria-label="Rotación del elemento">
                  <button className="bo-drawRotateBtn" type="button" onClick={() => rotateSelectedDrawElement(-1)}>
                    <RotateCcw size={14} />
                    -10°
                  </button>
                  <div className="bo-drawRotationValue">{Math.round(selectedDrawElement.rotationDeg)}°</div>
                  <button className="bo-drawRotateBtn" type="button" onClick={() => rotateSelectedDrawElement(1)}>
                    +10°
                    <RotateCw size={14} />
                  </button>
                </div>
                <div className="bo-drawDisplayModePicker" role="group" aria-label="Modo de visualización del elemento">
                  <button
                    className={`bo-drawDisplayModeBtn${selectedDrawElement.displayMode === "both" ? " is-active" : ""}`}
                    type="button"
                    onClick={() => updateSelectedDrawElementDisplayMode("both")}
                  >
                    Ambos
                  </button>
                  <button
                    className={`bo-drawDisplayModeBtn${selectedDrawElement.displayMode === "asset" ? " is-active" : ""}`}
                    type="button"
                    onClick={() => updateSelectedDrawElementDisplayMode("asset")}
                  >
                    Solo asset
                  </button>
                  <button
                    className={`bo-drawDisplayModeBtn${selectedDrawElement.displayMode === "text" ? " is-active" : ""}`}
                    type="button"
                    onClick={() => updateSelectedDrawElementDisplayMode("text")}
                  >
                    Solo texto
                  </button>
                </div>
              </>
            ) : (
              <div className="bo-tableMapDrawHint">Selecciona un elemento del mapa para cambiar su visual.</div>
            )}
          </div>

          <div className="bo-tableMapDrawSection">
            <div className="bo-tableMapDrawSectionTitle">Limites del mapa</div>
            <div className="bo-tableMapDrawHint">Dibuja el perimetro del area</div>
            {hasClosedLimitArea(selectedFloorTemplatePoints) ? (
              <div className="bo-tableMapDrawHint bo-tableMapDrawHint--compact">Hay una plantilla guardada para este salón.</div>
            ) : null}
            {!lineDrawing.isDrawing && lineDrawing.points.length === 0 ? (
              <button className="bo-btn bo-btn--primary" type="button" onClick={startLineDrawing}>
                <MapPin size={16} />
                Dibujar limites
              </button>
            ) : (
              <div className="bo-tableMapLineDrawControls">
                {lineDrawing.isDrawing && (
                  <div className="bo-tableMapLineDrawStatus">
                    <Circle size={12} className="bo-tableMapLineDrawStatusDot" />
                    <span>{lineDrawing.points.length} puntos</span>
                  </div>
                )}
                {lineDrawing.isDrawing && lineDrawing.points.length > 0 && (
                  <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={undoCreateAreaLastAction}>
                    <Undo size={14} />
                    Deshacer ultimo punto
                  </button>
                )}
                {!lineDrawing.isDrawing && hasClosedLimitArea(lineDrawing.points) && !isEditingLimitArea && (
                  <button className="bo-btn bo-btn--primary bo-btn--sm" type="button" onClick={startLimitAreaEditing}>
                    Editar area
                  </button>
                )}
                {!lineDrawing.isDrawing && hasClosedLimitArea(lineDrawing.points) && isEditingLimitArea && (
                  <button className="bo-btn bo-btn--primary bo-btn--sm" type="button" onClick={stopLimitAreaEditing}>
                    Guardar edición
                  </button>
                )}
                {isEditingLimitArea && (
                  <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={undoEditAreaLastAction}>
                    <Undo size={14} />
                    Deshacer ultimo cambio
                  </button>
                )}
                {lineDrawing.points.length >= 3 && lineDrawing.isDrawing && (
                  <button className="bo-btn bo-btn--primary bo-btn--sm" type="button" onClick={closeLineDrawing}>
                    <SquareMinus size={14} />
                    Cerrar area
                  </button>
                )}
                {lineDrawing.points.length > 0 && (
                  <button
                    className="bo-btn bo-btn--ghost bo-btn--sm"
                    type="button"
                    onClick={isEditingLimitArea ? stopLimitAreaEditing : cancelLineDrawing}
                  >
                    <Undo size={14} />
                    {isEditingLimitArea ? "Salir edición" : "Cancelar"}
                  </button>
                )}
                {!lineDrawing.isDrawing && hasClosedLimitArea(lineDrawing.points) && (
                  <button
                    className="bo-btn bo-btn--ghost bo-btn--sm"
                    type="button"
                    onClick={() => void saveLimitAreaTemplate()}
                    disabled={savingLimitTemplate}
                  >
                    <MapPin size={14} />
                    {savingLimitTemplate ? "Guardando plantilla..." : "Guardar plantilla salón"}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <aside className={`bo-tableMapSheet${rightSheetOpen ? " is-open" : ""}${isDragging ? " drag-active" : ""}`} aria-label="Panel de reservas">
        <div className="bo-tableMapSheetHead">
          {bookingForAssignment ? (
            <div className="bo-assigningBanner">
              <span>Asignando: <strong>{bookingForAssignment.customer_name}</strong></span>
              <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={cancelAssignmentMode}>Cancelar</button>
            </div>
          ) : (
            <div className="bo-tableMapSheetStats">
              <span className="bo-tableMapSheetStat bo-tableMapSheetStat--total">
                <span className="bo-tableMapSheetStatDot" />{bookingStats.total} reservas
              </span>
              <span className="bo-tableMapSheetStat bo-tableMapSheetStat--seated">
                <span className="bo-tableMapSheetStatDot" />{bookingStats.seated} sentadas
              </span>
              <span className="bo-tableMapSheetStat bo-tableMapSheetStat--pending">
                <span className="bo-tableMapSheetStatDot" />{bookingStats.pending} pendientes
              </span>
            </div>
          )}
          <div className="bo-tableMapSheetHeader">
            <div className="bo-tableMapSheetHeaderLeft">
              <div className="bo-panelTitle">Booking manager</div>
              <div className="bo-panelMeta">{visibleTables.length} mesas</div>
            </div>
            <div className="bo-tableMapSheetHeaderActions">
              <button className="bo-btn bo-btn--ghost bo-tableMapDateBtn" type="button" onClick={() => setCalendarExpanded((v) => !v)} aria-expanded={calendarExpanded}>
                <CalendarRange size={14} />
                <span>{selectedDate}</span>
              </button>
              <button
                className="bo-actionBtn bo-actionBtn--glass bo-tableMapSheetToggleBtn"
                type="button"
                aria-label="Colapsar panel derecho"
                onClick={closeRightSheet}
              >
                <PanelRightClose size={18} strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>
        <div className="bo-tableMapSheetBody">
          {calendarExpanded ? (
            <div className="bo-tableMapCalendarWrapper">
              <MonthCalendar
                year={calendarView.year}
                month={calendarView.month}
                days={calendarDays}
                selectedDateISO={selectedDate}
                onSelectDate={(date) => { onSelectDate(date); setCalendarExpanded(false); }}
                onPrevMonth={onPrevMonth}
                onNextMonth={onNextMonth}
                loading={loading}
              />
            </div>
          ) : null}

          {floorTabs.length > 1 && (
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
          )}

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

          <div className="bo-tableMapSheetContent">
            {sheetTab === "reservas" ? (
            <div className="bo-tableMapSection">
              <div className="bo-tableMapSectionHeader">
                <div className="bo-tableMapSectionTitle">Reservas del día</div>
                {bookings.length > 0 && hasUnassignedBookings && !assignMode && (
                  <button
                    className="bo-btn bo-btn--primary bo-btn--sm"
                    type="button"
                    onClick={() => setAssignMode(true)}
                  >
                    Asignar mesa
                  </button>
                )}
                {assignMode && (
                  <button
                    className="bo-btn bo-btn--ghost bo-btn--sm"
                    type="button"
                    onClick={cancelAssignmentMode}
                  >
                    Cancelar
                  </button>
                )}
              </div>
              {bookings.length === 0 ? (
                <div className="bo-tableMapEmptyState">
                  <div className="bo-tableMapEmptyStateIcon"><CalendarDays size={24} /></div>
                  <div>No hay reservas para esta fecha</div>
                  <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => setSelectedDate(todayISO())}>Ver hoy</button>
                </div>
              ) : (
                <div className="bo-tableMapBookingsList">
                  {assignMode && hasUnassignedBookings && (
                    <div className="bo-tableMapAssignModeHint">Selecciona una reserva sin mesa asignada</div>
                  )}
                  {assignMode && !hasUnassignedBookings && (
                    <div className="bo-tableMapEmptyState">
                      <div className="bo-tableMapEmptyStateIcon"><LayoutGrid size={24} /></div>
                      <div>Todas las reservas tienen mesa asignada</div>
                    </div>
                  )}
                  {(bookings.filter(b => !assignMode || !b.table_number) || []).map((booking) => {
                    const seated = bookingStates[String(booking.id)]?.seated;
                    const isUnassigned = !booking.table_number;
                    const isAssigning = bookingForAssignment?.id === booking.id;
                    const isSelected = selectedBookingId === booking.id;
                    return (
                      <div
                        key={booking.id}
                        className={`bo-tableMapBookingRow${seated ? " is-seated" : " is-pending"}${isAssigning ? " is-assigning" : ""}${assignMode ? " is-assign-mode" : ""}${isSelected ? " is-selected" : ""}${assignMode && !isUnassigned ? " is-disabled" : ""}`}
                        onClick={() => {
                          if (assignMode && !isUnassigned) return; // Can't select assigned bookings in assign mode
                          if (assignMode) {
                            setSelectedBookingId(isSelected ? null : booking.id);
                          } else if (bookingForAssignment?.id === booking.id) {
                            setBookingForAssignment(null);
                          } else {
                            setSelectedBooking(booking);
                          }
                        }}
                      >
                        {assignMode ? (
                          <label className="bo-checkboxContainer" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                e.stopPropagation();
                                setSelectedBookingId(isSelected ? null : booking.id);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <span className="bo-checkboxMark" />
                          </label>
                        ) : (
                          <span className="bo-bookingDragIndicator"><GripVertical size={16} /></span>
                        )}
                        <span className="bo-tableMapBookingStatusDot" />
                        <div className="bo-tableMapBookingMain">
                          <strong>{booking.table_number || "—"} · {booking.customer_name}</strong>
                          <span>{booking.party_size} pax · {formatHHMM(booking.reservation_time)}</span>
                        </div>
                        <DropdownMenu
                          label="Acciones reserva"
                          triggerClassName="bo-actionBtn bo-actionBtn--glass"
                          items={[
                            { id: "details", label: "Ver", icon: <FileText size={16} strokeWidth={1.8} />, onSelect: () => setSelectedBooking(booking) },
                            { id: "cancel", label: "Cancelar", tone: "danger", icon: <Trash2 size={16} strokeWidth={1.8} />, onSelect: () => void cancelBooking(booking) },
                          ]}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bo-tableMapSection">
              <div className="bo-tableMapSectionHeader">
                <div className="bo-tableMapSectionTitle">Estado de mesas</div>
                <div className="bo-tableMapSectionSummary">
                  <span className="bo-tableMapSummaryItem bo-tableMapSummaryItem--free">{tableSummary.free} libres</span>
                  <span className="bo-tableMapSummaryItem bo-tableMapSummaryItem--booked">{tableSummary.booked} reservadas</span>
                  <span className="bo-tableMapSummaryItem bo-tableMapSummaryItem--seated">{tableSummary.seated} ocupadas</span>
                </div>
              </div>
              {visibleTables.length === 0 ? (
                <div className="bo-tableMapEmptyState">
                  <div className="bo-tableMapEmptyStateIcon"><LayoutGrid size={24} /></div>
                  <div>No hay mesas en este salón</div>
                  <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => setEditorOpen(true)}>Crear mesa</button>
                </div>
              ) : (
                <div className="bo-tableMapTablesByStatus">
                  {tablesByStatus.seated.length > 0 && (
                    <div className="bo-tableMapTablesStatusGroup">
                      <div className="bo-tableMapTablesStatusGroupTitle">Ocupadas</div>
                      <div className="bo-tableMapTablesGrid">
                        {tablesByStatus.seated.map((table) => {
                          const tableBookings = getTableBookings(table.name);
                          const currentBooking = tableBookings[0];
                          const isSelected = selectedTableId === table.id;
                          return (
                            <div 
                              key={`table-card-${table.id}`} 
                              className={`bo-tableMapTableCard is-seated${assignMode ? " is-assign-mode" : ""}${isSelected ? " is-selected" : ""}`}
                              onClick={() => {
                                if (assignMode) {
                                  setSelectedTableId(isSelected ? null : table.id);
                                }
                              }}
                            >
                              {assignMode && (
                                <label className="bo-tableMapTableCardCheckbox" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setSelectedTableId(isSelected ? null : table.id);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span className="bo-checkboxMark" />
                                </label>
                              )}
                              <span className="bo-tableMapTableCardOcc" />
                              <span className="bo-tableMapTableCardNum">{table.name}</span>
                              <span className="bo-tableMapTableCardCap">{table.capacity} pax</span>
                              {currentBooking && (
                                <span className="bo-tableMapTableCardBooking">
                                  {currentBooking.customer_name?.split(' ')[0]} · {formatHHMM(currentBooking.reservation_time)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {tablesByStatus.booked.length > 0 && (
                    <div className="bo-tableMapTablesStatusGroup">
                      <div className="bo-tableMapTablesStatusGroupTitle">Reservadas</div>
                      <div className="bo-tableMapTablesGrid">
                        {tablesByStatus.booked.map((table) => {
                          const tableBookings = getTableBookings(table.name);
                          const currentBooking = tableBookings[0];
                          const isSelected = selectedTableId === table.id;
                          return (
                            <div 
                              key={`table-card-${table.id}`} 
                              className={`bo-tableMapTableCard is-booked${assignMode ? " is-assign-mode" : ""}${isSelected ? " is-selected" : ""}`}
                              onClick={() => {
                                if (assignMode) {
                                  setSelectedTableId(isSelected ? null : table.id);
                                }
                              }}
                            >
                              {assignMode && (
                                <label className="bo-tableMapTableCardCheckbox" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setSelectedTableId(isSelected ? null : table.id);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span className="bo-checkboxMark" />
                                </label>
                              )}
                              <span className="bo-tableMapTableCardOcc" />
                              <span className="bo-tableMapTableCardNum">{table.name}</span>
                              <span className="bo-tableMapTableCardCap">{table.capacity} pax</span>
                              {currentBooking && (
                                <span className="bo-tableMapTableCardBooking">
                                  {currentBooking.customer_name?.split(' ')[0]} · {formatHHMM(currentBooking.reservation_time)}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {tablesByStatus.free.length > 0 && (
                    <div className="bo-tableMapTablesStatusGroup">
                      <div className="bo-tableMapTablesStatusGroupTitle">Libres</div>
                      <div className="bo-tableMapTablesGrid">
                        {tablesByStatus.free.map((table) => {
                          const isSelected = selectedTableId === table.id;
                          return (
                            <div 
                              key={`table-card-${table.id}`} 
                              className={`bo-tableMapTableCard is-free${assignMode ? " is-assign-mode" : ""}${isSelected ? " is-selected" : ""}`}
                              onClick={() => {
                                if (assignMode) {
                                  setSelectedTableId(isSelected ? null : table.id);
                                }
                              }}
                            >
                              {assignMode && (
                                <label className="bo-tableMapTableCardCheckbox" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      setSelectedTableId(isSelected ? null : table.id);
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                  <span className="bo-checkboxMark" />
                                </label>
                              )}
                              <span className="bo-tableMapTableCardOcc" />
                              <span className="bo-tableMapTableCardNum">{table.name}</span>
                              <span className="bo-tableMapTableCardCap">{table.capacity} pax</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          </div>
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
                onClick={() =>
                  setDraft((prev) => {
                    const base = Math.round(prev.rotationDeg / DRAW_ROTATE_STEP) * DRAW_ROTATE_STEP;
                    return { ...prev, rotationDeg: Math.max(-180, base - DRAW_ROTATE_STEP) };
                  })
                }
                aria-label="Girar 10 grados a la izquierda"
              >
                <RotateCcw size={16} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                className="bo-actionBtn bo-actionBtn--glass bo-tableEditorRotateBtn"
                onClick={() =>
                  setDraft((prev) => {
                    const base = Math.round(prev.rotationDeg / DRAW_ROTATE_STEP) * DRAW_ROTATE_STEP;
                    return { ...prev, rotationDeg: Math.min(180, base + DRAW_ROTATE_STEP) };
                  })
                }
                aria-label="Girar 10 grados a la derecha"
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
            </motion.div>
          ) : (
            <motion.div
              key="table-map-closed"
              className="bo-tableMapClosedShell"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
              <div className="bo-tableMapClosedTop">
                <button className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={onBack} aria-label="Volver a reservas">
                  <ChevronLeft size={18} strokeWidth={1.8} />
                </button>
              </div>
              <div className="bo-tableMapClosedBody">
                <ReservationDayPanel
                  title="Día cerrado"
                  meta={selectedDate}
                  day={day ?? { date: selectedDate, isOpen: false }}
                  busy={dayBusy}
                  onToggleDay={openDay}
                  actionMode="openOnly"
                  bodyClassName="bo-configDayLimitRow--single"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
    </section>
    </ReactFlowProvider>
  );
}
