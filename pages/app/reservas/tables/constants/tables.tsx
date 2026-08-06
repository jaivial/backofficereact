import { Square, Leaf, Users, Sofa, GripVertical, Circle, Trash2, DoorOpen } from "lucide-react";
import type { ColorPreset, DrawPanelGroup, DrawElementPreset } from "../types/tables";

export { Square, Leaf, Users, Sofa, GripVertical, Circle, Trash2, DoorOpen };

export const COLOR_PRESETS: ColorPreset[] = [
  { id: "lavanda", fill: "rgba(185, 168, 255, 0.28)", outline: "rgba(185, 168, 255, 0.72)" },
  { id: "cian", fill: "rgba(147, 239, 231, 0.24)", outline: "rgba(147, 239, 231, 0.74)" },
  { id: "amber", fill: "rgba(245, 181, 109, 0.25)", outline: "rgba(245, 181, 109, 0.7)" },
  { id: "grafito", fill: "rgba(125, 129, 157, 0.22)", outline: "rgba(125, 129, 157, 0.7)" },
];

export const STATUS_LABEL: Record<string, string> = {
  available: "Libre",
  reserved: "Reservada",
  occupied: "Ocupada",
};

export const RECT_SEAT_OFFSET = 18;
export const DRAW_ROTATE_STEP = 10;

/** Minimum canvas size (px) for a table node when resizing in edit mode. */
export const TABLE_SIZE_MIN = 44;
export const TABLE_SIZE_DEFAULT = 148;

export const DEFAULT_TABLE_MAP_FIT_VIEW_OPTIONS = {
  padding: 0.5,
  maxZoom: 0.45,
};

export const TABLE_LIMIT_PADDING = 40;

export const DRAW_PANEL_GROUPS: DrawPanelGroup[] = [
  { id: "structure", title: "Estructura", presets: ["wall", "wall_corner", "wall_window", "column"] },
  { id: "obstacles", title: "Obstáculos", presets: ["plant", "plant_tall", "lamp", "chair", "bench", "trashcan"] },
  { id: "openings", title: "Aberturas y muebles", presets: ["door", "door_wide", "arch_door", "sofa"] },
];

export const DRAW_PRESET_ICONS: Record<DrawElementPreset, React.ReactElement> = {
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
