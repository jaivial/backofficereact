export type DrawElementKind = "wall" | "obstacle" | "image";

export type DrawElementPreset =
  | "wall"
  | "wall_corner"
  | "wall_window"
  | "plant"
  | "plant_tall"
  | "chair"
  | "bench"
  | "door"
  | "door_wide"
  | "arch_door"
  | "sofa"
  | "column"
  | "lamp"
  | "trashcan";

export type DrawElementDisplayMode = "asset" | "text" | "both";

type DrawPresetDefinition = {
  label: string;
  kind: DrawElementKind;
  size: { width: number; height: number };
  assetImageUrl?: string;
};

export const DRAW_PRESET_META: Record<DrawElementPreset, DrawPresetDefinition> = {
  wall: {
    label: "Muro",
    kind: "wall",
    size: { width: 220, height: 26 },
    assetImageUrl: "/assets/draw/wall.png",
  },
  wall_corner: {
    label: "Muro esquina",
    kind: "wall",
    size: { width: 120, height: 92 },
    assetImageUrl: "/assets/draw/wall-corner.png",
  },
  wall_window: {
    label: "Muro ventana",
    kind: "wall",
    size: { width: 170, height: 92 },
    assetImageUrl: "/assets/draw/wall-window.png",
  },
  plant: {
    label: "Planta",
    kind: "obstacle",
    size: { width: 92, height: 92 },
    assetImageUrl: "/assets/draw/plant.png",
  },
  plant_tall: {
    label: "Planta alta",
    kind: "obstacle",
    size: { width: 92, height: 108 },
    assetImageUrl: "/assets/draw/plant-tall.png",
  },
  chair: {
    label: "Silla",
    kind: "obstacle",
    size: { width: 82, height: 82 },
    assetImageUrl: "/assets/draw/chair.png",
  },
  bench: {
    label: "Banco",
    kind: "obstacle",
    size: { width: 132, height: 82 },
    assetImageUrl: "/assets/draw/bench.png",
  },
  column: {
    label: "Columna",
    kind: "obstacle",
    size: { width: 116, height: 116 },
    assetImageUrl: "/assets/draw/column.png",
  },
  lamp: {
    label: "Lámpara",
    kind: "obstacle",
    size: { width: 92, height: 92 },
    assetImageUrl: "/assets/draw/lamp.png",
  },
  trashcan: {
    label: "Papelera",
    kind: "obstacle",
    size: { width: 92, height: 92 },
    assetImageUrl: "/assets/draw/trashcan.png",
  },
  door: {
    label: "Puerta",
    kind: "image",
    size: { width: 92, height: 92 },
    assetImageUrl: "/assets/draw/door.png",
  },
  door_wide: {
    label: "Puerta ancha",
    kind: "image",
    size: { width: 124, height: 92 },
    assetImageUrl: "/assets/draw/door-wide.png",
  },
  arch_door: {
    label: "Puerta arco",
    kind: "image",
    size: { width: 92, height: 92 },
    assetImageUrl: "/assets/draw/arch-door.png",
  },
  sofa: {
    label: "Sofá",
    kind: "image",
    size: { width: 112, height: 92 },
    assetImageUrl: "/assets/draw/sofa.png",
  },
};

export const DRAW_TOOL_PRESETS: DrawElementPreset[] = [
  "wall",
  "wall_corner",
  "wall_window",
  "plant",
  "plant_tall",
  "chair",
  "bench",
  "column",
  "lamp",
  "trashcan",
  "door",
  "door_wide",
  "arch_door",
  "sofa",
];

const DRAW_PRESET_SET = new Set<DrawElementPreset>(
  Object.keys(DRAW_PRESET_META) as DrawElementPreset[],
);
const DRAW_DISPLAY_MODE_SET = new Set<DrawElementDisplayMode>(["asset", "text", "both"]);

export function normalizeDrawElementPreset(value: unknown): DrawElementPreset {
  return typeof value === "string" && DRAW_PRESET_SET.has(value as DrawElementPreset)
    ? (value as DrawElementPreset)
    : "wall";
}

export function normalizeDrawElementKind(value: unknown): DrawElementKind {
  if (value === "wall" || value === "image" || value === "obstacle") return value;
  return "obstacle";
}

export function normalizeDrawElementDisplayMode(value: unknown): DrawElementDisplayMode {
  return typeof value === "string" && DRAW_DISPLAY_MODE_SET.has(value as DrawElementDisplayMode)
    ? (value as DrawElementDisplayMode)
    : "both";
}

export function drawPresetLabel(preset: DrawElementPreset): string {
  return DRAW_PRESET_META[preset].label;
}

export function drawPresetKind(preset: DrawElementPreset): DrawElementKind {
  return DRAW_PRESET_META[preset].kind;
}

export function drawPresetAssetImageUrl(preset: DrawElementPreset): string | undefined {
  return DRAW_PRESET_META[preset].assetImageUrl;
}

export function drawElementSizeForPreset(preset: DrawElementPreset): { width: number; height: number } {
  return DRAW_PRESET_META[preset].size;
}
