import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { EB_ID, findById, isTextElement, type InsertPosition } from "./document";
import { BORDER_PREFLIGHT_CSS, EMAIL_RESET_CSS } from "./css";
import { useBuilderTestId } from "./testIds";

/*
 * Editable canvas of the campaign HTML builder (campaign_html_builder_v1).
 * The design renders inside an iframe at the real width of the device, so its
 * Tailwind breakpoints (sm:/md:) react exactly as in an inbox, and the frame is
 * scaled to fit the panel. Selection, hover and drop indicators are drawn by
 * the parent above the frame (Figma-style), never injected in the design.
 * The frame runs no script: the parent listens to its document.
 */

export type BuilderDevice = "desktop" | "tablet" | "mobile";
export const DEVICE_WIDTH: Record<BuilderDevice, number> = { desktop: 1024, tablet: 768, mobile: 375 };
export const BLOCK_MIME = "application/x-eb-block";
export const MOVE_MIME = "application/x-eb-move";

type Box = { x: number; y: number; w: number; h: number };
type Drop = { box: Box; position: InsertPosition };

export type CanvasDrop = { block?: string; moveId?: string; targetId: string | null; position: InsertPosition };

/**
 * Stage of a design shown over something (ads_html_editor_v1): a web ad is
 * edited where it appears, as a sheet centred over the real website at the
 * device size, under its dimming overlay. Without a stage the design fills
 * the device width (campaign email).
 */
export type CanvasStage = {
  /** Screen of the device the design is shown on. */
  viewport: { width: number; height: number };
  /** Width of the design sheet (the ad window) on this device. */
  sheetWidth: number;
  /** What sits behind (the website), laid out at viewport size; the canvas scales it. */
  backdrop?: React.ReactNode;
  overlay?: string;
  /** Blur of what sits behind, in stage pixels (backdrop-filter). */
  blur?: number;
  radius?: number;
  background?: string;
  /** Decoration over the sheet in sheet pixels (close / back chips). */
  chrome?: React.ReactNode;
  /** Text of the canvas meta line ("Escritorio · 1280 × 800"). */
  label?: string;
  /** Attributes of the canvas <html> (the device the design is laid out for). */
  docAttrs?: Record<string, string>;
};

type Props = {
  html: string;
  css: string;
  device: BuilderDevice;
  zoom: "fit" | number;
  selectedId: string | null;
  selectedLabel: string;
  onSelect: (id: string | null) => void;
  onInlineEdit: (id: string, innerHtml: string) => void;
  onDrop: (drop: CanvasDrop) => void;
  onKey: (e: KeyboardEvent) => void;
  onScale?: (scale: number) => void;
  /** Editing-only CSS of the profile (e.g. channel hints); never reaches the output. */
  extraCss?: string;
  stage?: CanvasStage;
};

const skeleton = (extraCss: string) =>
  `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${BORDER_PREFLIGHT_CSS}${EMAIL_RESET_CSS}</style><style id="eb-tw"></style><style>[contenteditable="true"]{outline:none;cursor:text}a,img{cursor:default}</style><style>${extraCss}</style></head><body></body></html>`;
const CONTAINER_TAGS = new Set(["DIV", "SECTION", "TD", "UL", "OL", "TABLE", "TR"]);

function boxOf(el: Element | null): Box | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
}

