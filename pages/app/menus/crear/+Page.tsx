import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bean,
  Check,
  ChevronDown,
  ChevronUp,
  CircleDot,
  Egg,
  Eye,
  Fish,
  FlaskConical,
  GripVertical,
  LeafyGreen,
  Milk,
  Nut,
  Plus,
  Repeat2,
  Search,
  Settings2,
  Shell,
  Shrimp,
  Sparkles,
  Sprout,
  Trash2,
  Upload,
  Wheat,
} from "lucide-react";
import { motion, Reorder, useDragControls, useReducedMotion } from "motion/react";
import { usePageContext } from "vike-react/usePageContext";

import { createClient } from "../../../../api/client";
import type { DishCatalogItem, GroupMenuV2, GroupMenuV2AIDish, GroupMenuV2AIImages, GroupMenuV2Dish, GroupMenuV2Section } from "../../../../api/types";
import { cropSquareImageToWebp, isSupportedDishImageFile, MAX_DISH_IMAGE_INPUT_BYTES } from "../../../../lib/dishImageCrop";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { LoadingSpinner } from "../../../../ui/feedback/LoadingSpinner";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { Select } from "../../../../ui/inputs/Select";
import { Modal } from "../../../../ui/overlays/Modal";
import { Switch } from "../../../../ui/shadcn/Switch";
import { FoodDishCard } from "../../../../ui/widgets/food/FoodDishCard";
import { MenuTypeChangeModal } from "../../../../ui/widgets/menus/MenuTypeChangeModal";
import { MENU_TYPE_PANELS } from "../../../../ui/widgets/menus/menuPresentation";

type PageData = {
  menu: GroupMenuV2 | null;
  error: string | null;
};

type EditorDish = {
  clientId: string;
  id?: number;
  catalog_dish_id?: number | null;
  title: string;
  description: string;
  description_enabled: boolean;
  allergens: string[];
  supplement_enabled: boolean;
  supplement_price: number | null;
  price: number | null;
  active: boolean;
  position: number;
  foto_url?: string;
  ai_requested: boolean;
  ai_generating: boolean;
  ai_generated_img?: string | null;
};

type MenuAIDishTracker = {
  dish_id: number;
  ai_requested: boolean;
  ai_generating: boolean;
  ai_generated_img?: string | null;
};

type MenuAITrackerState = {
  dishes: MenuAIDishTracker[];
};

type EditorSection = {
  clientId: string;
  id?: number;
  title: string;
  kind: string;
  position: number;
  dishes: EditorDish[];
  expanded?: boolean;
};

type PersistedEditorSection = EditorSection & { id: number };
type PersistedEditorDish = EditorDish & { id: number };

type SaveState = "idle" | "saving" | "saved" | "error";

type ReorderItemContainerProps = {
  as?: "div" | "article";
  value: string;
  className: string;
  transition?: any;
  whileDrag?: any;
  children: (startDrag: (event: React.PointerEvent<Element>) => void) => React.ReactNode;
};

type BasicsDraft = {
  title: string;
  price: string;
  active: boolean;
  menuType: string;
  subtitles: string[];
  showDishImages: boolean;
  includedCoffee: boolean;
  beverageType: string;
  beveragePrice: string;
  beverageHasSupplement: boolean;
  beverageSupplementPrice: string;
  comments: string[];
  minPartySize: string;
  mainLimit: boolean;
  mainLimitNum: string;
};

type BasicsPayload = {
  menu_title: string;
  price: number;
  active: boolean;
  menu_type: string;
  menu_subtitle: string[];
  show_dish_images: boolean;
  included_coffee: boolean;
  beverage: {
    type: string;
    price_per_person: number | null;
    has_supplement: boolean;
    supplement_price: number | null;
  };
  comments: string[];
  min_party_size: number;
  main_dishes_limit: boolean;
  main_dishes_limit_number: number;
};

type PreviewThemeConfig = {
  assigned: boolean;
  default_theme_id: string;
  overrides: Record<string, string>;
  themes: { id: string; name?: string }[];
};

const MENU_TYPE_HINTS: Record<string, string> = {
  closed_conventional: "Estructura fija y rapida para menus clasicos",
  closed_group: "Pensado para grupos con timing de servicio",
  a_la_carte: "Carta abierta con mas libertad de eleccion",
  a_la_carte_group: "Version de carta para reservas de grupo",
  special: "Menu de temporada o evento con presentacion especial",
};

const MENU_TYPES = MENU_TYPE_PANELS.map((panel) => ({
  ...panel,
  enabled: true,
  hint: MENU_TYPE_HINTS[panel.value] ?? "Plantilla lista para editar",
}));

const DEFAULT_BEVERAGE = {
  type: "no_incluida",
  price_per_person: null as number | null,
  has_supplement: false,
  supplement_price: null as number | null,
};

const ALLERGENS = [
  { key: "Gluten", icon: Wheat },
  { key: "Crustaceos", icon: Shrimp },
  { key: "Huevos", icon: Egg },
  { key: "Pescado", icon: Fish },
  { key: "Cacahuetes", icon: Nut },
  { key: "Soja", icon: Bean },
  { key: "Leche", icon: Milk },
  { key: "Frutos de cascara", icon: Nut },
  { key: "Apio", icon: LeafyGreen },
  { key: "Mostaza", icon: Sprout },
  { key: "Sesamo", icon: CircleDot },
  { key: "Sulfitos", icon: FlaskConical },
  { key: "Altramuces", icon: Bean },
  { key: "Moluscos", icon: Shell },
] as const;

const beverageTypeOptions: { value: string; label: string }[] = [
  { value: "no_incluida", label: "No incluida" },
  { value: "opcion", label: "Opcion bebida ilimitada" },
  { value: "ilimitada", label: "Bebida ilimitada" },
];

const dishVisibilityOptions: { value: string; label: string }[] = [
  { value: "without_image", label: "Sin imagen" },
  { value: "with_image", label: "Con imagen" },
];

const DISH_IMAGE_AI_MAX_KB = 150;
const MENU_AI_TRACE_PREFIX = "[MENU_AI_TRACE]";

function logMenuAITrace(event: string, payload?: Record<string, unknown>): void {
  if (payload) {
    console.log(`${MENU_AI_TRACE_PREFIX} ${event}`, payload);
    return;
  }
  console.log(`${MENU_AI_TRACE_PREFIX} ${event}`);
}

function parseLooseBool(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const text = String(value ?? "").trim().toLowerCase();
  if (!text) return fallback;
  if (text === "1" || text === "true" || text === "yes" || text === "si" || text === "on") return true;
  if (text === "0" || text === "false" || text === "no" || text === "off") return false;
  return fallback;
}

function normalizeMenuAIDish(raw: unknown): MenuAIDishTracker | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const dishIdRaw = row.dish_id ?? row.dishId ?? row.id;
  const dishId = Number(dishIdRaw);
  if (!Number.isFinite(dishId) || dishId <= 0) return null;
  const aiGeneratedImgRaw = row.ai_generated_img ?? row.aiGeneratedImg;
  return {
    dish_id: dishId,
    ai_requested: parseLooseBool(row.ai_requested ?? row.aiRequested ?? row.ai_requested_img ?? row.aiRequestedImg, false),
    ai_generating: parseLooseBool(row.ai_generating ?? row.aiGenerating ?? row.ai_generating_img ?? row.aiGeneratingImg, false),
    ai_generated_img: typeof aiGeneratedImgRaw === "string" && aiGeneratedImgRaw.trim()
      ? aiGeneratedImgRaw.trim()
      : null,
  };
}

function mergeMenuAIDishes(items: MenuAIDishTracker[]): MenuAIDishTracker[] {
  const map = new Map<number, MenuAIDishTracker>();
  for (const item of items) {
    const prev = map.get(item.dish_id);
    if (!prev) {
      map.set(item.dish_id, item);
      continue;
    }
    map.set(item.dish_id, {
      dish_id: item.dish_id,
      ai_requested: item.ai_requested || prev.ai_requested,
      ai_generating: item.ai_generating,
      ai_generated_img: item.ai_generated_img ?? prev.ai_generated_img ?? null,
    });
  }
  return Array.from(map.values());
}

function trackerFromAIImages(raw: GroupMenuV2AIImages | GroupMenuV2AIDish[] | null | undefined): MenuAIDishTracker[] {
  if (!raw) return [];
  const rows: MenuAIDishTracker[] = [];
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const normalized = normalizeMenuAIDish(item);
      if (normalized) rows.push(normalized);
    }
    return mergeMenuAIDishes(rows);
  }

  if (Array.isArray(raw.dishes)) {
    for (const item of raw.dishes) {
      const normalized = normalizeMenuAIDish(item);
      if (normalized) rows.push(normalized);
    }
  }

  if (Array.isArray(raw.items)) {
    for (const item of raw.items) {
      const normalized = normalizeMenuAIDish(item);
      if (normalized) rows.push(normalized);
    }
  }

  const byDish = raw.by_dish;
  if (byDish && typeof byDish === "object") {
    for (const item of Object.values(byDish)) {
      const normalized = normalizeMenuAIDish(item);
      if (normalized) rows.push(normalized);
    }
  }

  return mergeMenuAIDishes(rows);
}

function buildGroupMenuAIWSURL(menuId: number): string {
  const wsURL = new URL("/api/admin/group-menus-v2/ws", window.location.href);
  wsURL.protocol = wsURL.protocol === "https:" ? "wss:" : "ws:";
  wsURL.searchParams.set("menuId", String(menuId));
  return wsURL.toString();
}

function trackerFromSections(sections: GroupMenuV2Section[] | EditorSection[]): MenuAIDishTracker[] {
  const rows: MenuAIDishTracker[] = [];
  for (const section of sections) {
    const dishes = Array.isArray(section.dishes) ? section.dishes : [];
    for (const dish of dishes as Array<GroupMenuV2Dish | EditorDish>) {
      if (!dish?.id) continue;
      const rawDish = dish as GroupMenuV2Dish & { ai_requested_img?: unknown; ai_generating_img?: unknown };
      rows.push({
        dish_id: dish.id,
        ai_requested: parseLooseBool(dish.ai_requested ?? rawDish.ai_requested_img, false),
        ai_generating: parseLooseBool(dish.ai_generating ?? rawDish.ai_generating_img, false),
        ai_generated_img: typeof dish.ai_generated_img === "string" && dish.ai_generated_img.trim()
          ? dish.ai_generated_img.trim()
          : null,
      });
    }
  }
  return mergeMenuAIDishes(rows);
}

function buildMenuAITracker(
  menu: GroupMenuV2 | null | undefined,
  fallbackSections: EditorSection[] = [],
): MenuAITrackerState {
  const fromMenu = menu ? trackerFromAIImages(menu.ai_images) : [];
  const fromSections = menu?.sections?.length ? trackerFromSections(menu.sections) : trackerFromSections(fallbackSections);
  return { dishes: mergeMenuAIDishes([...fromMenu, ...fromSections]) };
}

function trackerFromWSPayload(raw: unknown): MenuAIDishTracker[] {
  if (!raw || typeof raw !== "object") return [];
  const payload = raw as Record<string, unknown>;
  const rows: MenuAIDishTracker[] = [];

  const direct = normalizeMenuAIDish(payload);
  if (direct) rows.push(direct);

  if (Array.isArray(payload.dishes)) {
    for (const row of payload.dishes) {
      const normalized = normalizeMenuAIDish(row);
      if (normalized) rows.push(normalized);
    }
  }

  if (Array.isArray(payload.ai_dishes)) {
    for (const row of payload.ai_dishes) {
      const normalized = normalizeMenuAIDish(row);
      if (normalized) rows.push(normalized);
    }
  }

  if (payload.tracker && typeof payload.tracker === "object") {
    const tracker = payload.tracker as Record<string, unknown>;
    if (Array.isArray(tracker.items)) {
      for (const row of tracker.items) {
        const normalized = normalizeMenuAIDish(row);
        if (normalized) rows.push(normalized);
      }
    }
    if (Array.isArray(tracker.dishes)) {
      for (const row of tracker.dishes) {
        const normalized = normalizeMenuAIDish(row);
        if (normalized) rows.push(normalized);
      }
    }
  }

  if (payload.ai_images) {
    rows.push(...trackerFromAIImages(payload.ai_images as GroupMenuV2AIImages | GroupMenuV2AIDish[]));
  }

  if (payload.menu && typeof payload.menu === "object") {
    const menu = payload.menu as Record<string, unknown>;
    rows.push(...trackerFromAIImages(menu.ai_images as GroupMenuV2AIImages | GroupMenuV2AIDish[]));
    if (Array.isArray(menu.sections)) {
      rows.push(...trackerFromSections(menu.sections as GroupMenuV2Section[]));
    }
  }

  return mergeMenuAIDishes(rows);
}

function updateMenuAITrackerDish(
  prev: MenuAITrackerState,
  dishId: number,
  patch: Partial<MenuAIDishTracker>,
): MenuAITrackerState {
  if (!Number.isFinite(dishId) || dishId <= 0) return prev;
  let changed = false;
  let hasDish = false;
  const nextDishes = prev.dishes.map((dish) => {
    if (dish.dish_id !== dishId) return dish;
    hasDish = true;
    const nextDish: MenuAIDishTracker = {
      dish_id: dishId,
      ai_requested: patch.ai_requested ?? dish.ai_requested,
      ai_generating: patch.ai_generating ?? dish.ai_generating,
      ai_generated_img: patch.ai_generated_img ?? dish.ai_generated_img ?? null,
    };
    if (
      nextDish.ai_requested === dish.ai_requested
      && nextDish.ai_generating === dish.ai_generating
      && nextDish.ai_generated_img === dish.ai_generated_img
    ) {
      return dish;
    }
    changed = true;
    return nextDish;
  });
  if (!hasDish) {
    changed = true;
    nextDishes.push({
      dish_id: dishId,
      ai_requested: patch.ai_requested ?? false,
      ai_generating: patch.ai_generating ?? false,
      ai_generated_img: patch.ai_generated_img ?? null,
    });
  }
  return changed ? { dishes: mergeMenuAIDishes(nextDishes) } : prev;
}

async function fileToImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo leer la imagen"));
    };
    img.src = objectUrl;
  });
}

async function canvasToWebPBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("No se pudo procesar la imagen"));
        return;
      }
      resolve(blob);
    }, "image/webp", quality);
  });
}

function webpOutputName(fileName: string): string {
  const base = String(fileName || "dish-image").replace(/\.[^.]+$/, "").trim() || "dish-image";
  return `${base.replace(/\s+/g, "-")}.webp`;
}

async function preprocessDishImageToWebp(file: File, maxSizeKB = DISH_IMAGE_AI_MAX_KB): Promise<File> {
  if (!isSupportedDishImageFile(file)) {
    throw new Error("Formato no soportado. Usa JPG, PNG, WEBP o GIF.");
  }
  const maxBytes = Math.max(1, Math.round(maxSizeKB * 1024));
  const img = await fileToImage(file);
  const naturalWidth = Math.max(1, img.naturalWidth || img.width || 1);
  const naturalHeight = Math.max(1, img.naturalHeight || img.height || 1);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar la imagen");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  const maxEdge = 1600;
  const longest = Math.max(naturalWidth, naturalHeight);
  const baseScale = longest > maxEdge ? maxEdge / longest : 1;
  const scaleSteps = [1, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52];
  const qualitySteps = [0.92, 0.86, 0.8, 0.74, 0.68, 0.62, 0.56, 0.5, 0.44, 0.38, 0.32];

  let bestBlob: Blob | null = null;
  for (const scaleStep of scaleSteps) {
    const scale = Math.max(0.15, baseScale * scaleStep);
    const width = Math.max(1, Math.round(naturalWidth * scale));
    const height = Math.max(1, Math.round(naturalHeight * scale));
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of qualitySteps) {
      const blob = await canvasToWebPBlob(canvas, quality);
      bestBlob = blob;
      if (blob.size <= maxBytes) {
        return new File([blob], webpOutputName(file.name), { type: "image/webp" });
      }
    }
  }

  if (!bestBlob) throw new Error("No se pudo procesar la imagen");
  throw new Error("No se pudo reducir la imagen por debajo de 150KB");
}

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function withSectionPositions(sections: EditorSection[]): EditorSection[] {
  return sections.map((sec, idx) => (sec.position === idx ? sec : { ...sec, position: idx }));
}

function withDishPositions(dishes: EditorDish[]): EditorDish[] {
  return dishes.map((dish, idx) => (dish.position === idx ? dish : { ...dish, position: idx }));
}

function orderByClientId<T extends { clientId: string }>(items: T[], orderedClientIds: string[]): T[] {
  const byId = new Map(items.map((item) => [item.clientId, item]));
  const seen = new Set<string>();
  const ordered: T[] = [];

  for (const id of orderedClientIds) {
    const item = byId.get(id);
    if (!item || seen.has(id)) continue;
    ordered.push(item);
    seen.add(id);
  }

  for (const item of items) {
    if (seen.has(item.clientId)) continue;
    ordered.push(item);
  }

  return ordered;
}

function ReorderItemContainer({ as = "div", value, className, transition, whileDrag, children }: ReorderItemContainerProps) {
  const dragControls = useDragControls();

  const startDrag = useCallback(
    (event: React.PointerEvent<Element>) => {
      dragControls.start(event);
    },
    [dragControls],
  );

  return (
    <Reorder.Item
      as={as}
      value={value}
      className={className}
      layout="position"
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0.04}
      transition={transition}
      whileDrag={whileDrag}
    >
      {children(startDrag)}
    </Reorder.Item>
  );
}

function toNumOrNull(raw: string): number | null {
  const s = raw.trim();
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatEuro(value: number): string {
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(value || 0));
}

function WheatOffIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="m2 22 10-10" />
      <path d="m16 8-1.17 1.17" />
      <path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
      <path d="m8 8-.53.53a3.5 3.5 0 0 0 0 4.94L9 15l1.53-1.53c.55-.55.88-1.25.98-1.97" />
      <path d="M10.91 5.26c.15-.26.34-.51.56-.73L13 3l1.53 1.53a3.5 3.5 0 0 1 .28 4.62" />
      <path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z" />
      <path d="M11.47 17.47 13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0Z" />
      <path d="m16 16-.53.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.49 3.49 0 0 1 1.97-.98" />
      <path d="M18.74 13.09c.26-.15.51-.34.73-.56L21 11l-1.53-1.53a3.5 3.5 0 0 0-4.62-.28" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

