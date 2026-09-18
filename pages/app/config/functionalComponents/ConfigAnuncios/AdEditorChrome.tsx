import React, { useCallback, useEffect, useRef, useState } from "react";
import Moveable from "react-moveable";
import { GripVertical, Layers, Menu, SlidersHorizontal, Trash2, X } from "lucide-react";

/* Coordination id: ads_studio_v1 - the anuncios editor becomes a design tool:
 * a canvas in the middle, layers + insert on the left, properties on the
 * right, and both sidebars collapsed into one hamburger drawer on mobile.
 * The card inside the canvas stays the 1:1 public replica. */

export type StudioPanel = "layers" | "properties";

/** Responsive three-column shell. Below `lg` the sidebars live in a drawer. */
export function AdStudioShell({
  layers,
  canvas,
  properties,
  canvasLabel,
}: {
  layers: React.ReactNode;
  canvas: React.ReactNode;
  properties: React.ReactNode;
  canvasLabel: string;
}) {
  const [panel, setPanel] = useState<StudioPanel | null>(null);
  const close = useCallback(() => setPanel(null), []);

  return (
    <div className="bo-adStudio" data-testid="ad-studio" data-panel={panel ?? "none"}>
      <aside className="bo-adStudioSide bo-adStudioSide--layers" data-testid="ad-studio-layers" aria-label="Capas y anadir">
        <div className="bo-adStudioSideHead">
          <Layers size={14} aria-hidden="true" />
          <span>Capas</span>
        </div>
        {layers}
      </aside>

      <div className="bo-adStudioStage" data-testid="ad-studio-stage">
        <p className="bo-adStudioStageLabel">{canvasLabel}</p>
        {canvas}
      </div>

      <aside className="bo-adStudioSide bo-adStudioSide--props" data-testid="ad-studio-properties" aria-label="Propiedades">
        <div className="bo-adStudioSideHead">
          <SlidersHorizontal size={14} aria-hidden="true" />
          <span>Propiedades</span>
        </div>
        {properties}
      </aside>

      <button
        type="button"
        className="bo-adStudioMenu"
        aria-label={panel ? "Cerrar panel del editor" : "Abrir panel del editor"}
        aria-expanded={Boolean(panel)}
        onClick={() => setPanel((current) => (current ? null : "layers"))}
        data-testid="ad-studio-menu"
      >
        {panel ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
      </button>

      {panel ? (
        <div className="bo-adStudioDrawer" role="dialog" aria-modal="true" aria-label="Panel del editor" data-testid="ad-studio-drawer">
          <div className="bo-adStudioDrawerTabs" role="tablist" aria-label="Paneles del editor">
            <button
              type="button"
              role="tab"
              aria-selected={panel === "layers"}
              className={panel === "layers" ? "is-active" : ""}
              onClick={() => setPanel("layers")}
              data-testid="ad-studio-drawer-layers"
            >
              Capas
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={panel === "properties"}
              className={panel === "properties" ? "is-active" : ""}
              onClick={() => setPanel("properties")}
              data-testid="ad-studio-drawer-properties"
            >
              Propiedades
            </button>
            <button type="button" className="bo-adStudioDrawerClose" aria-label="Cerrar" onClick={close} data-testid="ad-studio-drawer-close">
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <div className="bo-adStudioDrawerBody">{panel === "layers" ? layers : properties}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Overlay backdrop for the mobile drawer. */
export function AdStudioScrim({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return open ? <div className="bo-adStudioScrim" onClick={onClose} data-testid="ad-studio-scrim" /> : null;
}

/**
 * Floating toolbar over the selection (coord id ads_selection_tools_v1):
 * drag to reorder, duplicate-free delete and a size readout, positioned from
 * the measured node so it never enters the editable text.
 */
/** Pure geometry so the position can be verified without a browser. */
export function measureToolbarBox(node: Element, root: Element): { top: number; left: number } {
  const rect = node.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  return { top: rect.top - rootRect.top, left: rect.left - rootRect.left };
}

export function AdSelectionToolbar({
  containerRef,
  nodeId,
  label,
  onDelete,
  onMoveTo,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodeId: string;
  label: string;
  onDelete: () => void;
  /** Moves the node to the given index of its list (drag and drop). */
  onMoveTo: (toIndex: number) => void;
  children?: React.ReactNode;
}) {
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const root = containerRef.current;
    if (!root) return;
    const node = root.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
    if (!node) {
      setBox(null);
      return;
    }
    setBox(measureToolbarBox(node, root));
  }, [containerRef, nodeId]);

  useEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    root.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      root.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [containerRef, measure]);

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      const root = containerRef.current;
      if (!root) return;
      const node = root.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
      if (!node) return;
      event.preventDefault();
      const nodes = Array.from(root.querySelectorAll<HTMLElement>("[data-node-id]"));
      let from = nodes.indexOf(node);
      const startY = event.clientY;
      node.classList.add("is-dragging");
      setDragging(true);

      const move = (moveEvent: PointerEvent) => {
        const dy = moveEvent.clientY - startY;
        if (Math.abs(dy) < 6) return;
        let to = from;
        nodes.forEach((other, index) => {
          if (index === from) return;
          const rect = other.getBoundingClientRect();
          if (moveEvent.clientY > rect.top && moveEvent.clientY < rect.bottom) to = index;
        });
        if (to !== from) {
          onMoveTo(to);
          from = to;
          window.requestAnimationFrame(() => measure());
        }
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        node.classList.remove("is-dragging");
        setDragging(false);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [containerRef, nodeId, onMoveTo, measure],
  );

  if (!box) return null;

  return (
    <div
      className={`bo-adToolbar ${dragging ? "is-dragging" : ""}`}
      style={{ top: Math.max(box.top - 20, 0), left: Math.max(box.left, 0) }}
      data-testid="ad-selection-toolbar"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="bo-adToolBtn"
        aria-label={`Mover ${label}`}
        title="Arrastra para reordenar"
        data-testid={`ad-node-${nodeId}-drag`}
        onPointerDown={startDrag}
      >
        <GripVertical size={14} aria-hidden="true" />
      </button>
      {children}
      <button
        type="button"
        className="bo-adToolBtn"
        data-tone="danger"
        aria-label={`Eliminar ${label}`}
        data-testid={`ad-node-${nodeId}-delete`}
        onClick={onDelete}
      >
        <Trash2 size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Figma-style transform box over the selected element (coord id
 * ads_element_size_v1). It only resizes: ordering stays with the layers list
 * and the card keeps its public metrics, because Moveable writes the same
 * percentage width / pixel height that the backend stores.
 */
export function AdMoveableBox({
  containerRef,
  nodeId,
  hasHeight,
  onResize,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodeId: string | null;
  hasHeight: boolean;
  onResize: (patch: { width: number; height?: number }) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const frame = useRef({ width: 0, container: 0 });

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !nodeId || !containerRef.current) {
      setTarget(null);
      return;
    }
    setTarget(containerRef.current.querySelector<HTMLElement>(`[data-node-id="${nodeId}"] .bo-adResizable`) ?? null);
  }, [containerRef, mounted, nodeId]);

  if (!mounted || !target) return null;

  return (
    <Moveable
      target={target}
      draggable={false}
      resizable
      keepRatio={false}
      origin={false}
      throttleResize={1}
      renderDirections={["e", "w", "se", "sw", "n", "s"]}
      className="bo-adMoveable"
      hideDefaultLines={false}
      onResizeStart={(event) => {
        const body = target.closest<HTMLElement>(".bo-adModalBody");
        frame.current = { width: target.offsetWidth, container: body?.clientWidth ?? target.parentElement?.clientWidth ?? 1 };
        event.setMin([40, hasHeight ? 40 : 0]);
      }}
      onResize={(event) => {
        const { width, height, drag } = event;
        target.style.width = `${width}px`;
        if (hasHeight) target.style.height = `${height}px`;
        // Flow layout: ignore the translate the control box adds, the element
        // keeps its document position.
        target.style.transform = "";
        void drag;
        const nextWidth = Math.round((width / (frame.current.container || 1)) * 100);
        const patch: { width: number; height?: number } = { width: Math.min(Math.max(nextWidth, 10), 100) };
        if (hasHeight) patch.height = Math.round(height);
        onResize(patch);
      }}
    />
  );
}
