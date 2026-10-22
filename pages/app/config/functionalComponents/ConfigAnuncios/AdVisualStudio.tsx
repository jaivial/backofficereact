// Coordination id: ads_visual_studio_v1 - Chrome-devtools-like responsive
// studio for canvas ads. The ad is edited on top of the REAL website iframe
// (the plugin/popover production context) inside a device viewport whose width
// can be preset or dragged: crossing the shared breakpoints
// (ads_canvas_breakpoints_v1) switches the edited variant live, exactly like
// the public popover resolves it for a visitor.
// Coordination id: ads_canvas_safezone_v1 - the edit overlay draws the public
// popover chips (Cerrar / Volver) where the visitor sees them, so a title or
// image is never placed under them.
// Coordination id: ads_canvas_handles_v1 - the selected element gets 8 resize
// handles whose hit area stays constant on screen whatever the canvas zoom.
// Coordination id: ads_preview_live_v1 - the background site iframe reloads
// only after a save lands (refreshToken), never on every keystroke.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";
import type { RestaurantAdCanvas, RestaurantAdCanvasBackground, RestaurantAdCanvasElement, RestaurantAdCanvasVariant } from "../../../../../api/types";
import { adPreviewOrigin, canvasElementDraftReason, isCanvasHttpURL } from "./lib/adEditor";

type Props = {
  canvas: RestaurantAdCanvas;
  adId: number;
  stepId?: string;
  adName: string;
  website: string;
  /** Which public face this document renders: the wizard card or the open ad. */
  surface?: "card" | "detail";
  /** Bumped by the editor after each successful save: refreshes the site iframe. */
  refreshToken?: number;
  disabled?: boolean;
  onChange: (canvas: RestaurantAdCanvas) => void;
};

type VariantName = "desktop" | "tablet" | "mobile";

type HandleDir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

type DragState =
  | { kind: "move"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: "container"; startX: number; startY: number; origW: number; origH: number; scale: number }
  | { kind: "resize"; id: string; dir: HandleDir; startX: number; startY: number; origX: number; origY: number; origW: number; origH: number };

const MIN_SIZE = 12;

const HANDLE_DIRS: HandleDir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

// Responsive breakpoints (coord id ads_canvas_breakpoints_v1) - mirror of the
// backend resolver (internal/api/ads_canvas.go) and the preact popover.
const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

function variantForWidth(vw: number): VariantName {
  if (vw > 0 && vw < MOBILE_BREAKPOINT) return "mobile";
  if (vw > 0 && vw < TABLET_BREAKPOINT) return "tablet";
  return "desktop";
}

// Popover geometry (coord id ads_container_geometry_v1) - mirror of the preact
// site CSS (.publicAdOverlay / .publicAdModal / .publicAdCanvasFrame in
// frontend/src/index.css). The edit overlay replicates it so what you drag is
// pixel-aligned with what the visitor sees at the same viewport width.
const POPOVER = {
  overlayPad: 20,
  modalPadX: 0,
  modalPadY: 0,
  // The wizard card face renders INSIDE the classic modal: 24/22px modal
  // padding plus the 16px inline card padding the public list adds per card.
  cardModalPadX: 22,
  cardModalPadY: 24,
  cardPad: 16,
  // Modal default width of the public list view (no --vc-ad-modal-max there).
  cardModalMax: 560,
  modalDefaultRadius: 24,
  modalMaxHeightPct: 0.8,
} as const;

const DEVICES = [
  { id: "desktop", label: "Escritorio", width: 1440, height: 900, icon: Monitor },
  { id: "tablet", label: "Tablet", width: 834, height: 1024, icon: Tablet },
  { id: "mobile", label: "Móvil", width: 390, height: 844, icon: Smartphone },
] as const;

type DeviceId = (typeof DEVICES)[number]["id"];

const TYPE_LABEL: Record<RestaurantAdCanvasElement["type"], string> = {
  text: "Texto",
  image: "Imagen",
  button: "Botón",
  shape: "Forma",
};

const VARIANT_LABEL: Record<VariantName, string> = { desktop: "Escritorio", tablet: "Tablet", mobile: "Móvil" };

/** Resolved document for a breakpoint (mirrors backend adCanvasViewFor). */
type ResolvedDoc = {
  width: number;
  height: number;
  background: RestaurantAdCanvasBackground;
  elements: RestaurantAdCanvasElement[];
};

