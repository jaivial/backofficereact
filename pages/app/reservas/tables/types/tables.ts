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
};

// Line drawing state (LinePoint is imported from lineDrawing.ts)
// LineDrawingState references LinePoint
export type LineDrawingState = {
  points: Array<{ x: number; y: number }>;
  isDrawing: boolean;
};

// Booking state
export type BookingState = {
  seated: boolean;
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
