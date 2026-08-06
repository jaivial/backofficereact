// Table shape and draft types
export type TableShape = "round" | "square";
export type RectShortSide = "left" | "right";
export type RectShortSides = Record<RectShortSide, boolean>;

export type TableDraft = {
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

export type TableNodeData = {
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
  /** Explicit canvas size (px) set by the editor resize feature. */
  width?: number;
  height?: number;
  /** True while the map is in edit mode (enables resize handles). */
  editable?: boolean;
  /** Fired by NodeResizer when a resize gesture ends (final pixel size). */
  onResizeEnd?: (width: number, height: number) => void;
  /** Names of seated guests at this table (derived from booking assignments). */
  seatedNames?: string[];
  /** True when table is in multi-table draft selection */
  isMultiSelected?: boolean;
  /** Index in multiTableDraft array (-1 if not selected) */
  multiTableDraftIdx?: number;
  /** Callback to open names modal for this table */
  onMultiNamesClick?: () => void;
  /** Callback to remove this table from multi selection */
  onMultiRemoveClick?: () => void;
};

// Draw element types
export type DrawElementDisplayMode = "asset" | "text" | "both";
export type DrawElementKind = "wall" | "obstacle" | "image";
export type DrawElementPreset =
  | "wall"
  | "wall_corner"
  | "wall_window"
  | "plant"
  | "plant_tall"
  | "chair"
  | "bench"
  | "column"
  | "lamp"
  | "trashcan"
  | "door"
  | "door_wide"
  | "arch_door"
  | "sofa";

export type DrawElement = {
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

export type DrawNodeData = {
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
  onDelete?: () => void;
  onResizeEnd?: (width: number, height: number) => void;
};

// Line drawing state (LinePoint is imported from lineDrawing.ts)
// LineDrawingState references LinePoint
export type LineDrawingState = {
  points: Array<{ x: number; y: number }>;
  isDrawing: boolean;
};

// Booking state
export type BookingTableAssignment = {
  /** Table row id when resolvable (null for legacy table_number-only bookings). */
  table_id: number | null;
  table_name: string;
  /** Number of guests split to this table. */
  seats: number;
  /** Guest names seated at this table. */
  names: string[];
};

export type BookingState = {
  seated: boolean;
  /**
   * Structured table split for the booking. Missing for legacy bookings that
   * only carry a `table_number`; those are derived as a single assignment.
   */
  assignments?: BookingTableAssignment[];
};

// Geometry types
export type ChairPosition = { x: number; y: number; side: "top" | "right" | "bottom" | "left" };

export type PreviewGeometry = {
  width: number;
  height: number;
  chairs: ChairPosition[];
};

// Date view type
export type DateView = {
  year: number;
  month: number;
};

// Color preset type
export type ColorPreset = { id: string; fill: string; outline: string };

// Draw panel group type
export type DrawPanelGroup = { id: string; title: string; presets: DrawElementPreset[] };