function resolveDoc(c: RestaurantAdCanvas, variant: VariantName): ResolvedDoc {
  const doc: ResolvedDoc = { width: c.width, height: c.height, background: c.background, elements: c.elements };
  if (variant === "desktop") return doc;
  const v = c.variants?.[variant];
  if (!v) return doc;
  if (v.width > 0) doc.width = v.width;
  if (v.height > 0) doc.height = v.height;
  if (v.background) doc.background = v.background;
  if (v.elements) doc.elements = v.elements;
  return doc;
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Uniformly scales one element (geometry + size-driven props) by k. */
function scaleElement(el: RestaurantAdCanvasElement, k: number): RestaurantAdCanvasElement {
  const props = { ...(el.props as Record<string, unknown>) };
  for (const key of ["fontSize", "lineHeight", "radius", "strokeWidth"]) {
    if (typeof props[key] === "number") props[key] = round1((props[key] as number) * k);
  }
  return { ...el, x: round1(el.x * k), y: round1(el.y * k), w: round1(el.w * k), h: round1(el.h * k), props };
}

/** Materializes an inherited variant as a scaled copy of the base doc so that,
 * at the popover frame width it was created for, 1 canvas px ≈ 1 screen px. */
function scaleDocToWidth(base: RestaurantAdCanvas, targetWidth: number): RestaurantAdCanvasVariant {
  const k = targetWidth / base.width;
  return {
    width: Math.max(100, Math.round(base.width * k)),
    height: Math.max(100, Math.round(base.height * k)),
    background: { ...base.background },
    elements: base.elements.map((el) => scaleElement(el, k)),
  };
}

function defaultElement(type: RestaurantAdCanvasElement["type"], doc: ResolvedDoc, z: number, src = ""): RestaurantAdCanvasElement {
  const cx = doc.width / 2;
  const cy = doc.height / 2;
  if (type === "text") {
    return { id: nextId("txt"), type, x: cx - 200, y: cy - 40, w: 400, h: 80, z, props: { text: "Nuevo texto", fontSize: 36, color: "#111111", align: "center", bold: false, italic: false } };
  }
  if (type === "image") {
    return { id: nextId("img"), type, x: cx - 150, y: cy - 100, w: 300, h: 200, z, props: { src, fit: "cover", radius: 0, alt: "" } };
  }
  if (type === "button") {
    return { id: nextId("btn"), type, x: cx - 100, y: cy - 28, w: 200, h: 56, z, props: { text: "Reservar", href: "/", bg: "#c9a86a", color: "#1a2e22", radius: 28, fontSize: 20, bold: true, newTab: false } };
  }
  return { id: nextId("shp"), type, x: cx - 120, y: cy - 80, w: 240, h: 160, z, props: { shape: "rect", fill: "#f0e6d2", stroke: "", strokeWidth: 0, radius: 12, opacity: 1 } };
}

/** Short layers-list label: the text itself or the element kind. */
function elementLayerName(el: RestaurantAdCanvasElement): string {
  const props = (el.props ?? {}) as Record<string, unknown>;
  if (el.type === "text" || el.type === "button") {
    const text = String(props.text ?? "").replace(/\s+/g, " ").trim();
    return text.length > 20 ? `${text.slice(0, 20)}...` : text || "(sin texto)";
  }
  if (el.type === "image") return isCanvasHttpURL(props.src) ? "Imagen" : "Imagen en borrador";
  return String(props.shape) === "ellipse" ? "Elipse" : "Rectángulo";
}

export function AdVisualStudio({ canvas, adId, adName, website, stepId, surface = "detail", refreshToken = 0, disabled, onChange }: Props) {
  const [device, setDevice] = useState<DeviceId>("mobile");
  const [viewport, setViewport] = useState<{ width: number; height: number }>({ width: DEVICES[2].width, height: DEVICES[2].height });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Inline text editing (double click): the caret lives on the element itself.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // +Imagen collects a valid URL first; an image without src is rejected by the
  // API, so it would be kept as a draft (ads_draft_image_guard_v1) instead.
  const [imgDraft, setImgDraft] = useState<string | null>(null);
  const imgDraftValid = imgDraft !== null && /^https?:\/\/\S+$/i.test(imgDraft.trim());
  const dragRef = useRef<DragState | null>(null);
  const widthDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [wrapSize, setWrapSize] = useState({ width: 0, height: 0 });

  const activeVariant = variantForWidth(viewport.width);
  const variant = activeVariant === "desktop" ? undefined : canvas.variants?.[activeVariant];
  const view = useMemo(() => resolveDoc(canvas, activeVariant), [canvas, activeVariant]);
  const container = { ...canvas.container, ...variant?.container };
  // ads_container_geometry_v1 - by default the popover hugs the edited canvas
  // (1 canvas px = 1 screen px); an explicit container.maxWidth caps it. The
  // wizard card face renders inside the classic modal, so its frame is inset
  // by the modal and card paddings and shows at public scale.
  const isCardSurface = surface === "card";
  const frameInsetX = isCardSurface ? POPOVER.cardModalPadX + POPOVER.cardPad : POPOVER.modalPadX;
  const modalMax = isCardSurface
    ? Math.min(POPOVER.cardModalMax, container.maxWidth || POPOVER.cardModalMax)
    : container.maxWidth || view.width + 2 * POPOVER.modalPadX;
  const frameWidth = Math.max(
    100,
    Math.min(modalMax, viewport.width - 2 * POPOVER.overlayPad) - 2 * frameInsetX,
  );
  // ads_canvas_handles_v1 (BIZ-79.1, H1): FRAME_BREATHE is the gutter the frame
  // keeps around the stage so the -8px edge handles render inside the frame's
  // own (clean) border-box clip. The stage is scaled to FIT that content box on
  // both axes and centred by the frame's flex, so the canvas never overruns it.
  const FRAME_BREATHE = 14;
  const frameHeight = (frameWidth * view.height) / view.width;
  const canvasScale = Math.max(
    0.05,
    Math.min(
      (frameWidth - 2 * FRAME_BREATHE) / view.width,
      (frameHeight - 2 * FRAME_BREATHE) / view.height,
    ),
  );
  const selected = useMemo(() => view.elements.find((el) => el.id === selectedId) || null, [view.elements, selectedId]);
  const sorted = useMemo(() => [...view.elements].sort((a, b) => (a.z || 0) - (b.z || 0)), [view.elements]);

  // Fit-zoom of the device viewport inside the studio column.
  useEffect(() => {
    const node = wrapRef.current;
    if (!node) return;
    const compute = () => setWrapSize({ width: node.clientWidth, height: node.clientHeight });
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const fit = useMemo(() => {
    if (!wrapSize.width || !wrapSize.height) return 0.5;
    return Math.min(1, (wrapSize.width - 24) / viewport.width, (wrapSize.height - 24) / viewport.height);
  }, [viewport, wrapSize]);

  // Live site iframe (ads_preview_live_v1): refreshes ONLY after a save lands,
  // so editing never unloads the production context mid-work and the popover
  // state inside the iframe survives the whole edit.
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    setReloadKey((key) => key + 1);
  }, [refreshToken]);

  const update = useCallback(
    (mutate: (draft: RestaurantAdCanvas) => void) => {
      const draft: RestaurantAdCanvas = JSON.parse(JSON.stringify(canvas));
      mutate(draft);
      onChange(draft);
    },
    [canvas, onChange],
  );

  /** Materializes the active variant on first edit (uniform-scale copy). */
  const ensureVariant = useCallback(
    (draft: RestaurantAdCanvas): RestaurantAdCanvasVariant => {
      const name = activeVariant as Exclude<VariantName, "desktop">;
      const existing = draft.variants?.[name];
      if (existing) return existing;
      const created = scaleDocToWidth(draft, frameWidth);
      if (!draft.variants) draft.variants = {};
      draft.variants[name] = created;
      return created;
    },
    [activeVariant, frameWidth],
  );

  /** Routes a document edit to the active breakpoint doc (base or variant). */
  const updateDoc = useCallback(
    (fn: (doc: ResolvedDoc) => void) => {
      update((draft) => {
        if (activeVariant === "desktop") {
          fn(draft);
          return;
        }
        const v = ensureVariant(draft);
        const doc: ResolvedDoc = {
          width: v.width || draft.width,
          height: v.height || draft.height,
          background: v.background ?? draft.background,
          elements: v.elements ?? draft.elements,
        };
        fn(doc);
        v.width = doc.width;
        v.height = doc.height;
        v.background = doc.background;
        v.elements = doc.elements;
      });
    },
    [activeVariant, ensureVariant, update],
  );

  const updateContainer = useCallback((patch: Partial<NonNullable<RestaurantAdCanvas["container"]>>) => {
    update((draft) => {
      if (activeVariant === "desktop") draft.container = { ...draft.container, ...patch };
      else { const v = ensureVariant(draft); v.container = { ...draft.container, ...v.container, ...patch }; }
    });
  }, [activeVariant, update, ensureVariant]);

  const updateElement = useCallback(
    (id: string, patch: Partial<RestaurantAdCanvasElement> & { props?: Record<string, unknown> }) => {
      updateDoc((doc) => {
        const el = doc.elements.find((item) => item.id === id);
        if (!el) return;
        if (patch.props) el.props = { ...el.props, ...patch.props };
        const { props: _ignored, ...rest } = patch;
        Object.assign(el, rest);
      });
    },
    [updateDoc],
  );

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };
      const rect = stage.getBoundingClientRect();
      const scale = rect.width / view.width;
      return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    },
    [view.width],
  );

  const onElementPointerDown = useCallback(
    (event: React.PointerEvent, el: RestaurantAdCanvasElement) => {
      if (disabled) return;
      if (editingId === el.id) return; // the inline editor owns the pointer
      event.stopPropagation();
      event.preventDefault();
      setSelectedId(el.id);
      const pt = toCanvasPoint(event.clientX, event.clientY);
      dragRef.current = { kind: "move", id: el.id, startX: pt.x, startY: pt.y, origX: el.x, origY: el.y };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [disabled, editingId, toCanvasPoint],
  );

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent, el: RestaurantAdCanvasElement, dir: HandleDir) => {
      if (disabled) return;
      event.stopPropagation();
      event.preventDefault();
      const pt = toCanvasPoint(event.clientX, event.clientY);
      dragRef.current = { kind: "resize", id: el.id, dir, startX: pt.x, startY: pt.y, origX: el.x, origY: el.y, origW: el.w, origH: el.h };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [disabled, toCanvasPoint],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pt = toCanvasPoint(event.clientX, event.clientY);
      if (drag.kind === "container") {
        updateDoc((doc) => { doc.width = Math.max(100, Math.min(4096, Math.round(drag.origW + (event.clientX - drag.startX) / drag.scale))); doc.height = Math.max(100, Math.min(4096, Math.round(drag.origH + (event.clientY - drag.startY) / drag.scale))); });
      } else if (drag.kind === "move") {
        // ads_canvas_handles_v1: clamp x/y to the document so the clip-margin
        // that keeps the edge handles visible can't let CONTENT be dragged
        // outside the canvas (the -8px handles may still overhang by design).
        const target = view.elements.find((item) => item.id === drag.id);
        const maxX = target ? Math.max(0, view.width - target.w) : view.width;
        const maxY = target ? Math.max(0, view.height - target.h) : view.height;
        const nextX = drag.origX + (pt.x - drag.startX);
        const nextY = drag.origY + (pt.y - drag.startY);
        updateElement(drag.id, {
          x: Math.round(Math.min(Math.max(0, nextX), maxX)),
          y: Math.round(Math.min(Math.max(0, nextY), maxY)),
        });
      } else {
        // ads_canvas_handles_v1: every handle grows from the opposite corner
        // or edge, clamped to the minimum size without drifting.
        const dx = pt.x - drag.startX;
        const dy = pt.y - drag.startY;
        let { origX: x, origY: y, origW: w, origH: h } = drag;
        if (drag.dir.includes("e")) w = drag.origW + dx;
        if (drag.dir.includes("s")) h = drag.origH + dy;
        if (drag.dir.includes("w")) { w = drag.origW - dx; x = drag.origX + dx; }
        if (drag.dir.includes("n")) { h = drag.origH - dy; y = drag.origY + dy; }
        if (w < MIN_SIZE) { if (drag.dir.includes("w")) x = drag.origX + drag.origW - MIN_SIZE; w = MIN_SIZE; }
        if (h < MIN_SIZE) { if (drag.dir.includes("n")) y = drag.origY + drag.origH - MIN_SIZE; h = MIN_SIZE; }
        updateElement(drag.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
      }
    },
    [toCanvasPoint, updateElement, updateDoc, view],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const addElement = useCallback(
    (type: RestaurantAdCanvasElement["type"], src = "") => {
      const z = view.elements.reduce((acc, el) => Math.max(acc, el.z || 0), 0) + 1;
      let id = "";
      updateDoc((doc) => {
        const el = defaultElement(type, doc, z, src);
        const k = Math.min(1, (doc.width - 24) / el.w, (doc.height - 24) / el.h);
        const sized = scaleElement(el, Math.max(0.1, k));
        sized.x = Math.max(0, (doc.width - sized.w) / 2);
        sized.y = Math.max(0, (doc.height - sized.h) / 2);
        doc.elements.push(sized);
        id = sized.id;
      });
      setSelectedId(id);
    },
    [updateDoc, view],
  );

  const removeElement = useCallback(
    (id: string) => {
      updateDoc((doc) => {
        doc.elements = doc.elements.filter((el) => el.id !== id);
      });
      setSelectedId(null);
      setEditingId(null);
    },
    [updateDoc],
  );

  const duplicateElement = useCallback(
    (id: string) => {
      let copyId = "";
      updateDoc((doc) => {
        const index = doc.elements.findIndex((el) => el.id === id);
        if (index < 0) return;
        const source = doc.elements[index];
        const copy: RestaurantAdCanvasElement = {
          ...JSON.parse(JSON.stringify(source)),
          id: nextId(source.type.slice(0, 3)),
          x: source.x + 16,
          y: source.y + 16,
          z: doc.elements.reduce((acc, el) => Math.max(acc, el.z || 0), 0) + 1,
        };
        doc.elements.push(copy);
        copyId = copy.id;
      });
      if (copyId) setSelectedId(copyId);
    },
    [updateDoc],
  );

  const reorder = useCallback(
    (id: string, dir: 1 | -1) => {
      updateDoc((doc) => {
        const el = doc.elements.find((item) => item.id === id);
        if (!el) return;
        el.z = (el.z || 0) + dir;
      });
    },
    [updateDoc],
  );

  /** Drops the active variant so the breakpoint inherits the base doc again. */
  const resetVariant = useCallback(() => {
    update((draft) => {
      if (!draft.variants) return;
      delete draft.variants[activeVariant as Exclude<VariantName, "desktop">];
      if (!draft.variants.tablet && !draft.variants.mobile) delete draft.variants;
    });
    setSelectedId(null);
  }, [activeVariant, update]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selectedId || disabled) return;
      if (event.key === "Escape") { setEditingId(null); return; }
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      removeElement(selectedId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, disabled, removeElement]);

  const applyDevice = useCallback((id: DeviceId) => {
    const preset = DEVICES.find((entry) => entry.id === id) ?? DEVICES[0];
    setDevice(id);
    setViewport({ width: preset.width, height: preset.height });
  }, []);

  const rotate = useCallback(() => {
    setViewport((current) => ({ width: current.height, height: current.width }));
  }, []);

  // Responsive width drag (devtools-style): pointer deltas are in screen px,
  // the viewport box is rendered scaled by `fit`.
  const onWidthHandleDown = useCallback(
    (event: React.PointerEvent) => {
      event.preventDefault();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      widthDragRef.current = { startX: event.clientX, startWidth: viewport.width };
    },
    [viewport.width],
  );
  const onWidthHandleMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = widthDragRef.current;
      if (!drag || fit <= 0) return;
      const next = Math.min(1920, Math.max(240, Math.round(drag.startWidth + (event.clientX - drag.startX) / fit)));
      setViewport((current) => (next === current.width ? current : { ...current, width: next }));
    },
    [fit],
  );

  const siteURL = website && adId > 0 ? `${adPreviewOrigin(website)}/?vc_ad=${adId}&vc_preview=1${stepId ? `&vc_step=${encodeURIComponent(stepId)}` : ""}&_r=${reloadKey}` : "";

  return (
    <div className="bo-adstudioRoot" data-testid="ad-visual-studio" data-coord-id="ads_visual_studio_v1">
      <div className="bo-adstudioToolbar" role="toolbar" aria-label="Herramientas del estudio visual" data-testid="ad-studio-toolbar">
        <button type="button" disabled={disabled} onClick={() => addElement("text")} data-testid="ad-studio-add-text">+ Texto</button>
        <button type="button" disabled={disabled} onClick={() => setImgDraft(imgDraft === null ? "" : null)} data-testid="ad-studio-add-image">+ Imagen</button>
        {imgDraft !== null ? (
          <span className="bo-adstudioField" data-testid="ad-studio-image-draft">
            <input
              type="url"
              autoFocus
              disabled={disabled}
              value={imgDraft}
              onChange={(e) => setImgDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && imgDraftValid) { addElement("image", imgDraft.trim()); setImgDraft(null); } }}
              placeholder="https://cdn.../imagen.webp"
              aria-label="URL de la imagen"
              data-testid="ad-studio-image-url"
              style={{ fontSize: 16 }}
            />
            <button type="button" disabled={disabled || !imgDraftValid} onClick={() => { addElement("image", imgDraft.trim()); setImgDraft(null); }} data-testid="ad-studio-image-insert">Insertar</button>
            <button type="button" onClick={() => setImgDraft(null)} data-testid="ad-studio-image-cancel">Cancelar</button>
          </span>
        ) : null}
        <button type="button" disabled={disabled} onClick={() => addElement("button")} data-testid="ad-studio-add-button">+ Botón</button>
        <button type="button" disabled={disabled} onClick={() => addElement("shape")} data-testid="ad-studio-add-shape">+ Forma</button>
        <span className="bo-adcanvasSpacer" />
        <label className="bo-adstudioField">
          {"Lienzo "}
          <input
            type="number"
            min={100}
            max={4096}
            disabled={disabled}
            value={view.width}
            aria-label="Ancho del lienzo"
            data-testid="ad-studio-canvas-width"
            onChange={(event) => updateDoc((doc) => { doc.width = Math.max(100, Math.min(4096, Number(event.target.value) || doc.width)); })}
          />
          {"× "}
          <input
            type="number"
            min={100}
            max={4096}
            disabled={disabled}
            value={view.height}
            aria-label="Alto del lienzo"
            data-testid="ad-studio-canvas-height"
            onChange={(event) => updateDoc((doc) => { doc.height = Math.max(100, Math.min(4096, Number(event.target.value) || doc.height)); })}
          />
        </label>
        <label className="bo-adstudioField">
          {" Fondo "}
          <select
            disabled={disabled}
            value={view.background.type}
            aria-label="Tipo de fondo"
            data-testid="ad-studio-bg-type"
            onChange={(event) => updateDoc((doc) => { doc.background = { ...doc.background, type: event.target.value as "color" | "image" }; })}
          >
            <option value="color">Color</option>
            <option value="image">Imagen</option>
          </select>
        </label>
        {view.background.type === "color" ? (
          <input
            type="color"
            disabled={disabled}
            aria-label="Color de fondo"
            data-testid="ad-studio-bg-color"
            value={/^#[0-9a-fA-F]{6}$/.test(view.background.value) ? view.background.value : "#ffffff"}
            onChange={(event) => updateDoc((doc) => { doc.background = { ...doc.background, value: event.target.value }; })}
          />
        ) : (
          <input
            type="text"
            placeholder="https://.../fondo.webp"
            disabled={disabled}
            value={view.background.value}
            aria-label="URL del fondo"
            data-testid="ad-studio-bg-image"
            onChange={(event) => updateDoc((doc) => { doc.background = { ...doc.background, value: event.target.value }; })}
            style={{ minWidth: 180 }}
          />
        )}
      </div>

      <div className="bo-adstudioDeviceBar" role="group" aria-label="Viewport responsivo" data-testid="ad-studio-device-bar">
        {DEVICES.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`bo-adstudioDeviceBtn ${device === entry.id ? "is-active" : ""}`}
            aria-pressed={device === entry.id}
            data-testid={`ad-studio-device-${entry.id}`}
            onClick={() => applyDevice(entry.id)}
          >
            <entry.icon size={14} aria-hidden="true" />
            <span>{entry.label}</span>
          </button>
        ))}
        <label className="bo-adstudioField">
          {"Ancho "}
          <input
            type="number"
            min={240}
            max={1920}
            value={viewport.width}
            aria-label="Ancho del viewport"
            data-testid="ad-studio-viewport-width"
            onChange={(event) => {
              const next = Math.max(240, Math.min(1920, Number(event.target.value) || viewport.width));
              setViewport((current) => ({ ...current, width: next }));
            }}
          />
        </label>
        <label className="bo-adstudioField">
          {"Alto "}
          <input
            type="number"
            min={320}
            max={2160}
            value={viewport.height}
            aria-label="Alto del viewport"
            data-testid="ad-studio-viewport-height"
            onChange={(event) => {
              const next = Math.max(320, Math.min(2160, Number(event.target.value) || viewport.height));
              setViewport((current) => ({ ...current, height: next }));
            }}
          />
        </label>
        <button type="button" className="bo-adstudioDeviceBtn" onClick={rotate} aria-label="Rotar viewport" data-testid="ad-studio-rotate" title="Rotar">
          <RotateCw size={14} aria-hidden="true" />
        </button>
        <span className="bo-adcanvasSpacer" />
        <span
          className={`bo-adstudioVariantChip ${variant ? "is-custom" : "is-inherited"}`}
          data-testid="ad-studio-variant-chip"
          data-variant={activeVariant}
          title={variant ? "Este breakpoint tiene su propio diseño" : "Este breakpoint hereda el diseño de escritorio"}
        >
          {VARIANT_LABEL[activeVariant]} · {variant ? "personalizado" : "heredado"}
        </span>
        {variant && activeVariant !== "desktop" ? (
          <button type="button" disabled={disabled} onClick={resetVariant} data-testid="ad-studio-variant-reset" title="Volver a heredar del escritorio">
            Restablecer
          </button>
        ) : null}
      </div>

      <div className="bo-adstudioViewportWrap" ref={wrapRef} data-testid="ad-studio-viewport-wrap">
        <div className="bo-adstudioScaleBox" style={{ width: viewport.width * fit, height: viewport.height * fit }}>
        <div
          className="bo-adstudioViewport"
          style={{ width: viewport.width, height: viewport.height, transform: `scale(${fit})` }}
          data-testid="ad-studio-viewport"
          data-viewport-width={viewport.width}
        >
          {siteURL ? (
            <iframe key={reloadKey} className="bo-adstudioSite" src={siteURL} title={`${adName || "Anuncio"} en la web real`} data-testid="ad-studio-site-iframe" />
          ) : (
            <div className="bo-adstudioSite bo-adstudioSite--empty" data-testid="ad-studio-site-empty">
              Sin website configurado: edita sobre el contenedor real del anuncio.
            </div>
          )}
          {/* Edit overlay: mirrors .publicAdOverlay/.publicAdModal (ads_container_geometry_v1). */}
          <div
            className="bo-adstudioOverlayMock"
            style={{ padding: POPOVER.overlayPad, background: container.overlay || undefined }}
            onPointerDown={() => setSelectedId(null)}
            data-testid="ad-studio-popover-mock"
            data-surface={surface}
          >
            <div
              className="bo-adstudioModalMock"
              style={{
                width: `min(100%, ${modalMax}px)`,
                maxHeight: `${POPOVER.modalMaxHeightPct * 100}%`,
                borderRadius: container.radius ?? POPOVER.modalDefaultRadius,
                padding: isCardSurface ? `${POPOVER.cardModalPadY}px ${POPOVER.cardModalPadX}px` : 0,
              }}
              data-testid="ad-studio-modal-mock"
            >
              {/* ads_canvas_safezone_v1: the public popover chips, drawn where
                  the visitor sees them so nothing is placed underneath. */}
              <span className="bo-adstudioCloseMock" aria-hidden="true" title="El popover público reserva esta esquina para Cerrar" data-testid="ad-studio-close-mock">×</span>
              {!isCardSurface ? (
                <span className="bo-adstudioBackMock" aria-hidden="true" title="El popover público reserva esta esquina para Volver" data-testid="ad-studio-back-mock" data-coord-id="ads_canvas_safezone_v1">
                  ‹ Volver
                </span>
              ) : null}
              <div
                className={isCardSurface ? "bo-adstudioCardMock" : undefined}
                data-testid={isCardSurface ? "ad-studio-card-mock" : undefined}
              >
                <div
                  className="bo-adstudioFrameMock"
                  style={{ aspectRatio: `${view.width} / ${view.height}` }}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  data-testid="ad-studio-frame-mock"
                  data-canvas-scale={round1(canvasScale * 100)}
                >
                  <div
                    ref={stageRef}
                    className="bo-adcanvasStage"
                    style={{
                      width: view.width,
                      height: view.height,
                      transform: `scale(${canvasScale})`,
                      ["--bo-adcanvas-scale" as string]: String(canvasScale || 1),
                      background:
                        view.background.type === "image" && view.background.value
                          ? `url(${view.background.value}) center/cover`
                          : view.background.value || "#ffffff",
                    }}
                  >
                    <button type="button" aria-label="Redimensionar lienzo" disabled={disabled} data-testid="ad-studio-doc-resize"
                      className="bo-adcanvasDocHandle"
                      onPointerDown={(event) => { event.stopPropagation(); event.preventDefault(); dragRef.current = { kind: "container", startX: event.clientX, startY: event.clientY, origW: view.width, origH: view.height, scale: stageRef.current ? stageRef.current.getBoundingClientRect().width / view.width : 1 }; event.currentTarget.setPointerCapture(event.pointerId); }}>↘</button>
                    {sorted.map((el) => {
                      const isSel = el.id === selectedId;
                      const isEditing = el.id === editingId;
                      return (
                        <div
                          key={el.id}
                          className={`bo-adcanvasEl${isSel ? " is-selected" : ""}${isEditing ? " is-editing" : ""}`}
                          style={{
                            left: el.x,
                            top: el.y,
                            width: el.w,
                            height: el.h,
                            transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                          }}
                          role={isEditing ? undefined : "button"}
                          aria-label={isEditing ? undefined : `${TYPE_LABEL[el.type]}: ${elementLayerName(el)}`}
                          aria-pressed={isEditing ? undefined : isSel}
                          data-node-id={el.id}
                          onPointerDown={(event) => onElementPointerDown(event, el)}
                          onDoubleClick={() => { if (disabled) return; if (el.type === "text" || el.type === "button") { setSelectedId(el.id); setEditingId(el.id); } }}
                        >
                          <CanvasElementPreview el={el} />
                          {isEditing ? (
                            <CanvasInlineEdit el={el} disabled={disabled} onPatch={(text) => updateElement(el.id, { props: { text } })} onDone={() => setEditingId(null)} />
                          ) : null}
                          {isSel && !disabled && !isEditing ? (
                            HANDLE_DIRS.map((dir) => (
                              <span
                                key={dir}
                                className={`bo-adcanvasHandle is-${dir}`}
                                data-testid={`ad-studio-handle-${dir}`}
                                aria-label={`Redimensionar ${dir}`}
                                onPointerDown={(event) => onResizePointerDown(event, el, dir)}
                              />
                            ))
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className="bo-adstudioWidthHandle"
            role="separator"
            aria-orientation="vertical"
            aria-label="Arrastrar para cambiar el ancho"
            data-testid="ad-studio-width-handle"
            onPointerDown={onWidthHandleDown}
            onPointerMove={onWidthHandleMove}
            onPointerUp={() => { widthDragRef.current = null; }}
          />
        </div>
        </div>
      </div>

      <div className="bo-adstudioPanels">
        {selected ? (
          <div className="bo-adcanvasPanel" data-testid="ad-studio-element-panel">
            <div className="bo-adcanvasPanelHead">
              <strong data-testid="ad-studio-panel-type">{TYPE_LABEL[selected.type] ?? selected.type}</strong>
              <span className="bo-adcanvasSpacer" />
              <button type="button" disabled={disabled} onClick={() => reorder(selected.id, 1)} data-testid="ad-studio-layer-up">Subir capa</button>
              <button type="button" disabled={disabled} onClick={() => reorder(selected.id, -1)} data-testid="ad-studio-layer-down">Bajar capa</button>
              <button type="button" disabled={disabled} onClick={() => duplicateElement(selected.id)} data-testid="ad-studio-duplicate">Duplicar</button>
              <button type="button" disabled={disabled} onClick={() => removeElement(selected.id)} data-tone="danger" data-testid="ad-studio-delete">Eliminar</button>
            </div>
            <ElementInspector el={selected} disabled={disabled} onPatch={(props) => updateElement(selected.id, { props })} />
            {(selected.type === "text" || selected.type === "button") && !disabled ? (
              <p className="bo-adcanvasHint" data-testid="ad-studio-inline-edit-hint">Doble clic sobre el elemento en el lienzo para editar su texto directamente.</p>
            ) : null}
          </div>
        ) : null}
        <div className="bo-adcanvasPanel" data-testid="ad-studio-layers-panel" data-coord-id="ads_canvas_layers_v1">
          <div className="bo-adcanvasPanelHead">
            <strong>Capas</strong>
            <span className="bo-adcanvasSpacer" />
            <span className="bo-adcanvasHint" data-testid="ad-studio-layers-count">{sorted.length} elementos · el primero pinta encima</span>
          </div>
          <ul className="bo-adcanvasLayerList" data-testid="ad-studio-layers-list">
            {[...sorted].reverse().map((el) => (
              <li key={el.id}>
                <button
                  type="button"
                  className={`bo-adcanvasLayerRow ${el.id === selectedId ? "is-selected" : ""}`}
                  onClick={() => setSelectedId(el.id === selectedId ? null : el.id)}
                  data-testid={`ad-studio-layer-row-${el.id}`}
                  data-layer-id={el.id}
                >
                  <span className="bo-adcanvasLayerType">{TYPE_LABEL[el.type]}</span>
                  <span className="bo-adcanvasLayerName">{elementLayerName(el)}</span>
                  <span className="bo-adcanvasLayerPos">{`${Math.round(el.x)},${Math.round(el.y)}`}</span>
                </button>
              </li>
            ))}
            {!sorted.length ? <li className="bo-adcanvasHint" data-testid="ad-studio-layers-empty">Sin elementos: añade texto, imagen o botón desde la barra superior.</li> : null}
          </ul>
        </div>
        <div className="bo-adcanvasPanel" data-testid="ad-studio-container-panel">
          <div className="bo-adcanvasPanelHead">
            <strong>Contenedor del anuncio · {DEVICES.find((item) => item.id === device)?.label}</strong>
          </div>
          <div className="bo-adcanvasFields">
            <label>Ancho máx.<input type="number" min={240} max={2000} disabled={disabled} value={container.maxWidth ?? ""} placeholder="auto (lienzo)" data-testid="ad-studio-container-maxwidth"
              onChange={(event) => { const raw = event.target.value; updateContainer({ maxWidth: raw ? Math.max(240, Math.min(2000, Number(raw))) : undefined }); }} /></label>
            <label>Color overlay<input type="text" disabled={disabled} value={container.overlay ?? ""} placeholder="rgba(20,24,21,.58)" data-testid="ad-studio-container-overlay"
              onChange={(event) => updateContainer({ overlay: event.target.value || undefined })} /></label>
            <label>Radio modal<input type="number" min={0} max={96} disabled={disabled} value={container.radius ?? ""} placeholder={String(POPOVER.modalDefaultRadius)} data-testid="ad-studio-container-radius"
              onChange={(event) => { const raw = event.target.value; updateContainer({ radius: raw !== "" ? Math.max(0, Math.min(96, Number(raw))) : undefined }); }} /></label>
          </div>
          <p className="bo-adcanvasHint">Los cambios se guardan para el dispositivo seleccionado. El lienzo no añade padding: coloca tú los márgenes.</p>
        </div>
      </div>
    </div>
  );
}

/** Local copy of adPreviewOrigin lives in lib/adEditor (VITE_AD_PREVIEW_ORIGIN). */

function CanvasElementPreview({ el }: { el: RestaurantAdCanvasElement }) {
  const p = el.props as Record<string, unknown>;
  if (el.type === "text") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          fontSize: Number(p.fontSize) || 16,
          color: String(p.color || "#111"),
          textAlign: (p.align as "left" | "center" | "right") || "left",
          fontWeight: p.bold ? 700 : 400,
          fontStyle: p.italic ? "italic" : "normal",
          overflow: "hidden",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {String(p.text || "")}
      </div>
    );
  }
  if (el.type === "image") {
    const src = String(p.src || "");
    return src ? (
      <img
        src={src}
        alt=""
        draggable={false}
        style={{ width: "100%", height: "100%", objectFit: p.fit === "contain" ? "contain" : "cover", borderRadius: Number(p.radius) || 0, pointerEvents: "none" }}
      />
    ) : (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.08)", color: "#666", fontSize: 14 }}>Sin imagen (borrador)</div>
    );
  }
  if (el.type === "button") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: String(p.bg || "#111"),
          color: String(p.color || "#fff"),
          borderRadius: Number(p.radius) || 0,
          fontSize: Number(p.fontSize) || 16,
          fontWeight: p.bold ? 700 : 400,
        }}
      >
        {String(p.text || "Botón")}
      </div>
    );
  }
  const isEllipse = p.shape === "ellipse";
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: String(p.fill || "transparent"),
        borderRadius: isEllipse ? "50%" : Number(p.radius) || 0,
        border: p.stroke && Number(p.strokeWidth) ? `${Number(p.strokeWidth)}px solid ${String(p.stroke)}` : undefined,
        opacity: typeof p.opacity === "number" && p.opacity > 0 && p.opacity < 1 ? p.opacity : 1,
      }}
    />
  );
}