export function BuilderCanvas({ html, css, device, zoom, selectedId, selectedLabel, onSelect, onInlineEdit, onDrop, onKey, onScale, extraCss = "", stage }: Props) {
  const tp = useBuilderTestId();
  const srcDoc = React.useMemo(() => skeleton(extraCss), [extraCss]);
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const editingRef = useRef<HTMLElement | null>(null);
  const [ready, setReady] = useState(false);
  const [frameHeight, setFrameHeight] = useState(640);
  const [available, setAvailable] = useState(800);
  const [hoverBox, setHoverBox] = useState<Box | null>(null);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const width = stage ? stage.sheetWidth : DEVICE_WIDTH[device];
  // The stage is scaled as a whole: the website keeps its real layout.
  const baseWidth = stage ? stage.viewport.width : width;
  const scale = zoom === "fit" ? Math.min(1, Math.max(0.2, (available - 32) / baseWidth)) : zoom;
  const minHeight = stage ? 80 : 480;
  const minHeightRef = useRef(minHeight);
  minHeightRef.current = minHeight;
  const handlers = useRef({ onSelect, onInlineEdit, onDrop, onKey });
  handlers.current = { onSelect, onInlineEdit, onDrop, onKey };
  const selectedIdRef = useRef(selectedId);
  selectedIdRef.current = selectedId;
  const htmlRef = useRef(html);
  htmlRef.current = html;
  const hoveredRef = useRef<Element | null>(null);

  useEffect(() => onScale?.(scale), [onScale, scale]);

  const doc = () => frameRef.current?.contentDocument ?? null;

  const measure = useCallback(() => {
    const d = doc();
    if (!d?.body) return;
    // The body, not the document: the document is never shorter than the frame
    // itself, so a design that shrinks would leave a blank band below it.
    setFrameHeight(Math.max(d.body.scrollHeight, minHeightRef.current));
    setSelectedBox(boxOf(findById(d, selectedIdRef.current)));
  }, []);

  // Panel width drives the fit-to-width zoom.
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setAvailable(el.clientWidth));
    ro.observe(el);
    setAvailable(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // The device of the stage on the canvas <html> (e.g. data-vp for ad designs).
  const docAttrsKey = JSON.stringify(stage?.docAttrs ?? {});
  useEffect(() => {
    const d = doc();
    if (!ready || !d) return;
    for (const [k, v] of Object.entries(JSON.parse(docAttrsKey) as Record<string, string>)) d.documentElement.setAttribute(k, v);
    measure();
  }, [docAttrsKey, ready, measure]);

  // Design + CSS into the frame. A text being edited in place is never overwritten.
  useEffect(() => {
    const d = doc();
    if (!ready || !d?.body || editingRef.current) return;
    d.body.innerHTML = html;
    hoveredRef.current = null;
    setHoverBox(null);
    measure();
  }, [html, ready, measure]);

  useEffect(() => {
    const d = doc();
    const style = d?.getElementById("eb-tw");
    if (!ready || !style) return;
    style.textContent = css;
    measure();
  }, [css, ready, measure]);

  useEffect(() => {
    setSelectedBox(boxOf(findById(doc() ?? document.createElement("div"), selectedId)));
  }, [selectedId, ready, frameHeight, width]);

  // Re-measure when images load or breakpoints reflow the design.
  useEffect(() => {
    const d = doc();
    if (!ready || !d?.body) return;
    const view = frameRef.current?.contentWindow as (Window & { ResizeObserver?: typeof ResizeObserver }) | null;
    const Observer = view?.ResizeObserver ?? ResizeObserver;
    const ro = new Observer(() => measure());
    ro.observe(d.body);
    return () => ro.disconnect();
  }, [ready, measure, width]);

  const commitEdit = useCallback((cancel = false) => {
    const el = editingRef.current;
    if (!el) return;
    editingRef.current = null;
    el.removeAttribute("contenteditable");
    const id = el.getAttribute(EB_ID);
    if (!cancel && id) handlers.current.onInlineEdit(id, el.innerHTML);
  }, []);

  // One set of listeners per loaded document; they read the latest props through refs.
  useEffect(() => {
    const d = doc();
    if (!ready || !d) return;
    const elementAt = (target: EventTarget | null) => {
      const node = target as Element | null;
      return typeof node?.closest === "function" ? node.closest<HTMLElement>(`[${EB_ID}]`) : null;
    };
    const onClick = (e: MouseEvent) => {
      if (editingRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      commitEdit();
      handlers.current.onSelect(elementAt(e.target)?.getAttribute(EB_ID) ?? null);
    };
    const onMove = (e: MouseEvent) => {
      const el = elementAt(e.target);
      if (el === hoveredRef.current) return;
      hoveredRef.current = el;
      setHoverBox(boxOf(el));
    };
    const onLeave = () => {
      hoveredRef.current = null;
      setHoverBox(null);
    };
    const onDblClick = (e: MouseEvent) => {
      const el = elementAt(e.target);
      if (!el || !isTextElement(el)) return;
      e.preventDefault();
      commitEdit();
      editingRef.current = el;
      el.setAttribute("contenteditable", "true");
      el.focus();
      handlers.current.onSelect(el.getAttribute(EB_ID));
    };
    const onFocusOut = (e: FocusEvent) => {
      if (editingRef.current && e.target === editingRef.current) commitEdit();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingRef.current) {
        if (e.key === "Escape") {
          commitEdit(true);
          d.body.innerHTML = htmlRef.current;
        } else if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commitEdit();
        }
        return;
      }
      handlers.current.onKey(e);
    };
    const dropTarget = (e: DragEvent): { el: HTMLElement | null; position: InsertPosition } => {
      const el = elementAt(e.target);
      if (!el) return { el: null, position: "inside" };
      const r = el.getBoundingClientRect();
      const edge = Math.min(14, r.height / 3);
      if (CONTAINER_TAGS.has(el.tagName) && e.clientY > r.top + edge && e.clientY < r.bottom - edge && el.children.length === 0) return { el, position: "inside" };
      return { el, position: e.clientY < r.top + r.height / 2 ? "before" : "after" };
    };
    const accepts = (e: DragEvent) => Boolean(e.dataTransfer && (e.dataTransfer.types.includes(BLOCK_MIME) || e.dataTransfer.types.includes(MOVE_MIME)));
    const onDragOver = (e: DragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = e.dataTransfer.types.includes(MOVE_MIME) ? "move" : "copy";
      const { el, position } = dropTarget(e);
      const box = boxOf(el);
      setDrop(box ? { box, position } : null);
    };
    const onDragLeave = (e: DragEvent) => {
      if (!e.relatedTarget) setDrop(null);
    };
    const onDropEvent = (e: DragEvent) => {
      if (!accepts(e)) return;
      e.preventDefault();
      setDrop(null);
      const { el, position } = dropTarget(e);
      handlers.current.onDrop({
        block: e.dataTransfer?.getData(BLOCK_MIME) || undefined,
        moveId: e.dataTransfer?.getData(MOVE_MIME) || undefined,
        targetId: el?.getAttribute(EB_ID) ?? null,
        position,
      });
    };
    d.addEventListener("click", onClick);
    d.addEventListener("mousemove", onMove);
    d.addEventListener("mouseleave", onLeave);
    d.addEventListener("dblclick", onDblClick);
    d.addEventListener("focusout", onFocusOut);
    d.addEventListener("keydown", onKeyDown);
    d.addEventListener("dragover", onDragOver);
    d.addEventListener("dragleave", onDragLeave);
    d.addEventListener("drop", onDropEvent);
    return () => {
      d.removeEventListener("click", onClick);
      d.removeEventListener("mousemove", onMove);
      d.removeEventListener("mouseleave", onLeave);
      d.removeEventListener("dblclick", onDblClick);
      d.removeEventListener("focusout", onFocusOut);
      d.removeEventListener("keydown", onKeyDown);
      d.removeEventListener("dragover", onDragOver);
      d.removeEventListener("dragleave", onDragLeave);
      d.removeEventListener("drop", onDropEvent);
    };
  }, [ready, commitEdit]);

  const place = (b: Box): React.CSSProperties => ({ left: b.x * scale, top: b.y * scale, width: b.w * scale, height: b.h * scale });

  return (
    <div
      ref={viewportRef}
      className="relative h-full min-h-[420px] overflow-auto bg-[#0d0e13] bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:18px_18px]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onSelect(null);
      }}
      data-testid={`${tp}-canvas`}
      data-observe={`${tp}-canvas`}
      data-device={device}
    >
      <div className="mx-auto px-4 pb-10 pt-4" style={{ width: baseWidth * scale + 32 }} data-testid={`${tp}-canvas-stage`}>
        <div className="mb-2 flex items-center justify-between text-[11px] text-bo-faint" data-testid={`${tp}-canvas-meta`}>
          <span data-testid={`${tp}-canvas-device`}>{stage?.label ?? `${device === "desktop" ? "Escritorio" : device === "tablet" ? "Tablet" : "Móvil"} · ${width}px`}</span>
          <span data-testid={`${tp}-canvas-scale`}>{Math.round(scale * 100)}%</span>
        </div>
        <StageFrame stage={stage} scale={scale} sheetWidth={width} sheetHeight={frameHeight} testId={`${tp}-stage`}>
        <div
          className={stage ? "absolute overflow-hidden shadow-[0_18px_50px_rgba(0,0,0,0.45)]" : "relative overflow-hidden rounded-md bg-white shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10"}
          style={stage ? sheetStyle(stage, scale, width, frameHeight) : { width: width * scale, height: frameHeight * scale }}
          onMouseLeave={() => setHoverBox(null)}
          data-testid={`${tp}-frame-box`}
        >
          <iframe
            ref={frameRef}
            title={stage ? "Lienzo del anuncio" : "Lienzo del email"}
            srcDoc={srcDoc}
            sandbox="allow-same-origin"
            onLoad={() => setReady(true)}
            scrolling="no"
            className="block origin-top-left border-0"
            style={{ width, height: frameHeight, transform: `scale(${scale})` }}
            data-testid={`${tp}-frame`}
          />
          {hoverBox && <div className="pointer-events-none absolute border border-dashed border-[#9b87ff]" style={place(hoverBox)} data-testid={`${tp}-hover-box`} />}
          {selectedBox && (
            <div className="pointer-events-none absolute border-2 border-[#7c5cff]" style={place(selectedBox)} data-testid={`${tp}-selection-box`}>
              <span
                className="absolute left-[-2px] top-0 -translate-y-full whitespace-nowrap rounded-t-[4px] bg-[#7c5cff] px-1.5 py-0.5 text-[10px] font-semibold text-white"
                data-testid={`${tp}-selection-label`}
              >
                {selectedLabel}
              </span>
            </div>
          )}
          {drop && (
            <div
              className={drop.position === "inside" ? "pointer-events-none absolute border-2 border-dashed border-[#22c55e] bg-[#22c55e]/10" : "pointer-events-none absolute h-[3px] rounded-full bg-[#22c55e]"}
              style={
                drop.position === "inside"
                  ? place(drop.box)
                  : { left: drop.box.x * scale, width: drop.box.w * scale, top: (drop.position === "before" ? drop.box.y : drop.box.y + drop.box.h) * scale - 1 }
              }
              data-testid={`${tp}-drop-indicator`}
            />
          )}
          {stage?.chrome && (
            <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width, transform: `scale(${scale})` }} data-testid={`${tp}-stage-chrome`}>
              {stage.chrome}
            </div>
          )}
        </div>
        </StageFrame>
      </div>
    </div>
  );
}

