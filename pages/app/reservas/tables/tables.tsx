import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom } from "jotai";
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
import {
  CalendarDays, ChevronDown, ChevronLeft, ClipboardList, DoorOpen, Ellipsis, FileDown, FileText, GripVertical,
  Hand, ImagePlus, Layers, Leaf, Minus, MousePointer2, PanelRightClose, PanelRightOpen, Pencil,
  Plus, Redo2, RotateCcw, RotateCw, Sofa, Square, SquareMinus, Trash2, Undo, X, Circle,
  CalendarRange, Users, LayoutGrid, MapPin,
} from "lucide-react";
import "reactflow/dist/style.css";
import { usePageContext } from "vike-react/usePageContext";
import { tableSheetViewAtom, selectedTableCardIdAtom } from "../../../../state/tableManagerAtoms";

import { createClient } from "../../../../api/client";
import type {
  Booking, CalendarDay, ConfigDailyLimit, ConfigDayStatus, ConfigFloor,
  DashboardMetrics, TableMapArea, TableMapItem,
} from "../../../../api/types";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { DropdownMenu } from "../../../../ui/inputs/DropdownMenu";
import { MonthCalendarDatePicker } from "../../../../ui/widgets/MonthCalendarDatePicker";
import { Select } from "../../../../ui/inputs/Select";
import { Switch } from "../../../../ui/shadcn/Switch";
import { formatHHMM } from "../../../../ui/lib/format";
import { Tabs, type TabItem } from "../../../../ui/nav/Tabs";
import { ScrollArea } from "../../../../ui/layout/ScrollArea";
import { Modal } from "../../../../ui/overlays/Modal";
import { ModalHeader } from "../../../../ui/overlays/ModalHeader";
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
import {
  projectFlowPointToOverlay,
  type FlowViewportTransform,
  type LinePoint,
} from "./lineDrawing";
import {
  findNearestRectInsideLimitArea,
  hasClosedLimitArea,
  isRectInsideLimitArea,
  normalizeLimitPoints,
  type RectSize,
} from "./mapLimits";
import { areaMetadata, floorNumberForArea, limitAreaTemplatePointsForFloor, normalizeTableArea } from "./areaLayout";
import { LineDrawingToolbar } from "./functionalComponents/LineDrawingToolbar/LineDrawingToolbar";

// Re-export types that companion files depend on
export type { TableNodeData, DrawNodeData, DrawElement, BookingState } from "./types/tables";
export { previewGeometry } from "./helpers/tables";

// Types already extracted to types/tables.ts but also defined locally for the component
// (the extracted types in types/tables.ts are re-exported above)
import type {
  TableShape,
  RectShortSide,
  RectShortSides,
  TableDraft,
  TableNodeData,
  DrawElement,
  DrawNodeData,
  BookingState,
  BookingTableAssignment,
} from "./types/tables";
import {
  COLOR_PRESETS,
  RECT_SEAT_OFFSET,
  DRAW_ROTATE_STEP,
  DEFAULT_TABLE_MAP_FIT_VIEW_OPTIONS,
  TABLE_LIMIT_PADDING,
  TABLE_SIZE_MIN,
  DRAW_PANEL_GROUPS,
  DRAW_PRESET_ICONS,
  STATUS_LABEL,
} from "./constants/tables";
import {
  todayISO,
  clampCapacity,
  defaultDraft,
  normalizeRectShortSides,
  maxRectShortSeatsForCapacity,
  shortSidesToMetadata,
  shortSidesFromMetadata,
  previewGeometry,
  interpolatePosition,
  cloneLinePoints,
  elementIntersectsRect,
  normalizeTableKey,
  buildRectChairs,
  buildRoundChairs,
  resolveAssignments,
  sumAssignmentSeats,
  splitPartyAcrossTables,
  normalizeAssignmentSeats,
  assignmentsDisplayName,
  seatedNamesForTable,
  initialDateFromSearch,
  withDateParam,
} from "./helpers/tables";
import {
  buildDayOverrideLayout,
  buildGlobalTemplateLayout,
  buildTemplatePayload,
  defaultScope,
  isNonEmptyTemplate,
  stripDayFieldsForTemplate,
  stripTemplateFieldsForDay,
} from "./helpers/templateScope";
import type { TableMapLayoutTemplate, TableMapTemplateScope } from "../../../../api/types";

// === Status label ===
// Already exported from constants/tables.ts

// === Draw element size helper ===
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

/** Normalizes raw layout element rows (per-day `elements` or cross-day
 *  `draw_elements_template`) into the DrawElement shape the canvas renders. */
function normalizeLayoutElements(raw: unknown): DrawElement[] {
  if (!Array.isArray(raw)) return [];
  return (raw as any[])
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
    .filter(Boolean) as DrawElement[];
}

type MapEditSnapshot = {
  drawElements: DrawElement[];
  limitPoints: LinePoint[];
};

type MapEditHistoryEntry = {
  before: MapEditSnapshot;
  after: MapEditSnapshot;
  timestamp: number;
};

function cloneDrawElements(elements: DrawElement[]): DrawElement[] {
  return elements.map((element) => ({ ...element }));
}

function cloneMapEditSnapshot(snapshot: MapEditSnapshot): MapEditSnapshot {
  return {
    drawElements: cloneDrawElements(snapshot.drawElements),
    limitPoints: cloneLinePoints(snapshot.limitPoints),
  };
}

// === Geometry helpers ===
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

function rectsOverlap(a: RectSize & XYPosition, b: RectSize & XYPosition): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function tableSizeFitsOtherTables(
  node: Node<any>,
  width: number,
  height: number,
  nodes: Node<any>[],
): boolean {
  if (!node.position) return false;
  const data = node.data as TableNodeData;
  const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
  const frame = rotatedRectFrameFromPosition(node.position, width, height, rotationDeg, 0);

  return nodes.every((other) => {
    if (other.id === node.id || other.type !== "restaurantTable" || !other.position) return true;
    const otherData = other.data as TableNodeData;
    const otherGeom = previewGeometry(
      otherData.shape,
      otherData.capacity,
      otherData.rectShortSides,
      typeof otherData.width === "number" || typeof otherData.height === "number"
        ? { width: otherData.width, height: otherData.height }
        : undefined,
    );
    const otherRotation = Number.isFinite(otherData.rotationDeg) ? otherData.rotationDeg : 0;
    const otherFrame = rotatedRectFrameFromPosition(other.position, otherGeom.width, otherGeom.height, otherRotation, 0);
    return !rectsOverlap(frame, otherFrame);
  });
}

// === Table node renderer ===
function tableFromRFNode(data: TableNodeData): React.JSX.Element {
  const explicitSize =
    typeof data.width === "number" || typeof data.height === "number"
      ? { width: data.width, height: data.height }
      : undefined;
  const geom = previewGeometry(data.shape, data.capacity, data.rectShortSides, explicitSize);
  const shape = data.shape === "square" ? "is-square" : "is-round";
  const style: React.CSSProperties = {
    ["--bo-table-fill" as any]: data.fillColor || "var(--bo-surface-2)",
    ["--bo-table-outline" as any]: data.outlineColor || "var(--bo-border-2)",
    ["--bo-table-texture" as any]: data.textureImageUrl ? `url(${data.textureImageUrl})` : "none",
    transform: `rotate(${Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0}deg)`,
    width: `${geom.width}px`,
    height: `${geom.height}px`,
  };
  const seatedNames = data.seatedNames || [];
  return (
    <div
      data-ui="table-node"
      className={`bo-tableMapNode ${shape}${data.assignMode ? " is-assign-mode" : ""}${data.isSelected ? " is-selected" : ""}${data.editable ? " is-editable" : ""}${data.isMultiSelected ? " is-multi-selected" : ""}`}
      style={style}
    >
      {data.editable ? (
        <NodeResizer
          isVisible={data.editable && Boolean(data.isSelected)}
          minWidth={TABLE_SIZE_MIN}
          minHeight={TABLE_SIZE_MIN}
          lineStyle={{ borderColor: "var(--bo-accent)" }}
          handleStyle={{ width: 10, height: 10, border: "1px solid var(--bo-accent)", background: "var(--bo-surface)" }}
          onResizeEnd={(_event, params) => {
            const width = Number(params?.width);
            const height = Number(params?.height);
            if (Number.isFinite(width) && Number.isFinite(height)) {
              data.onResizeEnd?.(Math.round(width), Math.round(height));
            }
          }}
        />
      ) : null}
      {geom.chairs.map((chair, idx) => (
        <span key={`node-chair-${idx}`} data-ui="chair" className="bo-tableMapChair" style={{ transform: `translate(${chair.x}px, ${chair.y}px)` }} />
      ))}
      <div data-ui="node-pax" className="bo-tableMapNodePax">
        <Users size={11} strokeWidth={1.8} aria-hidden="true" />
        <span data-ui="node-pax-value">{data.capacity} pax</span>
      </div>
      <div data-ui="node-number" className="bo-tableMapNodeNum">{data.numeroMesa || data.id}</div>
      <div data-ui="node-status" className={`bo-tableMapNodeStatus is-${data.status}`}>{STATUS_LABEL[data.status]}</div>
      {seatedNames.length > 0 ? (
        <div data-ui="node-seated-names" className="bo-tableMapNodeSeatedNames">{seatedNames.join(", ")}</div>
      ) : null}
      {/* Multi-table selection overlay - buttons outside container on top-right */}
      {data.isMultiSelected && (
        <div data-ui="multi-select-overlay" className="bo-tableMultiSelectOverlay">
          <button
            data-ui="multi-names-btn"
            type="button"
            className="bo-tableMultiSelectBtn"
            title="Nombres"
            onClick={(e) => {
              e.stopPropagation();
              data.onMultiNamesClick?.();
            }}
          >
            <ClipboardList size={12} strokeWidth={2} />
          </button>
          <button
            data-ui="multi-remove-btn"
            type="button"
            className="bo-tableMultiSelectBtn bo-tableMultiSelectBtn--remove"
            title="Quitar"
            onClick={(e) => {
              e.stopPropagation();
              data.onMultiRemoveClick?.();
            }}
          >
            <X size={12} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}

const TableNode = ({ data }: { data: TableNodeData }) => tableFromRFNode(data);

// === Draw element node renderer ===
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
    <div data-ui="draw-element" className={`bo-drawElementNode ${cls}${data.isSelected ? " is-selected" : ""}${assetImageUrl && showAsset ? " has-asset" : ""}${showText ? " has-text" : " no-text"}`} style={style}>
      <NodeResizer
        isVisible={data.editable}
        minWidth={24}
        minHeight={24}
        lineStyle={{ borderColor: "var(--bo-accent)" }}
        handleStyle={{ width: 10, height: 10, border: "1px solid var(--bo-accent)", background: "var(--bo-surface)" }}
        onResizeEnd={(_event, params) => {
          const width = Number(params?.width);
          const height = Number(params?.height);
          if (Number.isFinite(width) && Number.isFinite(height)) {
            data.onResizeEnd?.(Math.round(width), Math.round(height));
          }
        }}
      />
      {data.editable && data.isSelected && data.onDelete ? (
        <button
          data-ui="delete-draw-element-btn"
          className="bo-drawElementDeleteBtn"
          type="button"
          aria-label={`Eliminar ${data.label}`}
          title={`Eliminar ${data.label}`}
          onMouseDown={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            data.onDelete?.();
          }}
        >
          <Trash2 size={13} strokeWidth={2} />
        </button>
      ) : null}
      {showAsset ? (
        assetImageUrl ? (
          <img data-ui="draw-asset" className="bo-drawElementNodeAsset" src={assetImageUrl} alt="" aria-hidden="true" />
        ) : (
          <span data-ui="draw-icon" className="bo-drawElementNodeIcon" aria-hidden="true">{DRAW_PRESET_ICONS[data.preset]}</span>
        )
      ) : null}
      {showText ? <span data-ui="draw-label" className="bo-drawElementNodeLabel">{data.label}</span> : null}
    </div>
  );
};

const NODE_TYPES = {
  restaurantTable: TableNode,
  drawElement: DrawElementNode,
};

// === File conversion helper ===
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

// === Guest names modal ===
export type GuestNamesModalProps = {
  tableName: string;
  capacity: number;
  names: string[];
  onSave: (names: string[]) => void;
  onClose: () => void;
};