/** Inline text editing on the canvas itself (double click, ads_canvas_inline_edit_v1). */
function CanvasInlineEdit({
  el,
  disabled,
  onPatch,
  onDone,
}: {
  el: RestaurantAdCanvasElement;
  disabled?: boolean;
  onPatch: (text: string) => void;
  onDone: () => void;
}) {
  const p = el.props as Record<string, unknown>;
  const isButton = el.type === "button";
  return (
    <textarea
      autoFocus
      readOnly={disabled}
      defaultValue={String(p.text ?? "")}
      onChange={(event) => onPatch(event.target.value)}
      onBlur={onDone}
      onKeyDown={(event) => {
        if (event.key === "Escape") { event.preventDefault(); (event.currentTarget as HTMLTextAreaElement).blur(); }
      }}
      onPointerDown={(event) => event.stopPropagation()}
      aria-label={isButton ? "Texto del botón" : "Texto del elemento"}
      data-testid={`ad-studio-inline-edit-${el.id}`}
      className="bo-adcanvasInlineEdit"
      style={{
        fontSize: Number(p.fontSize) || 16,
        color: String(p.color || "#111"),
        textAlign: (p.align as "left" | "center" | "right") || "center",
        fontWeight: p.bold ? 700 : 400,
        fontStyle: p.italic ? "italic" : "normal",
      }}
    />
  );
}

