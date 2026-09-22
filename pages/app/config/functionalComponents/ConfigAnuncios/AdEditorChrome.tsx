import React, { useCallback, useEffect, useRef, useState } from "react";
import Moveable from "react-moveable";
import { Copy, GripVertical, Layers, Menu, SlidersHorizontal, Trash2, X } from "lucide-react";

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

/* Coordination id: ads_block_studio_v1 - every block of the editable area
 * (text, image, button) gets the same chrome: a hover label, a selection
 * action bar (drag, duplicate, delete) and a resize box. The chrome reads only
 * the block attributes written by `blockNodeProps`, so kinds are equal. */

export type BlockGeometry = { top: number; left: number; width: number; height: number; label: string; kind: string };

/** Pure geometry so the position can be verified without a browser. */
export function measureBlock(node: Element, root: Element): BlockGeometry {
  const rect = node.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  return {
    top: rect.top - rootRect.top + root.scrollTop,
    left: rect.left - rootRect.left + root.scrollLeft,
    width: rect.width,
    height: rect.height,
    label: node.getAttribute("data-block-label") ?? "",
    kind: node.getAttribute("data-block-kind") ?? "",
  };
}

function blockNode(root: HTMLElement | null, nodeId: string | null): HTMLElement | null {
  if (!root || !nodeId) return null;
  return root.querySelector<HTMLElement>(`[data-node-id="${nodeId}"]`);
}

/** Tracks a block box inside the canvas and re-measures on any layout change. */
function useBlockGeometry(containerRef: React.RefObject<HTMLDivElement | null>, nodeId: string | null): BlockGeometry | null {
  const [box, setBox] = useState<BlockGeometry | null>(null);
  const frame = useRef(0);
  // Coalesce the many triggers (keystrokes, scroll, observers) into one
  // measure per animation frame.
  const measure = useCallback(() => {
    if (frame.current) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      const root = containerRef.current;
      const node = blockNode(root, nodeId);
      setBox(root && node ? measureBlock(node, root) : null);
    });
  }, [containerRef, nodeId]);

  useEffect(() => {
    measure();
    const root = containerRef.current;
    if (!root) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    const mutations = new MutationObserver(() => measure());
    mutations.observe(root, { attributes: true, childList: true, subtree: true, characterData: true });
    root.addEventListener("scroll", measure, true);
    root.addEventListener("transitionend", measure, true);
    window.addEventListener("resize", measure);
    // Selection happens on pointer down; the block settles (caret, :active) by pointer up.
    window.addEventListener("pointerup", measure);
    return () => {
      window.cancelAnimationFrame(frame.current);
      frame.current = 0;
      window.removeEventListener("pointerup", measure);
      observer.disconnect();
      mutations.disconnect();
      root.removeEventListener("scroll", measure, true);
      root.removeEventListener("transitionend", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [containerRef, measure]);

  return box;
}

/** Hover outline + kind label over the block under the pointer (never the selected one). */
export function AdBlockHover({ containerRef, selectedId }: { containerRef: React.RefObject<HTMLDivElement | null>; selectedId: string | null }) {
  const [hoverId, setHoverId] = useState<string | null>(null);
  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    const onMove = (event: PointerEvent) => {
      const node = (event.target as Element | null)?.closest?.("[data-node-id]");
      const next = node?.getAttribute("data-node-id") ?? null;
      setHoverId((current) => (current === next ? current : next));
    };
    const onLeave = () => setHoverId(null);
    root.addEventListener("pointermove", onMove);
    root.addEventListener("pointerleave", onLeave);
    return () => {
      root.removeEventListener("pointermove", onMove);
      root.removeEventListener("pointerleave", onLeave);
    };
  }, [containerRef]);
  const box = useBlockGeometry(containerRef, hoverId && hoverId !== selectedId ? hoverId : null);
  if (!box) return null;
  return (
    <div className="bo-adBlockHover" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} data-testid="ad-block-hover" data-kind={box.kind} aria-hidden="true">
      <span className="bo-adBlockTag">{box.label}</span>
    </div>
  );
}

/**
 * Action bar pinned above the selected block: kind label, drag to reorder
 * within its list, duplicate and delete. It measures the block, so it never
 * enters the editable text.
 */