function debugMenuPerf(event: string, payload?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const globalDebug = (window as any).__MENU_PERF_DEBUG === true;
  let storageDebug = false;
  try {
    storageDebug = window.localStorage.getItem("menuPerfDebug") === "1";
  } catch {
    storageDebug = false;
  }
  if (!globalDebug && !storageDebug) return;
  console.log("[menus/crear perf]", event, payload ?? {});
}

type DishImageCropDraft = {
  sectionClientId: string;
  dishClientId: string;
  file: File;
  objectUrl: string;
};

type DishImageCropConfirm = {
  zoom: number;
  offsetX: number;
  offsetY: number;
  viewportSize: number;
};

function clampDishCropValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

type DishImageAdvisorModalProps = {
  open: boolean;
  imageUrl: string;
  imageKB: number;
  busy: boolean;
  onClose: () => void;
  onContinueWithoutAI: () => void;
  onImproveWithAI: () => void;
};

function DishImageAdvisorModal({
  open,
  imageUrl,
  imageKB,
  busy,
  onClose,
  onContinueWithoutAI,
  onImproveWithAI,
}: DishImageAdvisorModalProps) {
  return (
    <Modal open={open} title="Asesor IA de imagen" onClose={busy ? () => undefined : onClose} widthPx={620}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">Asesor IA de imagen</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Cerrar" disabled={busy}>
          ×
        </button>
      </div>

      <div className="bo-modalBody bo-dishAIAdvisorBody">
        <div className="bo-dishAIAdvisorCopy">
          <p className="bo-dishAIAdvisorLead">
            Mejorar esta foto con IA puede elevar la presentacion del plato y hacer tu menu mas atractivo para el cliente.
          </p>
          <p className="bo-dishAIAdvisorHint">
            Imagen optimizada para subir: {Math.max(1, imageKB)}KB · WebP.
          </p>
        </div>
        <div className="bo-dishAIAdvisorPreviewWrap">
          <img className="bo-dishAIAdvisorPreview" src={imageUrl} alt="Previsualizacion de imagen optimizada" />
        </div>
      </div>

      <div className="bo-modalActions bo-dishAIAdvisorActions">
        <button
          className="bo-btn bo-btn--advisorSecondary"
          type="button"
          onClick={onContinueWithoutAI}
          disabled={busy}
        >
          Continuar sin mejorar
        </button>
        <button
          className="bo-btn bo-btn--advisorPrimary"
          type="button"
          onClick={onImproveWithAI}
          disabled={busy}
          aria-label={busy ? "Mejorando con IA" : "Mejorar con IA"}
        >
          <Sparkles size={15} />
          <span>{busy ? "Mejorando con IA..." : "Mejorar con IA"}</span>
        </button>
      </div>
    </Modal>
  );
}

type DishImageCropModalProps = {
  open: boolean;
  imageUrl: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (payload: DishImageCropConfirm) => void;
};