export function GuestNamesModal({ tableName, capacity, names, onSave, onClose }: GuestNamesModalProps) {
  const [draft, setDraft] = useState<string[]>(() => {
    const result = new Array(capacity).fill("");
    for (let i = 0; i < Math.min(names.length, capacity); i++) {
      result[i] = names[i] || "";
    }
    return result;
  });

  const handleChange = useCallback((idx: number, value: string) => {
    setDraft((prev) => {
      const next = [...prev];
      next[idx] = value;
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    onSave(draft.map((n) => n.trim()).filter(Boolean));
    onClose();
  }, [draft, onSave, onClose]);

  return (
    <div data-ui="guest-names-modal" className="bo-guestNamesModal">
      <div data-ui="guest-names-backdrop" className="bo-guestNamesBackdrop" onClick={onClose} />
      <div data-ui="guest-names-content" className="bo-guestNamesContent">
        <div data-ui="guest-names-header" className="bo-guestNamesHeader">
          <h3>Comensales en {tableName || "mesa"}</h3>
          <button type="button" className="bo-actionBtn bo-actionBtn--glass" onClick={onClose} aria-label="Cerrar">
            <X size={14} strokeWidth={2} />
          </button>
        </div>
        <div data-ui="guest-names-inputs" className="bo-guestNamesInputs">
          {draft.map((name, idx) => (
            <div key={idx} data-ui="guest-name-row" className="bo-guestNameRow">
              <label className="bo-guestNameLabel">Comensal {idx + 1}</label>
              <input
                data-ui="guest-name-input"
                className="bo-input"
                value={name}
                placeholder={`Nombre comensal ${idx + 1}`}
                onChange={(e) => handleChange(idx, e.target.value)}
              />
            </div>
          ))}
        </div>
        <div data-ui="guest-names-footer" className="bo-guestNamesFooter">
          <button type="button" className="bo-btn bo-btn--ghost bo-btn--sm" onClick={onClose}>
            Cancelar
          </button>
          <button type="button" className="bo-btn bo-btn--primary bo-btn--sm" onClick={handleSave}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// === PDF generator for multi-table assignment ===
async function downloadMultiTablePdf(
  bookingName: string,
  assignments: Array<{ table_name: string; seats: number; names: string[] }>,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const PAGE_WIDTH = 210;
  const PAGE_HEIGHT = 297;
  const MARGIN = 15;
  const CARD_GAP = 10;
  const CARD_WIDTH = (PAGE_WIDTH - MARGIN * 2 - CARD_GAP) / 2;
  const CARD_MIN_HEIGHT = 50;
  const LINE_HEIGHT = 6;
  const HEADER_HEIGHT = 10;

  let x = MARGIN;
  let y = MARGIN;
  let col = 0;
  let maxRowHeight = 0;

  // Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Reserva: ${bookingName}`, MARGIN, y + 5);
  y += 15;

  for (const assignment of assignments) {
    const nameCount = Math.max(assignment.seats, assignment.names.length, 1);
    const cardHeight = Math.max(CARD_MIN_HEIGHT, HEADER_HEIGHT + nameCount * LINE_HEIGHT + 10);

    // Check if we need a new row or page
    if (y + cardHeight > PAGE_HEIGHT - MARGIN) {
      doc.addPage();
      y = MARGIN;
      x = MARGIN;
      col = 0;
      maxRowHeight = 0;
    }

    // Draw card border
    doc.setDrawColor("#cccccc");
    doc.setLineWidth(0.3);
    doc.rect(x, y, CARD_WIDTH, cardHeight);

    // Table header
    doc.setFillColor("#f5f5f5");
    doc.rect(x, y, CARD_WIDTH, HEADER_HEIGHT, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor("#333333");
    doc.text(`Mesa ${assignment.table_name}`, x + 4, y + 7);

    // Guest names
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor("#000000");
    let nameY = y + HEADER_HEIGHT + 6;
    for (let i = 0; i < nameCount; i++) {
      const name = assignment.names[i]?.trim() || `— Comensal ${i + 1}`;
      doc.text(name, x + 4, nameY);
      nameY += LINE_HEIGHT;
    }

    maxRowHeight = Math.max(maxRowHeight, cardHeight);

    // Move to next column or row
    col++;
    if (col >= 2) {
      col = 0;
      x = MARGIN;
      y += maxRowHeight + CARD_GAP;
      maxRowHeight = 0;
    } else {
      x += CARD_WIDTH + CARD_GAP;
    }
  }

  const safeBookingName = bookingName.replace(/[^\w.-]+/g, "-") || "reserva";
  doc.save(`mesas-${safeBookingName}.pdf`);
}

// === Booking multi-table assignment editor ===
type BookingAssignmentEditorProps = {
  booking: Booking;
  state: BookingState | undefined;
  tables: TableMapItem[];
  /** Seats already committed to each table by OTHER bookings (for capacity hints). */
  occupiedSeats: Map<string, number>;
  onSave: (assignments: BookingTableAssignment[]) => void;
};

function BookingAssignmentEditor({ booking, state, tables, occupiedSeats, onSave }: BookingAssignmentEditorProps) {
  const [draft, setDraft] = useState<BookingTableAssignment[]>(() =>
    resolveAssignments(state, booking.table_number, booking.party_size),
  );
  const [namesModalRow, setNamesModalRow] = useState<number | null>(null);
  const partySize = Math.max(1, Math.round(Number(booking.party_size) || 1));

  useEffect(() => {
    setDraft(resolveAssignments(state, booking.table_number, booking.party_size));
  }, [booking.id, booking.party_size, booking.table_number, state]);

  const totalSeats = useMemo(() => sumAssignmentSeats(draft), [draft]);
  const seatsOk = totalSeats === partySize;

  // Map table name -> capacity for quick lookup
  const tableCapacityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tables) {
      const key = normalizeTableKey(t.name);
      if (key) map.set(key, Math.max(1, Number(t.capacity) || 4));
    }
    return map;
  }, [tables]);

  const tableOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    const seen = new Set<string>();
    for (const t of tables) {
      const key = normalizeTableKey(t.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      const capacity = Math.max(1, Number(t.capacity) || 4);
      const otherSeats = Math.max(0, occupiedSeats.get(key) || 0);
      const freeSeats = Math.max(0, capacity - otherSeats);
      opts.push({
        value: t.name,
        label: `${t.name} (${capacity} pax${freeSeats < capacity ? `, ${freeSeats} libres` : ""})`,
      });
    }
    return opts;
  }, [occupiedSeats, tables]);

  const optionsForRow = useCallback(
    (row: BookingTableAssignment): Array<{ value: string; label: string }> => {
      if (!row.table_name) return tableOptions;
      const exists = tableOptions.some((o) => normalizeTableKey(o.value) === normalizeTableKey(row.table_name));
      if (exists) return tableOptions;
      return [{ value: row.table_name, label: `${row.table_name} (actual)` }, ...tableOptions];
    },
    [tableOptions],
  );

  const setRow = useCallback(
    (idx: number, patch: Partial<BookingTableAssignment>) => {
      setDraft((prev) => {
        const next = prev.map((row, i) => (i === idx ? { ...row, ...patch } : row));
        // Note: we no longer normalize seats across tables automatically since seats are locked to capacity
        return next;
      });
    },
    [],
  );

  // When table is selected, lock seats to table capacity
  const handleTableSelect = useCallback(
    (idx: number, tableName: string) => {
      const table = tables.find((t) => normalizeTableKey(t.name) === normalizeTableKey(tableName));
      const capacity = table ? Math.max(1, Number(table.capacity) || 4) : 1;
      setDraft((prev) => {
        const next = prev.map((row, i) =>
          i === idx ? { ...row, table_name: tableName, table_id: table?.id ?? null, seats: capacity } : row,
        );
        return next;
      });
    },
    [tables],
  );

  const addRow = useCallback(() => {
    setDraft((prev) => [...prev, { table_id: null, table_name: "", seats: 1, names: [] }]);
  }, []);

  const removeRow = useCallback((idx: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleSaveNames = useCallback(
    (idx: number, names: string[]) => {
      setRow(idx, { names });
    },
    [setRow],
  );

  const handleDownloadPdf = useCallback(async () => {
    const bookingName = booking.customer_name?.trim() || `Reserva ${booking.id}`;
    await downloadMultiTablePdf(bookingName, draft);
  }, [booking.id, booking.customer_name, draft]);

  const hasAnyNames = draft.some((row) => row.names.length > 0);
  const isMultiTable = draft.length > 1;
  const showPdfButton = isMultiTable || hasAnyNames;

  // Get the modal row data for GuestNamesModal
  const modalRow = namesModalRow !== null ? draft[namesModalRow] : null;
  const modalCapacity = modalRow ? (tableCapacityMap.get(normalizeTableKey(modalRow.table_name)) || modalRow.seats) : 1;

  return (
    <div data-ui="booking-assignment-editor" className="bo-bookingAssignmentEditor">
      {draft.length === 0 ? (
        <div data-ui="assignment-empty" className="bo-bookingAssignmentEmpty">Sin mesas asignadas</div>
      ) : (
        <div data-ui="assignment-rows" className="bo-bookingAssignmentRows">
          {draft.map((row, idx) => {
            const rowCapacity = tableCapacityMap.get(normalizeTableKey(row.table_name)) || row.seats;
            const isLocked = Boolean(row.table_name);
            const namesCount = row.names.filter(Boolean).length;
            return (
              <div key={idx} data-ui="assignment-row" className="bo-bookingAssignmentRow">
                <Select
                  value={row.table_name}
                  onChange={(val) => handleTableSelect(idx, val)}
                  options={optionsForRow(row)}
                  ariaLabel={`Mesa ${idx + 1}`}
                  size="sm"
                  placeholder="Elegir mesa"
                />
                {isLocked ? (
                  <span data-ui="assignment-seats-chip" className="bo-bookingAssignmentSeatsChip" title="Capacidad fija de la mesa">
                    {rowCapacity} pax
                  </span>
                ) : (
                  <div data-ui="assignment-seats" className="bo-bookingAssignmentSeats">
                    <button
                      type="button"
                      className="bo-counterBtn"
                      aria-label="Restar comensal"
                      onClick={() => setRow(idx, { seats: Math.max(1, row.seats - 1) })}
                    >
                      <Minus size={12} strokeWidth={2.2} />
                    </button>
                    <span data-ui="assignment-seats-value" className="bo-bookingAssignmentSeatsValue">{row.seats}</span>
                    <button
                      type="button"
                      className="bo-counterBtn"
                      aria-label="Sumar comensal"
                      onClick={() => setRow(idx, { seats: row.seats + 1 })}
                    >
                      <Plus size={12} strokeWidth={2.2} />
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  data-ui="open-names-modal"
                  className="bo-actionBtn bo-actionBtn--glass"
                  aria-label={`Nombres en ${row.table_name || `mesa ${idx + 1}`}`}
                  title={namesCount > 0 ? `${namesCount} nombre(s)` : "Añadir nombres"}
                  onClick={() => setNamesModalRow(idx)}
                >
                  <ClipboardList size={13} strokeWidth={1.8} />
                  {namesCount > 0 && <span className="bo-namesBadge">{namesCount}</span>}
                </button>
                <button
                  type="button"
                  data-ui="remove-assignment-row"
                  className="bo-actionBtn bo-actionBtn--glass"
                  aria-label={`Quitar mesa ${row.table_name || idx + 1}`}
                  onClick={() => removeRow(idx)}
                >
                  <Trash2 size={13} strokeWidth={1.8} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <div data-ui="assignment-footer" className="bo-bookingAssignmentFooter">
        <button
          data-ui="add-table-assignment"
          className="bo-btn bo-btn--ghost bo-btn--sm"
          type="button"
          onClick={addRow}
        >
          <Plus size={13} strokeWidth={1.8} /> Añadir mesa
        </button>
        <span data-ui="assignment-total" className={`bo-bookingAssignmentTotal${seatsOk ? " is-ok" : " is-warn"}`}>
          {totalSeats} / {partySize} pax
        </span>
        {showPdfButton && (
          <button
            data-ui="download-pdf-btn"
            className="bo-btn bo-btn--ghost bo-btn--sm"
            type="button"
            onClick={handleDownloadPdf}
            title="Descargar PDF con mesas y comensales"
          >
            <FileDown size={13} strokeWidth={1.8} /> PDF
          </button>
        )}
        <button
          data-ui="save-assignments-btn"
          className="bo-btn bo-btn--primary bo-btn--sm"
          type="button"
          onClick={() => onSave(draft)}
        >
          Guardar mesas
        </button>
      </div>
      {namesModalRow !== null && modalRow && (
        <GuestNamesModal
          tableName={modalRow.table_name || `Mesa ${namesModalRow + 1}`}
          capacity={modalCapacity}
          names={modalRow.names}
          onSave={(names) => handleSaveNames(namesModalRow, names)}
          onClose={() => setNamesModalRow(null)}
        />
      )}
    </div>
  );
}

// === Main Page Component ===
export default function TableManagerPage() {
  const pageContext = usePageContext();
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const initialDate = useMemo(
    () => initialDateFromSearch(pageContext.urlParsed?.search?.date, todayISO()),
    [pageContext.urlParsed?.search?.date],
  );
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [calendarView, setCalendarView] = useState(() => {
    const [y, m] = String(initialDate).split("-").map((n) => Number(n));
    return {
      year: Number.isFinite(y) ? y : new Date().getFullYear(),
      month: Number.isFinite(m) ? m : new Date().getMonth() + 1,
    };
  });
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
  const [editMode, setEditMode] = useState(false);
  const [drawPanelDismissed, setDrawPanelDismissed] = useState(false);
  const [lineDrawing, setLineDrawing] = useState<{ points: LinePoint[]; isDrawing: boolean }>({ points: [], isDrawing: false });
  const [isEditingLimitArea, setIsEditingLimitArea] = useState(false);
  const [draggingLimitVertexIndex, setDraggingLimitVertexIndex] = useState<number | null>(null);
  const [interactionMode, setInteractionMode] = useState<"select" | "pan">("pan");
  const [calendarExpanded, setCalendarExpanded] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [bookingForAssignment, setBookingForAssignment] = useState<Booking | null>(null);
  const [assignMode, setAssignMode] = useState(false);
  const [multiTableMode, setMultiTableMode] = useState(false);
  const [multiTableDraft, setMultiTableDraft] = useState<BookingTableAssignment[]>([]);
  const [multiTableNamesModalIdx, setMultiTableNamesModalIdx] = useState<number | null>(null);
  const [selectedBookingId, setSelectedBookingId] = useState<number | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [selectedDrawElementId, setSelectedDrawElementId] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuTooltipStyle, setMenuTooltipStyle] = useState<React.CSSProperties>({});
  const [drawPanelHover, setDrawPanelHover] = useState(false);
  const [elementosOpen, setElementosOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [dayBusy, setDayBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [savingLimitTemplate, setSavingLimitTemplate] = useState(false);
  const [removeAreaConfirmOpen, setRemoveAreaConfirmOpen] = useState(false);
  // Cross-day layout template (per floor). When `templateScope` is "template"
  // the editor commits to the global template; when "day" it stores day-specific
  // overrides without touching the template.
  const [floorTemplate, setFloorTemplate] = useState<TableMapLayoutTemplate | null>(null);
  const [templateScope, setTemplateScope] = useState<TableMapTemplateScope>("day");
  const [templateScopeLocked, setTemplateScopeLocked] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [confirmScopeChange, setConfirmScopeChange] = useState<
    | { next: TableMapTemplateScope; reason: "switch-to-day" | "switch-to-template" }
    | null
  >(null);

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
  const nodeTypes = NODE_TYPES;
  const reduceMotion = useReducedMotion();
  const isDayOpen = day?.isOpen !== false;
  const dayVisibilityTransition = reduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeInOut" as const };

  const ws = useRef<WebSocket | null>(null);
  const drawElementsRef = useRef<DrawElement[]>([]);
  const deleteSelectedDrawElementRef = useRef<() => void>(() => undefined);
  const lineDrawingPointsRef = useRef<LinePoint[]>([]);
  const limitEditHistoryRef = useRef<LinePoint[][]>([]);
  const bookingStatesRef = useRef<Record<string, BookingState>>({});
  const persistLayoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingMapWSMessagesRef = useRef<string[]>([]);
  const mapHistoryRef = useRef(new Map<string, { undo: MapEditHistoryEntry[]; redo: MapEditHistoryEntry[]; last: MapEditSnapshot | null }>());
  const applyingHistoryRef = useRef(false);
  const drawPanelHoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flowWrapRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);
  const rightSheetRef = useRef<HTMLElement | null>(null);
  const assignmentInProgress = useRef(false);
  const saveBookingAssignmentsRef = useRef<(booking: Booking, assignments: BookingTableAssignment[]) => Promise<void>>(async () => undefined);
  const saveTableSizeRef = useRef<(id: string, width: number, height: number) => void>(() => undefined);
  const saveDrawElementSizeRef = useRef<(id: string, width: number, height: number) => void>(() => undefined);
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

  const mapHistoryKey = useCallback(
    () => `${Number(pageContext.bo?.session?.activeRestaurantId || 0)}:${selectedFloor}:${selectedDate}:${templateScope}`,
    [pageContext.bo?.session?.activeRestaurantId, selectedDate, selectedFloor, templateScope],
  );

  const getMapHistory = useCallback(() => {
    const key = mapHistoryKey();
    let history = mapHistoryRef.current.get(key);
    if (!history) {
      history = { undo: [], redo: [], last: null };
      mapHistoryRef.current.set(key, history);
    }
    return history;
  }, [mapHistoryKey]);

  const setMapHistoryBaseline = useCallback((elements: DrawElement[], points: LinePoint[]) => {
    const history = getMapHistory();
    history.last = cloneMapEditSnapshot({ drawElements: elements, limitPoints: points });
    history.undo = [];
    history.redo = [];
    setHistoryVersion((version) => version + 1);
  }, [getMapHistory]);

  const sendMapWSMessage = useCallback((message: Record<string, unknown>) => {
    const raw = JSON.stringify(message);
    const socket = ws.current;
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(raw);
      return;
    }
    pendingMapWSMessagesRef.current.push(raw);
  }, []);

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
    const allTables = areas.flatMap((a) => a.tables || []);
    const usedNames = new Set(allTables.map((t) => normalizeTableKey(t.name)));
    // Start above the visible count; keep bumping until "Mesa N" is free so a
    // duplicate name can never be suggested (tables not nested under an area
    // or tables with custom names would otherwise collide).
    let n = allTables.length + 1;
    while (usedNames.has(normalizeTableKey(`Mesa ${n}`))) n += 1;
    return n;
  }, [areas]);

  // Suggested next numero_mesa: scan numeric numero_mesa values already in use
  // and return max+1 as a string. Non-numeric labels (e.g. "4B") are ignored,
  // so they never block a plain numeric suggestion. The backend validates
  // final uniqueness, so this is only a best-effort prefill.
  const nextTableNumero = useMemo(() => {
    const allTables = areas.flatMap((a) => a.tables || []);
    const used = new Set(allTables.map((t) => normalizeTableKey(String(t.numero_mesa ?? ""))));
    let n = allTables.length + 1;
    while (used.has(normalizeTableKey(String(n)))) n += 1;
    return String(n);
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
        // Per-day elements win when present; otherwise fall back to the
        // cross-day template the backend merges into the layout response.
        const perDayElements = normalizeLayoutElements(mapLayout.elements);
        const templateElements = normalizeLayoutElements(mapLayout.draw_elements_template);
        const loadedElements = perDayElements.length > 0 ? perDayElements : templateElements;
        drawElementsRef.current = loadedElements;
        setDrawElements(loadedElements);

        // Limit points: per-day polygon wins, then the merged template polygon,
        // then the legacy area-metadata path.
        const loadedLimitPoints = normalizeLimitPoints(mapLayout.limit_points);
        const templateLayoutPoints = normalizeLimitPoints(mapLayout.limit_area_template_points);
        const legacyTemplatePoints = limitAreaTemplatePointsForFloor(loadedAreas, selectedFloor);
        const activeLimitPoints = hasClosedLimitArea(loadedLimitPoints)
          ? loadedLimitPoints
          : hasClosedLimitArea(templateLayoutPoints)
            ? templateLayoutPoints
            : legacyTemplatePoints;
        lineDrawingPointsRef.current = activeLimitPoints;
        limitEditHistoryRef.current = [];
        setLineDrawing({ points: activeLimitPoints, isDrawing: false });
        const history = getMapHistory();
        if (!history.last) setMapHistoryBaseline(loadedElements, activeLimitPoints);

        const loadedBookingStates: Record<string, BookingState> = {};
        const rawBookingStates = mapLayout.booking_states as Record<string, unknown> | undefined;
        if (rawBookingStates && typeof rawBookingStates === "object") {
          for (const [key, value] of Object.entries(rawBookingStates)) {
            const raw = value as any;
            const rawAssignments = Array.isArray(raw?.assignments) ? raw.assignments : undefined;
            const assignments = rawAssignments
              ? (rawAssignments as any[]).map((item) => ({
                  table_id: typeof item?.table_id === "number" ? item.table_id : item?.table_id ? Number(item.table_id) : null,
                  table_name: String(item?.table_name || ""),
                  seats: Math.max(1, Math.round(Number(item?.seats) || 1)),
                  names: Array.isArray(item?.names) ? item.names.map((n: any) => String(n || "")) : [],
                }))
              : undefined;
            loadedBookingStates[key] = {
              seated: Boolean(raw?.seated),
              ...(assignments ? { assignments } : {}),
            };
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

  // Load the cross-day template for the current floor and re-derive the
  // default scope. Done as a separate effect so it re-runs when the floor
  // changes (and not on every per-day layout refresh).
  useEffect(() => {
    let cancelled = false;
    async function loadTemplateForFloor() {
      try {
        const res = await api.tables.getTemplate(selectedFloor);
        if (cancelled) return;
        if (!res.success) {
          setFloorTemplate(null);
          setTemplateScope(defaultScope(false));
          return;
        }
        const tpl = isNonEmptyTemplate((res as any).template) ? ((res as any).template as TableMapLayoutTemplate) : null;
        setFloorTemplate(tpl);
        setTemplateScope(defaultScope(tpl !== null, (res as any).scope));
      } catch {
        if (cancelled) return;
        setFloorTemplate(null);
        setTemplateScope(defaultScope(false));
      }
    }
    void loadTemplateForFloor();
    return () => {
      cancelled = true;
    };
  }, [api.tables, selectedFloor]);

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
    setEditMode(false);
    setDrawPanelDismissed(true);
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

  // Table occupancy map (multi-table aware: a booking can occupy several tables)
  const tableOccupancyMap = useMemo(() => {
    const out = new Map<string, { booked: number; seated: number }>();
    for (const booking of bookings) {
      const state = bookingStates[String(booking.id)];
      const assignments = resolveAssignments(state, booking.table_number, booking.party_size);
      for (const assignment of assignments) {
        const key = normalizeTableKey(assignment.table_name);
        if (!key) continue;
        const seats = Math.max(0, Number(assignment.seats) || Number(booking.party_size) || 0);
        const row = out.get(key) || { booked: 0, seated: 0 };
        row.booked += seats;
        if (state?.seated) row.seated += seats;
        out.set(key, row);
      }
    }
    return out;
  }, [bookingStates, bookings]);

  // Get bookings for a specific table (multi-table aware)
  const getTableBookings = useCallback((tableName: string): Booking[] => {
    const key = normalizeTableKey(tableName);
    return bookings.filter((b) => {
      if (normalizeTableKey(b.table_number) === key) return true;
      const state = bookingStates[String(b.id)];
      const assignments = resolveAssignments(state, b.table_number, b.party_size);
      return assignments.some((a) => normalizeTableKey(a.table_name) === key);
    });
  }, [bookingStates, bookings]);

  // Names of seated guests grouped by table name (for map node display).
  const seatedNamesByTable = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const booking of bookings) {
      const state = bookingStates[String(booking.id)];
      if (!state?.seated) continue;
      const assignments = resolveAssignments(state, booking.table_number, booking.party_size);
      for (const assignment of assignments) {
        const key = normalizeTableKey(assignment.table_name);
        if (!key) continue;
        const names = (assignment.names || []).map((n) => String(n || "").trim()).filter(Boolean);
        if (names.length === 0) continue;
        map.set(key, [...(map.get(key) || []), ...names]);
      }
    }
    return map;
  }, [bookingStates, bookings]);

  // Total seats committed to each table (used for capacity validation when
  // splitting a booking across several tables).
  const occupiedSeatsByTable = useMemo(() => {
    const map = new Map<string, number>();
    for (const booking of bookings) {
      const state = bookingStates[String(booking.id)];
      const assignments = resolveAssignments(state, booking.table_number, booking.party_size);
      for (const assignment of assignments) {
        const key = normalizeTableKey(assignment.table_name);
        if (!key) continue;
        map.set(key, (map.get(key) || 0) + Math.max(0, Number(assignment.seats) || Number(booking.party_size) || 0));
      }
    }
    return map;
  }, [bookingStates, bookings]);

  // Same map but without the given booking's own seats (capacity hints in the
  // assignment editor should only reflect what OTHER bookings occupy).
  const occupiedSeatsExcludingBooking = useCallback(
    (booking: Booking | null): Map<string, number> => {
      if (!booking) return occupiedSeatsByTable;
      const map = new Map(occupiedSeatsByTable);
      const prev = resolveAssignments(bookingStates[String(booking.id)], booking.table_number, booking.party_size);
      for (const a of prev) {
        const key = normalizeTableKey(a.table_name);
        map.set(key, Math.max(0, (map.get(key) || 0) - Math.max(0, Number(a.seats) || 0)));
      }
      return map;
    },
    [bookingStates, occupiedSeatsByTable],
  );

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

  const [tableSheetView, setTableSheetView] = useAtom(tableSheetViewAtom);
  const [selectedTableCardId, setSelectedTableCardId] = useAtom(selectedTableCardIdAtom);

  const selectedTableCard = useMemo(
    () => visibleTables.find((t) => t.id === selectedTableCardId) || null,
    [visibleTables, selectedTableCardId],
  );

  const selectedTableCardBookings = useMemo(
    () => (selectedTableCard ? getTableBookings(selectedTableCard.name) : []),
    [selectedTableCard, getTableBookings],
  );

  const selectedTableCardIsOccupied = useMemo(() => {
    if (!selectedTableCard) return false;
    const key = normalizeTableKey(selectedTableCard.name);
    const occ = tableOccupancyMap.get(key);
    return (occ?.booked ?? 0) > 0 || (occ?.seated ?? 0) > 0;
  }, [selectedTableCard, tableOccupancyMap]);

  const unassignedBookings = useMemo(
    () => bookings.filter((b) => !b.table_number),
    [bookings],
  );

  const assignBookingToFreeTable = useCallback(
    async (booking: Booking, tableName: string) => {
      const table = visibleTables.find((t) => normalizeTableKey(t.name) === normalizeTableKey(tableName));
      const existing = resolveAssignments(bookingStatesRef.current[String(booking.id)], booking.table_number, booking.party_size);
      const already = existing.some((a) => normalizeTableKey(a.table_name) === normalizeTableKey(tableName));
      const assignments: BookingTableAssignment[] = already
        ? existing
        : [
            {
              table_id: table?.id ?? null,
              table_name: tableName,
              seats: Math.max(1, Math.round(Number(booking.party_size) || 1)),
              names: [],
            },
          ];
      await saveBookingAssignmentsRef.current(booking, assignments);
      setSelectedTableCardId(null);
    },
    [setSelectedTableCardId, visibleTables],
  );

  const unassignBookingFromTable = useCallback(
    async (booking: Booking) => {
      await saveBookingAssignmentsRef.current(booking, []);
      setTableSheetView("list");
      setSelectedTableCardId(null);
    },
    [setTableSheetView, setSelectedTableCardId],
  );

  const closeTableDetail = useCallback(() => {
    setTableSheetView("list");
    setSelectedTableCardId(null);
  }, [setTableSheetView, setSelectedTableCardId]);

  useEffect(() => {
    setNodes(
      [
        ...visibleTables.map((table) => {
          const tableKey = normalizeTableKey(table.name);
          const occ = tableOccupancyMap.get(tableKey);
          const hasBookings = occ && occ.booked > 0;
          const hasSeated = occ && occ.seated > 0;
          // Status is derived from bookings only - ignore DB status field
          const nodeStatus = hasSeated ? "occupied" : hasBookings ? "reserved" : "available";
          const metadata = (table.metadata || {}) as Record<string, unknown>;
          const explicitWidth = Number(metadata.width);
          const explicitHeight = Number(metadata.height);
          // Check if this table is in the multi-table draft
          const multiDraftIdx = multiTableDraft.findIndex((d) => d.table_id === table.id);
          const isMultiSelected = multiTableMode && multiDraftIdx >= 0;
          return {
            id: String(table.id),
            type: "restaurantTable",
            draggable: true,
            position: { x: table.x_pos || 0, y: table.y_pos || 0 },
            data: {
              id: table.id,
              name: table.name || `Mesa ${table.id}`,
              numeroMesa: table.numero_mesa || String(table.id),
              capacity: clampCapacity(table.capacity || 4),
              status: nodeStatus as TableMapItem["status"],
              shape: (table.shape || "round") as TableShape,
              fillColor: table.fill_color || "",
              outlineColor: table.outline_color || "",
              textureImageUrl: table.texture_image_url || "",
              rotationDeg: Number(metadata.rotation_deg || 0),
              rectShortSides: shortSidesFromMetadata(metadata.short_side_seats, table.capacity || 4),
              assignMode,
              isSelected: selectedTableId === table.id,
              editable: editMode,
              width: Number.isFinite(explicitWidth) && explicitWidth > 0 ? Math.round(explicitWidth) : undefined,
              height: Number.isFinite(explicitHeight) && explicitHeight > 0 ? Math.round(explicitHeight) : undefined,
              onResizeEnd: (width, height) => saveTableSizeRef.current(String(table.id), width, height),
              seatedNames: seatedNamesByTable.get(tableKey) || [],
              isMultiSelected,
              multiTableDraftIdx: multiDraftIdx,
              onMultiNamesClick: isMultiSelected ? () => setMultiTableNamesModalIdx(multiDraftIdx) : undefined,
              onMultiRemoveClick: isMultiSelected ? () => setMultiTableDraft((prev) => prev.filter((_, i) => i !== multiDraftIdx)) : undefined,
            } as TableNodeData,
          };
        }),
        ...drawElements.map((item) => ({
          id: item.id,
          type: "drawElement",
          draggable: editMode,
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
            editable: editMode,
            onDelete: () => deleteSelectedDrawElementRef.current(),
            onResizeEnd: (width, height) => saveDrawElementSizeRef.current(item.id, width, height),
          } as DrawNodeData,
        })),
      ],
    );
  }, [assignMode, drawElements, editMode, multiTableDraft, multiTableMode, selectedDrawElementId, selectedTableId, seatedNamesByTable, setNodes, tableOccupancyMap, visibleTables]);

  useEffect(() => {
    const secure = typeof window !== "undefined" && window.location.protocol === "https:";
    const wsURL = `${secure ? "wss" : "ws"}://${window.location.host}/api/admin/tables/ws`;
    const socket = new WebSocket(wsURL);
    ws.current = socket;
    socket.onopen = () => {
      for (const raw of pendingMapWSMessagesRef.current.splice(0)) socket.send(raw);
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === "snapshot" && Array.isArray(payload.areas)) {
          setAreas(payload.areas.map((a: any) => normalizeTableArea(a)));
          // The server also ships the resolved template + scope in the
          // snapshot; pick them up so the toggle stays in sync with any
          // other open tab or the backend itself.
          const snapshotTemplate = isNonEmptyTemplate(payload.layout?.template)
            ? (payload.layout.template as TableMapLayoutTemplate)
            : null;
          if (snapshotTemplate !== null) {
            setFloorTemplate(snapshotTemplate);
            setTemplateScope(defaultScope(true, payload.layout?.scope));
          } else {
            setFloorTemplate(null);
            setTemplateScope(defaultScope(false, payload.layout?.scope));
          }
          return;
        }
        if (payload.type === "area_created" || payload.type === "area_updated") {
          const area = (payload.data || payload) as any;
          if (!area?.id) return;
          const nextArea = normalizeTableArea(area);
          setAreas((prev) => {
            if (prev.some((a) => a.id === area.id)) {
              return prev.map((a) => (a.id === area.id ? { ...a, ...nextArea } : a));
            }
            return [...prev, nextArea];
          });
          return;
        }
        if (payload.type === "area_deleted") {
          const area = (payload.data || payload) as any;
          const id = Number(area?.id);
          if (!Number.isFinite(id) || id <= 0) return;
          setAreas((prev) => prev.filter((a) => Number(a.id) !== id));
          return;
        }
        if (payload.type === "template_updated") {
          const floor = Number(payload.floor_number);
          if (Number.isFinite(floor) && floor !== selectedFloor) return;
          const tpl = isNonEmptyTemplate(payload.template) ? (payload.template as TableMapLayoutTemplate) : null;
          if (tpl) {
            setFloorTemplate(tpl);
            setTemplateScope("template");
          } else {
            setFloorTemplate(null);
            setTemplateScope("day");
          }
          return;
        }
        if (payload.type === "template_cleared") {
          const floor = Number(payload.floor_number);
          if (Number.isFinite(floor) && floor !== selectedFloor) return;
          setFloorTemplate(null);
          setTemplateScope("day");
          return;
        }
        if (payload.type === "layout_updated") {
          const floor = Number(payload.floor_number);
          if (Number.isFinite(floor) && floor !== selectedFloor) return;
          if (String(payload.date || "") !== selectedDate) return;
          // The generic broadcast wraps the payload under `data`; date/floor are
          // copied to the top level but `layout` only lives inside `data` on
          // current backends. Read both so older and newer servers both work.
          const data = (payload.data || {}) as Record<string, unknown>;
          const layout = ((data.layout || payload.layout) || {}) as Record<string, unknown>;
          const elements = Array.isArray(layout.elements) ? (layout.elements as any[]).map((item) => ({
            id: String(item?.id || ""),
            kind: normalizeDrawElementKind(item?.kind),
            preset: normalizeDrawElementPreset(item?.preset),
            displayMode: normalizeDrawElementDisplayMode(item?.display_mode ?? item?.displayMode),
            x: Number(item?.x || 0), y: Number(item?.y || 0),
            width: Math.max(24, Number(item?.width || 24)), height: Math.max(24, Number(item?.height || 24)),
            rotationDeg: Number(item?.rotationDeg || 0), label: String(item?.label || ""),
          })).filter((item) => item.id) as DrawElement[] : drawElementsRef.current;
          const points = normalizeLimitPoints(layout.limit_points);
          drawElementsRef.current = elements;
          lineDrawingPointsRef.current = points;
          setDrawElements(elements);
          setLineDrawing((prev) => ({ ...prev, points, isDrawing: false }));
          return;
        }
        if (payload.type === "table_created" || payload.type === "table_updated") {
          const table = payload.table as TableMapItem | undefined;
          if (!table?.id) return;
          setAreas((prev) => {
            const existingTable = prev.flatMap((area) => area.tables || []).find((entry) => entry.id === table.id);
            // Keep local position and area membership when the broadcast omits
            // them (older backends send area_id 0 and no position on moves).
            const mergedTable = existingTable
              ? ({
                  ...existingTable,
                  ...table,
                  x_pos: existingTable.x_pos,
                  y_pos: existingTable.y_pos,
                  area_id: existingTable.area_id || table.area_id,
                } as TableMapItem)
              : ({ ...table } as TableMapItem);
            const next = prev.map((area) => ({ ...area, tables: [...(area.tables || [])] }));
            const targetAreaID = Number(mergedTable.area_id || existingTable?.area_id || 0);
            const target = next.find((area) => area.id === targetAreaID);
            if (target) {
              for (const area of next) {
                area.tables = area.tables.filter((t) => t.id !== table.id);
              }
              target.tables.push(mergedTable);
            } else if (!existingTable) {
              // New table without a resolvable area: keep it visible in the first area.
              const firstArea = next[0];
              if (firstArea) firstArea.tables.push(mergedTable);
            }
            // If we already track the table but cannot resolve a target area,
            // leave it untouched instead of dropping it.
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
  }, [loadData, selectedDate, selectedFloor, templateScope]);

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
      sendMapWSMessage({
        type: "table_edit",
        date: selectedDate,
        floor_number: selectedFloor,
        data: { id: tableId, x_pos: nextX, y_pos: nextY },
      });
    },
    [selectedDate, selectedFloor, sendMapWSMessage],
  );

  const saveTableSize = useCallback(
    async (id: string, width: number, height: number) => {
      const tableId = Number(id);
      if (!Number.isFinite(tableId) || tableId <= 0) return;
      const nextWidth = Math.max(TABLE_SIZE_MIN, Math.round(width));
      const nextHeight = Math.max(TABLE_SIZE_MIN, Math.round(height));

      // NodeResizer's onResizeEnd receives the raw gesture dimensions. Keep
      // persistence subject to the same spatial rules as the live node state,
      // otherwise a rejected resize could still be written to metadata.
      const node = nodes.find((item) => item.id === id && item.type === "restaurantTable");
      if (node?.position) {
        const data = node.data as TableNodeData;
        const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
        const frame = rotatedRectFrameFromPosition(
          node.position,
          nextWidth,
          nextHeight,
          rotationDeg,
          TABLE_LIMIT_PADDING,
        );
        const limitPoints = hasClosedLimitArea(lineDrawingPointsRef.current)
          ? lineDrawingPointsRef.current
          : null;
        if (
          (limitPoints && !isRectInsideLimitArea(frame, limitPoints)) ||
          !tableSizeFitsOtherTables(node, nextWidth, nextHeight, nodes)
        ) {
          return;
        }
      }

      setAreas((prev) =>
        prev.map((area) => {
          const source = area.tables || [];
          let touched = false;
          const tables = source.map((table) => {
            if (table.id !== tableId) return table;
            const metadata = { ...((table.metadata || {}) as Record<string, unknown>), width: nextWidth, height: nextHeight };
            touched = true;
            return { ...table, metadata };
          });
          return touched ? { ...area, tables } : area;
        }),
      );
      sendMapWSMessage({
        type: "table_edit",
        date: selectedDate,
        floor_number: selectedFloor,
        data: { id: tableId, metadata: { width: nextWidth, height: nextHeight } },
      });
    },
    [nodes, selectedDate, selectedFloor, sendMapWSMessage],
  );

  useEffect(() => {
    saveTableSizeRef.current = (id, width, height) => {
      void saveTableSize(id, width, height);
    };
  }, [saveTableSize]);

  const persistLayout = useCallback(
    async (patch: Record<string, unknown>) => {
      sendMapWSMessage({ type: "layout_edit", date: selectedDate, floor_number: selectedFloor, metadata: patch });
    },
    [selectedDate, selectedFloor, sendMapWSMessage],
  );

  const queuePersistLayout = useCallback(
    (elements: DrawElement[], states: Record<string, BookingState>, limitPoints: LinePoint[]) => {
      const history = getMapHistory();
      const after = cloneMapEditSnapshot({ drawElements: elements, limitPoints });
      if (!applyingHistoryRef.current) {
        if (!history.last) {
          history.last = cloneMapEditSnapshot(after);
        } else if (JSON.stringify(history.last) !== JSON.stringify(after)) {
          history.undo.push({ before: cloneMapEditSnapshot(history.last), after: cloneMapEditSnapshot(after), timestamp: Date.now() });
          history.redo = [];
          history.last = cloneMapEditSnapshot(after);
          setHistoryVersion((version) => version + 1);
        }
      } else {
        history.last = cloneMapEditSnapshot(after);
      }
      if (persistLayoutTimerRef.current) {
        clearTimeout(persistLayoutTimerRef.current);
      }
      persistLayoutTimerRef.current = setTimeout(() => {
        persistLayoutTimerRef.current = null;
        const layoutElements = elements.map((item) => ({
          ...item,
          display_mode: item.displayMode,
        }));
        void persistLayout({ elements: layoutElements, booking_states: states, limit_points: limitPoints });
      }, 120);
    },
    [getMapHistory, persistLayout],
  );

  const applyMapEditSnapshot = useCallback((snapshot: MapEditSnapshot) => {
    const next = cloneMapEditSnapshot(snapshot);
    applyingHistoryRef.current = true;
    drawElementsRef.current = next.drawElements;
    lineDrawingPointsRef.current = next.limitPoints;
    setDrawElements(next.drawElements);
    setLineDrawing((prev) => ({ ...prev, points: next.limitPoints, isDrawing: false }));
    setIsEditingLimitArea(false);
    setDraggingLimitVertexIndex(null);
    queuePersistLayout(next.drawElements, bookingStatesRef.current, next.limitPoints);
    applyingHistoryRef.current = false;
  }, [queuePersistLayout]);

  const undoMapEdit = useCallback(() => {
    const history = getMapHistory();
    const entry = history.undo.pop();
    if (!entry) return;
    history.redo.push(entry);
    applyMapEditSnapshot(entry.before);
    setHistoryVersion((version) => version + 1);
  }, [applyMapEditSnapshot, getMapHistory]);

  const redoMapEdit = useCallback(() => {
    const history = getMapHistory();
    const entry = history.redo.pop();
    if (!entry) return;
    history.undo.push(entry);
    applyMapEditSnapshot(entry.after);
    setHistoryVersion((version) => version + 1);
  }, [applyMapEditSnapshot, getMapHistory]);

  useEffect(() => {
    return () => {
      if (!persistLayoutTimerRef.current) return;
      clearTimeout(persistLayoutTimerRef.current);
      persistLayoutTimerRef.current = null;
    };
  }, []);

  const deleteSelectedDrawElement = useCallback(() => {
    if (!editMode || !selectedDrawElementId) return;
    const current = drawElementsRef.current;
    const updated = current.filter((item) => item.id !== selectedDrawElementId);
    if (updated.length === current.length) return;
    drawElementsRef.current = updated;
    setDrawElements(updated);
    setSelectedDrawElementId(null);
    queuePersistLayout(updated, bookingStatesRef.current, lineDrawingPointsRef.current);
  }, [editMode, queuePersistLayout, selectedDrawElementId]);

  useEffect(() => {
    deleteSelectedDrawElementRef.current = deleteSelectedDrawElement;
  }, [deleteSelectedDrawElement]);

  // Persist a draw element resize. The NodeResizer fires onResizeEnd with the
  // final gesture dimensions; the `dimensions` change React Flow emits at the
  // end carries no size, so this is the only reliable save point.
  const saveDrawElementSize = useCallback(
    (id: string, width: number, height: number) => {
      if (!editMode) return;
      const nextWidth = Math.max(24, Math.round(width));
      const nextHeight = Math.max(24, Math.round(height));
      const current = drawElementsRef.current;
      let changed = false;
      const updated = current.map((el) => {
        if (el.id !== id) return el;
        if (el.width === nextWidth && el.height === nextHeight) return el;
        changed = true;
        return { ...el, width: nextWidth, height: nextHeight };
      });
      if (!changed) return;
      drawElementsRef.current = updated;
      setDrawElements(updated);
      queuePersistLayout(updated, bookingStatesRef.current, lineDrawingPointsRef.current);
    },
    [editMode, queuePersistLayout],
  );

  useEffect(() => {
    saveDrawElementSizeRef.current = (id, width, height) => {
      saveDrawElementSize(id, width, height);
    };
  }, [saveDrawElementSize]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const activeDrawElements = drawElementsRef.current;
      const activeLimitPoints = hasClosedLimitArea(lineDrawingPointsRef.current)
        ? lineDrawingPointsRef.current
        : null;
      let nextNodesSnapshot: Node<any>[] = [];
      const pendingTableSaves: Array<{ id: string; x: number; y: number }> = [];
      const pendingTableSizeSaves: Array<{ id: string; width: number; height: number }> = [];

      setNodes((nds) => {
        const next = applyNodeChanges(changes, nds) as Node<any>[];
        for (const c of changes as any[]) {
          if (c.type === "position") {
            const prevNode = nds.find((n) => n.id === c.id);
            const node = next.find((n) => n.id === c.id);
            if (!node || !prevNode || !node.position) continue;

            if (node.type === "restaurantTable") {
              const data = node.data as TableNodeData;
              const nodeGeom = previewGeometry(
                data.shape,
                data.capacity,
                data.rectShortSides,
                typeof data.width === "number" || typeof data.height === "number"
                  ? { width: data.width, height: data.height }
                  : undefined,
              );
              const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
              const fromFrame = rotatedRectFrameFromPosition(
                prevNode.position,
                nodeGeom.width,
                nodeGeom.height,
                rotationDeg,
                TABLE_LIMIT_PADDING,
              );
              const toFrame = rotatedRectFrameFromPosition(
                node.position,
                nodeGeom.width,
                nodeGeom.height,
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
                    nodeGeom.width,
                    nodeGeom.height,
                  )
                : prevNode.position;
              const blockedByObstacle = activeDrawElements.some((el) =>
                elementIntersectsRect(el, constrainedPosition.x, constrainedPosition.y, nodeGeom.width, nodeGeom.height),
              );
              node.position = blockedByObstacle ? prevNode.position : constrainedPosition;
              continue;
            }

            if (node.type === "drawElement") {
              if (!editMode) {
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

          if (c.type === "dimensions") {
            const prevNode = nds.find((n) => n.id === c.id);
            const node = next.find((n) => n.id === c.id);
            if (!node || !prevNode || !node.position) continue;

            const rawWidth = c.dimensions ? Number(c.dimensions.width) : NaN;
            const rawHeight = c.dimensions ? Number(c.dimensions.height) : NaN;
            // React Flow emits a final dimensions change with `resizing: false`
            // and NO dimensions when a resize gesture ends. Leave the node
            // untouched there; the last real drag already set the size.
            if (!Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) continue;
            const nextWidth = Math.max(24, Math.round(rawWidth));
            const nextHeight = Math.max(24, Math.round(rawHeight));

            if (node.type === "drawElement") {
              const prevData = prevNode.data as DrawNodeData;
              const rotationDeg = Number.isFinite(prevData.rotationDeg) ? prevData.rotationDeg : 0;

              if (!editMode) {
                node.data = { ...node.data, width: prevData.width, height: prevData.height };
                continue;
              }

              const nextFrame = rotatedRectFrameFromPosition(node.position, nextWidth, nextHeight, rotationDeg, 0);
              const insideLimit = activeLimitPoints
                ? isRectInsideLimitArea(
                    { x: nextFrame.x, y: nextFrame.y, width: nextFrame.width, height: nextFrame.height },
                    activeLimitPoints,
                  )
                : true;
              if (!insideLimit) {
                node.data = { ...node.data, width: prevData.width, height: prevData.height };
              } else {
                node.data = { ...node.data, width: nextWidth, height: nextHeight };
              }
              continue;
            }

            if (node.type === "restaurantTable") {
              const prevData = prevNode.data as TableNodeData;
              const rotationDeg = Number.isFinite(prevData.rotationDeg) ? prevData.rotationDeg : 0;

              if (!editMode) {
                node.data = { ...node.data, width: prevData.width, height: prevData.height };
                continue;
              }

              const candidateWidth = Math.max(TABLE_SIZE_MIN, nextWidth);
              const candidateHeight = Math.max(TABLE_SIZE_MIN, nextHeight);
              const candidateFrame = rotatedRectFrameFromPosition(
                node.position,
                candidateWidth,
                candidateHeight,
                rotationDeg,
                TABLE_LIMIT_PADDING,
              );
              const fitsLimit = activeLimitPoints ? isRectInsideLimitArea(candidateFrame, activeLimitPoints) : true;
              const fitsTables = tableSizeFitsOtherTables(node, candidateWidth, candidateHeight, next);
              if (fitsLimit && fitsTables) {
                node.data = { ...node.data, width: candidateWidth, height: candidateHeight };
              } else {
                node.data = { ...node.data, width: prevData.width, height: prevData.height };
              }
            }
          }
        }

        if (activeLimitPoints) {
          for (const node of next) {
            if (!node.position) continue;
            const prevNode = nds.find((n) => n.id === node.id) || node;

            if (node.type === "restaurantTable") {
              const data = node.data as TableNodeData;
              const nodeGeom = previewGeometry(
                data.shape,
                data.capacity,
                data.rectShortSides,
                typeof data.width === "number" || typeof data.height === "number"
                  ? { width: data.width, height: data.height }
                  : undefined,
              );
              const rotationDeg = Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0;
              const frame = rotatedRectFrameFromPosition(
                node.position,
                nodeGeom.width,
                nodeGeom.height,
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
                    nodeGeom.width,
                    nodeGeom.height,
                  );
                }
              }

              const blockedByObstacle = activeDrawElements.some((el) =>
                elementIntersectsRect(el, node.position.x, node.position.y, nodeGeom.width, nodeGeom.height),
              );
              if (blockedByObstacle) {
                node.position = prevNode.position;
              }
              continue;
            }

            if (node.type === "drawElement") {
              if (!editMode) {
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
        if (c.type === "position" && c.dragging === false) {
          const updatedNode = nextNodesSnapshot.find((n) => n.id === c.id);
          if (!updatedNode?.position) continue;

          if (String(c.id).startsWith("draw-") && updatedNode.type === "drawElement") {
            if (!editMode) continue;
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
            pendingTableSaves.push({
              id: c.id,
              x: Math.round(updatedNode.position.x),
              y: Math.round(updatedNode.position.y),
            });
          }
        }
        if (c.type === "dimensions" && String(c.id).startsWith("draw-")) {
          if (!editMode) continue;
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
        if (c.type === "dimensions" && c.resizing === false && c.dimensions) {
          // Belt-and-suspenders: React Flow's finalize change carries no
          // dimensions, so the real save goes through NodeResizer onResizeEnd.
          // If a future version does send dimensions here, persist them.
          const width = Math.round(Number(c.dimensions.width));
          const height = Math.round(Number(c.dimensions.height));
          if (Number.isFinite(width) && Number.isFinite(height)) {
            pendingTableSizeSaves.push({ id: c.id, width, height });
          }
        }
      }

      if (drawElementsChanged) {
        drawElementsRef.current = nextDrawElements;
        setDrawElements(nextDrawElements);
        queuePersistLayout(nextDrawElements, bookingStatesRef.current, lineDrawingPointsRef.current);
      }

      for (const save of pendingTableSizeSaves) {
        void saveTableSize(save.id, save.width, save.height);
      }

      for (const save of pendingTableSaves) {
        void savePosition(save.id, save.x, save.y);
      }
    },
    [editMode, lineDrawing.isDrawing, queuePersistLayout, savePosition, saveTableSize, setNodes],
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

      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

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

      const table = visibleTables.find((t) => t.id === Number(targetNode.id));
      const existing = resolveAssignments(bookingStatesRef.current[String(booking.id)], booking.table_number, booking.party_size);
      const already = existing.some((a) => normalizeTableKey(a.table_name) === normalizeTableKey(tableName));
      const assignments: BookingTableAssignment[] = already
        ? existing
        : [
            {
              table_id: table?.id ?? null,
              table_name: tableName,
              seats: Math.max(1, Math.round(Number(booking.party_size) || 1)),
              names: [],
            },
          ];
      void saveBookingAssignmentsRef.current(booking, assignments);
    },
    [bookings, nodes, pushToast, reactFlowInstance, selectedDate, visibleTables]
  );

  const onDragStart = useCallback((event: React.DragEvent, booking: Booking) => {
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
    setDraft(defaultDraft(nextTableNumber, nextTableNumero));
    setDraftTextureFile(null);
    setShortSideHover(null);
    setEditorOpen(true);
    setMenuVisible(false);
  }, [nextTableNumber, nextTableNumero]);

  const openEditModal = useCallback((table: TableMapItem) => {
    const capacity = clampCapacity(table.capacity || 4);
    const metadata = (table.metadata || {}) as Record<string, unknown>;
    setEditingTableId(table.id);
    setDraft({
      name: table.name || "",
      numeroMesa: table.numero_mesa || "",
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
      name: selectedFloor === 0 ? "Salon principal" : `Salon ${selectedFloor}`,
      metadata: { floorNumber: selectedFloor },
    } as any);
    if (!createRes.success) {
      pushToast({ kind: "error", title: "Error", message: createRes.message || "No se pudo crear area" });
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
    const numeroMesa = draft.numeroMesa.trim();
    if (!numeroMesa) {
      pushToast({ kind: "error", title: "Error", message: "Número de mesa requerido" });
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
        numero_mesa: numeroMesa,
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
          pushToast({ kind: "error", title: "Limites requeridos", message: "Dibuja y cierra el area de limites primero." });
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
          pushToast({ kind: "error", title: "Sin espacio", message: "No hay espacio dentro del area limite para una nueva mesa." });
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
        pushToast({ kind: "error", title: "Imagen", message: "Formato no valido" });
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
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo abrir el dia" });
        return;
      }
      setDay(res);
      pushToast({ kind: "success", title: "Guardado", message: "Dia abierto" });
      void loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el dia");
    } finally {
      setDayBusy(false);
    }
  }, [api.config, day?.isOpen, loadData, pushToast, selectedDate]);

  const onSelectDate = useCallback(
    (nextDate: string) => {
      setSelectedDate(nextDate);
      setDay(null);
      const [y, m] = String(nextDate).split("-").map((n) => Number(n));
      const nextView = {
        year: Number.isFinite(y) ? y : new Date().getFullYear(),
        month: Number.isFinite(m) ? m : new Date().getMonth() + 1,
      };
      if (nextView.year !== calendarView.year || nextView.month !== calendarView.month) {
        setCalendarView(nextView);
      }
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", withDateParam(window.location.href, nextDate));
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
      const prev = bookingStatesRef.current[String(booking.id)] || { seated: false };
      const next = { ...bookingStatesRef.current, [String(booking.id)]: { ...prev, seated } };
      bookingStatesRef.current = next;
      setBookingStates(next);
      queuePersistLayout(drawElementsRef.current, next, lineDrawingPointsRef.current);
    },
    [queuePersistLayout],
  );

  /**
   * Shared persistence for table assignment. Stores the structured split in
   * the day layout (booking_states) and keeps `booking.table_number` in sync
   * with the primary table for the rest of the app.
   */
  const saveBookingAssignments = useCallback(
    async (booking: Booking, assignments: BookingTableAssignment[]) => {
      const partySize = Math.max(1, Math.round(Number(booking.party_size) || 1));
      const normalized = normalizeAssignmentSeats(assignments, partySize) as BookingTableAssignment[];
      const total = sumAssignmentSeats(normalized);

      if (normalized.length > 0 && total !== partySize) {
        pushToast({
          kind: "error",
          title: "Reparto de mesas",
          message: `La suma de comensales (${total}) debe ser igual al grupo (${partySize})`,
        });
        return;
      }

      if (normalized.some((a) => !normalizeTableKey(a.table_name))) {
        pushToast({ kind: "error", title: "Mesas", message: "Selecciona una mesa para cada fila" });
        return;
      }
      const seenTableNames = new Set<string>();
      for (const a of normalized) {
        const key = normalizeTableKey(a.table_name);
        if (seenTableNames.has(key)) {
          pushToast({ kind: "error", title: "Mesas", message: `La mesa ${a.table_name} aparece repetida` });
          return;
        }
        seenTableNames.add(key);
      }

      // Capacity check: the seats placed on a table plus what other bookings
      // already commit to it must not exceed the table capacity.
      const prevState = bookingStatesRef.current[String(booking.id)];
      const prevAssignments = resolveAssignments(prevState, booking.table_number, booking.party_size);
      const prevSeatsByTable = new Map<string, number>();
      for (const a of prevAssignments) {
        const key = normalizeTableKey(a.table_name);
        prevSeatsByTable.set(key, (prevSeatsByTable.get(key) || 0) + Math.max(0, Number(a.seats) || 0));
      }
      for (const a of normalized) {
        const key = normalizeTableKey(a.table_name);
        const table = visibleTables.find((t) => normalizeTableKey(t.name) === key);
        if (!table) continue;
        const otherSeats = Math.max(0, (occupiedSeatsByTable.get(key) || 0) - (prevSeatsByTable.get(key) || 0));
        if (otherSeats + Math.max(0, Number(a.seats) || 0) > (table.capacity || 4)) {
          pushToast({
            kind: "error",
            title: "Capacidad",
            message: `La mesa ${table.name} no tiene capacidad para ${a.seats} comensales (max ${table.capacity})`,
          });
          return;
        }
      }

      const primary = normalized[0]?.table_name?.trim() || "";
      const display = assignmentsDisplayName(normalized, primary || "sin mesa");

      // Optimistic local update: bookings + booking states (layout).
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? { ...b, table_number: primary || null } : b)),
      );
      const nextState: BookingState = {
        ...(prevState || { seated: false }),
        ...(normalized.length > 0 ? { assignments: normalized } : { assignments: undefined }),
      };
      const nextStates = { ...bookingStatesRef.current, [String(booking.id)]: nextState };
      bookingStatesRef.current = nextStates;
      setBookingStates(nextStates);
      queuePersistLayout(drawElementsRef.current, nextStates, lineDrawingPointsRef.current);

      // Keep table_number in sync through the bookings API.
      const res = await api.reservas.patch(booking.id, { table_number: primary });
      if (!res.success) {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? { ...b, table_number: booking.table_number } : b)),
        );
        const rollback: BookingState = {
          ...(prevState || { seated: false }),
          ...(prevState?.assignments ? { assignments: prevState.assignments } : { assignments: undefined }),
        };
        const rollbackStates = { ...bookingStatesRef.current, [String(booking.id)]: rollback };
        bookingStatesRef.current = rollbackStates;
        setBookingStates(rollbackStates);
        pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo guardar la asignacion" });
        return;
      }
      if (normalized.length > 0) {
        pushToast({ kind: "success", title: "Reserva asignada", message: `${booking.customer_name} -> ${display}` });
      } else {
        pushToast({ kind: "success", title: "Reserva desasignada" });
      }
    },
    [api.reservas, occupiedSeatsByTable, pushToast, queuePersistLayout, visibleTables],
  );

  useEffect(() => {
    saveBookingAssignmentsRef.current = saveBookingAssignments;
  }, [saveBookingAssignments]);

  const addDrawElement = useCallback(
    (preset: DrawElementPreset) => {
      const activeLimitPoints = hasClosedLimitArea(lineDrawing.points) ? lineDrawing.points : null;
      if (!activeLimitPoints) {
        pushToast({ kind: "error", title: "Limites requeridos", message: "Dibuja y cierra el area de limites primero." });
        return;
      }
      const current = drawElementsRef.current;
      const kind = drawPresetKind(preset);
      const size = drawElementSize(preset);
      const preferred = { x: 180 + current.length * 24, y: 180 + current.length * 24 };
      const base = findNearestRectInsideLimitArea(preferred, size, activeLimitPoints);
      if (!base) {
        pushToast({ kind: "error", title: "Sin espacio", message: "No hay espacio dentro del area limite para ese elemento." });
        return;
      }
      const next = makeDrawElement(kind, preset, base, current.length + 1);
      const updated = [...current, next];
      drawElementsRef.current = updated;
      setDrawElements(updated);
      setSelectedDrawElementId(next.id);
      queuePersistLayout(updated, bookingStatesRef.current, activeLimitPoints);
      setEditMode(true);
      setDrawPanelDismissed(false);
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

  const assignBookingToTable = useCallback(
    async (booking: Booking, tableName: string, tableId: string) => {
      setBookingForAssignment(null);
      const table = visibleTables.find((t) => t.id === Number(tableId));
      const existing = resolveAssignments(bookingStatesRef.current[String(booking.id)], booking.table_number, booking.party_size);
      const already = existing.some((a) => normalizeTableKey(a.table_name) === normalizeTableKey(tableName));
      const assignments: BookingTableAssignment[] = already
        ? existing
        : [
            {
              table_id: table?.id ?? null,
              table_name: tableName,
              seats: Math.max(1, Math.round(Number(booking.party_size) || 1)),
              names: [],
            },
          ];
      await saveBookingAssignmentsRef.current(booking, assignments);
    },
    [visibleTables],
  );

  // Multi-table assignment: computed totals
  const multiTableTotalSeats = useMemo(() => sumAssignmentSeats(multiTableDraft), [multiTableDraft]);
  const multiTablePartySize = bookingForAssignment ? Math.max(1, Math.round(Number(bookingForAssignment.party_size) || 1)) : 0;
  const multiTableComplete = multiTableTotalSeats >= multiTablePartySize;

  // Add a table to multi-table draft
  const addTableToMultiDraft = useCallback((table: TableMapItem) => {
    const capacity = Math.max(1, Number(table.capacity) || 4);
    const key = normalizeTableKey(table.name);
    setMultiTableDraft((prev) => {
      // Don't add duplicates
      if (prev.some((a) => normalizeTableKey(a.table_name) === key)) return prev;
      return [...prev, { table_id: table.id, table_name: table.name, seats: capacity, names: [] }];
    });
  }, []);

  // Remove a table from multi-table draft
  const removeTableFromMultiDraft = useCallback((idx: number) => {
    setMultiTableDraft((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  // Update names for a table in multi-table draft
  const updateMultiDraftNames = useCallback((idx: number, names: string[]) => {
    setMultiTableDraft((prev) => prev.map((row, i) => (i === idx ? { ...row, names } : row)));
  }, []);

  // Save multi-table draft
  const saveMultiTableDraft = useCallback(async () => {
    if (!bookingForAssignment) return;
    await saveBookingAssignmentsRef.current(bookingForAssignment, multiTableDraft);
    setMultiTableMode(false);
    setMultiTableDraft([]);
    setBookingForAssignment(null);
    setAssignMode(false);
    setSelectedBookingId(null);
    setSelectedTableId(null);
    pushToast({ kind: "success", title: "Mesas asignadas", message: `${multiTableDraft.length} mesa(s) asignadas` });
  }, [bookingForAssignment, multiTableDraft, pushToast]);

  // Cancel multi-table mode
  const cancelMultiTableMode = useCallback(() => {
    setMultiTableMode(false);
    setMultiTableDraft([]);
    setMultiTableNamesModalIdx(null);
  }, []);

  const handleAssignModeSelect = useCallback(async (bookingId: number, tableId: number) => {
    const booking = bookings.find(b => b.id === bookingId);
    const table = visibleTables.find(t => t.id === tableId);

    if (!booking || !table) return;

    // If multi-table mode is enabled, add to draft instead of saving
    if (multiTableMode) {
      addTableToMultiDraft(table);
      setSelectedTableId(null);
      return;
    }

    const existing = resolveAssignments(bookingStatesRef.current[String(booking.id)], booking.table_number, booking.party_size);
    const already = existing.some((a) => normalizeTableKey(a.table_name) === normalizeTableKey(table.name));
    const assignments: BookingTableAssignment[] = already
      ? existing
      : [
          {
            table_id: table.id,
            table_name: table.name,
            seats: Math.max(1, Math.round(Number(booking.party_size) || 1)),
            names: [],
          },
        ];
    await saveBookingAssignmentsRef.current(booking, assignments);

    setSelectedBookingId(null);
    setSelectedTableId(null);
    setAssignMode(false);
  }, [bookings, visibleTables, multiTableMode, addTableToMultiDraft]);

  // Sync bookingForAssignment with selectedBookingId in assign mode
  useEffect(() => {
    if (assignMode && selectedBookingId) {
      const booking = bookings.find(b => b.id === selectedBookingId);
      if (booking) {
        setBookingForAssignment(booking);
      }
    } else if (!assignMode) {
      setBookingForAssignment(null);
    }
  }, [assignMode, selectedBookingId, bookings]);

  useEffect(() => {
    if (assignmentInProgress.current) return;
    if (assignMode && selectedBookingId && selectedTableId) {
      assignmentInProgress.current = true;
      handleAssignModeSelect(selectedBookingId, selectedTableId);
      setTimeout(() => {
        assignmentInProgress.current = false;
      }, 100);
    }
  }, [assignMode, selectedBookingId, selectedTableId, handleAssignModeSelect]);

  const cancelAssignmentMode = useCallback(() => {
    setBookingForAssignment(null);
    setAssignMode(false);
    setMultiTableMode(false);
    setMultiTableDraft([]);
    setMultiTableNamesModalIdx(null);
    setSelectedBookingId(null);
    setSelectedTableId(null);
  }, []);

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
    const tooltipEl = document.querySelector('[data-ui="map-menu-tooltip"]') as HTMLElement | null;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const tooltipWidth = tooltipEl?.getBoundingClientRect().width ?? 240;
        const btnRect = menuButtonRef.current?.getBoundingClientRect();
        if (!btnRect) return;
        const centerX = btnRect.left + btnRect.width / 2;
        const top = btnRect.bottom + 8;
        setMenuTooltipStyle({
          position: "fixed" as const,
          left: `${centerX - tooltipWidth / 2}px`,
          top: `${top}px`,
        });
      });
    });
    const onResize = () => {
      const tooltipWidth = tooltipEl?.getBoundingClientRect().width ?? 240;
      const btnRect = menuButtonRef.current?.getBoundingClientRect();
      if (!btnRect) return;
      const centerX = btnRect.left + btnRect.width / 2;
      const top = btnRect.bottom + 8;
      setMenuTooltipStyle({
        position: "fixed" as const,
        left: `${centerX - tooltipWidth / 2}px`,
        top: `${top}px`,
      });
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
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
    // The reservations sheet is independent from the drawing editor. Opening
    // it must dismiss the editor panel, while preserving edit mode itself.
    setDrawPanelDismissed(true);
    setDrawPanelHover(false);
  }, []);

  const closeRightSheet = useCallback(() => {
    setRightSheetOpen(false);
  }, []);

  useEffect(() => {
    if (!menuVisible && !rightSheetOpen) return;
    const onClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Clicks inside a portal overlay (modal, dropdown menu) must not count
      // as an outside click for the reservations sheet.
      const insidePortalUI = Boolean(target.closest?.('[data-ui="modal-overlay"], [data-ui="dropdown-menu"]'));
      if (menuVisible) {
        const tooltip = document.querySelector('[data-ui="map-menu-tooltip"]');
        const trigger = menuButtonRef.current;
        if (!insidePortalUI && tooltip && !tooltip.contains(target) && trigger && !trigger.contains(target)) {
          setMenuVisible(false);
        }
      }
      if (rightSheetOpen) {
        const sheet = rightSheetRef.current;
        if (!insidePortalUI && sheet && !sheet.contains(target)) {
          setRightSheetOpen(false);
        }
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuVisible, rightSheetOpen]);

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

  const handleEditModeChange = useCallback((next: boolean) => {
    if (next) {
      setEditMode(true);
      setDrawPanelDismissed(false);
    } else {
      setEditMode(false);
      setSelectedDrawElementId(null);
      setSelectedTableId(null);
      setIsEditingLimitArea(false);
      setDraggingLimitVertexIndex(null);
      limitEditHistoryRef.current = [];
      setDrawPanelDismissed(true);
    }
    setDrawPanelHover(false);
    setMenuVisible(false);
  }, []);

  const onToggleDrawMode = useCallback(() => {
    if (editMode && !drawPanelDismissed) {
      // Panel open + edit mode: switch back to read mode.
      setEditMode(false);
      setSelectedDrawElementId(null);
      setIsEditingLimitArea(false);
      setDraggingLimitVertexIndex(null);
      limitEditHistoryRef.current = [];
      setDrawPanelDismissed(true);
    } else if (editMode) {
      // Edit mode with the panel dismissed: reopen the panel, keep editing.
      setDrawPanelDismissed(false);
    } else {
      setEditMode(true);
      setDrawPanelDismissed(false);
    }
    setDrawPanelHover(false);
    setMenuVisible(false);
  }, [drawPanelDismissed, editMode]);

  const closeDrawPanel = useCallback(() => {
    setSelectedDrawElementId(null);
    // Closing the panel only hides its UI. While editing the area, keep the
    // area editor active so joints and lines remain editable on the canvas.
    if (!isEditingLimitArea) {
      setIsEditingLimitArea(false);
    }
    setDraggingLimitVertexIndex(null);
    limitEditHistoryRef.current = [];
    setDrawPanelDismissed(true);
    setDrawPanelHover(false);
  }, [isEditingLimitArea]);

  const startLineDrawing = useCallback(() => {
    setIsEditingLimitArea(false);
    setDraggingLimitVertexIndex(null);
    limitEditHistoryRef.current = [];
    setLineDrawing({ points: [], isDrawing: true });
    lineDrawingPointsRef.current = [];
    setEditMode(true);
    setDrawPanelDismissed(false);
    setMenuVisible(false);
    setDrawPanelHover(false);
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
      pushToast({ kind: "error", title: "Area invalida", message: "Necesitas al menos 3 puntos para cerrar el area." });
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
    setEditMode(true);
    setDrawPanelDismissed(false);
    setMenuVisible(false);
    // Reframe the complete editable area so all joints are immediately reachable.
    requestAnimationFrame(() => {
      reactFlowInstance?.fitView?.({ padding: 0.2, duration: 220 });
    });
  }, [lineDrawing.isDrawing, lineDrawing.points, reactFlowInstance]);

  const stopLimitAreaEditing = useCallback(() => {
    setIsEditingLimitArea(false);
    setDraggingLimitVertexIndex(null);
    limitEditHistoryRef.current = [];
    queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, lineDrawingPointsRef.current);
  }, [queuePersistLayout]);

  /**
   * Persists the cross-day template via POST /tables/template/{floor}.
   * The template owns the limit area polygon and the draw elements (kind,
   * preset, position, size, rotation, display mode). Customer booking data
   * is intentionally excluded.
   *
   * The current "scope" decides which backend write path is used:
   *  - "template"  → writes to the template; per-day overrides are wiped
   *                  so the rest of the app immediately reads the new state.
   *  - "day"       → writes only to the per-day layout (the template stays
   *                  untouched and other days are not affected).
   */
  const saveLimitAreaTemplate = useCallback(async () => {
    if (lineDrawing.isDrawing || !hasClosedLimitArea(lineDrawing.points)) {
      pushToast({ kind: "error", title: "Area invalida", message: "Cierra el area antes de guardar la plantilla." });
      return;
    }

    setSavingLimitTemplate(true);
    try {
      const clonedPoints = cloneLinePoints(lineDrawing.points);
      const clonedElements = drawElementsRef.current.map((item) => ({
        ...item,
        display_mode: item.displayMode,
      }));

      if (templateScope === "template") {
        // Build the full template payload: take the current template (if any)
        // and overlay the new limit area + draw elements. This is the path
        // that ships cross-day changes to all other days.
        const payload = buildTemplatePayload({
          previousTemplate: floorTemplate || undefined,
          limitPoints: clonedPoints,
          drawElements: clonedElements,
        });
        sendMapWSMessage({ type: "template_edit", floor_number: selectedFloor, data: payload });
        setFloorTemplate(payload as TableMapLayoutTemplate);
        setTemplateScope("template");
        // Reflect the new template in the current per-day state so the
        // canvas immediately renders the new geometry.
        const newLayout = stripTemplateFieldsForDay(
          buildGlobalTemplateLayout({ ...stripDayFieldsForTemplate({ ...payload }) }),
        );
        queuePersistLayout(clonedElements, bookingStatesRef.current, clonedPoints);
        pushToast({
          kind: "success",
          title: "Plantilla guardada",
          message: "Se aplicara por defecto para este salon en todos los dias.",
        });
        return;
      }

      // Day-specific scope: write only the per-day layout with day-specific
      // overrides. The template is left untouched.
      const dayOverride = buildDayOverrideLayout(
        { limit_area_template_points: clonedPoints, draw_elements_template: clonedElements },
        {},
      );
        sendMapWSMessage({ type: "layout_edit", date: selectedDate, floor_number: selectedFloor, metadata: dayOverride });
      queuePersistLayout(clonedElements, bookingStatesRef.current, clonedPoints);
      pushToast({
        kind: "success",
        title: "Cambios guardados para este dia",
        message: "Solo afectaran al dia seleccionado.",
      });
    } finally {
      setSavingLimitTemplate(false);
    }
  }, [
    floorTemplate,
    lineDrawing.isDrawing,
    lineDrawing.points,
    pushToast,
    queuePersistLayout,
    selectedDate,
    selectedFloor,
    templateScope,
    sendMapWSMessage,
  ]);

  const clearFloorTemplate = useCallback(async () => {
    setSavingLimitTemplate(true);
    try {
      sendMapWSMessage({ type: "template_delete", floor_number: selectedFloor });
      setFloorTemplate(null);
      setTemplateScope("day");
      pushToast({ kind: "success", title: "Plantilla eliminada", message: "Este salon vuelve a las ediciones por dia." });
    } finally {
      setSavingLimitTemplate(false);
    }
  }, [pushToast, selectedFloor, sendMapWSMessage]);

  const requestScopeChange = useCallback(
    (next: TableMapTemplateScope) => {
      if (next === templateScope) return;
      if (next === "day" && templateScope === "template") {
        setConfirmScopeChange({ next, reason: "switch-to-day" });
        return;
      }
      applyScopeChange(next, next === "template" ? "switch-to-template" : "switch-to-day");
    },
    [templateScope],
  );

  const applyScopeChange = useCallback(
    async (next: TableMapTemplateScope, reason: "switch-to-day" | "switch-to-template") => {
      setConfirmScopeChange(null);
      // Switching to "day": copy the current per-day layout (which already
      // has the merged template) into a per-day override and save it.
      if (next === "day") {
        if (!floorTemplate) {
          setTemplateScope("day");
          return;
        }
        const currentLayout = {
          booking_states: bookingStatesRef.current,
        };
        const dayOverride = buildDayOverrideLayout(floorTemplate, currentLayout);
        const res = await api.tables.saveLayout({
          date: selectedDate,
          floor_number: selectedFloor,
          metadata: dayOverride,
        });
        if (!res.success) {
          pushToast({ kind: "error", title: "Error", message: res.message || "No se pudo cambiar a cambios por dia" });
          return;
        }
        setTemplateScope("day");
        pushToast({
          kind: "info",
          title: "Cambios solo para este dia",
          message: "Los cambios futuros se guardaran solo para esta fecha.",
        });
        return;
      }
      // Switching to "template": the template already wins, so just clear
      // any per-day override markers and re-fetch.
      setTemplateScope("template");
      void loadData();
      pushToast({
        kind: "info",
        title: "Cambios en la plantilla",
        message: "Los cambios futuros afectaran a todos los dias.",
      });
    },
    [api.tables, floorTemplate, loadData, pushToast, selectedDate, selectedFloor],
  );

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

  // Double-click on a joint circle deletes that joint (keeps a valid polygon).
  const deleteLimitVertex = useCallback(
    (index: number) => {
      if (!isEditingLimitArea) return;
      const current = lineDrawingPointsRef.current;
      if (current.length <= 3) {
        pushToast({ kind: "info", title: "Area invalida", message: "Necesitas al menos 3 puntos en el area." });
        return;
      }
      if (index < 0 || index >= current.length) return;
      limitEditHistoryRef.current.push(cloneLinePoints(current));
      const next = cloneLinePoints(current);
      next.splice(index, 1);
      lineDrawingPointsRef.current = next;
      setDraggingLimitVertexIndex(null);
      setLineDrawing((prev) => ({ ...prev, points: next, isDrawing: false }));
      queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, next);
    },
    [isEditingLimitArea, pushToast, queuePersistLayout],
  );

  // Double-click on a line segment adds a new joint at its midpoint.
  const addLimitVertexOnSegment = useCallback(
    (index: number) => {
      if (!isEditingLimitArea) return;
      const current = lineDrawingPointsRef.current;
      if (index < 1 || index >= current.length) return;
      limitEditHistoryRef.current.push(cloneLinePoints(current));
      const next = cloneLinePoints(current);
      const a = next[index - 1];
      const b = next[index];
      next.splice(index, 0, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
      lineDrawingPointsRef.current = next;
      setDraggingLimitVertexIndex(null);
      setLineDrawing((prev) => ({ ...prev, points: next, isDrawing: false }));
      queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, next);
    },
    [isEditingLimitArea, queuePersistLayout],
  );

  // Double-click on the closing edge (last -> first) appends a joint between them.
  const addLimitVertexOnClosingSegment = useCallback(() => {
    if (!isEditingLimitArea) return;
    const current = lineDrawingPointsRef.current;
    if (current.length < 3) return;
    limitEditHistoryRef.current.push(cloneLinePoints(current));
    const next = cloneLinePoints(current);
    const a = next[next.length - 1];
    const b = next[0];
    next.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    lineDrawingPointsRef.current = next;
    setDraggingLimitVertexIndex(null);
    setLineDrawing((prev) => ({ ...prev, points: next, isDrawing: false }));
    queuePersistLayout(drawElementsRef.current, bookingStatesRef.current, next);
  }, [isEditingLimitArea, queuePersistLayout]);

  // Removes the limit area and every draw element inside it (tables are kept).
  const removeArea = useCallback(() => {
    const nextElements: DrawElement[] = [];
    drawElementsRef.current = nextElements;
    setDrawElements(nextElements);
    setSelectedDrawElementId(null);
    const nextPoints: LinePoint[] = [];
    lineDrawingPointsRef.current = nextPoints;
    setLineDrawing({ points: nextPoints, isDrawing: false });
    setIsEditingLimitArea(false);
    setDraggingLimitVertexIndex(null);
    limitEditHistoryRef.current = [];
    setDrawPanelDismissed(true);
    setEditMode(false);
    setRemoveAreaConfirmOpen(false);
    queuePersistLayout(nextElements, bookingStatesRef.current, nextPoints);
    pushToast({ kind: "success", title: "Area eliminada", message: "Limites y elementos del mapa eliminados." });
  }, [pushToast, queuePersistLayout]);

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
  const currentMapHistory = getMapHistory();
  // The ref-backed history needs a render signal after each mutation so the
  // button availability reflects the current undo/redo stacks.
  const historyRenderVersion = historyVersion;
  void historyRenderVersion;

  // The full tree (including the date picker) must stay mounted across
  // loadData transitions, otherwise the MonthCalendarDatePicker unmounts and
  // its popover state is lost while the month-nav callback is in flight.
  return (
    <ReactFlowProvider>
      <section data-ui="table-map-page" className="bo-tableMapPage" aria-label="Mapa de mesas">
        {loading ? (
          <div data-ui="loading" className="bo-tableMapLoading">Cargando mapa...</div>
        ) : null}
        <AnimatePresence mode="wait" initial={false}>
          {isDayOpen ? (
            <motion.div
              data-ui="table-map-open"
              key="table-map-open"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
              <div data-ui="top-controls" className="bo-tableMapTopControls">
                <button data-ui="back-btn" className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={onBack} aria-label="Volver a reservas">
                  <ChevronLeft size={18} strokeWidth={1.8} />
                </button>

                <div data-ui="top-center" className="bo-tableMapTopCenter">
                  <MonthCalendarDatePicker
                    value={selectedDate}
                    onChange={onSelectDate}
                    year={calendarView.year}
                    month={calendarView.month}
                    days={calendarDays}
                    onPrevMonth={onPrevMonth}
                    onNextMonth={onNextMonth}
                    loading={loading}
                    data-testid="table-map-date-picker"
                    className="bo-tableMapHeaderDatePicker"
                  />
                  <button
                    data-ui="menu-trigger"
                    ref={menuButtonRef}
                    className="bo-actionBtn bo-actionBtn--glass"
                    type="button"
                    aria-label="Abrir menu de mapa"
                    aria-expanded={menuVisible}
                    onClick={onToggleMenu}
                  >
                    <Ellipsis size={18} strokeWidth={1.8} />
                  </button>

                  <AnimatePresence>
                    {menuVisible ? (
                      <motion.div
                        data-ui="map-menu-tooltip"
                        className="bo-tableMapTooltip"
                        role="menu"
                        aria-label="Opciones del mapa"
                        style={menuTooltipStyle}
                        initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                        transition={reduceMotion ? { duration: 0 } : { duration: 0.16, ease: "easeInOut" }}
                      >
                        <div data-slot="tooltip-head" className="bo-tableMapTooltipHead">
                          <div data-ui="tooltip-title" className="bo-tableMapTooltipTitle">Mapa de mesas</div>
                          <div data-ui="tooltip-subtitle" className="bo-tableMapTooltipSub">Acciones rapidas</div>
                        </div>

                        <div data-slot="tooltip-actions" className="bo-tableMapTooltipActions" role="group" aria-label="Acciones de mapa">
                          <button data-ui="add-table-btn" className="bo-menuItem" type="button" onClick={openAddModal} role="menuitem">
                            <span data-ui="menu-icon" className="bo-menuIcon" aria-hidden="true">
                              <Plus size={16} strokeWidth={1.8} />
                            </span>
                            <span data-ui="menu-label" className="bo-menuLabel">Anadir mesa</span>
                          </button>

                          <button data-ui="toggle-draw-btn" className="bo-menuItem" type="button" onClick={onToggleDrawMode} role="menuitem">
                            <span data-ui="menu-icon" className="bo-menuIcon" aria-hidden="true">
                              <Pencil size={16} strokeWidth={1.8} />
                            </span>
                            <span data-ui="menu-label" className="bo-menuLabel">{editMode ? "Salir de dibujo" : "Dibujar"}</span>
                          </button>
                        </div>

                        <div data-slot="tooltip-stats" className="bo-tableMapTooltipStats" aria-label="Resumen del dia">
                          <div data-ui="stat-people">
                            Personas / Limite: <strong data-ui="people-value">{occupancy.totalPeople} / {occupancy.limit || "-"}</strong>
                          </div>
                          <div data-ui="stat-occupancy">
                            Ocupacion: <strong data-ui="occupancy-value">{occupancy.percent}%</strong>
                          </div>
                        </div>

                        {floorTabs.length > 1 ? (
                          <div data-ui="floor-tabs" className="bo-tableMapFloorTabs" role="tablist" aria-label="Seleccionar planta">
                            {floorTabs.map((f) => {
                              const active = f.floorNumber === selectedFloor;
                              return (
                                <button
                                  key={f.floorNumber}
                                  data-ui="floor-tab"
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
                <div data-ui="top-right" className="bo-tableMapTopRight">
                  <div data-ui="edit-mode-toggle" className={`bo-tableMapEditToggleWrap${editMode ? " is-active" : ""}`}>
                    <span
                      data-ui="edit-mode-label"
                      className={`bo-tableMapEditToggleLabel${editMode ? " is-active" : ""}`}
                      aria-hidden="true"
                    >
                      {editMode ? "Editar" : "Ver"}
                    </span>
                    <Switch
                      checked={editMode}
                      onCheckedChange={handleEditModeChange}
                      aria-label={editMode ? "Modo edicion activado" : "Modo lectura activado"}
                      title={editMode ? "Modo edicion (desactivar para solo lectura)" : "Modo lectura (activar para editar)"}
                      className="bo-tableMapEditToggle"
                    />
                  </div>
                  <button
                    data-ui="add-table-top-btn"
                    className="bo-actionBtn bo-actionBtn--glass"
                    type="button"
                    aria-label="Anadir mesa"
                    onClick={openAddModal}
                  >
                    <Plus size={18} strokeWidth={1.8} />
                  </button>
                  <div
                    data-ui="draw-trigger"
                    className="bo-tableMapDrawTrigger"
                  >
                    <button
                      data-ui="draw-mode-btn"
                      className={`bo-actionBtn bo-actionBtn--glass${editMode ? " is-active" : ""}`}
                      type="button"
                      aria-label="Modo dibujo"
                      onClick={onToggleDrawMode}
                    >
                      <Pencil size={18} strokeWidth={1.8} />
                    </button>
                  </div>
                  {!rightSheetOpen ? (
                    <button
                      data-ui="open-right-panel-btn"
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

              <LineDrawingToolbar
                pointCount={lineDrawing.points.length}
                isDrawing={lineDrawing.isDrawing}
                onCloseArea={closeLineDrawing}
                onUndoPoint={undoCreateAreaLastAction}
                onCancel={cancelLineDrawing}
              />

              <div ref={flowWrapRef} data-ui="flow-wrapper" className="bo-tableMapFlowWrap">
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
                      if (assignMode) {
                        setSelectedTableId(prev => prev === tableData.id ? null : tableData.id);
                      } else if (multiTableMode) {
                        // In multi-table mode, clicking a table adds it to draft
                        const table = visibleTables.find(t => t.id === tableData.id);
                        if (table) {
                          addTableToMultiDraft(table);
                        }
                      } else if (bookingForAssignment) {
                        assignBookingToTable(bookingForAssignment, tableData.name, node.id);
                      } else if (editMode) {
                        setSelectedTableId(prev => (prev === tableData.id ? null : tableData.id));
                      } else {
                        // View mode: if table is occupied, open booking modal
                        const tableKey = normalizeTableKey(tableData.name);
                        const tableBookings = bookings.filter(b => {
                          const assignments = resolveAssignments(bookingStates[String(b.id)], b.table_number, b.party_size);
                          return assignments.some(a => normalizeTableKey(a.table_name) === tableKey);
                        });
                        if (tableBookings.length > 0) {
                          // Open modal with first booking (or could show a list if multiple)
                          setSelectedBooking(tableBookings[0]);
                        }
                      }
                      return;
                    }
                    if (node.type === "drawElement") {
                      if (!editMode) return;
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
                  nodesDraggable={editMode}
                  panOnDrag={interactionMode === "pan"}
                  selectionOnDrag={interactionMode === "select"}
                  selectNodesOnDrag={false}
                  onNodeDragStop={(_event, node) => {
                    if (node.type === "restaurantTable" && node.position) {
                      void savePosition(node.id, node.position.x, node.position.y);
                    }
                    if (node.type === "drawElement" && node.position && editMode) {
                      const x = Math.round(node.position.x);
                      const y = Math.round(node.position.y);
                      setDrawElements((prev) =>
                        prev.map((el) => (el.id === node.id ? { ...el, x, y } : el))
                      );
                      queuePersistLayout(
                        drawElementsRef.current.map((el) =>
                          el.id === node.id ? { ...el, x, y } : el
                        ),
                        bookingStatesRef.current,
                        lineDrawingPointsRef.current
                      );
                    }
                  }}
                  className="bo-tableMapFlow"
                  style={{ touchAction: "none" }}
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
                    {isEditingLimitArea && editMode ? (
                      <ControlButton
                        onClick={() => reactFlowInstance?.fitView?.({ padding: 0.2, duration: 220 })}
                        title="Reencuadrar area"
                        aria-label="Reencuadrar area"
                      >
                        <RotateCcw size={14} strokeWidth={1.9} />
                      </ControlButton>
                    ) : null}
                  </Controls>
                </ReactFlow>

                {lineDrawing.points.length > 0 && (
                  <svg
                    data-ui="line-draw-overlay"
                    className="bo-tableMapLineDrawOverlay"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      // The overlay must not create a full-screen hit target. Only
                      // the joint circles and line segments below handle input.
                      pointerEvents: "none",
                      overflow: "visible",
                    }}
                  >
                    {lineOverlayPoints.map((point, idx) => (
                      <g key={idx} data-ui="line-vertex-group">
                        <circle
                          data-ui="line-vertex"
                          cx={point.x}
                          cy={point.y}
                          r={isEditingLimitArea && editMode ? 14 : 6}
                          fill={isEditingLimitArea && editMode ? "color-mix(in srgb, var(--bo-accent) 70%, var(--bo-surface))" : "var(--bo-accent)"}
                          stroke="var(--bo-surface)"
                          strokeWidth={2}
                          style={{
                            cursor: isEditingLimitArea && editMode ? "pointer" : "default",
                            pointerEvents: isEditingLimitArea && editMode ? "all" : "none",
                          }}
                          onMouseDown={(event) => onLimitVertexMouseDown(idx, event)}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            deleteLimitVertex(idx);
                          }}
                        />
                        {idx > 0 && (
                          <line
                            data-ui="line-segment"
                            x1={lineOverlayPoints[idx - 1].x}
                            y1={lineOverlayPoints[idx - 1].y}
                            x2={point.x}
                            y2={point.y}
                            stroke="var(--bo-accent)"
                            strokeWidth={isEditingLimitArea && editMode ? 5 : 2}
                            strokeOpacity={isEditingLimitArea && editMode ? 0.5 : 1}
                            strokeLinecap="round"
                            strokeDasharray={lineDrawing.isDrawing ? "5,5" : "none"}
                            style={{
                              cursor: isEditingLimitArea && editMode ? "copy" : "default",
                              pointerEvents: isEditingLimitArea && editMode ? "all" : "none",
                            }}
                            onDoubleClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              addLimitVertexOnSegment(idx);
                            }}
                          />
                        )}
                      </g>
                    ))}
                    {lineDrawing.points.length >= 2 && !lineDrawing.isDrawing && (() => {
                      const first = lineOverlayPoints[0];
                      const last = lineOverlayPoints[lineOverlayPoints.length - 1];
                      return (
                        <line
                          data-ui="line-segment-closing"
                          x1={last.x}
                          y1={last.y}
                          x2={first.x}
                          y2={first.y}
                          stroke="var(--bo-accent)"
                          strokeWidth={isEditingLimitArea && editMode ? 5 : 2}
                          strokeOpacity={isEditingLimitArea && editMode ? 0.5 : 1}
                          strokeLinecap="round"
                          style={{
                            cursor: isEditingLimitArea && editMode ? "copy" : "default",
                            pointerEvents: isEditingLimitArea && editMode ? "all" : "none",
                          }}
                          onDoubleClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            addLimitVertexOnClosingSegment();
                          }}
                        />
                      );
                    })()}
                    {lineDrawing.points.length >= 2 && !lineDrawing.isDrawing && (
                      <polygon
                        data-ui="limit-area-polygon"
                        points={lineOverlayPoints.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none"
                        stroke="var(--bo-accent)"
                        strokeWidth={2}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                  </svg>
                )}
              </div>

              <aside
                data-ui="draw-panel"
                className={`bo-tableMapDrawPanel${(editMode && !drawPanelDismissed && !lineDrawing.isDrawing) || drawPanelHover ? " is-open" : ""}`}
                aria-label="Panel de dibujo"
                onMouseEnter={openDrawPanelHover}
                onMouseLeave={closeDrawPanelHoverSoon}
              >
                <div data-slot="draw-panel-head" className="bo-tableMapDrawPanelHead">
                  <div data-ui="draw-panel-title" className="bo-panelTitle">Dibujo</div>
                  <button data-ui="close-draw-panel-btn" className="bo-btn bo-btn--ghost" type="button" onClick={closeDrawPanel}>Cerrar</button>
                </div>
                <div data-slot="draw-panel-body" className="bo-tableMapDrawPanelBody">
                    <ScrollArea dataSlot="draw-panel-body" className="bo-tableMapDrawScrollArea">
                  <div data-ui="draw-hint" className="bo-tableMapDrawHint">En modo dibujo puedes crear y editar muros/obstaculos. Las mesas quedan bloqueadas por estos limites.</div>

                  <div data-ui="limit-section" className="bo-tableMapDrawSection">
                    <div data-ui="limit-header" className="bo-tableMapDrawSectionHead">
                      <div data-ui="limit-title" className="bo-tableMapDrawSectionTitle">Limites del mapa</div>
                      <span
                        data-ui="template-status"
                        className={`bo-tableMapDrawSectionPill${floorTemplate ? " is-active" : ""}`}
                        aria-label={floorTemplate ? "Plantilla guardada para este salon" : "Sin plantilla"}
                      >
                        <Layers size={12} />
                        {floorTemplate ? "Plantilla" : "Sin plantilla"}
                      </span>
                    </div>
                    <div data-ui="limit-hint" className="bo-tableMapDrawHint">
                      {isEditingLimitArea
                        ? "Edita los limites: doble clic en una linea anade un punto, doble clic en un punto lo elimina."
                        : "Dibuja el perimetro del area"}
                    </div>

                    {floorTemplate ? (
                      <div
                        data-ui="template-scope-toggle"
                        className="bo-tableMapDrawScopeToggle"
                        role="group"
                        aria-label="Alcance de los cambios"
                      >
                        <button
                          data-ui="template-scope-template-btn"
                          type="button"
                          className={`bo-tableMapDrawScopeOption${templateScope === "template" ? " is-active" : ""}`}
                          onClick={() => requestScopeChange("template")}
                          aria-pressed={templateScope === "template"}
                        >
                          <Layers size={12} />
                          Cambios en la plantilla
                        </button>
                        <button
                          data-ui="template-scope-day-btn"
                          type="button"
                          className={`bo-tableMapDrawScopeOption${templateScope === "day" ? " is-active" : ""}`}
                          onClick={() => requestScopeChange("day")}
                          aria-pressed={templateScope === "day"}
                        >
                          <CalendarDays size={12} />
                          Cambios solo este dia
                        </button>
                      </div>
                    ) : null}

                    {floorTemplate && templateScope === "day" ? (
                      <div data-ui="day-scope-hint" className="bo-tableMapDrawHint bo-tableMapDrawHint--compact">
                        Estás editando solo para esta fecha. La plantilla no cambiara.
                      </div>
                    ) : null}
                    {floorTemplate && templateScope === "template" ? (
                      <div data-ui="template-scope-hint" className="bo-tableMapDrawHint bo-tableMapDrawHint--compact">
                        Los cambios se aplican a todos los dias de este salon.
                      </div>
                    ) : null}
                    {hasClosedLimitArea(selectedFloorTemplatePoints) && !floorTemplate ? (
                      <div data-ui="template-hint" className="bo-tableMapDrawHint bo-tableMapDrawHint--compact">
                        Hay limites guardados para este salon (solo este dia).
                      </div>
                    ) : null}
                    {!lineDrawing.isDrawing && lineDrawing.points.length === 0 && currentMapHistory.undo.length === 0 ? (
                      <button data-ui="start-line-drawing-btn" className="bo-btn bo-btn--primary" type="button" onClick={startLineDrawing}>
                        <MapPin size={16} />
                        Dibujar limites
                      </button>
                    ) : (
                      <div data-ui="line-draw-controls" className="bo-tableMapLineDrawControls">
                        {lineDrawing.isDrawing && (
                          <div data-ui="line-draw-status-row" className="bo-tableMapLineDrawStatusRow">
                            <div data-ui="line-draw-status" className="bo-tableMapLineDrawStatus">
                              <Circle size={12} className="bo-tableMapLineDrawStatusDot" />
                              <span data-ui="point-count">{lineDrawing.points.length} puntos</span>
                            </div>
                            <span data-ui="line-draw-status-hint" className="bo-tableMapLineDrawStatusHint">Pulsa en el mapa para añadir vértices</span>
                          </div>
                        )}
                        <div data-ui="line-draw-primary-actions" className="bo-tableMapLineDrawActionGroup bo-tableMapLineDrawActionGroup--primary">
                          {lineDrawing.isDrawing && lineDrawing.points.length > 0 && (
                            <button data-ui="undo-point-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={undoCreateAreaLastAction}>
                              <Undo size={14} />
                              Deshacer ultimo punto
                            </button>
                          )}
                          {lineDrawing.points.length >= 3 && lineDrawing.isDrawing && (
                            <button data-ui="close-area-btn" className="bo-btn bo-btn--primary bo-btn--sm" type="button" onClick={closeLineDrawing}>
                              <SquareMinus size={14} />
                              Cerrar area
                            </button>
                          )}
                          {!lineDrawing.isDrawing && hasClosedLimitArea(lineDrawing.points) && !isEditingLimitArea && (
                            <button data-ui="edit-area-btn" className="bo-btn bo-btn--primary bo-btn--sm" type="button" onClick={startLimitAreaEditing}>
                              <Pencil size={14} />
                              Editar area
                            </button>
                          )}
                          {!lineDrawing.isDrawing && hasClosedLimitArea(lineDrawing.points) && isEditingLimitArea && (
                            <button data-ui="save-edit-btn" className="bo-btn bo-btn--primary bo-btn--sm" type="button" onClick={stopLimitAreaEditing}>
                              <SquareMinus size={14} />
                              Guardar edicion
                            </button>
                          )}
                        </div>

                        {isEditingLimitArea && (
                          <div data-ui="line-draw-edit-actions" className="bo-tableMapLineDrawActionGroup bo-tableMapLineDrawActionGroup--secondary">
                            <span data-ui="editing-badge" className="bo-tableMapLineDrawEditingBadge">Editando límites</span>
                            <button data-ui="undo-edit-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={undoEditAreaLastAction}>
                              <Undo size={14} />
                              Deshacer ultimo cambio
                            </button>
                          </div>
                        )}

                        <div data-ui="line-draw-persistence-actions" className="bo-tableMapLineDrawActionGroup bo-tableMapLineDrawActionGroup--persistence">
                          {currentMapHistory.undo.length > 0 && (
                            <button
                              data-ui="cancel-line-btn"
                              className="bo-btn bo-btn--ghost bo-btn--sm"
                              type="button"
                              onClick={undoMapEdit}
                            >
                              <Undo size={14} />
                              Cancelar
                            </button>
                          )}
                          {currentMapHistory.redo.length > 0 && (
                            <button
                              data-ui="redo-line-btn"
                              className="bo-btn bo-btn--ghost bo-btn--sm"
                              type="button"
                              onClick={redoMapEdit}
                            >
                              <Redo2 size={14} />
                              Rehacer
                            </button>
                          )}
                          {lineDrawing.points.length > 0 && currentMapHistory.undo.length === 0 && (
                            <button
                              data-ui="cancel-line-btn"
                              className="bo-btn bo-btn--ghost bo-btn--sm"
                              type="button"
                              onClick={isEditingLimitArea ? stopLimitAreaEditing : cancelLineDrawing}
                            >
                              <Undo size={14} />
                              {isEditingLimitArea ? "Salir edicion" : "Cancelar"}
                            </button>
                          )}
                        </div>

                        <div data-ui="line-draw-template-actions" className="bo-tableMapLineDrawActionGroup bo-tableMapLineDrawActionGroup--template">
                          {!lineDrawing.isDrawing && hasClosedLimitArea(lineDrawing.points) && (
                            <button
                              data-ui="save-template-btn"
                              className="bo-btn bo-btn--ghost bo-btn--sm bo-tableMapLineDrawSaveBtn"
                              type="button"
                              onClick={() => void saveLimitAreaTemplate()}
                              disabled={savingLimitTemplate}
                            >
                              <MapPin size={14} />
                              {savingLimitTemplate
                                ? "Guardando..."
                                : templateScope === "day"
                                ? "Guardar solo este dia"
                                : "Guardar plantilla salon"}
                            </button>
                          )}
                          {floorTemplate ? (
                            <button
                              data-ui="delete-template-btn"
                              className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm"
                              type="button"
                              onClick={() => void clearFloorTemplate()}
                              disabled={savingLimitTemplate}
                            >
                              <Trash2 size={14} />
                              Eliminar plantilla
                            </button>
                          ) : null}
                        </div>

                        <div data-ui="line-draw-area-actions" className="bo-tableMapLineDrawActionGroup bo-tableMapLineDrawActionGroup--area">
                          {!lineDrawing.isDrawing && hasClosedLimitArea(lineDrawing.points) && !floorTemplate ? (
                            <button
                              data-ui="remove-area-btn"
                              className="bo-btn bo-btn--ghost bo-btn--danger bo-btn--sm"
                              type="button"
                              onClick={() => setRemoveAreaConfirmOpen(true)}
                            >
                              <Trash2 size={14} />
                              Eliminar area
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </div>

                  <div data-ui="draw-elements-section" className="bo-tableMapDrawSection">
                    <button
                      data-ui="draw-elements-toggle"
                      className="bo-drawAccordionToggle"
                      type="button"
                      onClick={() => setElementosOpen((v) => !v)}
                      aria-expanded={elementosOpen}
                    >
                      <div data-slot="toggle-label" className="bo-drawAccordionToggleLabel">
                        <div data-ui="draw-section-title" className="bo-tableMapDrawSectionTitle">Elementos</div>
                        <div data-ui="draw-section-hint" className="bo-tableMapDrawHint">Anade objetos con un solo click.</div>
                      </div>
                      <ChevronDown size={16} className={`bo-drawAccordionChevron${elementosOpen ? " is-open" : ""}`} />
                    </button>
                    {elementosOpen && (
                      <div data-ui="draw-preset-groups" className="bo-drawPresetGroups" aria-label="Herramientas de dibujo">
                        {DRAW_PANEL_GROUPS.map((group) => (
                          <section key={group.id} data-ui="draw-preset-group" className="bo-drawPresetGroup" aria-label={group.title}>
                            <div data-ui="draw-group-title" className="bo-drawPresetGroupTitle">{group.title}</div>
                            <div data-ui="draw-preset-grid" className="bo-drawPresetGrid">
                              {group.presets.map((preset) => {
                                const previewUrl = drawPresetAssetImageUrl(preset);
                                const isActivePreset = selectedDrawElement?.preset === preset;
                                return (
                                  <button
                                    key={preset}
                                    data-ui="draw-preset-btn"
                                    className={`bo-drawPresetBtn${isActivePreset ? " is-active" : ""}`}
                                    type="button"
                                    onClick={() => addDrawElement(preset)}
                                  >
                                    <span data-ui="preset-icon" className="bo-drawPresetBtnIcon" aria-hidden="true">
                                      {previewUrl ? (
                                        <img data-ui="preset-asset" className="bo-drawPresetBtnAsset" src={previewUrl} alt="" />
                                      ) : (
                                        DRAW_PRESET_ICONS[preset]
                                      )}
                                    </span>
                                    <span data-ui="preset-label" className="bo-drawPresetBtnLabel">{drawPresetLabel(preset)}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>

                  <div data-ui="draw-visual-section" className="bo-tableMapDrawSection">
                    <div data-ui="draw-visual-title" className="bo-tableMapDrawSectionTitle">Visual del elemento</div>
                    {selectedDrawElement ? (
                      <>
                        <div data-ui="selected-hint" className="bo-tableMapDrawHint bo-tableMapDrawHint--compact">
                          Seleccionado: <strong data-ui="selected-element-name">{selectedDrawElement.label}</strong>
                        </div>
                        <div data-ui="rotation-controls" className="bo-drawRotationControls" role="group" aria-label="Rotacion del elemento">
                          <button data-ui="rotate-left-btn" className="bo-drawRotateBtn" type="button" onClick={() => rotateSelectedDrawElement(-1)}>
                            <RotateCcw size={14} />
                            -10°
                          </button>
                          <div data-ui="rotation-value" className="bo-drawRotationValue">{Math.round(selectedDrawElement.rotationDeg)}°</div>
                          <button data-ui="rotate-right-btn" className="bo-drawRotateBtn" type="button" onClick={() => rotateSelectedDrawElement(1)}>
                            +10°
                            <RotateCw size={14} />
                          </button>
                        </div>
                        <div data-ui="display-mode-picker" className="bo-drawDisplayModePicker" role="group" aria-label="Modo de visualizacion del elemento">
                          <button
                            data-ui="display-mode-both"
                            className={`bo-drawDisplayModeBtn${selectedDrawElement.displayMode === "both" ? " is-active" : ""}`}
                            type="button"
                            onClick={() => updateSelectedDrawElementDisplayMode("both")}
                          >
                            Ambos
                          </button>
                          <button
                            data-ui="display-mode-asset"
                            className={`bo-drawDisplayModeBtn${selectedDrawElement.displayMode === "asset" ? " is-active" : ""}`}
                            type="button"
                            onClick={() => updateSelectedDrawElementDisplayMode("asset")}
                          >
                            Solo asset
                          </button>
                          <button
                            data-ui="display-mode-text"
                            className={`bo-drawDisplayModeBtn${selectedDrawElement.displayMode === "text" ? " is-active" : ""}`}
                            type="button"
                            onClick={() => updateSelectedDrawElementDisplayMode("text")}
                          >
                            Solo texto
                          </button>
                        </div>
                      </>
                    ) : (
                      <div data-ui="no-element-hint" className="bo-tableMapDrawHint">Selecciona un elemento del mapa para cambiar su visual.</div>
                    )}
                  </div>
                </ScrollArea>
                </div>
              </aside>

              <aside ref={rightSheetRef as React.RefObject<HTMLElement>} data-ui="right-sheet" className={`bo-tableMapSheet${rightSheetOpen ? " is-open" : ""}${isDragging ? " drag-active" : ""}`} aria-label="Panel de reservas">
                <div data-slot="sheet-head" className="bo-tableMapSheetHead">
                  {bookingForAssignment ? (
                    <div data-ui="assigning-banner" className="bo-assigningBanner">
                      <span>Asignando: <strong data-ui="assigning-name">{bookingForAssignment.customer_name}</strong></span>
                      <button data-ui="cancel-assign-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={cancelAssignmentMode}>Cancelar</button>
                    </div>
                  ) : (
                    <div data-ui="sheet-stats" className="bo-tableMapSheetStats">
                      <span data-ui="stat-total" className="bo-tableMapSheetStat bo-tableMapSheetStat--total">
                        <span data-ui="stat-dot" className="bo-tableMapSheetStatDot" />{bookingStats.total} reservas
                      </span>
                      <span data-ui="stat-seated" className="bo-tableMapSheetStat bo-tableMapSheetStat--seated">
                        <span data-ui="stat-dot" className="bo-tableMapSheetStatDot" />{bookingStats.seated} sentadas
                      </span>
                      <span data-ui="stat-pending" className="bo-tableMapSheetStat bo-tableMapSheetStat--pending">
                        <span data-ui="stat-dot" className="bo-tableMapSheetStatDot" />{bookingStats.pending} pendientes
                      </span>
                    </div>
                  )}
                  <div data-slot="sheet-header" className="bo-tableMapSheetHeader">
                    <div data-slot="sheet-header-left" className="bo-tableMapSheetHeaderLeft">
                      <div data-ui="sheet-title" className="bo-panelTitle">Booking manager</div>
                      <div data-ui="sheet-meta" className="bo-panelMeta">{visibleTables.length} mesas</div>
                    </div>
                    <div data-slot="sheet-header-actions" className="bo-tableMapSheetHeaderActions">
                      <button data-ui="date-toggle-btn" className="bo-btn bo-btn--ghost bo-tableMapDateBtn" type="button" onClick={() => setCalendarExpanded((v) => !v)} aria-expanded={calendarExpanded}>
                        <CalendarRange size={14} />
                        <span data-ui="date-label">{selectedDate}</span>
                      </button>
                      <button
                        data-ui="collapse-sheet-btn"
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
                <div data-slot="sheet-body" className="bo-tableMapSheetBody">
                  {calendarExpanded ? (
                    <div data-ui="calendar-wrapper" className="bo-tableMapCalendarWrapper">
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
                    <div data-ui="sheet-floor-tabs" className="bo-tableMapFloorTabs" role="tablist" aria-label="Seleccionar salon/planta">
                      {floorTabs.map((floor) => {
                        const active = floor.floorNumber === selectedFloor;
                        return (
                          <button
                            key={`sheet-floor-${floor.floorNumber}`}
                            data-ui="sheet-floor-tab"
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

                  <div data-ui="sheet-content" className="bo-tableMapSheetContent">
                      <ScrollArea dataSlot="sheet-content">
                    {sheetTab === "reservas" ? (
                      <div data-ui="reservations-section" className="bo-tableMapSection">
                        <div data-slot="reservations-header" className="bo-tableMapSectionHeader">
                          <div data-ui="reservations-title" className="bo-tableMapSectionTitle">Reservas del dia</div>
                          {bookings.length > 0 && hasUnassignedBookings && !assignMode && visibleTables.length > 0 && tablesByStatus.free.length > 0 && (
                            <button
                              data-ui="assign-table-btn"
                              className="bo-btn bo-btn--primary bo-btn--sm"
                              type="button"
                              onClick={() => setAssignMode(true)}
                            >
                              Asignar mesa
                            </button>
                          )}
                          {assignMode && (
                            <button
                              data-ui="cancel-assign-mode-btn"
                              className="bo-btn bo-btn--ghost bo-btn--sm"
                              type="button"
                              onClick={cancelAssignmentMode}
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                        {bookings.length === 0 ? (
                          <div data-ui="empty-bookings" className="bo-tableMapEmptyState">
                            <div data-ui="empty-icon" className="bo-tableMapEmptyStateIcon"><CalendarDays size={24} /></div>
                            <div data-ui="empty-text">No hay reservas para esta fecha</div>
                            <button data-ui="today-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => setSelectedDate(todayISO())}>Ver hoy</button>
                          </div>
                        ) : (
                          <div data-ui="bookings-list" className="bo-tableMapBookingsList">
                            {assignMode && hasUnassignedBookings && (
                              <div data-ui="assign-hint" className="bo-tableMapAssignModeHint">Selecciona una reserva sin mesa asignada</div>
                            )}
                            {assignMode && !hasUnassignedBookings && (
                              <div data-ui="all-assigned" className="bo-tableMapEmptyState">
                                <div data-ui="empty-icon" className="bo-tableMapEmptyStateIcon"><LayoutGrid size={24} /></div>
                                <div data-ui="empty-text">Todas las reservas tienen mesa asignada</div>
                              </div>
                            )}
                            {(bookings.filter(b => !assignMode || !b.table_number) || []).map((booking) => {
                              const seated = bookingStates[String(booking.id)]?.seated;
                              const isUnassigned = !booking.table_number;
                              const isAssigning = bookingForAssignment?.id === booking.id;
                              const isSelected = selectedBookingId === booking.id;
                              return (
                                <React.Fragment key={booking.id}>
                                  {/* Multi-table toggle appears above selected booking in assign mode */}
                                  {assignMode && isSelected && (
                                    <div data-ui="multi-table-inline" className="bo-multiTableInline">
                                      <div data-ui="multi-table-toggle-row" className="bo-multiTableToggleRow">
                                        <span className="bo-multiTableLabel">Asignar múltiples mesas</span>
                                        <button
                                          data-ui="multi-table-toggle"
                                          type="button"
                                          className={`bo-multiTableToggle${multiTableMode ? " is-active" : ""}`}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!multiTableMode) {
                                              setMultiTableMode(true);
                                              setMultiTableDraft([]);
                                            } else {
                                              setMultiTableMode(false);
                                              setMultiTableDraft([]);
                                            }
                                          }}
                                        >
                                          <span className="bo-multiTableToggleThumb" />
                                        </button>
                                      </div>
                                      {multiTableMode && (
                                        <>
                                          <div data-ui="multi-table-hint" className="bo-multiTableHint">
                                            Haz clic en las mesas del mapa para añadirlas
                                          </div>
                                          {multiTableDraft.length > 0 && (
                                            <div data-ui="multi-table-progress" className="bo-multiTableProgress">
                                              <span className={`bo-multiTableProgressText${multiTableTotalSeats >= multiTablePartySize ? " is-complete" : ""}`}>
                                                {multiTableTotalSeats} / {multiTablePartySize} comensales
                                              </span>
                                            </div>
                                          )}
                                          {multiTableDraft.length > 0 && (
                                            <div data-ui="multi-table-assigned" className="bo-multiTableAssigned">
                                              {multiTableDraft.map((row, idx) => (
                                                <div key={row.table_id} data-ui="multi-table-row" className="bo-multiTableRow">
                                                  <span className="bo-multiTableRowName">{row.table_name} ({row.seats})</span>
                                                  <div className="bo-multiTableRowActions">
                                                    <button
                                                      type="button"
                                                      className="bo-btn bo-btn--ghost bo-btn--xs"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        setMultiTableNamesModalIdx(idx);
                                                      }}
                                                      title="Nombres"
                                                    >
                                                      <ClipboardList size={14} />
                                                    </button>
                                                    <button
                                                      type="button"
                                                      className="bo-btn bo-btn--ghost bo-btn--xs"
                                                      onClick={(e) => {
                                                        e.stopPropagation();
                                                        removeTableFromMultiDraft(idx);
                                                      }}
                                                      title="Quitar"
                                                    >
                                                      ×
                                                    </button>
                                                  </div>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                          {multiTableDraft.length > 0 && (
                                            <div data-ui="multi-table-actions" className="bo-multiTableActions">
                                              <button
                                                data-ui="multi-table-save-btn"
                                                type="button"
                                                className="bo-btn bo-btn--primary bo-btn--sm"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  saveMultiTableDraft();
                                                }}
                                              >
                                                Guardar mesas
                                              </button>
                                            </div>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  )}
                                  <div
                                    data-ui="booking-row"
                                    className={`bo-tableMapBookingRow${seated ? " is-seated" : " is-pending"}${isAssigning ? " is-assigning" : ""}${assignMode ? " is-assign-mode" : ""}${isSelected ? " is-selected" : ""}${assignMode && !isUnassigned ? " is-disabled" : ""}`}
                                    onClick={() => {
                                      if (assignMode && !isUnassigned) return;
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
                                    <label data-ui="booking-checkbox" className="bo-checkboxContainer" onClick={(e) => e.stopPropagation()}>
                                      <input
                                        data-ui="booking-checkbox-input"
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          setSelectedBookingId(isSelected ? null : booking.id);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <span data-ui="checkbox-mark" className="bo-checkboxMark" />
                                    </label>
                                  ) : (
                                    <span data-ui="drag-handle" className="bo-bookingDragIndicator"><GripVertical size={16} /></span>
                                  )}
                                  <span data-ui="booking-status-dot" className="bo-tableMapBookingStatusDot" />
                                  <div data-ui="booking-main" className="bo-tableMapBookingMain">
                                    <strong data-ui="booking-table-customer">
                                      {assignmentsDisplayName(
                                        resolveAssignments(bookingStates[String(booking.id)], booking.table_number, booking.party_size),
                                        booking.table_number || "-",
                                      )} · {booking.customer_name}
                                    </strong>
                                    <span data-ui="booking-pax-time">{booking.party_size} pax · {formatHHMM(booking.reservation_time)}</span>
                                  </div>
                                  <DropdownMenu
                                    label="Acciones reserva"
                                    triggerClassName="bo-actionBtn bo-actionBtn--glass"
                                    triggerDataSlot="booking-row-actions"
                                    items={[
                                      { id: "details", label: "Ver", icon: <FileText size={16} strokeWidth={1.8} />, onSelect: () => setSelectedBooking(booking) },
                                      { id: "cancel", label: "Cancelar", tone: "danger", icon: <Trash2 size={16} strokeWidth={1.8} />, onSelect: () => void cancelBooking(booking) },
                                    ]}
                                    wrapperClassName="bo-tableBookingRowActions"
                                  />
                                  </div>
                                </React.Fragment>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <AnimatePresence mode="wait" initial={false}>
                        {tableSheetView === "table-detail" && selectedTableCard ? (
                          <motion.div
                            key="table-detail"
                            data-ui="table-detail-view"
                            className="bo-tableSheetDetail"
                            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeInOut" }}
                          >
                            <div data-slot="detail-header" className="bo-tableSheetDetailHeader">
                              <button data-ui="back-to-list-btn" className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={closeTableDetail} aria-label="Volver a mesas">
                                <ChevronLeft size={18} strokeWidth={1.8} />
                              </button>
                              <div data-ui="detail-table-info" className="bo-tableSheetDetailTableInfo">
                                <span data-ui="detail-table-name" className="bo-tableSheetDetailTableName">{selectedTableCard.name}</span>
                                <span data-ui="detail-table-cap" className="bo-tableSheetDetailTableCap">{selectedTableCard.capacity} pax</span>
                              </div>
                              <span data-ui="detail-status-pill" className={`bo-tableSheetDetailStatusPill${selectedTableCardIsOccupied ? " is-occupied" : " is-free"}`}>
                                {selectedTableCardIsOccupied ? "Ocupada" : "Libre"}
                              </span>
                            </div>

                            {selectedTableCardBookings.length > 0 ? (
                              <div data-slot="detail-bookings" className="bo-tableSheetDetailBookings">
                                {selectedTableCardBookings.map((booking) => {
                                  const isSeated = bookingStates[String(booking.id)]?.seated;
                                  return (
                                    <div key={booking.id} data-ui="detail-booking-card" className="bo-tableSheetDetailBookingCard">
                                      <div data-slot="booking-card-head" className="bo-tableSheetDetailBookingHead">
                                        <div data-ui="booking-customer" className="bo-tableSheetDetailBookingCustomer">{booking.customer_name}</div>
                                        <span data-ui="booking-status-pill" className={`bo-tableSheetDetailBookingStatus${isSeated ? " is-seated" : " is-pending"}`}>
                                          {isSeated ? "Sentada" : "Pendiente"}
                                        </span>
                                      </div>
                                      <div data-slot="booking-card-meta" className="bo-tableSheetDetailBookingMeta">
                                        <span data-ui="booking-pax">{booking.party_size} pax</span>
                                        <span data-ui="booking-time">{formatHHMM(booking.reservation_time)}</span>
                                        {booking.contact_phone && <span data-ui="booking-phone">{booking.contact_phone}</span>}
                                      </div>
                                      {booking.commentary ? (
                                        <div data-ui="booking-comment" className="bo-tableSheetDetailBookingComment">{booking.commentary}</div>
                                      ) : null}
                                      <div data-slot="booking-card-actions" className="bo-tableSheetDetailBookingActions">
                                        <button
                                          data-ui="toggle-seated-detail-btn"
                                          className="bo-btn bo-btn--ghost bo-btn--sm"
                                          type="button"
                                          onClick={() => markBookingSeated(booking, !isSeated)}
                                        >
                                          {isSeated ? "Desmarcar sentada" : "Marcar sentada"}
                                        </button>
                                        <button
                                          data-ui="unassign-booking-btn"
                                          className="bo-btn bo-btn--ghost bo-btn--sm"
                                          type="button"
                                          onClick={() => void unassignBookingFromTable(booking)}
                                        >
                                          Desasignar mesa
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div data-ui="no-bookings-detail" className="bo-tableMapEmptyState">
                                <div data-ui="empty-text">No hay reservas para esta mesa</div>
                              </div>
                            )}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="table-list"
                            data-ui="tables-section"
                            className="bo-tableMapSection"
                            initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
                            transition={reduceMotion ? { duration: 0 } : { duration: 0.18, ease: "easeInOut" }}
                          >
                            <div data-slot="tables-header" className="bo-tableMapSectionHeader">
                              <div data-ui="tables-title" className="bo-tableMapSectionTitle">Estado de mesas</div>
                              <div data-ui="tables-summary" className="bo-tableMapSectionSummary">
                                <span data-ui="summary-free" className="bo-tableMapSummaryItem bo-tableMapSummaryItem--free">{tableSummary.free} libres</span>
                                <span data-ui="summary-booked" className="bo-tableMapSummaryItem bo-tableMapSummaryItem--booked">{tableSummary.booked} reservadas</span>
                                <span data-ui="summary-seated" className="bo-tableMapSummaryItem bo-tableMapSummaryItem--seated">{tableSummary.seated} ocupadas</span>
                              </div>
                            </div>
                            {visibleTables.length === 0 ? (
                              <div data-ui="empty-tables" className="bo-tableMapEmptyState">
                                <div data-ui="empty-icon" className="bo-tableMapEmptyStateIcon"><LayoutGrid size={24} /></div>
                                <div data-ui="empty-text">No hay mesas en este salon</div>
                                <button data-ui="create-table-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => setEditorOpen(true)}>Crear mesa</button>
                              </div>
                            ) : (
                              <div data-ui="tables-by-status" className="bo-tableMapTablesByStatus">
                                {tablesByStatus.seated.length > 0 && (
                                  <div data-ui="status-group-seated" className="bo-tableMapTablesStatusGroup">
                                    <div data-ui="status-group-title" className="bo-tableMapTablesStatusGroupTitle">Ocupadas</div>
                                    <div data-ui="status-group-grid" className="bo-tableMapTablesGrid">
                                      {tablesByStatus.seated.map((table) => {
                                        const tableBookings = getTableBookings(table.name);
                                        const currentBooking = tableBookings[0];
                                        return (
                                          <div
                                            key={`table-card-${table.id}`}
                                            data-ui="table-card-seated"
                                            className="bo-tableMapTableCard is-seated"
                                            onClick={() => {
                                              setSelectedTableCardId(table.id);
                                              setTableSheetView("table-detail");
                                            }}
                                          >
                                            <span data-ui="table-card-occ" className="bo-tableMapTableCardOcc" />
                                            <span data-ui="table-card-name" className="bo-tableMapTableCardNum">{table.name}</span>
                                            <span data-ui="table-card-cap" className="bo-tableMapTableCardCap">{table.capacity} pax</span>
                                            {currentBooking && (
                                              <span data-ui="table-card-booking" className="bo-tableMapTableCardBooking">
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
                                  <div data-ui="status-group-booked" className="bo-tableMapTablesStatusGroup">
                                    <div data-ui="status-group-title" className="bo-tableMapTablesStatusGroupTitle">Reservadas</div>
                                    <div data-ui="status-group-grid" className="bo-tableMapTablesGrid">
                                      {tablesByStatus.booked.map((table) => {
                                        const tableBookings = getTableBookings(table.name);
                                        const currentBooking = tableBookings[0];
                                        return (
                                          <div
                                            key={`table-card-${table.id}`}
                                            data-ui="table-card-booked"
                                            className="bo-tableMapTableCard is-booked"
                                            onClick={() => {
                                              setSelectedTableCardId(table.id);
                                              setTableSheetView("table-detail");
                                            }}
                                          >
                                            <span data-ui="table-card-occ" className="bo-tableMapTableCardOcc" />
                                            <span data-ui="table-card-name" className="bo-tableMapTableCardNum">{table.name}</span>
                                            <span data-ui="table-card-cap" className="bo-tableMapTableCardCap">{table.capacity} pax</span>
                                            {currentBooking && (
                                              <span data-ui="table-card-booking" className="bo-tableMapTableCardBooking">
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
                                  <div data-ui="status-group-free" className="bo-tableMapTablesStatusGroup">
                                    <div data-ui="status-group-title" className="bo-tableMapTablesStatusGroupTitle">Libres</div>
                                    <div data-ui="status-group-grid" className="bo-tableMapTablesGrid">
                                      {tablesByStatus.free.map((table) => {
                                        const isCardSelected = selectedTableCardId === table.id;
                                        return (
                                          <div
                                            key={`table-card-${table.id}`}
                                            data-ui="table-card-free"
                                            className={`bo-tableMapTableCard is-free${isCardSelected ? " is-selected" : ""}`}
                                            onClick={() => {
                                              setSelectedTableCardId(isCardSelected ? null : table.id);
                                            }}
                                          >
                                            <span data-ui="table-card-occ" className="bo-tableMapTableCardOcc" />
                                            <span data-ui="table-card-name" className="bo-tableMapTableCardNum">{table.name}</span>
                                            <span data-ui="table-card-cap" className="bo-tableMapTableCardCap">{table.capacity} pax</span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                    <AnimatePresence>
                                      {selectedTableCardId !== null && selectedTableCard && !selectedTableCardIsOccupied ? (
                                        <motion.div
                                          key="assign-section"
                                          data-ui="assign-section"
                                          className="bo-tableSheetAssignSection"
                                          initial={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
                                          animate={{ opacity: 1, height: "auto" }}
                                          exit={reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 }}
                                          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: "easeInOut" }}
                                        >
                                          <div data-ui="assign-title" className="bo-tableSheetAssignTitle">
                                            Asignar reserva a <strong>{selectedTableCard.name}</strong>
                                          </div>
                                          {unassignedBookings.length > 0 ? (
                                            <div data-ui="assign-list" className="bo-tableSheetAssignList">
                                              {unassignedBookings.map((booking) => (
                                                <button
                                                  key={booking.id}
                                                  data-ui="assign-row"
                                                  className="bo-tableSheetAssignRow"
                                                  type="button"
                                                  onClick={() => void assignBookingToFreeTable(booking, selectedTableCard.name)}
                                                >
                                                  <span data-ui="assign-row-name" className="bo-tableSheetAssignRowName">{booking.customer_name}</span>
                                                  <span data-ui="assign-row-meta" className="bo-tableSheetAssignRowMeta">
                                                    {booking.party_size} pax · {formatHHMM(booking.reservation_time)}
                                                  </span>
                                                </button>
                                              ))}
                                            </div>
                                          ) : (
                                            <div data-ui="no-unassigned-bookings" className="bo-tableSheetAssignEmpty">No hay mas reservas para el dia de hoy</div>
                                          )}
                                        </motion.div>
                                      ) : null}
                                    </AnimatePresence>
                                  </div>
                                )}
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    )}
                  </ScrollArea>
                  </div>
                </div>
              </aside>

              <Modal open={editorOpen} title={editingTableId ? "Editar mesa" : "Nueva mesa"} onClose={() => setEditorOpen(false)} widthPx={980} className="bo-tableEditorModal" hideClose>
                <ModalHeader data-slot="modal-head" data-ui="modal-title" title={editingTableId ? "Editar mesa" : "Nueva mesa"} onClose={() => setEditorOpen(false)} />

                <div data-ui="editor-grid" className="bo-tableEditorGrid">
                    <ScrollArea dataSlot="editor-grid" className="bo-tableEditorGridScroll">
                  <div data-slot="editor-columns" className="bo-tableEditorColumns">
                  <div data-slot="editor-preview" className="bo-tableEditorPreviewWrap">
                    <div data-ui="rotate-controls" className="bo-tableEditorRotate" role="group" aria-label="Giro de mesa">
                      <button
                        data-ui="rotate-left-btn"
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
                        data-ui="rotate-right-btn"
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
                    <div data-ui="preview-table" className={`bo-tableEditorPreviewTable is-${draft.shape}`} style={{
                      ["--bo-table-fill" as any]: draft.fillColor,
                      ["--bo-table-outline" as any]: draft.outlineColor,
                      ["--bo-table-texture" as any]: draft.texturePreview ? `url(${draft.texturePreview})` : "none",
                      width: `${geom.width}px`,
                      height: `${geom.height}px`,
                      transform: `rotate(${draft.rotationDeg}deg)`,
                    }}>
                      <span data-ui="preview-capacity" className="bo-tableEditorCapacity">{clampCapacity(draft.capacity)}</span>
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
                                data-ui="add-short-side-btn"
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
                              data-ui="remove-short-side-btn"
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
                              <span data-ui="chair-action-icon" className="bo-tableEditorChairAction" aria-hidden="true">
                                <X size={10} strokeWidth={2.3} />
                              </span>
                            </button>
                          );
                        }
                        return (
                          <span
                            key={idx}
                            data-ui="preview-chair"
                            className="bo-tableEditorChair"
                            style={{ transform: `translate(${chair.x}px, ${chair.y}px)` }}
                          />
                        );
                      })}
                    </div>
                  </div>

                  <div data-slot="editor-config" className="bo-tableEditorConfig">
                    <div data-ui="field-name" className="bo-field">
                      <label data-ui="name-label" className="bo-label" htmlFor="table-name">Nombre/etiqueta</label>
                      <input
                        data-ui="name-input"
                        id="table-name"
                        className="bo-input"
                        value={draft.name}
                        onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>

                    <div data-ui="field-number" className="bo-field">
                      <label data-ui="number-label" className="bo-label" htmlFor="table-number">Número de mesa</label>
                      <input
                        data-ui="number-input"
                        id="table-number"
                        className="bo-input"
                        placeholder="4, 4B, 4-B..."
                        maxLength={32}
                        value={draft.numeroMesa}
                        onChange={(e) => setDraft((prev) => ({ ...prev, numeroMesa: e.target.value }))}
                      />
                    </div>

                    <div data-ui="field-shape" className="bo-field">
                      <label data-ui="shape-label" className="bo-label">Forma</label>
                      <div data-ui="shape-buttons" className="bo-tableEditorShapeBtns">
                        <button data-ui="shape-round-btn" type="button" className={`bo-btn bo-btn--ghost${draft.shape === "round" ? " is-active" : ""}`} onClick={() => setDraft((prev) => ({ ...prev, shape: "round" }))}>
                          Redonda
                        </button>
                        <button data-ui="shape-square-btn" type="button" className={`bo-btn bo-btn--ghost${draft.shape === "square" ? " is-active" : ""}`} onClick={() => setDraft((prev) => ({ ...prev, shape: "square" }))}>
                          Cuadrada
                        </button>
                      </div>
                    </div>

                    <div data-ui="field-colors" className="bo-field">
                      <label data-ui="colors-label" className="bo-label">Colores</label>
                      <div data-ui="color-presets" className="bo-tableEditorPresetGrid">
                        {COLOR_PRESETS.map((preset) => (
                          <button
                            key={preset.id}
                            data-ui="color-preset-btn"
                            type="button"
                            className={`bo-tableColorPreset${draft.stylePreset === preset.id ? " is-active" : ""}`}
                            onClick={() => onPickPreset(preset.id)}
                            aria-label={`Preset ${preset.id}`}
                            style={{ ["--bo-preset-fill" as any]: preset.fill, ["--bo-preset-outline" as any]: preset.outline }}
                          />
                        ))}
                      </div>
                    </div>

                    <div data-ui="field-texture" className="bo-field">
                      <label data-ui="texture-label" className="bo-label">Subir textura</label>
                      <label data-ui="texture-upload-btn" className="bo-btn bo-btn--ghost bo-tableUploadBtn">
                        <ImagePlus size={16} strokeWidth={1.8} />
                        <span data-ui="upload-label">Subir imagen</span>
                        <input data-ui="texture-file-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={onTextureInput} hidden />
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
                </ScrollArea>
                </div>

                <div data-ui="editor-modal-actions-wrapper" className="bo-tableEditorActionsWrap">
                  <div data-ui="editor-modal-actions" className="bo-modalActions">
                    <button data-ui="cancel-editor-btn" className="bo-btn bo-btn--ghost" type="button" onClick={() => setEditorOpen(false)} disabled={saving}>
                      Cancelar
                    </button>
                    <button data-ui="save-editor-btn" className="bo-btn bo-btn--primary" type="button" onClick={() => void saveDraft()} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                  </div>
                </div>
              </Modal>

              <Modal open={Boolean(selectedBooking)} title="Reserva" onClose={() => setSelectedBooking(null)} widthPx={760} className="bo-tableBookingModal">
                {selectedBooking ? (
                  <div data-ui="booking-modal-content" className="bo-tableBookingModalContent">
                    <div data-slot="modal-head" className="bo-tableBookingModalHead">
                      <button data-ui="close-booking-x" className="bo-modalX" type="button" onClick={() => setSelectedBooking(null)} aria-label="Cerrar">
                        <X size={16} />
                      </button>
                    </div>

                    <div data-ui="booking-hero" className="bo-tableBookingHero">
                      <div data-ui="booking-hero-left" className="bo-tableBookingHeroLeft">
                        {(() => {
                          const display = assignmentsDisplayName(
                            resolveAssignments(bookingStates[String(selectedBooking.id)], selectedBooking.table_number, selectedBooking.party_size),
                            selectedBooking.table_number || "",
                          );
                          const unassigned = !display;
                          return (
                            <div data-ui="booking-table-badge" className={`bo-tableBookingTableBadge${unassigned ? " is-unassigned" : ""}`}>
                              {unassigned ? "Sin mesa" : `Mesas: ${display}`}
                            </div>
                          );
                        })()}
                        <div data-ui="booking-hero-name" className="bo-tableBookingHeroName">{selectedBooking.customer_name}</div>
                      </div>
                      <div data-ui="booking-hero-right" className="bo-tableBookingHeroRight">
                        <span data-ui="hero-pax" className="bo-tableBookingHeroStat">
                          <Users size={15} strokeWidth={1.8} />
                          {selectedBooking.party_size} pax
                        </span>
                        <span data-ui="hero-time" className="bo-tableBookingHeroStat">
                          <CalendarDays size={15} strokeWidth={1.8} />
                          {formatHHMM(selectedBooking.reservation_time)}
                        </span>
                        <span data-ui="hero-status" className={`bo-tableBookingHeroStatus${bookingStates[String(selectedBooking.id)]?.seated ? " is-seated" : " is-pending"}`}>
                          {bookingStates[String(selectedBooking.id)]?.seated ? "Sentada" : "Pendiente"}
                        </span>
                      </div>
                    </div>

                    <div data-ui="booking-details-grid" className="bo-tableBookingDetailsGrid">
                      <div data-ui="detail-name" className="bo-tableBookingDetailCard">
                        <div data-ui="detail-label" className="bo-tableBookingDetailLabel">Nombre</div>
                        <div data-ui="detail-value" className="bo-tableBookingDetailValue">{selectedBooking.customer_name}</div>
                      </div>
                      <div data-ui="detail-time" className="bo-tableBookingDetailCard">
                        <div data-ui="detail-label" className="bo-tableBookingDetailLabel">Hora</div>
                        <div data-ui="detail-value" className="bo-tableBookingDetailValue">{formatHHMM(selectedBooking.reservation_time)}</div>
                      </div>
                      <div data-ui="detail-guests" className="bo-tableBookingDetailCard">
                        <div data-ui="detail-label" className="bo-tableBookingDetailLabel">Comensales</div>
                        <div data-ui="detail-value" className="bo-tableBookingDetailValue">{selectedBooking.party_size}</div>
                      </div>
                      <div data-ui="detail-source" className="bo-tableBookingDetailCard">
                        <div data-ui="detail-label" className="bo-tableBookingDetailLabel">Estado</div>
                        <div data-ui="detail-value" className="bo-tableBookingDetailValue">
                          <span data-ui="status-indicator" className={`bo-tableBookingStatusIndicator${bookingStates[String(selectedBooking.id)]?.seated ? " is-seated" : " is-pending"}`} />
                          {bookingStates[String(selectedBooking.id)]?.seated ? "Sentada" : "Pendiente"}
                        </div>
                      </div>
                      {selectedBooking.commentary ? (
                        <div data-ui="detail-comment" className="bo-tableBookingDetailCard bo-tableBookingDetailCard--wide">
                          <div data-ui="detail-label" className="bo-tableBookingDetailLabel">Comentario</div>
                          <div data-ui="detail-value" className="bo-tableBookingDetailValue bo-tableBookingDetailValue--wrap">{selectedBooking.commentary}</div>
                        </div>
                      ) : null}
                    </div>

                    <div data-ui="field-booking-tables" className="bo-tableBookingTableField">
                      <label data-ui="booking-tables-label" className="bo-tableBookingTableLabel">Mesas asignadas</label>
                      {visibleTables.length === 0 ? (
                        <div data-ui="booking-table-empty" className="bo-tableBookingTableEmpty" role="status">
                          No hay mesas creadas, por favor primero crea una mesa nueva.
                        </div>
                      ) : (
                        <BookingAssignmentEditor
                          booking={selectedBooking}
                          state={bookingStates[String(selectedBooking.id)]}
                          tables={visibleTables}
                          occupiedSeats={occupiedSeatsExcludingBooking(selectedBooking)}
                          onSave={(assignments) => void saveBookingAssignments(selectedBooking, assignments)}
                        />
                      )}
                    </div>

                    <div data-ui="booking-modal-actions" className="bo-tableBookingModalActions">
                      <button data-ui="cancel-booking-btn" className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => void cancelBooking(selectedBooking)}>
                        <Trash2 size={14} strokeWidth={1.8} />
                        Cancelar reserva
                      </button>
                      <div data-slot="actions-right" className="bo-tableBookingActionsRight">
                        {visibleTables.length > 0 ? (
                          <button
                            data-ui="toggle-seated-btn"
                            className="bo-btn bo-btn--ghost bo-btn--sm"
                            type="button"
                            onClick={() => markBookingSeated(selectedBooking, !bookingStates[String(selectedBooking.id)]?.seated)}
                          >
                            {bookingStates[String(selectedBooking.id)]?.seated ? "Desmarcar sentada" : "Marcar sentada"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}
              </Modal>

              <Modal open={removeAreaConfirmOpen} title="Eliminar area" onClose={() => setRemoveAreaConfirmOpen(false)} widthPx={480} className="bo-tableRemoveAreaModal" hideClose>
                <ModalHeader data-slot="modal-head" data-ui="modal-title" title="Eliminar area" onClose={() => setRemoveAreaConfirmOpen(false)} />
                <div data-ui="remove-area-confirm" className="bo-tableRemoveAreaConfirm">
                  <p data-ui="remove-area-message" className="bo-tableRemoveAreaText">
                    Se eliminaran los limites del mapa y <strong>todos los elementos</strong> dibujados dentro de el
                    (muros, obstaculos, imagenes). Las mesas se mantendran.
                  </p>
                  <div data-ui="remove-area-actions" className="bo-modalActions">
                    <button data-ui="cancel-remove-area-btn" className="bo-btn bo-btn--ghost" type="button" onClick={() => setRemoveAreaConfirmOpen(false)}>
                      Cancelar
                    </button>
                    <button data-ui="confirm-remove-area-btn" className="bo-btn bo-btn--danger" type="button" onClick={removeArea}>
                      Eliminar area
                    </button>
                  </div>
                </div>
              </Modal>

              {/* Multi-table names modal */}
              {multiTableNamesModalIdx !== null && multiTableDraft[multiTableNamesModalIdx] && (
                <GuestNamesModal
                  tableName={multiTableDraft[multiTableNamesModalIdx].table_name}
                  capacity={multiTableDraft[multiTableNamesModalIdx].seats}
                  names={multiTableDraft[multiTableNamesModalIdx].names}
                  onSave={(names) => {
                    updateMultiDraftNames(multiTableNamesModalIdx, names);
                    setMultiTableNamesModalIdx(null);
                  }}
                  onClose={() => setMultiTableNamesModalIdx(null)}
                />
              )}
            </motion.div>
          ) : (
            <motion.div
              data-ui="table-map-closed"
              key="table-map-closed"
              className="bo-tableMapClosedShell"
              initial={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={dayVisibilityTransition}
            >
              <div data-ui="closed-top" className="bo-tableMapClosedTop">
                <button data-ui="closed-back-btn" className="bo-actionBtn bo-actionBtn--glass" type="button" onClick={onBack} aria-label="Volver a reservas">
                  <ChevronLeft size={18} strokeWidth={1.8} />
                </button>
                <MonthCalendarDatePicker
                  value={selectedDate}
                  onChange={onSelectDate}
                  year={calendarView.year}
                  month={calendarView.month}
                  days={calendarDays}
                  onPrevMonth={onPrevMonth}
                  onNextMonth={onNextMonth}
                  loading={loading}
                  data-testid="table-map-date-picker"
                  className="bo-tableMapHeaderDatePicker"
                />
              </div>
              <div data-ui="closed-body" className="bo-tableMapClosedBody">
                <ReservationDayPanel
                  title="Dia cerrado"
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