/** Top of the sheet on the stage: centred on the screen, never above 24px. */
function sheetTop(stage: CanvasStage, sheetHeight: number): number {
  return Math.max(24, (stage.viewport.height - sheetHeight) / 2);
}

function sheetStyle(stage: CanvasStage, scale: number, sheetWidth: number, sheetHeight: number): React.CSSProperties {
  return {
    left: ((stage.viewport.width - sheetWidth) / 2) * scale,
    top: sheetTop(stage, sheetHeight) * scale,
    width: sheetWidth * scale,
    height: sheetHeight * scale,
    borderRadius: (stage.radius ?? 24) * scale,
    background: stage.background || "#ffffff",
  };
}

/** The website behind the design, scaled with it, under the dimming overlay. */
function StageFrame({ stage, scale, sheetWidth, sheetHeight, testId, children }: { stage?: CanvasStage; scale: number; sheetWidth: number; sheetHeight: number; testId: string; children: React.ReactNode }) {
  if (!stage) return <>{children}</>;
  const height = Math.max(stage.viewport.height, sheetTop(stage, sheetHeight) + sheetHeight + 24);
  return (
    <div
      className="relative overflow-hidden rounded-md bg-[#f4f1ea] shadow-[0_18px_50px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      style={{ width: stage.viewport.width * scale, height: height * scale }}
      data-sheet-width={sheetWidth}
      data-testid={testId}
    >
      {stage.backdrop && (
        <div className="pointer-events-none absolute left-0 top-0 origin-top-left" style={{ width: stage.viewport.width, height, transform: `scale(${scale})` }} data-testid={`${testId}-backdrop`}>
          {stage.backdrop}
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: stage.overlay || "rgba(0,0,0,0.55)", backdropFilter: stage.blur ? `blur(${stage.blur * scale}px)` : undefined }}
        data-testid={`${testId}-overlay`}
      />
      {children}
    </div>
  );
}
