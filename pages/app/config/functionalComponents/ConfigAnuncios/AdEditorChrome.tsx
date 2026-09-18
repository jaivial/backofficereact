import React, { useCallback, useEffect, useRef, useState } from "react";
import Moveable from "react-moveable";
import { Layers, Menu, SlidersHorizontal, X } from "lucide-react";

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