function DishImageCropModal({ open, imageUrl, busy, onClose, onConfirm }: DishImageCropModalProps) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const pointerDragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const touchRef = useRef<
    | {
        mode: "drag";
        startX: number;
        startY: number;
        originX: number;
        originY: number;
      }
    | {
        mode: "pinch";
        startDistance: number;
        startZoom: number;
        startCenterX: number;
        startCenterY: number;
        startOffsetX: number;
        startOffsetY: number;
      }
    | null
  >(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 1, height: 1 });
  const [viewportSize, setViewportSize] = useState(0);

  useEffect(() => {
    if (!open) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNaturalSize({ width: 1, height: 1 });
    pointerDragRef.current = null;
    touchRef.current = null;
  }, [imageUrl, open]);

  useEffect(() => {
    if (!open) return;
    const node = viewportRef.current;
    if (!node) return;
    const update = () => {
      setViewportSize(Math.max(1, Math.round(node.clientWidth || 0)));
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(node);
    return () => ro.disconnect();
  }, [open]);

  const baseScale = useMemo(() => {
    if (viewportSize <= 0) return 1;
    return Math.max(viewportSize / naturalSize.width, viewportSize / naturalSize.height);
  }, [naturalSize.height, naturalSize.width, viewportSize]);

  const getOffsetBounds = useCallback(
    (nextZoom: number) => {
      const renderedWidth = naturalSize.width * baseScale * nextZoom;
      const renderedHeight = naturalSize.height * baseScale * nextZoom;
      return {
        x: Math.max(0, (renderedWidth - viewportSize) / 2),
        y: Math.max(0, (renderedHeight - viewportSize) / 2),
      };
    },
    [baseScale, naturalSize.height, naturalSize.width, viewportSize],
  );

  const clampOffset = useCallback(
    (x: number, y: number, nextZoom = zoom) => {
      const bounds = getOffsetBounds(nextZoom);
      return {
        x: clampDishCropValue(x, -bounds.x, bounds.x),
        y: clampDishCropValue(y, -bounds.y, bounds.y),
      };
    },
    [getOffsetBounds, zoom],
  );

  useEffect(() => {
    setOffset((prev) => {
      const next = clampOffset(prev.x, prev.y, zoom);
      if (next.x === prev.x && next.y === prev.y) return prev;
      return next;
    });
  }, [clampOffset, naturalSize.height, naturalSize.width, viewportSize, zoom]);

  const applyZoom = useCallback(
    (nextRawZoom: number) => {
      const nextZoom = clampDishCropValue(nextRawZoom, 1, 4);
      setZoom(nextZoom);
      setOffset((prev) => clampOffset(prev.x, prev.y, nextZoom));
    },
    [clampOffset],
  );

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (busy || event.pointerType === "touch") return;
      if (event.button !== 0) return;
      event.preventDefault();
      pointerDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [busy, offset.x, offset.y],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = pointerDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      setOffset(clampOffset(drag.originX + dx, drag.originY + dy));
    },
    [clampOffset],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = pointerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    pointerDragRef.current = null;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Ignore if pointer capture is already released by browser.
    }
  }, []);

  const onWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (busy) return;
      event.preventDefault();
      const delta = event.deltaY < 0 ? 0.08 : -0.08;
      applyZoom(zoom + delta);
    },
    [applyZoom, busy, zoom],
  );

  const onTouchStart = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (busy) return;
      const touches = event.touches;
      if (touches.length === 1) {
        const t = touches[0];
        touchRef.current = {
          mode: "drag",
          startX: t.clientX,
          startY: t.clientY,
          originX: offset.x,
          originY: offset.y,
        };
        return;
      }
      if (touches.length >= 2) {
        const t1 = touches[0];
        const t2 = touches[1];
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        touchRef.current = {
          mode: "pinch",
          startDistance: Math.hypot(dx, dy) || 1,
          startZoom: zoom,
          startCenterX: (t1.clientX + t2.clientX) / 2,
          startCenterY: (t1.clientY + t2.clientY) / 2,
          startOffsetX: offset.x,
          startOffsetY: offset.y,
        };
      }
    },
    [busy, offset.x, offset.y, zoom],
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (busy) return;
      const state = touchRef.current;
      if (!state) return;
      if (state.mode === "drag" && event.touches.length === 1) {
        event.preventDefault();
        const t = event.touches[0];
        const dx = t.clientX - state.startX;
        const dy = t.clientY - state.startY;
        setOffset(clampOffset(state.originX + dx, state.originY + dy));
        return;
      }
      if (state.mode === "pinch" && event.touches.length >= 2) {
        event.preventDefault();
        const t1 = event.touches[0];
        const t2 = event.touches[1];
        const dx = t2.clientX - t1.clientX;
        const dy = t2.clientY - t1.clientY;
        const distance = Math.hypot(dx, dy) || 1;
        const ratio = distance / state.startDistance;
        const nextZoom = clampDishCropValue(state.startZoom * ratio, 1, 4);
        const centerX = (t1.clientX + t2.clientX) / 2;
        const centerY = (t1.clientY + t2.clientY) / 2;
        const nextOffset = clampOffset(
          state.startOffsetX + (centerX - state.startCenterX),
          state.startOffsetY + (centerY - state.startCenterY),
          nextZoom,
        );
        setZoom(nextZoom);
        setOffset(nextOffset);
      }
    },
    [busy, clampOffset],
  );

  const onTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLDivElement>) => {
      if (busy) return;
      if (event.touches.length === 0) {
        touchRef.current = null;
        return;
      }
      if (event.touches.length === 1) {
        const t = event.touches[0];
        touchRef.current = {
          mode: "drag",
          startX: t.clientX,
          startY: t.clientY,
          originX: offset.x,
          originY: offset.y,
        };
        return;
      }
      const t1 = event.touches[0];
      const t2 = event.touches[1];
      const dx = t2.clientX - t1.clientX;
      const dy = t2.clientY - t1.clientY;
      touchRef.current = {
        mode: "pinch",
        startDistance: Math.hypot(dx, dy) || 1,
        startZoom: zoom,
        startCenterX: (t1.clientX + t2.clientX) / 2,
        startCenterY: (t1.clientY + t2.clientY) / 2,
        startOffsetX: offset.x,
        startOffsetY: offset.y,
      };
    },
    [busy, offset.x, offset.y, zoom],
  );

  return (
    <Modal open={open} title="Recortar imagen" onClose={busy ? () => undefined : onClose} widthPx={620}>
      <div className="bo-modalHead">
        <div className="bo-modalTitle">Recorte 1:1</div>
        <button className="bo-modalX" type="button" onClick={onClose} aria-label="Cerrar" disabled={busy}>
          ×
        </button>
      </div>

      <div className="bo-modalBody bo-dishCropBody">
        <div className="bo-dishCropViewportWrap">
          <div
            ref={viewportRef}
            className="bo-dishCropViewport"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onWheel={onWheel}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            <img
              src={imageUrl}
              alt="Previsualizacion del recorte"
              className="bo-dishCropImage"
              draggable={false}
              style={{ transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px)) scale(${zoom})` }}
              onLoad={(event) => {
                const img = event.currentTarget;
                setNaturalSize({
                  width: Math.max(1, img.naturalWidth || img.width || 1),
                  height: Math.max(1, img.naturalHeight || img.height || 1),
                });
              }}
            />
            <div className="bo-dishCropFrame" aria-hidden="true" />
          </div>
        </div>

        <div className="bo-dishCropControls">
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => applyZoom(zoom - 0.1)} disabled={busy}>
            -
          </button>
          <input
            className="bo-dishCropRange"
            type="range"
            min={1}
            max={4}
            step={0.01}
            value={zoom}
            onChange={(event) => applyZoom(Number(event.target.value))}
            disabled={busy}
            aria-label="Control de zoom"
          />
          <button className="bo-btn bo-btn--ghost bo-btn--sm" type="button" onClick={() => applyZoom(zoom + 0.1)} disabled={busy}>
            +
          </button>
          <button
            className="bo-btn bo-btn--ghost bo-btn--sm"
            type="button"
            onClick={() => {
              setOffset({ x: 0, y: 0 });
              setZoom(1);
            }}
            disabled={busy}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="bo-modalActions">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={onClose} disabled={busy}>
          Cancelar
        </button>
        <button
          className="bo-btn bo-btn--primary"
          type="button"
          onClick={() => onConfirm({ zoom, offsetX: offset.x, offsetY: offset.y, viewportSize })}
          disabled={busy || viewportSize <= 0}
        >
          {busy ? "Procesando..." : "Guardar imagen"}
        </button>
      </div>
    </Modal>
  );
}

type MenuDishEditorCardProps = {
  sectionClientId: string;
  dish: EditorDish;
  dishIdx: number;
  isALaCarte: boolean;
  mediaLoading: boolean;
  startDishDrag: (event: React.PointerEvent<Element>) => void;
  pickDishImage: (sectionClientId: string, dishClientId: string) => void;
  setAllergenModal: React.Dispatch<React.SetStateAction<{ open: boolean; sectionClientId: string; dishClientId: string } | null>>;
  removeDish: (sectionClientId: string, dishClientId: string) => void;
  updateDish: (sectionClientId: string, dishClientId: string, patch: Partial<EditorDish>) => void;
};

const MenuDishEditorCard = React.memo(
  function MenuDishEditorCard({
    sectionClientId,
    dish,
    dishIdx,
    isALaCarte,
    mediaLoading,
    startDishDrag,
    pickDishImage,
    setAllergenModal,
    removeDish,
    updateDish,
  }: MenuDishEditorCardProps) {
    const dishLabel = dish.title || `Plato ${dishIdx + 1}`;

    return (
      <FoodDishCard
        className="bo-dishCard bo-dishCard--horizontal"
        bodyClassName="bo-dishCardBody"
        debugId={`section:${sectionClientId}:dish:${dish.clientId}`}
        title={dishLabel}
        imageUrl={dish.foto_url}
        mediaLoading={mediaLoading}
        onMediaAction={() => pickDishImage(sectionClientId, dish.clientId)}
        mediaActionAriaLabel={`Subir imagen para ${dishLabel}`}
        inactive={!dish.active}
        priceLabel={isALaCarte ? formatEuro(dish.price ?? 0) : undefined}
        footerActions={(
          <div className="bo-dishRowActionsInline bo-dishRowActionsInline--split">
            <button
              className="bo-btn bo-btn--ghost bo-btn--sm bo-dishIconOnlyBtn bo-dishAllergenIconBtn"
              type="button"
              aria-label={`Editar alergenos de ${dishLabel}`}
              onClick={() => setAllergenModal({ open: true, sectionClientId, dishClientId: dish.clientId })}
            >
              <WheatOffIcon size={14} />
            </button>
            <button
              className="bo-btn bo-btn--ghost bo-btn--sm bo-dishIconOnlyBtn bo-dishDeleteIconBtn"
              type="button"
              aria-label={`Eliminar plato ${dishLabel}`}
              onClick={() => removeDish(sectionClientId, dish.clientId)}
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      >
        <div className="bo-dishEditorContent">
          <div className="bo-dishCardHead">
            <button
              className="bo-dishDrag"
              type="button"
              aria-label={`Arrastrar plato ${dishLabel}`}
              onPointerDown={(event) => {
                event.preventDefault();
                startDishDrag(event);
              }}
            >
              <GripVertical size={14} />
            </button>
            <label className="bo-checkRow">
              <Switch
                checked={dish.active}
                onCheckedChange={(checked) => {
                  debugMenuPerf("ui-toggle-active", {
                    sectionClientId,
                    dishClientId: dish.clientId,
                    checked,
                  });
                  updateDish(sectionClientId, dish.clientId, { active: checked });
                }}
              />
              <span>Activo</span>
            </label>
          </div>
          <div className="bo-dishFields">
            <textarea
              className="bo-input bo-textarea bo-dishTitleTextarea"
              rows={1}
              value={dish.title}
              ref={(node) => {
                if (!node) return;
                node.style.height = "auto";
                node.style.height = `${node.scrollHeight}px`;
              }}
              onInput={(e) => {
                const node = e.currentTarget;
                node.style.height = "auto";
                node.style.height = `${node.scrollHeight}px`;
              }}
              onChange={(e) => updateDish(sectionClientId, dish.clientId, { title: e.target.value })}
              placeholder="Titulo plato"
            />
            <label className="bo-checkRow">
              <Switch
                checked={dish.description_enabled}
                onCheckedChange={(checked) => {
                  debugMenuPerf("ui-toggle-description", {
                    sectionClientId,
                    dishClientId: dish.clientId,
                    checked,
                  });
                  updateDish(sectionClientId, dish.clientId, {
                    description_enabled: checked,
                    description: checked ? dish.description : "",
                  });
                }}
              />
              <span>Descripcion</span>
            </label>
            {dish.description_enabled ? (
              <textarea
                className="bo-input bo-textarea"
                value={dish.description}
                onChange={(e) => updateDish(sectionClientId, dish.clientId, { description: e.target.value })}
                placeholder="Descripcion"
              />
            ) : null}

            {isALaCarte ? (
              <div className="bo-dishPriceRow">
                <label className="bo-label">Precio</label>
                <input
                  className="bo-input bo-priceInput"
                  inputMode="decimal"
                  value={dish.price == null ? "" : String(dish.price)}
                  onChange={(e) =>
                    updateDish(sectionClientId, dish.clientId, {
                      price: toNumOrNull(e.target.value),
                    })
                  }
                  placeholder="0.00"
                />
              </div>
            ) : null}
            <div className="bo-dishFieldsSide">
              {dish.allergens.length > 0 ? (
                <div className="bo-allergenRow">
                  {dish.allergens.map((name) => (
                    <span key={`${dish.clientId}-${name}`} className="bo-allergenPill">
                      {name}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="bo-dishRow">
                <div className="bo-dishRowInlineControls">
                  <label className="bo-checkRow">
                    <Switch
                      checked={dish.supplement_enabled}
                      onCheckedChange={(checked) => {
                        debugMenuPerf("ui-toggle-supplement", {
                          sectionClientId,
                          dishClientId: dish.clientId,
                          checked,
                        });
                        updateDish(sectionClientId, dish.clientId, {
                          supplement_enabled: checked,
                          supplement_price: checked ? dish.supplement_price : null,
                        });
                      }}
                    />
                    <span>Suplemento</span>
                  </label>
                  {dish.supplement_enabled ? (
                    <input
                      className="bo-input bo-suppInput"
                      inputMode="decimal"
                      value={dish.supplement_price == null ? "" : String(dish.supplement_price)}
                      onChange={(e) =>
                        updateDish(sectionClientId, dish.clientId, {
                          supplement_price: toNumOrNull(e.target.value),
                        })
                      }
                      placeholder="0.00"
                    />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      </FoodDishCard>
    );
  },
  (prev, next) => (
    prev.sectionClientId === next.sectionClientId
    && areEditorDishesEqual(prev.dish, next.dish)
    && prev.dishIdx === next.dishIdx
    && prev.isALaCarte === next.isALaCarte
    && prev.mediaLoading === next.mediaLoading
  ),
);

const EMPTY_SEARCH_RESULTS: DishCatalogItem[] = [];
type SectionDishTab = "active" | "inactive";

type MenuSectionEditorPanelProps = {
  sec: EditorSection;
  secIdx: number;
  sectionsCount: number;
  isALaCarte: boolean;
  reorderTransition: any;
  reorderWhileDrag: any;
  chevronHover: any;
  chevronTapUp: any;
  chevronTapDown: any;
  moveSection: (from: number, to: number) => void;
  updateSection: (clientId: string, patch: Partial<EditorSection>) => void;
  reorderDishes: (sectionClientId: string, orderedClientIds: string[]) => void;
  setAllergenModal: React.Dispatch<React.SetStateAction<{ open: boolean; sectionClientId: string; dishClientId: string } | null>>;
  removeDish: (sectionClientId: string, dishClientId: string) => void;
  updateDish: (sectionClientId: string, dishClientId: string, patch: Partial<EditorDish>) => void;
  pickDishImage: (sectionClientId: string, dishClientId: string) => void;
  addDish: (sectionClientId: string, fromCatalog?: DishCatalogItem) => void;
  handleSearch: (sectionClientId: string, term: string) => void;
  searchTerm: string;
  searchItems: DishCatalogItem[];
};

const MenuSectionEditorPanel = React.memo(
  function MenuSectionEditorPanel({
    sec,
    secIdx,
    sectionsCount,
    isALaCarte,
    reorderTransition,
    reorderWhileDrag,
    chevronHover,
    chevronTapUp,
    chevronTapDown,
    moveSection,
    updateSection,
    reorderDishes,
    setAllergenModal,
    removeDish,
    updateDish,
    pickDishImage,
    addDish,
    handleSearch,
    searchTerm,
    searchItems,
  }: MenuSectionEditorPanelProps) {
    const [dishTab, setDishTab] = useState<SectionDishTab>("active");
    const sectionLabel = sec.title.trim() || `seccion ${secIdx + 1}`;
    const activeDishCount = useMemo(() => sec.dishes.reduce((total, dish) => total + (dish.active ? 1 : 0), 0), [sec.dishes]);
    const inactiveDishCount = sec.dishes.length - activeDishCount;
    const visibleDishes = useMemo(
      () => sec.dishes.filter((dish) => (dishTab === "active" ? dish.active : !dish.active)),
      [dishTab, sec.dishes],
    );
    const activeTabId = `bo-section-dishes-active-${sec.clientId}`;
    const inactiveTabId = `bo-section-dishes-inactive-${sec.clientId}`;
    const dishPanelId = `bo-section-dishes-panel-${sec.clientId}`;

    useEffect(() => {
      if (dishTab === "active" && activeDishCount > 0) return;
      if (dishTab === "inactive" && inactiveDishCount > 0) return;
      if (activeDishCount > 0) {
        setDishTab("active");
        return;
      }
      if (inactiveDishCount > 0) {
        setDishTab("inactive");
      }
    }, [activeDishCount, dishTab, inactiveDishCount]);

    const handleDishTabChange = useCallback((nextTab: SectionDishTab) => {
      setDishTab(nextTab);
    }, []);

    const handleAddDish = useCallback(() => {
      setDishTab("active");
      addDish(sec.clientId);
    }, [addDish, sec.clientId]);

    const handleAddDishFromCatalog = useCallback(
      (item: DishCatalogItem) => {
        setDishTab("active");
        addDish(sec.clientId, item);
      },
      [addDish, sec.clientId],
    );

    const handleReorderVisibleDishes = useCallback(
      (orderedVisibleClientIds: string[]) => {
        if (orderedVisibleClientIds.length !== visibleDishes.length) return;
        let visibleCursor = 0;
        const nextOrder = sec.dishes.map((dish) => {
          const matchesTab = dishTab === "active" ? dish.active : !dish.active;
          if (!matchesTab) return dish.clientId;
          const nextClientId = orderedVisibleClientIds[visibleCursor];
          visibleCursor += 1;
          return nextClientId ?? dish.clientId;
        });
        reorderDishes(sec.clientId, nextOrder);
      },
      [dishTab, reorderDishes, sec.clientId, sec.dishes, visibleDishes.length],
    );

    return (
      <ReorderItemContainer
        value={sec.clientId}
        className="bo-panel bo-accordionSection bo-reorderItem"
        transition={reorderTransition}
        whileDrag={reorderWhileDrag}
      >
        {(startSectionDrag) => (
          <>
            <div className="bo-accordionHeadRow">
              <div className="bo-sectionReorder bo-sectionReorder--accordion">
                <div className="bo-sectionMoveControls">
                  <motion.button
                    className="bo-sectionMoveBtn"
                    type="button"
                    aria-label={`Subir seccion ${sec.title || secIdx + 1}`}
                    disabled={secIdx === 0}
                    whileHover={chevronHover}
                    whileTap={chevronTapUp}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => moveSection(secIdx, secIdx - 1)}
                  >
                    <ChevronUp size={14} />
                  </motion.button>
                  <motion.button
                    className="bo-sectionMoveBtn"
                    type="button"
                    aria-label={`Bajar seccion ${sec.title || secIdx + 1}`}
                    disabled={secIdx === sectionsCount - 1}
                    whileHover={chevronHover}
                    whileTap={chevronTapDown}
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => moveSection(secIdx, secIdx + 1)}
                  >
                    <ChevronDown size={14} />
                  </motion.button>
                </div>
                <button
                  className="bo-sectionDrag"
                  type="button"
                  aria-label={`Arrastrar seccion ${sec.title || secIdx + 1}`}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    startSectionDrag(event);
                  }}
                >
                  <GripVertical size={18} />
                </button>
              </div>
              <button
                className="bo-accordionHead"
                type="button"
                onClick={() => updateSection(sec.clientId, { expanded: !sec.expanded })}
              >
                <span className="bo-accordionHeadLeft">
                  <input
                    className="bo-input"
                    value={sec.title}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => updateSection(sec.clientId, { title: e.target.value })}
                  />
                </span>
                {sec.expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>

            {sec.expanded !== false ? (
              <div className="bo-panelBody">
                <div className="bo-sectionDishTabs" role="tablist" aria-label={`Filtro de platos en ${sectionLabel}`}>
                  <button
                    id={activeTabId}
                    className={`bo-sectionDishTab ${dishTab === "active" ? "is-active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={dishTab === "active"}
                    aria-controls={dishPanelId}
                    tabIndex={dishTab === "active" ? 0 : -1}
                    onClick={() => handleDishTabChange("active")}
                  >
                    <span>Activos</span>
                    <span className="bo-sectionDishTabCount">{activeDishCount}</span>
                  </button>
                  <button
                    id={inactiveTabId}
                    className={`bo-sectionDishTab ${dishTab === "inactive" ? "is-active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={dishTab === "inactive"}
                    aria-controls={dishPanelId}
                    tabIndex={dishTab === "inactive" ? 0 : -1}
                    onClick={() => handleDishTabChange("inactive")}
                  >
                    <span>Inactivos</span>
                    <span className="bo-sectionDishTabCount">{inactiveDishCount}</span>
                  </button>
                </div>

                <div
                  id={dishPanelId}
                  className="bo-sectionDishTabPanel"
                  role="tabpanel"
                  aria-labelledby={dishTab === "active" ? activeTabId : inactiveTabId}
                >
                  {visibleDishes.length > 0 ? (
                    <Reorder.Group
                      axis="y"
                      values={visibleDishes.map((dish) => dish.clientId)}
                      onReorder={handleReorderVisibleDishes}
                      className="bo-dishesStack bo-reorderGroup"
                    >
                      {visibleDishes.map((dish, dishIdx) => (
                        <ReorderItemContainer
                          key={dish.clientId}
                          value={dish.clientId}
                          className="bo-dishReorderItem bo-reorderItem"
                          transition={reorderTransition}
                          whileDrag={reorderWhileDrag}
                        >
                          {(startDishDrag) => (
                            <MenuDishEditorCard
                              sectionClientId={sec.clientId}
                              dish={dish}
                              dishIdx={dishIdx}
                              isALaCarte={isALaCarte}
                              mediaLoading={dish.ai_generating}
                              startDishDrag={startDishDrag}
                              pickDishImage={pickDishImage}
                              setAllergenModal={setAllergenModal}
                              removeDish={removeDish}
                              updateDish={updateDish}
                            />
                          )}
                        </ReorderItemContainer>
                      ))}
                    </Reorder.Group>
                  ) : (
                    <div className="bo-dishesEmpty" role="status" aria-live="polite">
                      {dishTab === "active"
                        ? "No hay platos activos en esta seccion."
                        : "No hay platos inactivos en esta seccion."}
                    </div>
                  )}
                </div>

                <div className="bo-dishAddRow">
                  <button className="bo-btn bo-btn--ghost bo-btn--sm bo-dishAddBtn" type="button" onClick={handleAddDish}>
                    <Plus size={12} /> Añadir plato
                  </button>
                </div>

                <div className="bo-searchCatalogRow">
                  <div className="bo-searchCatalogInputWrap">
                    <Search size={14} className="bo-searchCatalogIcon" aria-hidden="true" />
                    <input
                      className="bo-input bo-searchCatalogInput"
                      placeholder="Buscar plato en base de datos"
                      value={searchTerm}
                      onChange={(e) => handleSearch(sec.clientId, e.target.value)}
                    />
                  </div>
                  {searchItems.length > 0 ? (
                    <div className="bo-searchResults">
                      {searchItems.map((item) => (
                        <button
                          key={`${sec.clientId}-${item.id}`}
                          type="button"
                          className="bo-searchResultBtn"
                          onClick={() => handleAddDishFromCatalog(item)}
                        >
                          <span>{item.title}</span>
                          <span className="bo-mutedText">Añadir</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </ReorderItemContainer>
    );
  },
  (prev, next) => (
    prev.sec === next.sec
    && prev.secIdx === next.secIdx
    && prev.sectionsCount === next.sectionsCount
    && prev.isALaCarte === next.isALaCarte
    && prev.reorderTransition === next.reorderTransition
    && prev.reorderWhileDrag === next.reorderWhileDrag
    && prev.chevronHover === next.chevronHover
    && prev.chevronTapUp === next.chevronTapUp
    && prev.chevronTapDown === next.chevronTapDown
    && prev.searchTerm === next.searchTerm
    && prev.searchItems === next.searchItems
  ),
);

function buildBasicsPayload(draft: BasicsDraft): BasicsPayload {
  return {
    menu_title: draft.title.trim() || "Nuevo menu",
    price: toNumOrNull(draft.price) ?? 0,
    active: draft.active,
    menu_type: draft.menuType,
    menu_subtitle: draft.subtitles.map((s) => s.trim()).filter(Boolean),
    show_dish_images: draft.showDishImages,
    included_coffee: draft.includedCoffee,
    beverage: {
      type: draft.beverageType,
      price_per_person: draft.beverageType === "no_incluida" ? null : toNumOrNull(draft.beveragePrice),
      has_supplement: draft.beverageType === "ilimitada" ? draft.beverageHasSupplement : false,
      supplement_price: draft.beverageType === "ilimitada" && draft.beverageHasSupplement ? toNumOrNull(draft.beverageSupplementPrice) : null,
    },
    comments: draft.comments.map((s) => s.trim()).filter(Boolean),
    min_party_size: Math.max(1, Number(draft.minPartySize) || 1),
    main_dishes_limit: draft.mainLimit,
    main_dishes_limit_number: Math.max(1, Number(draft.mainLimitNum) || 1),
  };
}

function getSectionsFingerprint(sections: EditorSection[]): string {
  return JSON.stringify(
    sections.map((sec) => ({
      id: sec.id || null,
      title: sec.title,
      kind: sec.kind,
      dishes: sec.dishes.map((d) => ({
        id: d.id || null,
        catalog: d.catalog_dish_id || null,
        title: d.title,
        desc: d.description,
        allergens: d.allergens,
        supp: d.supplement_enabled,
        suppPrice: d.supplement_price,
        active: d.active,
      })),
    })),
  );
}

function getSectionsStructureFingerprint(sections: EditorSection[]): string {
  return JSON.stringify(
    sections.map((sec, idx) => ({
      id: sec.id || null,
      clientId: sec.clientId,
      title: sec.title.trim(),
      kind: sec.kind,
      position: idx,
    })),
  );
}

function getSectionDishesFingerprint(section: EditorSection): string {
  return JSON.stringify(
    section.dishes.map((dish, idx) => ({
      id: dish.id || null,
      catalog: dish.catalog_dish_id || null,
      title: dish.title,
      description: dish.description,
      allergens: dish.allergens,
      supplement_enabled: dish.supplement_enabled,
      supplement_price: dish.supplement_price,
      price: dish.price,
      active: dish.active,
      position: idx,
    })),
  );
}

function getSectionsDishFingerprintMap(sections: EditorSection[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const section of sections) {
    map[section.clientId] = getSectionDishesFingerprint(section);
  }
  return map;
}

type SectionDishSyncState = {
  order: string;
  byId: Record<string, string>;
};

function getDishPatchFingerprint(dish: EditorDish, isALaCarte: boolean): string {
  return JSON.stringify({
    id: dish.id || null,
    catalog: dish.catalog_dish_id || null,
    title: dish.title.trim(),
    description: dish.description,
    allergens: dish.allergens,
    supplement_enabled: dish.supplement_enabled,
    supplement_price: dish.supplement_price,
    price: isALaCarte ? dish.price : null,
    active: dish.active,
  });
}

function getSectionDishSyncState(section: EditorSection, isALaCarte: boolean): SectionDishSyncState {
  const ids = section.dishes.map((dish) => dish.id || 0);
  const byId: Record<string, string> = {};
  section.dishes.forEach((dish) => {
    if (!dish.id) return;
    byId[String(dish.id)] = getDishPatchFingerprint(dish, isALaCarte);
  });
  return {
    order: JSON.stringify(ids),
    byId,
  };
}

function getSectionsDishSyncStateMap(sections: EditorSection[], isALaCarte: boolean): Record<string, SectionDishSyncState> {
  const map: Record<string, SectionDishSyncState> = {};
  sections.forEach((section) => {
    map[section.clientId] = getSectionDishSyncState(section, isALaCarte);
  });
  return map;
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function areEditorDishesEqual(prev: EditorDish, next: EditorDish): boolean {
  return (
    prev.clientId === next.clientId
    && prev.id === next.id
    && prev.catalog_dish_id === next.catalog_dish_id
    && prev.title === next.title
    && prev.description === next.description
    && prev.description_enabled === next.description_enabled
    && arraysEqual(prev.allergens, next.allergens)
    && prev.supplement_enabled === next.supplement_enabled
    && prev.supplement_price === next.supplement_price
    && prev.price === next.price
    && prev.active === next.active
    && prev.position === next.position
    && prev.foto_url === next.foto_url
    && prev.ai_requested === next.ai_requested
    && prev.ai_generating === next.ai_generating
    && prev.ai_generated_img === next.ai_generated_img
  );
}

function mergeDishFromServer(prev: EditorDish | undefined, server: GroupMenuV2Dish): EditorDish {
  const next = mapApiDish(server, prev);
  if (!prev) return next;
  if (
    prev.id === next.id
    && prev.catalog_dish_id === next.catalog_dish_id
    && prev.title === next.title
    && prev.description === next.description
    && prev.description_enabled === next.description_enabled
    && arraysEqual(prev.allergens, next.allergens)
    && prev.supplement_enabled === next.supplement_enabled
    && prev.supplement_price === next.supplement_price
    && prev.price === next.price
    && prev.active === next.active
    && prev.position === next.position
    && prev.foto_url === next.foto_url
    && prev.ai_requested === next.ai_requested
    && prev.ai_generating === next.ai_generating
    && prev.ai_generated_img === next.ai_generated_img
  ) {
    return prev;
  }
  return next;
}

function mapApiDish(d: GroupMenuV2Dish, prev?: EditorDish): EditorDish {
  const description = d.description || "";
  const hasDescription = description.trim().length > 0;
  const aiGeneratedImg = typeof d.ai_generated_img === "string" && d.ai_generated_img.trim()
    ? d.ai_generated_img.trim()
    : (prev?.ai_generated_img ?? null);
  const aiGenerating = parseLooseBool(d.ai_generating ?? d.ai_generating_img, prev?.ai_generating ?? false);
  const aiRequested = parseLooseBool(d.ai_requested ?? d.ai_requested_img, prev?.ai_requested ?? aiGenerating);
  return {
    clientId: prev?.clientId || uid("dish"),
    id: d.id,
    catalog_dish_id: d.catalog_dish_id ?? null,
    title: d.title,
    description,
    description_enabled: (prev?.description_enabled ?? false) || hasDescription,
    allergens: d.allergens || [],
    supplement_enabled: !!d.supplement_enabled,
    supplement_price: d.supplement_price ?? null,
    price: d.price ?? null,
    active: d.active !== false,
    position: d.position || 0,
    foto_url: d.foto_url || d.image_url || aiGeneratedImg || prev?.foto_url,
    ai_requested: !!aiRequested,
    ai_generating: !!aiGenerating,
    ai_generated_img: aiGeneratedImg,
  };
}

function mapApiSection(s: GroupMenuV2Section, prev?: EditorSection): EditorSection {
  const prevDishByID = new Map<number, EditorDish>();
  for (const dish of prev?.dishes || []) {
    if (dish.id) prevDishByID.set(dish.id, dish);
  }

  return {
    clientId: prev?.clientId || uid("section"),
    id: s.id,
    title: s.title,
    kind: s.kind,
    position: s.position || 0,
    expanded: prev?.expanded ?? true,
    dishes: (s.dishes || []).map((dish) => mapApiDish(dish, dish.id ? prevDishByID.get(dish.id) : undefined)),
  };
}

function mapApiMenu(menu: GroupMenuV2, prevSections: EditorSection[] = []): {
  title: string;
  price: string;
  active: boolean;
  menuType: string;
  subtitles: string[];
  sections: EditorSection[];
  settings: {
    included_coffee: boolean;
    beverage: {
      type: string;
      price_per_person: number | null;
      has_supplement: boolean;
      supplement_price: number | null;
    };
    comments: string[];
    min_party_size: number;
    main_dishes_limit: boolean;
    main_dishes_limit_number: number;
  };
  showDishImages: boolean;
} {
  const prevByID = new Map<number, EditorSection>();
  for (const sec of prevSections) {
    if (sec.id) prevByID.set(sec.id, sec);
  }

  const sections = (menu.sections || []).map((sec) => mapApiSection(sec, sec.id ? prevByID.get(sec.id) : undefined));

  return {
    title: menu.menu_title || "",
    price: menu.price || "0",
    active: !!menu.active,
    menuType: menu.menu_type || "closed_conventional",
    subtitles: menu.menu_subtitle || [],
    showDishImages: !!menu.show_dish_images,
    sections,
    settings: {
      included_coffee: !!menu.settings?.included_coffee,
      beverage: {
        type: menu.settings?.beverage?.type || DEFAULT_BEVERAGE.type,
        price_per_person: menu.settings?.beverage?.price_per_person ?? null,
        has_supplement: !!menu.settings?.beverage?.has_supplement,
        supplement_price: menu.settings?.beverage?.supplement_price ?? null,
      },
      comments: menu.settings?.comments || [],
      min_party_size: menu.settings?.min_party_size || 8,
      main_dishes_limit: !!menu.settings?.main_dishes_limit,
      main_dishes_limit_number: menu.settings?.main_dishes_limit_number || 1,
    },
  };
}

export default function Page() {
  const pageContext = usePageContext();
  const data = pageContext.data as PageData;
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const { pushToast } = useToasts();

  const [error, setError] = useState<string | null>(data.error);
  useErrorToast(error);
  const [menuId, setMenuId] = useState<number | null>(data.menu?.id ?? null);

  const [step, setStep] = useState<number>(data.menu ? 3 : 0);
  const [menuType, setMenuType] = useState<string>(data.menu?.menu_type || "closed_conventional");
  const [title, setTitle] = useState<string>(data.menu?.menu_title || "");
  const [price, setPrice] = useState<string>(data.menu?.price || "0");
  const [subtitles, setSubtitles] = useState<string[]>(data.menu?.menu_subtitle?.length ? data.menu.menu_subtitle : [""]);
  const [active, setActive] = useState<boolean>(data.menu?.active ?? false);
  const [showDishImages, setShowDishImages] = useState<boolean>(!!data.menu?.show_dish_images);
  const [sections, setSections] = useState<EditorSection[]>([]);

  const [includedCoffee, setIncludedCoffee] = useState<boolean>(false);
  const [beverageType, setBeverageType] = useState<string>(DEFAULT_BEVERAGE.type);
  const [beveragePrice, setBeveragePrice] = useState<string>("");
  const [beverageHasSupplement, setBeverageHasSupplement] = useState<boolean>(false);
  const [beverageSupplementPrice, setBeverageSupplementPrice] = useState<string>("");
  const [minPartySize, setMinPartySize] = useState<string>("8");
  const [mainLimit, setMainLimit] = useState<boolean>(false);
  const [mainLimitNum, setMainLimitNum] = useState<string>("1");
  const [comments, setComments] = useState<string[]>([""]);
  const [specialMenuImage, setSpecialMenuImage] = useState<string | null>(null);

  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [menuTypeModalOpen, setMenuTypeModalOpen] = useState(false);
  const [menuTypePendingValue, setMenuTypePendingValue] = useState<string>(data.menu?.menu_type || "closed_conventional");
  const [menuTypeChanging, setMenuTypeChanging] = useState(false);
  const [mobileTab, setMobileTab] = useState<"editor" | "preview">("editor");
  const [desktopPreviewOpen, setDesktopPreviewOpen] = useState(true);
  const [desktopPreviewDocked, setDesktopPreviewDocked] = useState(true);
  const [previewThemeConfig, setPreviewThemeConfig] = useState<PreviewThemeConfig | null>(null);
  const [previewThemeLoading, setPreviewThemeLoading] = useState(true);

  const [allergenModal, setAllergenModal] = useState<{ open: boolean; sectionClientId: string; dishClientId: string } | null>(null);
  const [searchTerms, setSearchTerms] = useState<Record<string, string>>({});
  const [searchResults, setSearchResults] = useState<Record<string, DishCatalogItem[]>>({});
  const [menuAITracker, setMenuAITracker] = useState<MenuAITrackerState>(() => buildMenuAITracker(data.menu));
  const [dishImageTarget, setDishImageTarget] = useState<{ sectionClientId: string; dishClientId: string } | null>(null);
  const [dishImageAdvisorDraft, setDishImageAdvisorDraft] = useState<DishImageCropDraft | null>(null);
  const [dishImageAdvisorBusy, setDishImageAdvisorBusy] = useState(false);
  const [dishImageCropDraft, setDishImageCropDraft] = useState<DishImageCropDraft | null>(null);
  const [dishImageBusy, setDishImageBusy] = useState(false);

  const searchTimerRef = useRef<Record<string, number>>({});
  const dishImageInputRef = useRef<HTMLInputElement | null>(null);
  const previewDockTimerRef = useRef<number | null>(null);
  const previewFrameRef = useRef<HTMLIFrameElement | null>(null);
  const syncTimerRef = useRef<number | null>(null);
  const basicsTimerRef = useRef<number | null>(null);
  const menuAIWSRetryRef = useRef<number | null>(null);
  const menuAIWSSocketRef = useRef<WebSocket | null>(null);
  const menuAIWSAttemptsRef = useRef(0);
  const menuAIWSAuthToastShownRef = useRef(false);
  const dishImageAdvisorDraftRef = useRef<DishImageCropDraft | null>(null);
  const dishImageCropDraftRef = useRef<DishImageCropDraft | null>(null);
  const pushToastRef = useRef(pushToast);
  const menuAITrackerRef = useRef<MenuAITrackerState>(menuAITracker);
  const sectionsRef = useRef<EditorSection[]>([]);
  const renderCountRef = useRef(0);
  const lastSavedBasicsRef = useRef<string>("");
  const inFlightBasicsRef = useRef<string | null>(null);
  const lastSavedSectionsRef = useRef<string>("");
  const lastSavedSectionsStructureRef = useRef<string>("");
  const lastSavedSectionDishesRef = useRef<Record<string, string>>({});
  const lastSavedSectionDishSyncRef = useRef<Record<string, SectionDishSyncState>>({});
  const inFlightSectionsRef = useRef<string | null>(null);
  const syncRequestSeqRef = useRef(0);

  const steps = [0, 1, 2, 3];

  const isALaCarte = menuType === "a_la_carte" || menuType === "a_la_carte_group";
  const isSpecial = menuType === "special";
  const hasSecondaryBasicsField = (!isALaCarte && !isSpecial) || isSpecial;

  const basicsDraft = useMemo<BasicsDraft>(
    () => ({
      title,
      price,
      active,
      menuType,
      subtitles,
      showDishImages,
      includedCoffee,
      beverageType,
      beveragePrice,
      beverageHasSupplement,
      beverageSupplementPrice,
      comments,
      minPartySize,
      mainLimit,
      mainLimitNum,
    }),
    [
      active,
      beverageHasSupplement,
      beveragePrice,
      beverageSupplementPrice,
      beverageType,
      comments,
      includedCoffee,
      mainLimit,
      mainLimitNum,
      menuType,
      minPartySize,
      price,
      showDishImages,
      subtitles,
      title,
    ],
  );
  const basicsPayload = useMemo(() => buildBasicsPayload(basicsDraft), [basicsDraft]);
  const basicsFingerprint = useMemo(() => JSON.stringify(basicsPayload), [basicsPayload]);
  const sectionsFingerprint = useMemo(() => getSectionsFingerprint(sections), [sections]);
  const shouldReduceMotion = useReducedMotion();
  const sectionOrder = useMemo(() => sections.map((sec) => sec.clientId), [sections]);
  const menuAIDishesById = useMemo(() => {
    const map = new Map<number, MenuAIDishTracker>();
    for (const row of menuAITracker.dishes) {
      if (!row || !Number.isFinite(row.dish_id) || row.dish_id <= 0) continue;
      map.set(row.dish_id, row);
    }
    return map;
  }, [menuAITracker]);
  const dishImageAdvisorPreviewKB = useMemo(
    () => (dishImageAdvisorDraft?.file?.size ? Math.round(dishImageAdvisorDraft.file.size / 1024) : 0),
    [dishImageAdvisorDraft],
  );
  const loadingSectionTitles = useMemo(() => {
    const fromMenu = Array.isArray(data.menu?.sections) ? data.menu.sections : [];
    if (fromMenu.length > 0) {
      return fromMenu.map((section, idx) => section.title?.trim() || `Seccion ${idx + 1}`);
    }
    return ["Entrantes", "Principales", "Postres"];
  }, [data.menu]);

  useEffect(() => {
    renderCountRef.current += 1;
    debugMenuPerf("page-commit", {
      render: renderCountRef.current,
      menuId,
      step,
      hydrated,
      saveState,
      sections: sections.length,
      sectionIds: sections.map((section) => section.clientId),
    });
  });

  useEffect(() => {
    debugMenuPerf("sections-fingerprint-change", {
      fingerprint: sectionsFingerprint.slice(0, 18),
      sections: sections.length,
    });
  }, [sectionsFingerprint, sections.length]);

  useEffect(() => {
    sectionsRef.current = sections;
  }, [sections]);

  useEffect(() => {
    dishImageAdvisorDraftRef.current = dishImageAdvisorDraft;
  }, [dishImageAdvisorDraft]);

  useEffect(() => {
    dishImageCropDraftRef.current = dishImageCropDraft;
  }, [dishImageCropDraft]);

  useEffect(() => {
    pushToastRef.current = pushToast;
  }, [pushToast]);

  useEffect(() => {
    menuAITrackerRef.current = menuAITracker;
  }, [menuAITracker]);

  const applyDishAIState = useCallback(
    (
      dishId: number,
      patch: Partial<MenuAIDishTracker> & {
        foto_url?: string | null;
      },
    ) => {
      if (!Number.isFinite(dishId) || dishId <= 0) return;
      logMenuAITrace("applyDishAIState", {
        dishId,
        ai_requested: patch.ai_requested,
        ai_generating: patch.ai_generating,
        ai_generated_img: patch.ai_generated_img ?? null,
        foto_url: patch.foto_url ?? null,
      });
      setMenuAITracker((prev) => updateMenuAITrackerDish(prev, dishId, patch));
      setSections((prev) => {
        let changed = false;
        const next = prev.map((section) => {
          let sectionChanged = false;
          const dishes = section.dishes.map((dish) => {
            if (dish.id !== dishId) return dish;
            const nextDish: EditorDish = {
              ...dish,
              ai_requested: patch.ai_requested ?? dish.ai_requested,
              ai_generating: patch.ai_generating ?? dish.ai_generating,
              ai_generated_img: patch.ai_generated_img ?? dish.ai_generated_img ?? null,
              foto_url: patch.foto_url
                ?? (!patch.ai_generating && patch.ai_generated_img ? patch.ai_generated_img : dish.foto_url),
            };
            if (
              nextDish.ai_requested === dish.ai_requested
              && nextDish.ai_generating === dish.ai_generating
              && nextDish.ai_generated_img === dish.ai_generated_img
              && nextDish.foto_url === dish.foto_url
            ) {
              return dish;
            }
            sectionChanged = true;
            changed = true;
            return nextDish;
          });
          return sectionChanged ? { ...section, dishes } : section;
        });
        return changed ? next : prev;
      });
    },
    [],
  );

  const applyAITrackerSnapshot = useCallback((rows: MenuAIDishTracker[]) => {
    if (!rows.length) return;
    const mergedRows = mergeMenuAIDishes(rows);
    const currentByDish = new Map<number, MenuAIDishTracker>();
    for (const row of menuAITrackerRef.current.dishes) {
      if (!Number.isFinite(row.dish_id) || row.dish_id <= 0) continue;
      currentByDish.set(row.dish_id, row);
    }
    const changedDishIds: number[] = [];
    for (const row of mergedRows) {
      const prev = currentByDish.get(row.dish_id);
      if (
        !prev
        || prev.ai_requested !== row.ai_requested
        || prev.ai_generating !== row.ai_generating
        || prev.ai_generated_img !== row.ai_generated_img
      ) {
        changedDishIds.push(row.dish_id);
      }
    }
    if (changedDishIds.length === 0) {
      logMenuAITrace("applyAITrackerSnapshot:skip-no-change", {
        rows: mergedRows.length,
      });
      return;
    }
    logMenuAITrace("applyAITrackerSnapshot", {
      rows: mergedRows.length,
      changedRows: changedDishIds.length,
      changedDishIds: changedDishIds.slice(0, 12),
    });
    const byDish = new Map<number, MenuAIDishTracker>();
    for (const row of mergedRows) {
      byDish.set(row.dish_id, row);
    }
    setMenuAITracker((prev) => ({ dishes: mergeMenuAIDishes([...prev.dishes, ...mergedRows]) }));
    setSections((prev) => {
      let changed = false;
      const next = prev.map((section) => {
        let sectionChanged = false;
        const dishes = section.dishes.map((dish) => {
          if (!dish.id) return dish;
          const tracked = byDish.get(dish.id);
          if (!tracked) return dish;
          const nextDish: EditorDish = {
            ...dish,
            ai_requested: tracked.ai_requested,
            ai_generating: tracked.ai_generating,
            ai_generated_img: tracked.ai_generated_img ?? null,
            foto_url: (!tracked.ai_generating && tracked.ai_generated_img) ? (tracked.ai_generated_img || dish.foto_url) : dish.foto_url,
          };
          if (
            nextDish.ai_requested === dish.ai_requested
            && nextDish.ai_generating === dish.ai_generating
            && nextDish.ai_generated_img === dish.ai_generated_img
            && nextDish.foto_url === dish.foto_url
          ) {
            return dish;
          }
          changed = true;
          sectionChanged = true;
          return nextDish;
        });
        return sectionChanged ? { ...section, dishes } : section;
      });
      return changed ? next : prev;
    });
  }, []);

  useEffect(() => {
    if (!menuId) return;
    logMenuAITrace("wsEffect:start", { menuId });

    let disposed = false;
    let socket: WebSocket | null = null;
    let openAtMs = 0;

    const clearRetryTimer = () => {
      if (menuAIWSRetryRef.current) {
        window.clearTimeout(menuAIWSRetryRef.current);
        menuAIWSRetryRef.current = null;
        logMenuAITrace("ws:retryTimer:cleared", { menuId });
      }
    };

    const parseEventKind = (rawType: string): "started" | "completed" | "failed" | null => {
      const type = rawType.trim().toLowerCase();
      if (!type) return null;
      if (type === "started" || type === "ai_image_started") return "started";
      if (type === "completed" || type === "ai_image_completed") return "completed";
      if (type === "failed" || type === "ai_image_failed") return "failed";
      return null;
    };

    const applyMessageTracker = (payload: unknown) => {
      const rows = trackerFromWSPayload(payload);
      if (rows.length > 0) {
        applyAITrackerSnapshot(rows);
      }
    };

    const scheduleReconnect = () => {
      if (disposed) return;
      menuAIWSAttemptsRef.current += 1;
      const attempt = menuAIWSAttemptsRef.current;
      const backoffMs = Math.min(12000, 700 * (2 ** Math.max(0, attempt - 1)));
      const jitterMs = Math.round(Math.random() * 280);
      clearRetryTimer();
      logMenuAITrace("ws:reconnect:scheduled", {
        menuId,
        attempt,
        backoffMs,
        jitterMs,
      });
      menuAIWSRetryRef.current = window.setTimeout(() => {
        if (disposed) return;
        logMenuAITrace("ws:reconnect:tick", { menuId, attempt });
        connect();
      }, backoffMs + jitterMs);
    };

    const connect = () => {
      if (disposed) return;
      let nextSocket: WebSocket | null = null;
      const wsURL = buildGroupMenuAIWSURL(menuId);
      logMenuAITrace("ws:connect:attempt", { menuId, wsURL });
      try {
        nextSocket = new WebSocket(wsURL);
      } catch {
        logMenuAITrace("ws:connect:constructor-error", { menuId, wsURL });
        scheduleReconnect();
        return;
      }
      socket = nextSocket;
      menuAIWSSocketRef.current = socket;

      socket.addEventListener("open", () => {
        if (disposed) {
          try {
            socket?.close();
          } catch {
            // ignore
          }
          logMenuAITrace("ws:open:disposed", { menuId });
          return;
        }
        logMenuAITrace("ws:open", { menuId, attempts: menuAIWSAttemptsRef.current });
        openAtMs = Date.now();
        clearRetryTimer();
        logMenuAITrace("ws:open:awaiting-server-hello", { menuId });
      });

      socket.addEventListener("message", (event) => {
        if (disposed) return;
        if (menuAIWSAttemptsRef.current !== 0) {
          menuAIWSAttemptsRef.current = 0;
          logMenuAITrace("ws:attempts:reset-on-message", { menuId });
        }
        let payload: Record<string, unknown> | null = null;
        try {
          payload = JSON.parse(String(event.data ?? "")) as Record<string, unknown>;
        } catch {
          payload = null;
        }
        if (!payload) return;

        const rawType = String(payload.type ?? "").trim().toLowerCase();
        const messageDishIdRaw = payload.dish_id ?? payload.dishId ?? payload.id;
        const messageDishId = Number(messageDishIdRaw ?? 0);
        logMenuAITrace("ws:message", {
          menuId,
          type: rawType || "unknown",
          dish_id: Number.isFinite(messageDishId) && messageDishId > 0 ? messageDishId : null,
        });
        if (rawType === "hello" || rawType === "snapshot") {
          applyMessageTracker(payload);
          return;
        }

        const eventKind = parseEventKind(rawType);
        if (eventKind) {
          const dishId = Number(payload.dish_id ?? payload.dishId ?? payload.id);
          const aiGeneratedRaw = payload.ai_generated_img ?? payload.aiGeneratedImg;
          const aiGeneratedImg = typeof aiGeneratedRaw === "string" && aiGeneratedRaw.trim()
            ? aiGeneratedRaw.trim()
            : null;
          const fotoRaw = payload.foto_url ?? payload.fotoUrl ?? aiGeneratedRaw;
          const fotoURL = typeof fotoRaw === "string" && fotoRaw.trim()
            ? fotoRaw.trim()
            : undefined;
          if (Number.isFinite(dishId) && dishId > 0) {
            if (eventKind === "started") {
              applyDishAIState(dishId, {
                ai_requested: true,
                ai_generating: true,
              });
            } else if (eventKind === "completed") {
              applyDishAIState(dishId, {
                ai_requested: true,
                ai_generating: false,
                ai_generated_img: aiGeneratedImg,
                foto_url: fotoURL ?? aiGeneratedImg ?? undefined,
              });
            } else if (eventKind === "failed") {
              applyDishAIState(dishId, {
                ai_requested: true,
                ai_generating: false,
              });
              const errorMessage = typeof payload.message === "string" && payload.message.trim()
                ? payload.message.trim()
                : "No se pudo completar la mejora con IA";
              pushToastRef.current({
                kind: "error",
                title: "Mejora IA fallida",
                message: errorMessage,
              });
            }
          }
          applyMessageTracker(payload);
          return;
        }

        applyMessageTracker(payload);
      });

      socket.addEventListener("error", () => {
        logMenuAITrace("ws:error", { menuId });
        // Let browser transition to "close" naturally to avoid noisy CONNECTING close warnings.
      });

      socket.addEventListener("close", (event) => {
        if (disposed) return;
        const openForMs = openAtMs > 0 ? Date.now() - openAtMs : 0;
        const unauthorized = event.code === 4401 || event.code === 1008;
        logMenuAITrace("ws:close", {
          menuId,
          code: event.code,
          reason: event.reason || null,
          wasClean: event.wasClean,
          openForMs,
          unauthorized,
        });
        if (openForMs >= 1500) {
          menuAIWSAttemptsRef.current = 0;
        }
        if (menuAIWSSocketRef.current === socket) {
          menuAIWSSocketRef.current = null;
        }
        if (unauthorized) {
          if (!menuAIWSAuthToastShownRef.current) {
            menuAIWSAuthToastShownRef.current = true;
            pushToastRef.current({
              kind: "error",
              title: "Sesion no autorizada para tiempo real",
              message: "Recarga la pagina o vuelve a iniciar sesion para reactivar las actualizaciones IA.",
            });
          }
          return;
        }
        if (!disposed) {
          scheduleReconnect();
        }
      });
    };

    connect();

    return () => {
      disposed = true;
      logMenuAITrace("wsEffect:cleanup", { menuId });
      clearRetryTimer();
      if (menuAIWSSocketRef.current === socket) {
        menuAIWSSocketRef.current = null;
      }
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.close();
        } catch {
          // ignore
        }
      }
    };
  }, [applyAITrackerSnapshot, applyDishAIState, menuId, pushToastRef]);

  useEffect(() => {
    const sectionRows = trackerFromSections(sections);
    const ids = new Set<number>();
    for (const section of sections) {
      for (const dish of section.dishes) {
        if (dish.id) ids.add(dish.id);
      }
    }
    setMenuAITracker((prev) => {
      const kept = prev.dishes.filter((dish) => ids.has(dish.dish_id));
      const merged = mergeMenuAIDishes([...kept, ...sectionRows]);
      if (merged.length === prev.dishes.length && merged.every((row, idx) => (
        row.dish_id === prev.dishes[idx]?.dish_id
        && row.ai_requested === prev.dishes[idx]?.ai_requested
        && row.ai_generating === prev.dishes[idx]?.ai_generating
        && row.ai_generated_img === prev.dishes[idx]?.ai_generated_img
      ))) {
        return prev;
      }
      return { dishes: merged };
    });
  }, [sections]);

  useEffect(() => {
    return () => {
      const advisorURL = dishImageAdvisorDraftRef.current?.objectUrl;
      const cropURL = dishImageCropDraftRef.current?.objectUrl;
      if (advisorURL) URL.revokeObjectURL(advisorURL);
      if (cropURL && cropURL !== advisorURL) URL.revokeObjectURL(cropURL);
      if (menuAIWSRetryRef.current) {
        window.clearTimeout(menuAIWSRetryRef.current);
        menuAIWSRetryRef.current = null;
      }
      const socket = menuAIWSSocketRef.current;
      menuAIWSSocketRef.current = null;
      if (socket && socket.readyState === WebSocket.OPEN) {
        try {
          socket.close();
        } catch {
          // ignore
        }
      }
    };
  }, []);
  const paneLayoutTransition = useMemo(
    () =>
      shouldReduceMotion
        ? { duration: 0 }
        : {
            duration: 0.6,
            ease: [0.22, 1, 0.36, 1] as const,
          },
    [shouldReduceMotion],
  );
  const reorderTransition = useMemo(
    () =>
      shouldReduceMotion
        ? { duration: 0 }
        : {
            duration: 0.18,
            ease: [0.2, 0, 0, 1] as const,
          },
    [shouldReduceMotion],
  );
  const reorderWhileDrag = useMemo(
    () =>
      shouldReduceMotion
        ? undefined
        : {
            borderColor: "rgba(185, 168, 255, 0.56)",
            boxShadow: "0 16px 34px rgba(8, 10, 20, 0.5)",
          },
    [shouldReduceMotion],
  );
  const chevronHover = shouldReduceMotion ? undefined : { scale: 1.05 };
  const chevronTapUp = shouldReduceMotion ? undefined : { scale: 0.9, y: -2 };
  const chevronTapDown = shouldReduceMotion ? undefined : { scale: 0.9, y: 2 };

  useEffect(() => {
    if (!data.menu) {
      lastSavedBasicsRef.current = "";
      inFlightBasicsRef.current = null;
      lastSavedSectionsRef.current = "";
      lastSavedSectionsStructureRef.current = "";
      lastSavedSectionDishesRef.current = {};
      lastSavedSectionDishSyncRef.current = {};
      inFlightSectionsRef.current = null;
      syncRequestSeqRef.current = 0;
      setMenuAITracker({ dishes: [] });
      setHydrated(true);
      return;
    }

    const mapped = mapApiMenu(data.menu, sections);
    const mappedIsALaCarte = mapped.menuType === "a_la_carte" || mapped.menuType === "a_la_carte_group";
    setTitle(mapped.title);
    setPrice(mapped.price);
    setActive(mapped.active);
    setMenuType(mapped.menuType);
    setSubtitles(mapped.subtitles.length ? mapped.subtitles : [""]);
    setShowDishImages(mapped.showDishImages);
    setSections(mapped.sections);
    setMenuAITracker(buildMenuAITracker(data.menu, mapped.sections));
    setIncludedCoffee(mapped.settings.included_coffee);
    setBeverageType(mapped.settings.beverage.type);
    setBeveragePrice(mapped.settings.beverage.price_per_person == null ? "" : String(mapped.settings.beverage.price_per_person));
    setBeverageHasSupplement(mapped.settings.beverage.has_supplement);
    setBeverageSupplementPrice(mapped.settings.beverage.supplement_price == null ? "" : String(mapped.settings.beverage.supplement_price));
    setMinPartySize(String(mapped.settings.min_party_size));
    setMainLimit(mapped.settings.main_dishes_limit);
    setMainLimitNum(String(mapped.settings.main_dishes_limit_number));
    setComments(mapped.settings.comments.length ? mapped.settings.comments : [""]);

    const mappedBasicsPayload = buildBasicsPayload({
      title: mapped.title,
      price: mapped.price,
      active: mapped.active,
      menuType: mapped.menuType,
      subtitles: mapped.subtitles.length ? mapped.subtitles : [""],
      showDishImages: mapped.showDishImages,
      includedCoffee: mapped.settings.included_coffee,
      beverageType: mapped.settings.beverage.type,
      beveragePrice: mapped.settings.beverage.price_per_person == null ? "" : String(mapped.settings.beverage.price_per_person),
      beverageHasSupplement: mapped.settings.beverage.has_supplement,
      beverageSupplementPrice: mapped.settings.beverage.supplement_price == null ? "" : String(mapped.settings.beverage.supplement_price),
      comments: mapped.settings.comments.length ? mapped.settings.comments : [""],
      minPartySize: String(mapped.settings.min_party_size),
      mainLimit: mapped.settings.main_dishes_limit,
      mainLimitNum: String(mapped.settings.main_dishes_limit_number),
    });
    lastSavedBasicsRef.current = JSON.stringify(mappedBasicsPayload);
    lastSavedSectionsRef.current = getSectionsFingerprint(mapped.sections);
    lastSavedSectionsStructureRef.current = getSectionsStructureFingerprint(mapped.sections);
    lastSavedSectionDishesRef.current = getSectionsDishFingerprintMap(mapped.sections);
    lastSavedSectionDishSyncRef.current = getSectionsDishSyncStateMap(mapped.sections, mappedIsALaCarte);
    inFlightBasicsRef.current = null;
    inFlightSectionsRef.current = null;
    syncRequestSeqRef.current = 0;
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (menuTypeModalOpen) return;
    setMenuTypePendingValue(menuType || "closed_conventional");
  }, [menuType, menuTypeModalOpen]);

  useEffect(() => {
    if (previewDockTimerRef.current) {
      window.clearTimeout(previewDockTimerRef.current);
      previewDockTimerRef.current = null;
    }

    if (desktopPreviewOpen) {
      setDesktopPreviewDocked(true);
      return;
    }

    // Keep the preview docked while it fades out, then collapse the layout.
    setDesktopPreviewDocked(true);
    previewDockTimerRef.current = window.setTimeout(() => {
      setDesktopPreviewDocked(false);
      previewDockTimerRef.current = null;
    }, 600);

    return () => {
      if (previewDockTimerRef.current) {
        window.clearTimeout(previewDockTimerRef.current);
        previewDockTimerRef.current = null;
      }
    };
  }, [desktopPreviewOpen]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setPreviewThemeLoading(true);
      try {
        const res = await api.settings.getWebsiteMenuTemplates();
        if (cancelled || !res.success) return;
        const overrides = (res.overrides as Record<string, string>) || {};
        const assigned = typeof res.assigned === "boolean"
          ? res.assigned
          : (Boolean((res.default_theme_id || "").trim()) || Object.keys(overrides).length > 0);
        setPreviewThemeConfig({
          assigned,
          default_theme_id: res.default_theme_id || "villa-carmen",
          overrides,
          themes: Array.isArray(res.themes) ? res.themes : [],
        });
      } catch {
        if (!cancelled) setPreviewThemeConfig(null);
      } finally {
        if (!cancelled) setPreviewThemeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const normalizePreviewThemeId = useCallback((rawThemeId?: string | null): string => {
    const raw = String(rawThemeId || "").trim().toLowerCase();
    if (!raw) return "villa-carmen";
    const alias = raw
      .replace(/[_\s]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    const compact = alias.replace(/-/g, "");
    if (alias === "preact-copy" || alias === "preactcopy") return "villa-carmen";
    if (alias === "villa-carmen" || compact === "villacarmen" || compact === "villacaren") return "villa-carmen";
    return alias || "villa-carmen";
  }, []);

  const previewThemeId = useMemo(() => {
    if (!previewThemeConfig) return "villa-carmen";
    const fromOverride = previewThemeConfig.overrides[menuType || "closed_conventional"];
    return normalizePreviewThemeId(fromOverride || previewThemeConfig.default_theme_id || "villa-carmen");
  }, [menuType, normalizePreviewThemeId, previewThemeConfig]);

  const previewThemeLabel = useMemo(() => {
    if (!previewThemeConfig) return "Plantilla no disponible";
    const options = Array.isArray(previewThemeConfig.themes) ? previewThemeConfig.themes : [];
    const match = options.find((theme) => theme.id === previewThemeId);
    return match?.name || previewThemeId;
  }, [previewThemeConfig, previewThemeId]);

  const previewNeedsUpgrade = useMemo(() => {
    if (!previewThemeConfig) return false;
    return previewThemeConfig.assigned === false;
  }, [previewThemeConfig]);

  const previewUrl = "/menu-preview/index.html";

  const previewMenuPayload = useMemo(
    () => ({
      id: menuId,
      menu_title: title,
      menu_type: menuType || "closed_conventional",
      price,
      active,
      menu_subtitle: subtitles,
      show_dish_images: showDishImages,
      settings: {
        included_coffee: includedCoffee,
        beverage: {
          type: beverageType,
          price_per_person: toNumOrNull(beveragePrice),
          has_supplement: beverageHasSupplement,
          supplement_price: toNumOrNull(beverageSupplementPrice),
        },
        comments,
        min_party_size: Number.parseInt(minPartySize || "0", 10) || 0,
        main_dishes_limit: mainLimit,
        main_dishes_limit_number: Number.parseInt(mainLimitNum || "0", 10) || 0,
      },
      ai_images: menuAITracker,
      sections: sections.map((section, sectionIdx) => ({
        id: section.id ?? null,
        title: section.title,
        kind: section.kind,
        position: section.position ?? sectionIdx,
        dishes: section.dishes.map((dish, dishIdx) => {
          const tracked = dish.id ? menuAIDishesById.get(dish.id) : null;
          const aiRequested = tracked?.ai_requested ?? dish.ai_requested;
          const aiGenerating = tracked?.ai_generating ?? dish.ai_generating;
          const aiGeneratedImg = tracked?.ai_generated_img ?? dish.ai_generated_img ?? null;
          return {
            id: dish.id ?? null,
            title: dish.title,
            description: dish.description,
            description_enabled: dish.description_enabled,
            allergens: dish.allergens,
            supplement_enabled: dish.supplement_enabled,
            supplement_price: dish.supplement_price,
            active: dish.active,
            price: dish.price,
            position: dish.position ?? dishIdx,
            foto_url: dish.foto_url,
            ai_requested: aiRequested,
            ai_generating: aiGenerating,
            ai_requested_img: aiRequested,
            ai_generating_img: aiGenerating,
            ai_generated_img: aiGeneratedImg,
          };
        }),
      })),
      special_menu_image_url: specialMenuImage || "",
    }),
    [
      active,
      beverageHasSupplement,
      beveragePrice,
      beverageSupplementPrice,
      beverageType,
      comments,
      includedCoffee,
      mainLimit,
      mainLimitNum,
      menuAIDishesById,
      menuAITracker,
      menuId,
      menuType,
      minPartySize,
      price,
      sections,
      showDishImages,
      specialMenuImage,
      subtitles,
      title,
    ],
  );

  useEffect(() => {
    if (previewThemeLoading || previewNeedsUpgrade) return;
    const win = previewFrameRef.current?.contentWindow;
    if (!win) return;
    win.postMessage(
      {
        type: "vc_preview:update",
        theme_id: previewThemeId,
        menu_type: menuType || "closed_conventional",
        menu: previewMenuPayload,
      },
      "*",
    );
  }, [menuType, previewMenuPayload, previewThemeId, previewThemeLoading, previewNeedsUpgrade]);

  const patchBasics = useCallback(
    async ({ payload, fingerprint, force = false }: { payload: BasicsPayload; fingerprint: string; force?: boolean }) => {
      if (!menuId) return;

      if (!force && (lastSavedBasicsRef.current === fingerprint || inFlightBasicsRef.current === fingerprint)) {
        return;
      }

      inFlightBasicsRef.current = fingerprint;
      setSaveState("saving");

      try {
        const res = await api.menus.gruposV2.patchBasics(menuId, payload);
        if (!res.success) throw new Error(res.message || "No se pudo guardar");
        lastSavedBasicsRef.current = fingerprint;
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
      } finally {
        if (inFlightBasicsRef.current === fingerprint) {
          inFlightBasicsRef.current = null;
        }
      }
    },
    [api, menuId, pushToast],
  );

  const syncSectionsAndDishes = useCallback(
    async ({
      sectionsSnapshot,
      fingerprint,
      force = false,
    }: {
      sectionsSnapshot: EditorSection[];
      fingerprint: string;
      force?: boolean;
    }) => {
      if (!menuId || sectionsSnapshot.length === 0) return sectionsSnapshot;

      if (!force && (lastSavedSectionsRef.current === fingerprint || inFlightSectionsRef.current === fingerprint)) {
        return sectionsSnapshot;
      }

      const requestSeq = syncRequestSeqRef.current + 1;
      syncRequestSeqRef.current = requestSeq;
      inFlightSectionsRef.current = fingerprint;
      setSaveState("saving");
      debugMenuPerf("sync-sections:start", {
        requestSeq,
        force,
        sections: sectionsSnapshot.length,
        fingerprint: fingerprint.slice(0, 18),
      });

      try {
        const structureFingerprint = getSectionsStructureFingerprint(sectionsSnapshot);
        let rebuilt = sectionsSnapshot.map((section, idx) => ({
          ...section,
          position: idx,
          dishes: section.dishes,
        }));
        let needsStateReconcile = false;

        const shouldSyncStructure = force
          || structureFingerprint !== lastSavedSectionsStructureRef.current
          || rebuilt.some((section) => !section.id);
        debugMenuPerf("sync-sections:structure-check", {
          requestSeq,
          shouldSyncStructure,
          fingerprint: structureFingerprint.slice(0, 18),
        });

        if (shouldSyncStructure) {
          const structure = rebuilt.map((sec, idx) => ({
            id: sec.id,
            title: sec.title.trim() || "Seccion",
            kind: sec.kind,
            position: idx,
          }));

          debugMenuPerf("api-call", {
            requestSeq,
            endpoint: "PUT /group-menus-v2/:id/sections",
            sections: structure.length,
          });
          const resSections = await api.menus.gruposV2.putSections(menuId, structure);
          if (!resSections.success) {
            throw new Error(resSections.message || "No se pudieron guardar las secciones");
          }

          needsStateReconcile = true;
          rebuilt = (resSections.sections || []).map((sec, idx) => {
            const local = rebuilt[idx];
            const mapped = mapApiSection(sec, local);
            mapped.dishes = withDishPositions(local?.dishes || []);
            return mapped;
          });
        }

        const changedSectionClientIds = force
          ? new Set(rebuilt.map((section) => section.clientId))
          : new Set(
            rebuilt
              .filter((section) => getSectionDishesFingerprint(section) !== lastSavedSectionDishesRef.current[section.clientId])
              .map((section) => section.clientId),
          );
        debugMenuPerf("sync-sections:dish-diff", {
          requestSeq,
          changedSections: Array.from(changedSectionClientIds),
          changedCount: changedSectionClientIds.size,
        });

        for (const section of rebuilt) {
          if (!section.id || !changedSectionClientIds.has(section.clientId)) continue;

          const previousSectionSyncState = lastSavedSectionDishSyncRef.current[section.clientId];
          const nextSectionSyncState = getSectionDishSyncState(section, isALaCarte);
          const allSectionDishesPersisted = section.dishes.every((dish) => !!dish.id);
          const canSyncBySingleDishPatch = !force
            && !shouldSyncStructure
            && !!previousSectionSyncState
            && allSectionDishesPersisted
            && previousSectionSyncState.order === nextSectionSyncState.order;

          if (canSyncBySingleDishPatch && previousSectionSyncState) {
            const changedDishes = section.dishes.filter((dish) => {
              if (!dish.id) return false;
              const dishId = String(dish.id);
              return previousSectionSyncState.byId[dishId] !== nextSectionSyncState.byId[dishId];
            });

            const hasUnsupportedPatch = changedDishes.some((dish) => dish.title.trim().length === 0);

            if (!hasUnsupportedPatch && changedDishes.length > 0) {
              debugMenuPerf("sync-sections:dish-patch-diff", {
                requestSeq,
                sectionId: section.id,
                clientId: section.clientId,
                changedDishes: changedDishes.map((dish) => dish.id),
              });

              const prevByID = new Map<number, EditorDish>();
              section.dishes.forEach((dish) => {
                if (dish.id) prevByID.set(dish.id, dish);
              });

              const patchedByID = new Map<number, EditorDish>();
              for (const dish of changedDishes) {
                if (!dish.id) continue;
                const trimmedTitle = dish.title.trim();
                if (!trimmedTitle) continue;

                debugMenuPerf("api-call", {
                  requestSeq,
                  endpoint: "PATCH /group-menus-v2/:id/sections/:sectionId/dishes/:dishId",
                  sectionId: section.id,
                  clientId: section.clientId,
                  dishId: dish.id,
                });
                const patched = await api.menus.gruposV2.patchSectionDish(menuId, section.id, dish.id, {
                  catalog_dish_id: dish.catalog_dish_id ?? null,
                  title: trimmedTitle,
                  description: dish.description,
                  allergens: dish.allergens,
                  supplement_enabled: dish.supplement_enabled,
                  supplement_price: dish.supplement_price,
                  price: isALaCarte ? dish.price : null,
                  active: dish.active,
                });
                if (!patched.success) {
                  throw new Error(patched.message || "No se pudo guardar el plato");
                }
                patchedByID.set(dish.id, mergeDishFromServer(prevByID.get(dish.id), patched.dish));
              }

              if (patchedByID.size > 0) {
                const merged = section.dishes.map((dish) => {
                  if (!dish.id) return dish;
                  return patchedByID.get(dish.id) || dish;
                });
                const sameDishRefs = merged.length === section.dishes.length && merged.every((dish, idx) => dish === section.dishes[idx]);
                if (!sameDishRefs) {
                  needsStateReconcile = true;
                  section.dishes = merged;
                }
              }
            }

            if (!hasUnsupportedPatch) {
              lastSavedSectionDishSyncRef.current[section.clientId] = getSectionDishSyncState(section, isALaCarte);
              continue;
            }
          }

          const payloadDishes: Array<{
            id?: number;
            catalog_dish_id?: number | null;
            title: string;
            description: string;
            allergens: string[];
            supplement_enabled: boolean;
            supplement_price: number | null;
            price: number | null;
            active: boolean;
          }> = [];

          const localDishes: EditorDish[] = [];
          let localDishMutated = false;

          for (const dish of section.dishes) {
            const trimmedTitle = dish.title.trim();
            if (!trimmedTitle) continue;

            let catalogId = dish.catalog_dish_id ?? null;
            if (!catalogId && !dish.id) {
              const upsert = await api.menus.dishesCatalog.upsert({
                id: undefined,
                title: trimmedTitle,
                description: dish.description.trim(),
                allergens: dish.allergens,
                default_supplement_enabled: dish.supplement_enabled,
                default_supplement_price: dish.supplement_price,
              });
              if (upsert.success) {
                catalogId = upsert.dish.id;
              }
            }

            if (catalogId && !dish.catalog_dish_id) {
              localDishMutated = true;
              localDishes.push({ ...dish, catalog_dish_id: catalogId });
            } else {
              localDishes.push(dish);
            }
            payloadDishes.push({
              id: dish.id,
              catalog_dish_id: catalogId,
              title: trimmedTitle,
              description: dish.description,
              allergens: dish.allergens,
              supplement_enabled: dish.supplement_enabled,
              supplement_price: dish.supplement_price,
              price: isALaCarte ? dish.price : null,
              active: dish.active,
            });
          }

          if (localDishMutated) {
            needsStateReconcile = true;
          }
          section.dishes = withDishPositions(localDishes);

          debugMenuPerf("api-call", {
            requestSeq,
            endpoint: "PUT /group-menus-v2/:id/sections/:sectionId/dishes",
            sectionId: section.id,
            clientId: section.clientId,
            dishes: payloadDishes.length,
          });
          const saved = await api.menus.gruposV2.putSectionDishes(menuId, section.id, payloadDishes);
          if (!saved.success) {
            throw new Error(saved.message || "No se pudieron guardar los platos");
          }

          const prevByID = new Map<number, EditorDish>();
          section.dishes.forEach((dish) => {
            if (dish.id) prevByID.set(dish.id, dish);
          });

          const merged = (saved.dishes || []).map((dish, dishIdx) => {
            const prev = (dish.id ? prevByID.get(dish.id) : undefined) || section.dishes[dishIdx];
            return mergeDishFromServer(prev, dish);
          });
          const sameDishRefs = merged.length === section.dishes.length && merged.every((dish, idx) => dish === section.dishes[idx]);
          if (!sameDishRefs) {
            needsStateReconcile = true;
            section.dishes = merged;
          }
          lastSavedSectionDishSyncRef.current[section.clientId] = getSectionDishSyncState(section, isALaCarte);
        }

        if (syncRequestSeqRef.current !== requestSeq) return sectionsSnapshot;

        if (needsStateReconcile) {
          setSections(rebuilt);
        }
        const savedSource = needsStateReconcile ? rebuilt : sectionsSnapshot;
        lastSavedSectionsRef.current = needsStateReconcile ? getSectionsFingerprint(savedSource) : fingerprint;
        lastSavedSectionsStructureRef.current = getSectionsStructureFingerprint(savedSource);
        lastSavedSectionDishesRef.current = getSectionsDishFingerprintMap(savedSource);
        lastSavedSectionDishSyncRef.current = getSectionsDishSyncStateMap(savedSource, isALaCarte);
        setSaveState("saved");
        debugMenuPerf("sync-sections:done", {
          requestSeq,
          sections: rebuilt.length,
          needsStateReconcile,
        });
        return savedSource;
      } finally {
        if (inFlightSectionsRef.current === fingerprint) {
          inFlightSectionsRef.current = null;
        }
        debugMenuPerf("sync-sections:finally", { requestSeq });
      }
    },
    [api, isALaCarte, menuId],
  );

  useEffect(() => {
    if (!hydrated || !menuId || step < 1) return;
    if (lastSavedBasicsRef.current === basicsFingerprint || inFlightBasicsRef.current === basicsFingerprint) return;

    if (basicsTimerRef.current) window.clearTimeout(basicsTimerRef.current);
    basicsTimerRef.current = window.setTimeout(() => {
      void patchBasics({ payload: basicsPayload, fingerprint: basicsFingerprint });
    }, 500);

    return () => {
      if (basicsTimerRef.current) window.clearTimeout(basicsTimerRef.current);
    };
  }, [basicsFingerprint, basicsPayload, hydrated, menuId, patchBasics, step]);

  useEffect(() => {
    if (!hydrated || !menuId || step < 2) return;
    if (lastSavedSectionsRef.current === sectionsFingerprint || inFlightSectionsRef.current === sectionsFingerprint) return;

    const snapshot = sections;
    debugMenuPerf("sync-sections:schedule", {
      menuId,
      step,
      sections: snapshot.length,
      fingerprint: sectionsFingerprint.slice(0, 18),
    });

    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await syncSectionsAndDishes({ sectionsSnapshot: snapshot, fingerprint: sectionsFingerprint });
        } catch (e) {
          setSaveState("error");
          pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo guardar" });
        }
      })();
    }, 700);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [hydrated, menuId, pushToast, sections, sectionsFingerprint, step, syncSectionsAndDishes]);

  const createDraftAndContinue = useCallback(async () => {
    setBusy(true);
    try {
      const created = await api.menus.gruposV2.createDraft({ menu_type: menuType });
      if (!created.success) throw new Error(created.message || "No se pudo crear borrador");

      const loaded = await api.menus.gruposV2.get(created.menu_id);
      if (!loaded.success) throw new Error(loaded.message || "No se pudo cargar borrador");

      const mapped = mapApiMenu(loaded.menu);
      const mappedIsALaCarte = mapped.menuType === "a_la_carte" || mapped.menuType === "a_la_carte_group";
      setMenuId(created.menu_id);
      setTitle(mapped.title);
      setPrice(mapped.price || "0");
      setActive(mapped.active);
      setSubtitles(mapped.subtitles.length ? mapped.subtitles : [""]);
      setShowDishImages(mapped.showDishImages);
      setSections(mapped.sections);
      setMenuAITracker(buildMenuAITracker(loaded.menu, mapped.sections));
      setIncludedCoffee(mapped.settings.included_coffee);
      setBeverageType(mapped.settings.beverage.type);
      setBeveragePrice(mapped.settings.beverage.price_per_person == null ? "" : String(mapped.settings.beverage.price_per_person));
      setBeverageHasSupplement(mapped.settings.beverage.has_supplement);
      setBeverageSupplementPrice(mapped.settings.beverage.supplement_price == null ? "" : String(mapped.settings.beverage.supplement_price));
      setMinPartySize(String(mapped.settings.min_party_size));
      setMainLimit(mapped.settings.main_dishes_limit);
      setMainLimitNum(String(mapped.settings.main_dishes_limit_number));
      setComments(mapped.settings.comments.length ? mapped.settings.comments : [""]);

      const mappedBasicsPayload = buildBasicsPayload({
        title: mapped.title,
        price: mapped.price || "0",
        active: mapped.active,
        menuType: mapped.menuType,
        subtitles: mapped.subtitles.length ? mapped.subtitles : [""],
        showDishImages: mapped.showDishImages,
        includedCoffee: mapped.settings.included_coffee,
        beverageType: mapped.settings.beverage.type,
        beveragePrice: mapped.settings.beverage.price_per_person == null ? "" : String(mapped.settings.beverage.price_per_person),
        beverageHasSupplement: mapped.settings.beverage.has_supplement,
        beverageSupplementPrice: mapped.settings.beverage.supplement_price == null ? "" : String(mapped.settings.beverage.supplement_price),
        comments: mapped.settings.comments.length ? mapped.settings.comments : [""],
        minPartySize: String(mapped.settings.min_party_size),
        mainLimit: mapped.settings.main_dishes_limit,
        mainLimitNum: String(mapped.settings.main_dishes_limit_number),
      });
      lastSavedBasicsRef.current = JSON.stringify(mappedBasicsPayload);
      inFlightBasicsRef.current = null;
      lastSavedSectionsRef.current = getSectionsFingerprint(mapped.sections);
      lastSavedSectionsStructureRef.current = getSectionsStructureFingerprint(mapped.sections);
      lastSavedSectionDishesRef.current = getSectionsDishFingerprintMap(mapped.sections);
      lastSavedSectionDishSyncRef.current = getSectionsDishSyncStateMap(mapped.sections, mappedIsALaCarte);
      inFlightSectionsRef.current = null;
      syncRequestSeqRef.current = 0;
      setSaveState("idle");

      window.history.replaceState({}, "", `/app/menus/crear?menuId=${created.menu_id}`);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear borrador");
    } finally {
      setBusy(false);
    }
  }, [api, menuType]);

  const openMenuTypeModal = useCallback(() => {
    setMenuTypePendingValue(menuType || "closed_conventional");
    setMenuTypeModalOpen(true);
  }, [menuType]);

  const closeMenuTypeModal = useCallback(() => {
    if (menuTypeChanging) return;
    setMenuTypeModalOpen(false);
    setMenuTypePendingValue(menuType || "closed_conventional");
  }, [menuType, menuTypeChanging]);

  const confirmMenuTypeChange = useCallback(async () => {
    if (!menuId) return;

    const previousType = menuType || "closed_conventional";
    const requestedType = menuTypePendingValue || previousType;
    if (requestedType === previousType) {
      closeMenuTypeModal();
      return;
    }

    setMenuTypeChanging(true);
    setMenuType(requestedType);

    try {
      const res = await api.menus.gruposV2.patchMenuType(menuId, requestedType);
      if (!res.success) {
        throw new Error(res.message || "No se pudo cambiar el tipo de menu");
      }

      const savedType = res.menu_type || requestedType;
      setMenuType(savedType);
      setMenuTypePendingValue(savedType);
      setMenuTypeModalOpen(false);
      pushToast({ kind: "success", title: "Tipo actualizado" });
    } catch (error) {
      setMenuType(previousType);
      setMenuTypePendingValue(previousType);
      pushToast({
        kind: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "No se pudo cambiar el tipo de menu",
      });
    } finally {
      setMenuTypeChanging(false);
    }
  }, [api, closeMenuTypeModal, menuId, menuType, menuTypePendingValue, pushToast]);

  const handleMenuTypePendingChange = useCallback((value: string) => {
    setMenuTypePendingValue(value);
  }, []);

  const addSection = useCallback(() => {
    setSections((prev) => [
      ...prev,
      {
        clientId: uid("section"),
        title: "Nueva seccion",
        kind: "custom",
        position: prev.length,
        dishes: [],
        expanded: true,
      },
    ]);
  }, []);

  const removeSection = useCallback((clientId: string) => {
    setSections((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((s) => s.clientId !== clientId).map((s, i) => ({ ...s, position: i }));
    });
  }, []);

  const updateSection = useCallback((clientId: string, patch: Partial<EditorSection>) => {
    setSections((prev) => {
      let changed = false;
      const next = prev.map((sec) => {
        if (sec.clientId !== clientId) return sec;
        for (const [k, v] of Object.entries(patch) as Array<[keyof EditorSection, EditorSection[keyof EditorSection]]>) {
          if (!Object.is(sec[k], v)) {
            changed = true;
            return { ...sec, ...patch };
          }
        }
        return sec;
      });
      return changed ? next : prev;
    });
  }, []);

  const moveSection = useCallback((from: number, to: number) => {
    if (from === to) return;
    setSections((prev) => {
      if (from < 0 || from >= prev.length || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return withSectionPositions(next);
    });
  }, []);

  const reorderSections = useCallback((orderedClientIds: string[]) => {
    setSections((prev) => {
      if (orderedClientIds.length === prev.length && prev.every((section, idx) => section.clientId === orderedClientIds[idx])) {
        return prev;
      }
      return withSectionPositions(orderByClientId(prev, orderedClientIds));
    });
  }, []);

  const addDish = useCallback((sectionClientId: string, fromCatalog?: DishCatalogItem) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        const dish: EditorDish = {
          clientId: uid("dish"),
          id: undefined,
          catalog_dish_id: fromCatalog?.id,
          title: fromCatalog?.title || "Nuevo plato",
          description: fromCatalog?.description || "",
          description_enabled: (fromCatalog?.description || "").trim().length > 0,
          allergens: fromCatalog?.allergens || [],
          supplement_enabled: fromCatalog?.default_supplement_enabled || false,
          supplement_price: fromCatalog?.default_supplement_price ?? null,
          price: isALaCarte ? 0 : null,
          active: true,
          position: sec.dishes.length,
          foto_url: fromCatalog?.foto_url || fromCatalog?.image_url,
          ai_requested: false,
          ai_generating: false,
          ai_generated_img: null,
        };
        return { ...sec, dishes: [...sec.dishes, dish] };
      }),
    );
  }, [isALaCarte]);

  const updateDish = useCallback((sectionClientId: string, dishClientId: string, patch: Partial<EditorDish>) => {
    setSections((prev) => {
      let changed = false;
      const next = prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;

        let dishChanged = false;
        const dishes = sec.dishes.map((dish) => {
          if (dish.clientId !== dishClientId) return dish;
          for (const [k, v] of Object.entries(patch) as Array<[keyof EditorDish, EditorDish[keyof EditorDish]]>) {
            if (!Object.is(dish[k], v)) {
              dishChanged = true;
              return { ...dish, ...patch };
            }
          }
          return dish;
        });

        if (!dishChanged) return sec;
        changed = true;
        return { ...sec, dishes };
      });
      return changed ? next : prev;
    });
  }, []);

  const removeDish = useCallback((sectionClientId: string, dishClientId: string) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        return {
          ...sec,
          dishes: sec.dishes
            .filter((dish) => dish.clientId !== dishClientId)
            .map((dish, idx) => ({ ...dish, position: idx })),
        };
      }),
    );
  }, []);

  const reorderDishes = useCallback((sectionClientId: string, orderedClientIds: string[]) => {
    setSections((prev) =>
      prev.map((sec) => {
        if (sec.clientId !== sectionClientId) return sec;
        if (orderedClientIds.length === sec.dishes.length && sec.dishes.every((dish, idx) => dish.clientId === orderedClientIds[idx])) {
          return sec;
        }
        return {
          ...sec,
          dishes: withDishPositions(orderByClientId(sec.dishes, orderedClientIds)),
        };
      }),
    );
  }, []);

  const handleSearch = useCallback(
    (sectionClientId: string, term: string) => {
      setSearchTerms((prev) => ({ ...prev, [sectionClientId]: term }));

      const existing = searchTimerRef.current[sectionClientId];
      if (existing) window.clearTimeout(existing);

      if (term.trim().length < 2) {
        setSearchResults((prev) => ({ ...prev, [sectionClientId]: [] }));
        return;
      }

      searchTimerRef.current[sectionClientId] = window.setTimeout(() => {
        void (async () => {
          const res = await api.menus.dishesCatalog.search(term.trim(), 8);
          if (!res.success) return;
          setSearchResults((prev) => ({ ...prev, [sectionClientId]: res.items }));
        })();
      }, 240);
    },
    [api],
  );

  const closeDishImageAdvisor = useCallback((opts?: { keepTarget?: boolean }) => {
    logMenuAITrace("advisor:close", { keepTarget: !!opts?.keepTarget });
    setDishImageAdvisorDraft((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
    setDishImageAdvisorBusy(false);
    if (!opts?.keepTarget) {
      setDishImageTarget(null);
    }
  }, []);

  const closeDishImageCropper = useCallback((opts?: { keepTarget?: boolean }) => {
    logMenuAITrace("cropper:close", { keepTarget: !!opts?.keepTarget });
    setDishImageCropDraft((prev) => {
      if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
      return null;
    });
    setDishImageBusy(false);
    if (!opts?.keepTarget) {
      setDishImageTarget(null);
    }
  }, []);

  const resolvePersistedDishTarget = useCallback(
    async (
      target: { sectionClientId: string; dishClientId: string },
    ): Promise<{ section: PersistedEditorSection; dish: PersistedEditorDish }> => {
      logMenuAITrace("resolvePersistedDishTarget:start", {
        sectionClientId: target.sectionClientId,
        dishClientId: target.dishClientId,
      });
      let latestSections = sectionsRef.current;
      let section = latestSections.find((row) => row.clientId === target.sectionClientId);
      let dish = section?.dishes.find((row) => row.clientId === target.dishClientId);
      if (!section || !dish) {
        throw new Error("No se encontro el plato seleccionado");
      }

      if (!section.id || !dish.id) {
        const synced = await syncSectionsAndDishes({
          sectionsSnapshot: latestSections,
          fingerprint: getSectionsFingerprint(latestSections),
          force: true,
        });
        if (Array.isArray(synced)) latestSections = synced;
        section = latestSections.find((row) => row.clientId === target.sectionClientId);
        dish = section?.dishes.find((row) => row.clientId === target.dishClientId);
      }

      if (!section?.id || !dish?.id) {
        logMenuAITrace("resolvePersistedDishTarget:missing-id", {
          sectionClientId: target.sectionClientId,
          dishClientId: target.dishClientId,
        });
        throw new Error("Guarda el plato antes de subir la imagen");
      }

      logMenuAITrace("resolvePersistedDishTarget:ok", {
        sectionId: section.id,
        dishId: dish.id,
      });
      return {
        section: section as PersistedEditorSection,
        dish: dish as PersistedEditorDish,
      };
    },
    [syncSectionsAndDishes],
  );

  const moveDishImageAdvisorToCrop = useCallback(() => {
    logMenuAITrace("advisor:continue-without-ai");
    setDishImageAdvisorDraft((advisorDraft) => {
      if (!advisorDraft) return null;
      setDishImageCropDraft((prevCrop) => {
        if (prevCrop?.objectUrl && prevCrop.objectUrl !== advisorDraft.objectUrl) {
          URL.revokeObjectURL(prevCrop.objectUrl);
        }
        return advisorDraft;
      });
      return null;
    });
    setDishImageAdvisorBusy(false);
  }, []);

  const requestMenuAITrackerSync = useCallback(() => {
    const ws = menuAIWSSocketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN || !menuId) {
      logMenuAITrace("ws:sync:skipped", {
        menuId,
        hasSocket: !!ws,
        readyState: ws?.readyState ?? null,
      });
      return;
    }
    try {
      ws.send(JSON.stringify({ type: "sync", menuId }));
      logMenuAITrace("ws:sync:sent", { menuId });
    } catch {
      logMenuAITrace("ws:sync:send-error", { menuId });
      // Ignore transient websocket send errors.
    }
  }, [menuId]);

  const pickDishImage = useCallback((sectionClientId: string, dishClientId: string) => {
    logMenuAITrace("pickDishImage", { sectionClientId, dishClientId });
    setDishImageTarget({ sectionClientId, dishClientId });
    const input = dishImageInputRef.current;
    if (!input) return;
    input.value = "";
    input.click();
  }, []);

  const onDishImageFileSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file || !dishImageTarget) return;
      logMenuAITrace("image:selected", {
        sectionClientId: dishImageTarget.sectionClientId,
        dishClientId: dishImageTarget.dishClientId,
        fileName: file.name,
        fileType: file.type,
        fileBytes: file.size,
      });

      if (!isSupportedDishImageFile(file)) {
        pushToast({ kind: "error", title: "Error", message: "Formato no soportado. Usa JPG, PNG, WEBP o GIF." });
        return;
      }
      if (file.size > MAX_DISH_IMAGE_INPUT_BYTES) {
        pushToast({ kind: "error", title: "Error", message: "La imagen excede 15MB." });
        return;
      }

      const nextTarget = { ...dishImageTarget };
      setDishImageAdvisorBusy(true);
      closeDishImageCropper({ keepTarget: true });
      closeDishImageAdvisor({ keepTarget: true });

      void (async () => {
        try {
          logMenuAITrace("image:preprocess:start", {
            maxKB: DISH_IMAGE_AI_MAX_KB,
          });
          const preprocessed = await preprocessDishImageToWebp(file, DISH_IMAGE_AI_MAX_KB);
          const objectUrl = URL.createObjectURL(preprocessed);
          logMenuAITrace("image:preprocess:done", {
            outputType: preprocessed.type,
            outputBytes: preprocessed.size,
            sectionClientId: nextTarget.sectionClientId,
            dishClientId: nextTarget.dishClientId,
          });
          setDishImageAdvisorDraft((prev) => {
            if (prev?.objectUrl) URL.revokeObjectURL(prev.objectUrl);
            return {
              sectionClientId: nextTarget.sectionClientId,
              dishClientId: nextTarget.dishClientId,
              file: preprocessed,
              objectUrl,
            };
          });
        } catch (error) {
          logMenuAITrace("image:preprocess:error", {
            message: error instanceof Error ? error.message : "unknown",
          });
          pushToast({
            kind: "error",
            title: "Error",
            message: error instanceof Error ? error.message : "No se pudo procesar la imagen",
          });
          setDishImageTarget(null);
        } finally {
          setDishImageAdvisorBusy(false);
        }
      })();
    },
    [closeDishImageAdvisor, closeDishImageCropper, dishImageTarget, pushToast],
  );

  const onDishImageAdvisorImprove = useCallback(async () => {
    if (!dishImageAdvisorDraft || !menuId) return;
    const draft = dishImageAdvisorDraft;
    logMenuAITrace("advisor:improve:click", {
      menuId,
      sectionClientId: draft.sectionClientId,
      dishClientId: draft.dishClientId,
      fileBytes: draft.file.size,
      fileType: draft.file.type,
    });
    setDishImageAdvisorBusy(true);
    let targetDishId: number | null = null;
    try {
      const { section, dish } = await resolvePersistedDishTarget({
        sectionClientId: draft.sectionClientId,
        dishClientId: draft.dishClientId,
      });
      targetDishId = dish.id;

      applyDishAIState(dish.id, {
        ai_requested: true,
        ai_generating: true,
      });
      logMenuAITrace("advisor:improve:request:start", {
        menuId,
        sectionId: section.id,
        dishId: dish.id,
      });

      const res = await api.menus.gruposV2.uploadSectionDishImageAI(menuId, section.id, dish.id, draft.file);
      if (!res.success) {
        logMenuAITrace("advisor:improve:request:failed", {
          menuId,
          sectionId: section.id,
          dishId: dish.id,
          message: res.message || "unknown",
        });
        throw new Error(res.message || "No se pudo iniciar la mejora con IA");
      }
      logMenuAITrace("advisor:improve:request:accepted", {
        menuId,
        sectionId: section.id,
        dishId: dish.id,
      });

      closeDishImageAdvisor();
      requestMenuAITrackerSync();
      pushToast({
        kind: "success",
        title: "Mejora iniciada",
        message: "La imagen se esta procesando con IA en segundo plano.",
      });
    } catch (error) {
      logMenuAITrace("advisor:improve:error", {
        targetDishId,
        message: error instanceof Error ? error.message : "unknown",
      });
      if (targetDishId) {
        applyDishAIState(targetDishId, { ai_generating: false });
      }
      pushToast({
        kind: "error",
        title: "Error",
        message: error instanceof Error ? error.message : "No se pudo iniciar la mejora con IA",
      });
    } finally {
      setDishImageAdvisorBusy(false);
    }
  }, [
    api,
    applyDishAIState,
    closeDishImageAdvisor,
    dishImageAdvisorDraft,
    menuId,
    pushToast,
    requestMenuAITrackerSync,
    resolvePersistedDishTarget,
  ]);

  const onDishImageCropConfirm = useCallback(
    async (crop: DishImageCropConfirm) => {
      if (!dishImageCropDraft || !menuId) return;
      logMenuAITrace("crop:confirm:start", {
        menuId,
        sectionClientId: dishImageCropDraft.sectionClientId,
        dishClientId: dishImageCropDraft.dishClientId,
      });
      setDishImageBusy(true);

      try {
        const webpFile = await cropSquareImageToWebp(dishImageCropDraft.file, {
          ...crop,
          outputSizePx: 1024,
          maxSizeKB: 150,
        });
        const { section, dish } = await resolvePersistedDishTarget({
          sectionClientId: dishImageCropDraft.sectionClientId,
          dishClientId: dishImageCropDraft.dishClientId,
        });
        logMenuAITrace("crop:confirm:upload:start", {
          menuId,
          sectionId: section.id,
          dishId: dish.id,
          webpBytes: webpFile.size,
        });

        const res = await api.menus.gruposV2.uploadSectionDishImage(menuId, section.id, dish.id, webpFile);
        if (!res.success) throw new Error(res.message || "No se pudo subir la imagen");
        logMenuAITrace("crop:confirm:upload:done", {
          menuId,
          sectionId: section.id,
          dishId: dish.id,
          foto_url: res.dish?.foto_url || res.dish?.image_url || null,
        });

        updateDish(dishImageCropDraft.sectionClientId, dishImageCropDraft.dishClientId, {
          foto_url: res.dish?.foto_url || res.dish?.image_url || undefined,
        });
        closeDishImageCropper();
        pushToast({
          kind: "success",
          title: "Imagen actualizada",
          message: `Imagen optimizada (${Math.max(1, Math.round(webpFile.size / 1024))}KB)`,
        });
      } catch (error) {
        logMenuAITrace("crop:confirm:error", {
          message: error instanceof Error ? error.message : "unknown",
        });
        pushToast({
          kind: "error",
          title: "Error",
          message: error instanceof Error ? error.message : "No se pudo actualizar la imagen",
        });
      } finally {
        setDishImageBusy(false);
      }
    },
    [api, closeDishImageCropper, dishImageCropDraft, menuId, pushToast, resolvePersistedDishTarget, updateDish],
  );

  const onPublish = useCallback(async () => {
    if (!menuId) return;
    setBusy(true);
    try {
      await patchBasics({ payload: basicsPayload, fingerprint: basicsFingerprint, force: true });
      await syncSectionsAndDishes({ sectionsSnapshot: sections, fingerprint: sectionsFingerprint, force: true });
      const res = await api.menus.gruposV2.publish(menuId);
      if (!res.success) throw new Error(res.message || "No se pudo publicar");
      pushToast({ kind: "success", title: "Menu guardado" });
      window.location.href = "/app/menus";
    } catch (e) {
      pushToast({ kind: "error", title: "Error", message: e instanceof Error ? e.message : "No se pudo publicar" });
    } finally {
      setBusy(false);
    }
  }, [api, basicsFingerprint, basicsPayload, menuId, patchBasics, pushToast, sections, sectionsFingerprint, syncSectionsAndDishes]);

  return (
    <section className="bo-menuWizardPage" aria-label="Editor de menu">
      <div className="bo-menuWizardTop">
        <button className="bo-btn bo-btn--ghost" type="button" onClick={() => (window.location.href = "/app/menus")}>
          <ArrowLeft size={16} /> Volver a menus
        </button>
        <div className={`bo-saveTag is-${saveState}`}>{saveState === "saving" ? "Guardando..." : saveState === "saved" ? "Guardado" : saveState === "error" ? "Error guardando" : ""}</div>
      </div>

      <div className="bo-stepBars" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}>
        {steps.map((idx) => (
          <div key={idx} className={`bo-stepBar ${idx === step ? "is-active" : ""} ${idx < step ? "is-done" : ""}`} />
        ))}
      </div>

      {step === 0 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Tipo de menu</h2>
          <p className="bo-typeIntro">Elige una base para empezar. Luego podras editar todos los detalles del menu.</p>
          <div className="bo-typeGrid">
            {MENU_TYPES.map((opt) => {
              const Icon = opt.icon;
              const isSelected = menuType === opt.value;

              return (
                <button
                  key={opt.value}
                  className={`bo-typeCard bo-menuGlassPanel ${isSelected ? "is-selected" : ""}`}
                  type="button"
                  disabled={!opt.enabled || busy}
                  onClick={() => setMenuType(opt.value)}
                  aria-pressed={isSelected}
                >
                  <div className="bo-typeCardTop">
                    <div className="bo-typeIconWrap" aria-hidden="true">
                      <Icon size={18} />
                    </div>
                    <div className={`bo-typeState ${isSelected ? "is-selected" : ""}`}>
                      {isSelected ? <Check size={13} /> : null}
                      {isSelected ? "Seleccionado" : "Plantilla"}
                    </div>
                  </div>
                  <div className="bo-typeTitle">{opt.label}</div>
                  <div className="bo-typeDesc">{opt.description}</div>
                  <div className="bo-typeHint">{opt.hint}</div>
                  {!opt.enabled ? <div className="bo-typeSoon">Proximamente</div> : null}
                </button>
              );
            })}
          </div>
          <div className="bo-menuWizardActions bo-menuWizardActions--right">
            <button className="bo-btn bo-btn--primary" type="button" disabled={busy} onClick={() => void createDraftAndContinue()}>
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Datos basicos</h2>
          <div className="bo-form bo-form--menuWizard bo-form--menuWizardBasics">
            <div className={`bo-menuBasicsMainRow ${hasSecondaryBasicsField ? "" : "is-single"}`}>
              <div className="bo-field bo-menuBasicsField bo-menuBasicsField--title">
                <div className="bo-label">Titulo</div>
                <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>

              {!isALaCarte && !isSpecial ? (
                <div className="bo-field bo-menuBasicsField bo-menuBasicsField--price">
                  <div className="bo-label">Precio</div>
                  <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                </div>
              ) : null}

              {isSpecial ? (
                <div className="bo-field bo-menuBasicsField bo-menuBasicsPriceToggle">
                  <div className="bo-label">¿Tiene precio fijo?</div>
                  <Switch checked={!!Number(price)} onCheckedChange={(checked) => setPrice(checked ? "0" : "")} />
                  {Number(price) > 0 ? (
                    <input
                      className="bo-input bo-menuBasicsPriceInput"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      inputMode="decimal"
                      placeholder="Precio"
                    />
                  ) : null}
                </div>
              ) : null}
            </div>

            {!isSpecial ? (
              <div className="bo-field bo-field--full">
                <div className="bo-label">Subtitulos</div>
                <div className="bo-stackFields">
                  {subtitles.map((line, idx) => (
                    <div key={`subtitle-${idx}`} className="bo-inlineField">
                      <input
                        className="bo-input"
                        value={line}
                        onChange={(e) => {
                          const next = [...subtitles];
                          next[idx] = e.target.value;
                          setSubtitles(next);
                        }}
                      />
                      <button
                        className="bo-btn bo-btn--ghost bo-inlineFieldIconBtn"
                        type="button"
                        aria-label={`Eliminar subtitulo ${idx + 1}`}
                        disabled={subtitles.length <= 1}
                        onClick={() => setSubtitles((prev) => prev.filter((_, i) => i !== idx))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button className="bo-btn bo-btn--ghost bo-btn--sm bo-subtitleAddBtn" type="button" onClick={() => setSubtitles((prev) => [...prev, ""])}>
                    <Plus size={14} /> Añadir subtitulo
                  </button>
                </div>
              </div>
            ) : null}

            <div className="bo-menuBasicsSwitchRow">
              <button
                className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass bo-menuV2IconBtn"
                type="button"
                disabled={!menuId || busy || menuTypeChanging}
                onClick={openMenuTypeModal}
                aria-label="Cambiar tipo de menu"
                title="Cambiar tipo"
              >
                <Repeat2 size={14} aria-hidden="true" focusable={false} />
              </button>
            </div>

            <div className="bo-menuBasicsSwitchRow">
              <label className="bo-menuBasicsActiveToggle">
                <span className="bo-label">Activo</span>
                <Switch checked={active} onCheckedChange={setActive} />
                <span className="bo-mutedText">{active ? "Activo" : "No activo"}</span>
              </label>
            </div>
          </div>

          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(0)}>
              Volver
            </button>
            <button
              className="bo-btn bo-btn--primary"
              type="button"
              onClick={() => {
                if (!title.trim()) {
                  pushToast({ kind: "error", title: "Titulo", message: "El titulo es obligatorio" });
                  return;
                }
                if (isSpecial) {
                  setStep(4);
                } else {
                  setStep(2);
                }
              }}
            >
              Continuar
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Secciones del menu</h2>

          <Reorder.Group axis="y" values={sectionOrder} onReorder={reorderSections} className="bo-sectionsBoard bo-reorderGroup">
            {sections.map((sec, idx) => (
              <ReorderItemContainer
                key={sec.clientId}
                as="div"
                value={sec.clientId}
                className="bo-sectionCard bo-reorderItem"
                transition={reorderTransition}
                whileDrag={reorderWhileDrag}
              >
                {(startDrag) => (
                  <div className="bo-sectionCardHead">
                    <div className="bo-sectionReorder">
                      <div className="bo-sectionMoveControls">
                        <motion.button
                          className="bo-sectionMoveBtn"
                          type="button"
                          aria-label={`Subir seccion ${sec.title || idx + 1}`}
                          disabled={idx === 0}
                          whileHover={chevronHover}
                          whileTap={chevronTapUp}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => moveSection(idx, idx - 1)}
                        >
                          <ChevronUp size={14} />
                        </motion.button>
                        <motion.button
                          className="bo-sectionMoveBtn"
                          type="button"
                          aria-label={`Bajar seccion ${sec.title || idx + 1}`}
                          disabled={idx === sections.length - 1}
                          whileHover={chevronHover}
                          whileTap={chevronTapDown}
                          onPointerDown={(event) => event.stopPropagation()}
                          onClick={() => moveSection(idx, idx + 1)}
                        >
                          <ChevronDown size={14} />
                        </motion.button>
                      </div>
                      <button
                        className="bo-sectionDrag"
                        type="button"
                        aria-label={`Arrastrar seccion ${sec.title || idx + 1}`}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          startDrag(event);
                        }}
                      >
                        <GripVertical size={18} />
                      </button>
                    </div>
                    <input className="bo-input" value={sec.title} onChange={(e) => updateSection(sec.clientId, { title: e.target.value })} />
                    <button
                      className="bo-btn bo-btn--ghost"
                      type="button"
                      aria-label={`Eliminar seccion ${sec.title || idx + 1}`}
                      disabled={sections.length <= 1}
                      onClick={() => removeSection(sec.clientId)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </ReorderItemContainer>
            ))}
          </Reorder.Group>

          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={addSection}>
              <Plus size={14} /> Añadir seccion
            </button>
            <div className="bo-menuWizardActionsRight">
              <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)}>
                Volver
              </button>
              <button className="bo-btn bo-btn--primary" type="button" onClick={() => setStep(3)}>
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div
          className={[
            "bo-menuWizardFinal",
            desktopPreviewOpen ? "is-previewOpen" : "is-previewHidden",
            desktopPreviewDocked ? "" : "is-previewUndocked",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="bo-previewDesktopSwitch">
            <span className="bo-previewDesktopSwitchLabel">
              <Eye size={14} aria-hidden="true" />
              Preview web
            </span>
            <Switch
              checked={desktopPreviewOpen}
              onCheckedChange={setDesktopPreviewOpen}
              aria-label={desktopPreviewOpen ? "Ocultar preview web" : "Mostrar preview web"}
            />
          </div>

          <div className="bo-previewSwitchGlass">
            <button className={`bo-previewSwitchBtn ${mobileTab === "editor" ? "is-active" : ""}`} type="button" onClick={() => setMobileTab("editor")}>
              <span>Editor</span>
            </button>
            <button className={`bo-previewSwitchBtn ${mobileTab === "preview" ? "is-active" : ""}`} type="button" onClick={() => setMobileTab("preview")}>
              <span>Preview</span>
            </button>
          </div>

          <motion.div layout transition={paneLayoutTransition} className={`bo-editorPane ${mobileTab === "editor" ? "is-mobileActive" : ""}`}>
            <motion.div layout transition={paneLayoutTransition} className="bo-panel bo-menuEditorHead">
              <div className="bo-panelHead">
                <div>
                  <div className="bo-panelTitle">Editor de menu</div>
                  <div className="bo-panelMeta">Titulo, subtitulos, precio y estado siguen editables</div>
                </div>
              </div>
              <div className="bo-panelBody bo-form bo-form--menuWizard bo-form--menuWizardBasics">
                <div className={`bo-menuBasicsMainRow ${hasSecondaryBasicsField ? "" : "is-single"}`}>
                  <div className="bo-field bo-menuBasicsField bo-menuBasicsField--title">
                    <div className="bo-label">Titulo</div>
                    <input className="bo-input" value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  {!isALaCarte && !isSpecial ? (
                    <div className="bo-field bo-menuBasicsField bo-menuBasicsField--price">
                      <div className="bo-label">Precio</div>
                      <input className="bo-input" value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
                    </div>
                  ) : null}
                  {isSpecial ? (
                    <div className="bo-field bo-menuBasicsField bo-menuBasicsPriceToggle">
                      <div className="bo-label">¿Tiene precio fijo?</div>
                      <Switch checked={!!Number(price)} onCheckedChange={(checked) => setPrice(checked ? "0" : "")} />
                      {Number(price) > 0 ? (
                        <input
                          className="bo-input bo-menuBasicsPriceInput"
                          value={price}
                          onChange={(e) => setPrice(e.target.value)}
                          inputMode="decimal"
                          placeholder="Precio"
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
                {!isSpecial ? (
                  <div className="bo-field bo-field--full">
                    <div className="bo-label">Subtitulos</div>
                    <div className="bo-stackFields">
                      {subtitles.map((line, idx) => (
                        <div key={`subtitle-final-${idx}`} className="bo-inlineField">
                          <input
                            className="bo-input"
                            value={line}
                            onChange={(e) => {
                              const next = [...subtitles];
                              next[idx] = e.target.value;
                              setSubtitles(next);
                            }}
                          />
                          <button
                            className="bo-btn bo-btn--ghost bo-inlineFieldIconBtn"
                            type="button"
                            aria-label={`Eliminar subtitulo ${idx + 1}`}
                            disabled={subtitles.length <= 1}
                            onClick={() => setSubtitles((prev) => prev.filter((_, i) => i !== idx))}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))}
                      <button className="bo-btn bo-btn--ghost bo-btn--sm bo-subtitleAddBtn" type="button" onClick={() => setSubtitles((prev) => [...prev, ""])}>
                        <Plus size={14} /> Añadir subtitulo
                      </button>
                    </div>
                  </div>
                ) : null}
                <div className="bo-field">
                  <div className="bo-label">Visibilidad de platos</div>
                  <Select
                    className="bo-menuSettingSelect"
                    value={showDishImages ? "with_image" : "without_image"}
                    onChange={(value) => setShowDishImages(value === "with_image")}
                    options={dishVisibilityOptions}
                    size="sm"
                    ariaLabel="Visibilidad de platos en preview"
                  />
                </div>
                <div className="bo-menuBasicsSwitchRow">
                  <button
                    className="bo-btn bo-btn--ghost bo-btn--sm bo-btn--glass bo-menuV2IconBtn"
                    type="button"
                    disabled={!menuId || busy || menuTypeChanging}
                    onClick={openMenuTypeModal}
                    aria-label="Cambiar tipo de menu"
                    title="Cambiar tipo"
                  >
                    <Repeat2 size={14} aria-hidden="true" focusable={false} />
                  </button>
                </div>
                <div className="bo-menuBasicsSwitchRow">
                  <label className="bo-menuBasicsActiveToggle">
                    <span className="bo-label">Activo</span>
                    <Switch checked={active} onCheckedChange={setActive} />
                    <span className="bo-mutedText">{active ? "Activo" : "No activo"}</span>
                  </label>
                </div>
              </div>
            </motion.div>

            {!hydrated ? (
              <div className="bo-sectionsEditor" aria-live="polite" aria-busy="true">
                {loadingSectionTitles.map((sectionTitle, idx) => (
                  <div key={`section-loading-${idx}`} className="bo-panel bo-accordionSection">
                    <div className="bo-panelHead">
                      <div className="bo-panelTitle">{sectionTitle}</div>
                    </div>
                    <div className="bo-panelBody">
                      <LoadingSpinner centered size="sm" label="Cargando platos..." />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Reorder.Group axis="y" values={sectionOrder} onReorder={reorderSections} className="bo-sectionsEditor bo-reorderGroup">
              {sections.map((sec, secIdx) => (
                <MenuSectionEditorPanel
                  key={sec.clientId}
                  sec={sec}
                  secIdx={secIdx}
                  sectionsCount={sections.length}
                  isALaCarte={isALaCarte}
                  reorderTransition={reorderTransition}
                  reorderWhileDrag={reorderWhileDrag}
                  chevronHover={chevronHover}
                  chevronTapUp={chevronTapUp}
                  chevronTapDown={chevronTapDown}
                  moveSection={moveSection}
                  updateSection={updateSection}
                  reorderDishes={reorderDishes}
                  setAllergenModal={setAllergenModal}
                  removeDish={removeDish}
                  updateDish={updateDish}
                  pickDishImage={pickDishImage}
                  addDish={addDish}
                  handleSearch={handleSearch}
                  searchTerm={searchTerms[sec.clientId] || ""}
                  searchItems={searchResults[sec.clientId] ?? EMPTY_SEARCH_RESULTS}
                />
              ))}
              </Reorder.Group>
            )}

            <motion.div layout transition={paneLayoutTransition} className="bo-panel bo-settingsPanel">
              <div className="bo-panelHead">
                <div className="bo-panelTitle">
                  <Settings2 size={15} /> Configuracion
                </div>
              </div>
              <div className="bo-panelBody bo-form bo-form--menuWizard">
                <div className="bo-field">
                  <div className="bo-label">Bebida</div>
                  <Select
                    className="bo-menuSettingSelect"
                    value={beverageType}
                    onChange={setBeverageType}
                    options={beverageTypeOptions}
                    size="sm"
                    ariaLabel="Tipo de bebida"
                  />
                </div>

                {beverageType !== "no_incluida" ? (
                  <div className="bo-field">
                    <div className="bo-label">Precio por persona</div>
                    <input className="bo-input" value={beveragePrice} onChange={(e) => setBeveragePrice(e.target.value)} inputMode="decimal" />
                  </div>
                ) : null}

                {beverageType === "ilimitada" ? (
                  <>
                    <div className="bo-field">
                      <div className="bo-label">Tiene suplemento</div>
                      <Switch checked={beverageHasSupplement} onCheckedChange={setBeverageHasSupplement} />
                    </div>
                    {beverageHasSupplement ? (
                      <div className="bo-field">
                        <div className="bo-label">Valor suplemento</div>
                        <input
                          className="bo-input"
                          value={beverageSupplementPrice}
                          onChange={(e) => setBeverageSupplementPrice(e.target.value)}
                          inputMode="decimal"
                        />
                      </div>
                    ) : null}
                  </>
                ) : null}

                <div className="bo-field">
                  <div className="bo-label">Minimo personas para reservar</div>
                  <input className="bo-input" value={minPartySize} onChange={(e) => setMinPartySize(e.target.value)} inputMode="numeric" />
                </div>

                <div className="bo-field">
                  <div className="bo-label">Limite maximo de principales por mesa</div>
                  <Switch checked={mainLimit} onCheckedChange={setMainLimit} />
                </div>

                {mainLimit ? (
                  <div className="bo-field">
                    <div className="bo-label">Numero de principales</div>
                    <input className="bo-input" value={mainLimitNum} onChange={(e) => setMainLimitNum(e.target.value)} inputMode="numeric" />
                  </div>
                ) : null}

                <div className="bo-field">
                  <div className="bo-label">Cafe incluido</div>
                  <Switch checked={includedCoffee} onCheckedChange={setIncludedCoffee} />
                </div>

                <div className="bo-field bo-field--full">
                  <div className="bo-label">Comentarios</div>
                  <div className="bo-stackFields">
                    {comments.map((line, idx) => (
                      <div key={`comment-${idx}`} className="bo-inlineField">
                        <input
                          className="bo-input"
                          value={line}
                          onChange={(e) => {
                            const next = [...comments];
                            next[idx] = e.target.value;
                            setComments(next);
                          }}
                        />
                        <button
                          className="bo-btn bo-btn--ghost"
                          type="button"
                          aria-label={`Eliminar comentario ${idx + 1}`}
                          disabled={comments.length <= 1}
                          onClick={() => setComments((prev) => prev.filter((_, i) => i !== idx))}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                    <button className="bo-btn bo-btn--ghost bo-commentAddBtn" type="button" onClick={() => setComments((prev) => [...prev, ""])}>
                      <Plus size={14} /> Añadir comentario
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              layout
              transition={paneLayoutTransition}
              className="bo-menuWizardActions bo-menuWizardActions--final bo-menuWizardActions--iconOnlyInline"
            >
              <button
                className="bo-btn bo-btn--ghost bo-btn--sm bo-menuFinalIconBtn"
                type="button"
                aria-label="Volver al paso de secciones"
                onClick={() => setStep(2)}
                disabled={busy}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                className="bo-btn bo-btn--primary bo-btn--sm bo-menuFinalIconBtn"
                type="button"
                aria-label="Añadir menu"
                onClick={() => void onPublish()}
                disabled={busy}
              >
                <Check size={16} />
              </button>
            </motion.div>
          </motion.div>

          <aside className={`bo-previewPane ${mobileTab === "preview" ? "is-mobileActive" : ""}`}>
            <div className="bo-previewHead">
              <div>
                <div className="bo-panelTitle">Preview web</div>
                <div className="bo-panelMeta">
                  {previewNeedsUpgrade
                    ? "Activa premium para desbloquear plantillas"
                    : "Plantilla web asignada en configuracion"}
                </div>
              </div>
              <div className="bo-previewThemeSummary">
                <span className={`bo-chip bo-menuOriginChip ${previewNeedsUpgrade ? "" : "is-on"}`}>
                  {previewNeedsUpgrade ? "Sin plantilla asignada" : previewThemeLabel}
                </span>
              </div>
            </div>
            {previewThemeLoading ? (
              <div className="bo-previewLoading" role="status" aria-live="polite">
                <LoadingSpinner size="lg" label="Cargando plantilla" />
                <span>Cargando plantilla del restaurante...</span>
              </div>
            ) : previewNeedsUpgrade ? (
              <section className="bo-previewUpgrade" aria-label="Upgrade premium">
                <div className="bo-previewUpgradeAura bo-previewUpgradeAura--one" aria-hidden="true" />
                <div className="bo-previewUpgradeAura bo-previewUpgradeAura--two" aria-hidden="true" />
                <div className="bo-previewUpgradeAura bo-previewUpgradeAura--three" aria-hidden="true" />
                <div className="bo-previewUpgradeBadge">Premium</div>
                <h3 className="bo-previewUpgradeTitle">Desbloquea la web de menus premium</h3>
                <p className="bo-previewUpgradeText">
                  Este restaurante todavia no tiene una plantilla web asignada. Activa la suscripcion premium para mostrar
                  el preview en tiempo real con el tema elegido.
                </p>
                <div className="bo-previewUpgradeActions" aria-label="Acciones premium">
                  <button className="bo-previewUpgradeBtn bo-previewUpgradeBtn--primary" type="button" aria-label="Accion principal de upgrade" />
                  <button className="bo-previewUpgradeBtn" type="button" aria-label="Accion secundaria de upgrade" />
                </div>
              </section>
            ) : (
              <iframe
                ref={previewFrameRef}
                className="bo-previewFrame"
                title="Preview menu"
                src={previewUrl}
                onLoad={() => {
                  const win = previewFrameRef.current?.contentWindow;
                  if (!win) return;
                  win.postMessage(
                    {
                      type: "vc_preview:init",
                      theme_id: previewThemeId,
                      menu_type: menuType || "closed_conventional",
                      menu: previewMenuPayload,
                    },
                    "*",
                  );
                }}
              />
            )}
          </aside>
        </div>
      ) : null}

      <input
        ref={dishImageInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="bo-hiddenFileInput"
        onChange={onDishImageFileSelected}
      />

      <DishImageAdvisorModal
        open={!!dishImageAdvisorDraft}
        imageUrl={dishImageAdvisorDraft?.objectUrl || ""}
        imageKB={dishImageAdvisorPreviewKB}
        busy={dishImageAdvisorBusy}
        onClose={() => closeDishImageAdvisor()}
        onContinueWithoutAI={moveDishImageAdvisorToCrop}
        onImproveWithAI={() => void onDishImageAdvisorImprove()}
      />

      <DishImageCropModal
        open={!!dishImageCropDraft}
        imageUrl={dishImageCropDraft?.objectUrl || ""}
        busy={dishImageBusy}
        onClose={() => closeDishImageCropper()}
        onConfirm={(payload) => void onDishImageCropConfirm(payload)}
      />

      <Modal open={!!allergenModal?.open} title="Alergenos" onClose={() => setAllergenModal(null)} widthPx={620}>
        <div className="bo-modalHead">
          <div className="bo-modalTitle">Selecciona alergenos</div>
          <button className="bo-modalX" type="button" onClick={() => setAllergenModal(null)} aria-label="Cerrar">
            ×
          </button>
        </div>
        <div className="bo-modalBody">
          <div className="bo-allergenGrid">
            {ALLERGENS.map((item) => {
              const open = allergenModal;
              if (!open) return null;
              const sec = sections.find((s) => s.clientId === open.sectionClientId);
              const dish = sec?.dishes.find((d) => d.clientId === open.dishClientId);
              const selected = !!dish?.allergens.includes(item.key);
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`bo-allergenCircle ${selected ? "is-selected" : ""}`}
                  onClick={() => {
                    if (!dish) return;
                    const set = new Set(dish.allergens);
                    if (set.has(item.key)) set.delete(item.key);
                    else set.add(item.key);
                    updateDish(open.sectionClientId, open.dishClientId, { allergens: Array.from(set) });
                  }}
                >
                  <span className="bo-allergenCircleIcon"><Icon size={16} /></span>
                  <span className="bo-allergenCircleLabel">{item.key}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>

      <MenuTypeChangeModal
        open={menuTypeModalOpen}
        title="Cambiar tipo de menu"
        currentType={menuType || "closed_conventional"}
        nextType={menuTypePendingValue}
        saving={menuTypeChanging}
        onClose={closeMenuTypeModal}
        onNextTypeChange={handleMenuTypePendingChange}
        onConfirm={() => void confirmMenuTypeChange()}
      />

      {step === 4 && isSpecial ? (
        <div className="bo-menuWizardPanel">
          <h2 className="bo-sectionTitle">Imagen del menu</h2>
          <p className="bo-mutedText" style={{ marginBottom: 16 }}>
            Sube una imagen del menu especial (PDF, Word, imagen)
          </p>

          <div className="bo-specialImageUpload">
            {specialMenuImage ? (
              <div className="bo-specialImagePreview">
                <img src={specialMenuImage} alt="Menu especial" />
                <button
                  className="bo-btn bo-btn--ghost bo-btn--danger"
                  type="button"
                  onClick={() => setSpecialMenuImage(null)}
                >
                  <Trash2 size={14} /> Eliminar
                </button>
              </div>
            ) : (
              <div className="bo-specialImageDropzone">
                <Upload size={48} />
                <p>Arrastra una imagen o haz clic para seleccionar</p>
                <p className="bo-mutedText">PDF, Word, PNG, JPG hasta 10MB</p>
                <input
                  type="file"
                  accept="image/*,.pdf,.doc,.docx,.txt"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      // TODO: Handle file upload
                      setSpecialMenuImage(URL.createObjectURL(file));
                    }
                  }}
                />
              </div>
            )}
          </div>

          <div className="bo-menuWizardActions">
            <button className="bo-btn bo-btn--ghost" type="button" onClick={() => setStep(1)}>
              Volver
            </button>
            <button className="bo-btn bo-btn--primary" type="button" onClick={() => setStep(3)}>
              Continuar al editor
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