export function AdBlockBar({
  containerRef,
  nodeId,
  onDelete,
  onDuplicate,
  onMoveTo,
  children,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  nodeId: string;
  onDelete: () => void;
  onDuplicate: () => void;
  /** Moves the block to the given index of its own list (drag and drop). */
  onMoveTo: (toIndex: number) => void;
  children?: React.ReactNode;
}) {
  const box = useBlockGeometry(containerRef, nodeId);
  const [dragging, setDragging] = useState(false);

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      const root = containerRef.current;
      const node = blockNode(root, nodeId);
      if (!root || !node) return;
      event.preventDefault();
      // Every block of the card is a drop target (coord id ads_button_slot_v1):
      // buttons move among content and content among buttons. The list is
      // re-read on every move: React reorders the DOM after each onMoveTo.
      const siblings = () => Array.from(root.querySelectorAll<HTMLElement>("[data-node-id]"));
      node.classList.add("is-dragging");
      setDragging(true);
      const move = (moveEvent: PointerEvent) => {
        const nodes = siblings();
        const from = nodes.indexOf(node);
        const to = nodes.findIndex((other, index) => {
          if (index === from) return false;
          const rect = other.getBoundingClientRect();
          return moveEvent.clientY > rect.top && moveEvent.clientY < rect.bottom && moveEvent.clientX > rect.left && moveEvent.clientX < rect.right;
        });
        if (to >= 0 && to !== from) onMoveTo(to);
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
    [containerRef, nodeId, onMoveTo],
  );

  if (!box) return null;
  // The bar sits above the block; the canvas column has the stage padding
  // above it, so only a block glued to the very top pushes the bar inside.
  const above = box.top >= 8;
  return (
    <>
      <div className="bo-adBlockRing" style={{ top: box.top, left: box.left, width: box.width, height: box.height }} data-testid="ad-block-ring" aria-hidden="true" />
      <div
        className={`bo-adBlockBar ${dragging ? "is-dragging" : ""}`}
        style={{ top: above ? box.top - 34 : box.top + box.height + 6, left: box.left }}
        data-testid="ad-block-bar"
        data-kind={box.kind}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="bo-adBlockBtn bo-adBlockBtn--drag"
          aria-label={`Mover ${box.label}`}
          title="Arrastra para reordenar"
          data-testid={`ad-node-${nodeId}-drag`}
          onPointerDown={startDrag}
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <span className="bo-adBlockBarLabel">{box.label}</span>
        {children}
        <button
          type="button"
          className="bo-adBlockBtn"
          aria-label={`Duplicar ${box.label}`}
          title="Duplicar"
          data-testid={`ad-node-${nodeId}-duplicate`}
          onClick={onDuplicate}
        >
          <Copy size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="bo-adBlockBtn"
          data-tone="danger"
          aria-label={`Eliminar ${box.label}`}
          title="Eliminar"
          data-testid={`ad-node-${nodeId}-delete`}
          onClick={onDelete}
        >
          <Trash2 size={14} aria-hidden="true" />
        </button>
      </div>
    </>
  );
}

/**
 * Figma-style transform box over the selected block (coord id
 * ads_element_size_v1). It only resizes: ordering stays with the action bar
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
    const node = blockNode(containerRef.current, nodeId);
    // The resizable box is the block itself, or the media it wraps (image).
    setTarget(node ? (node.matches(".bo-adResizable") ? node : node.querySelector<HTMLElement>(".bo-adResizable")) : null);
  }, [containerRef, mounted, nodeId]);

  if (!mounted || !target) return null;

  return (
    <Moveable
      target={target}
      container={containerRef.current}
      rootContainer={containerRef.current}
      draggable={false}
      resizable
      keepRatio={false}
      origin={false}
      throttleResize={1}
      renderDirections={hasHeight ? ["e", "w", "se", "sw", "n", "s"] : ["e", "w"]}
      className="bo-adMoveable"
      hideDefaultLines
      onResizeStart={(event) => {
        const body = target.closest<HTMLElement>(".bo-adModalBody, .bo-adWizardCardBody");
        frame.current = { width: target.offsetWidth, container: body?.clientWidth ?? target.parentElement?.clientWidth ?? 1 };
        event.setMin([40, hasHeight ? 40 : 0]);
      }}
      onResize={(event) => {
        const { width, height } = event;
        target.style.width = `${width}px`;
        if (hasHeight) target.style.height = `${height}px`;
        // Flow layout: ignore the translate the control box adds, the element
        // keeps its document position.
        target.style.transform = "";
        const nextWidth = Math.round((width / (frame.current.container || 1)) * 100);
        const patch: { width: number; height?: number } = { width: Math.min(Math.max(nextWidth, 10), 100) };
        if (hasHeight) patch.height = Math.round(height);
        onResize(patch);
      }}
    />
  );
}