function ElementInspector({ el, disabled, onPatch }: { el: RestaurantAdCanvasElement; disabled?: boolean; onPatch: (props: Record<string, unknown>) => void }) {
  const p = el.props as Record<string, unknown>;
  if (el.type === "text") {
    return (
      <div className="bo-adcanvasFields">
        <label>Texto<textarea disabled={disabled} rows={2} value={String(p.text || "")} onChange={(e) => onPatch({ text: e.target.value })} data-testid="ad-studio-inspector-text" /></label>
        <label>Tamaño<input disabled={disabled} type="number" min={4} max={400} value={Number(p.fontSize) || 16} onChange={(e) => onPatch({ fontSize: Number(e.target.value) })} data-testid="ad-studio-inspector-font-size" /></label>
        <label>Color<input disabled={disabled} type="color" value={String(p.color || "#111111")} onChange={(e) => onPatch({ color: e.target.value })} data-testid="ad-studio-inspector-color" /></label>
        <label>Alinear
          <select disabled={disabled} value={String(p.align || "left")} onChange={(e) => onPatch({ align: e.target.value })} data-testid="ad-studio-inspector-align">
            <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
          </select>
        </label>
        <label><input disabled={disabled} type="checkbox" checked={Boolean(p.bold)} onChange={(e) => onPatch({ bold: e.target.checked })} data-testid="ad-studio-inspector-bold" /> Negrita</label>
        <label><input disabled={disabled} type="checkbox" checked={Boolean(p.italic)} onChange={(e) => onPatch({ italic: e.target.checked })} data-testid="ad-studio-inspector-italic" /> Cursiva</label>
      </div>
    );
  }
  if (el.type === "image") {
    const draftReason = canvasElementDraftReason(el);
    return (
      <div className="bo-adcanvasFields">
        <label>URL imagen<input disabled={disabled} type="text" value={String(p.src || "")} onChange={(e) => onPatch({ src: e.target.value })} placeholder="https://cdn.../imagen.webp" data-testid="ad-studio-inspector-src" />{draftReason ? <small role="alert" data-testid="ad-studio-image-src-warning">Esta imagen queda en borrador (sin URL http(s) válida): no se envía al servidor, pero el resto de cambios sí se guardan.</small> : null}</label>
        <label>Ajuste
          <select disabled={disabled} value={String(p.fit || "cover")} onChange={(e) => onPatch({ fit: e.target.value })} data-testid="ad-studio-inspector-fit">
            <option value="cover">Cubrir</option>
            <option value="contain">Contener</option>
          </select>
        </label>
        <label>Radio<input disabled={disabled} type="number" min={0} max={400} value={Number(p.radius) || 0} onChange={(e) => onPatch({ radius: Number(e.target.value) })} data-testid="ad-studio-inspector-radius" /></label>
        <label>Alt<input disabled={disabled} type="text" value={String(p.alt || "")} onChange={(e) => onPatch({ alt: e.target.value })} data-testid="ad-studio-inspector-alt" /></label>
      </div>
    );
  }
  if (el.type === "button") {
    return (
      <div className="bo-adcanvasFields">
        <label>Texto<input disabled={disabled} type="text" value={String(p.text || "")} onChange={(e) => onPatch({ text: e.target.value })} data-testid="ad-studio-inspector-button-text" />{canvasElementDraftReason(el) ? <small role="alert" data-testid="ad-studio-button-text-warning">Botón en borrador: necesita texto para guardarse.</small> : null}</label>
        <label>Enlace<input disabled={disabled} type="text" value={String(p.href || "")} onChange={(e) => onPatch({ href: e.target.value })} placeholder="/reservas o https://..." data-testid="ad-studio-inspector-href" /></label>
        <label>Fondo<input disabled={disabled} type="color" value={String(p.bg || "#111111")} onChange={(e) => onPatch({ bg: e.target.value })} data-testid="ad-studio-inspector-bg" /></label>
        <label>Texto color<input disabled={disabled} type="color" value={String(p.color || "#ffffff")} onChange={(e) => onPatch({ color: e.target.value })} data-testid="ad-studio-inspector-button-color" /></label>
        <label>Radio<input disabled={disabled} type="number" min={0} max={200} value={Number(p.radius) || 0} onChange={(e) => onPatch({ radius: Number(e.target.value) })} data-testid="ad-studio-inspector-button-radius" /></label>
        <label>Tamaño<input disabled={disabled} type="number" min={4} max={200} value={Number(p.fontSize) || 16} onChange={(e) => onPatch({ fontSize: Number(e.target.value) })} data-testid="ad-studio-inspector-button-font-size" /></label>
        <label><input disabled={disabled} type="checkbox" checked={Boolean(p.bold)} onChange={(e) => onPatch({ bold: e.target.checked })} data-testid="ad-studio-inspector-button-bold" /> Negrita</label>
        <label><input disabled={disabled} type="checkbox" checked={Boolean(p.newTab)} onChange={(e) => onPatch({ newTab: e.target.checked })} data-testid="ad-studio-inspector-newtab" /> Abrir en pestaña nueva</label>
      </div>
    );
  }
  return (
    <div className="bo-adcanvasFields">
      <label>Forma
        <select disabled={disabled} value={String(p.shape || "rect")} onChange={(e) => onPatch({ shape: e.target.value })} data-testid="ad-studio-inspector-shape">
          <option value="rect">Rectángulo</option><option value="ellipse">Elipse</option>
        </select>
      </label>
      <label>Relleno<input disabled={disabled} type="color" value={String(p.fill || "#f0e6d2")} onChange={(e) => onPatch({ fill: e.target.value })} data-testid="ad-studio-inspector-fill" /></label>
      <label>Borde color<input disabled={disabled} type="color" value={String(p.stroke || "#000000")} onChange={(e) => onPatch({ stroke: e.target.value })} data-testid="ad-studio-inspector-stroke" /></label>
      <label>Borde ancho<input disabled={disabled} type="number" min={0} max={40} value={Number(p.strokeWidth) || 0} onChange={(e) => onPatch({ strokeWidth: Number(e.target.value) })} data-testid="ad-studio-inspector-stroke-width" /></label>
      <label>Radio<input disabled={disabled} type="number" min={0} max={400} value={Number(p.radius) || 0} onChange={(e) => onPatch({ radius: Number(e.target.value) })} data-testid="ad-studio-inspector-shape-radius" /></label>
    </div>
  );
}
