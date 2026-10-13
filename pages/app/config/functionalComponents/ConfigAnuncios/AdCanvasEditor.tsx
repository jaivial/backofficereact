// Coordination id: ads_canvas_v1
// Free-form ("Figma-like") canvas editor for ads. The edited document is the
// same canvas_json the backend render endpoint paints 1-1, so the iframe
// preview below the canvas is the exact truth of what visitors see.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RestaurantAdCanvas, RestaurantAdCanvasElement } from "../../../../../api/types";

type Props = {
  canvas: RestaurantAdCanvas;
  disabled?: boolean;
  onChange: (canvas: RestaurantAdCanvas) => void;
};

type DragState =
  | { kind: "move"; id: string; startX: number; startY: number; origX: number; origY: number }
  | { kind: "resize"; id: string; startX: number; startY: number; origW: number; origH: number };

const MIN_SIZE = 12;

const TYPE_LABEL: Record<RestaurantAdCanvasElement["type"], string> = {
  text: "Texto",
  image: "Imagen",
  button: "Botón",
  shape: "Forma",
};

function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`;
}

function defaultElement(type: RestaurantAdCanvasElement["type"], canvas: RestaurantAdCanvas): RestaurantAdCanvasElement {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const maxZ = canvas.elements.reduce((acc, el) => Math.max(acc, el.z || 0), 0) + 1;
  if (type === "text") {
    return { id: nextId("txt"), type, x: cx - 200, y: cy - 40, w: 400, h: 80, z: maxZ, props: { text: "Nuevo texto", fontSize: 36, color: "#111111", align: "center", bold: false, italic: false } };
  }
  if (type === "image") {
    return { id: nextId("img"), type, x: cx - 150, y: cy - 100, w: 300, h: 200, z: maxZ, props: { src: "", fit: "cover", radius: 0, alt: "" } };
  }
  if (type === "button") {
    return { id: nextId("btn"), type, x: cx - 100, y: cy - 28, w: 200, h: 56, z: maxZ, props: { text: "Reservar", href: "/", bg: "#c9a86a", color: "#1a2e22", radius: 28, fontSize: 20, bold: true, newTab: false } };
  }
  return { id: nextId("shp"), type, x: cx - 120, y: cy - 80, w: 240, h: 160, z: maxZ, props: { shape: "rect", fill: "#f0e6d2", stroke: "", strokeWidth: 0, radius: 12, opacity: 1 } };
}

export function AdCanvasEditor({ canvas, disabled, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const [scale, setScale] = useState(0.5);

  const selected = useMemo(() => canvas.elements.find((el) => el.id === selectedId) || null, [canvas, selectedId]);

  const update = useCallback(
    (mutate: (draft: RestaurantAdCanvas) => void) => {
      const draft: RestaurantAdCanvas = JSON.parse(JSON.stringify(canvas));
      mutate(draft);
      onChange(draft);
    },
    [canvas, onChange],
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<RestaurantAdCanvasElement> & { props?: Record<string, unknown> }) => {
      update((draft) => {
        const el = draft.elements.find((item) => item.id === id);
        if (!el) return;
        if (patch.props) el.props = { ...el.props, ...patch.props };
        const { props: _ignored, ...rest } = patch;
        Object.assign(el, rest);
      });
    },
    [update],
  );

  // Fit the stage into the available width.
  useEffect(() => {
    const node = stageRef.current?.parentElement;
    if (!node) return;
    const compute = () => {
      const rect = node.getBoundingClientRect();
      const next = Math.min(rect.width / canvas.width, 1);
      setScale(next > 0 ? next : 0.25);
    };
    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(node);
    return () => observer.disconnect();
  }, [canvas.width, canvas.height]);

  const toCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const stage = stageRef.current;
      if (!stage) return { x: 0, y: 0 };
      const rect = stage.getBoundingClientRect();
      return { x: (clientX - rect.left) / scale, y: (clientY - rect.top) / scale };
    },
    [scale],
  );

  const onElementPointerDown = useCallback(
    (event: React.PointerEvent, el: RestaurantAdCanvasElement) => {
      if (disabled) return;
      event.stopPropagation();
      event.preventDefault();
      setSelectedId(el.id);
      const pt = toCanvasPoint(event.clientX, event.clientY);
      dragRef.current = { kind: "move", id: el.id, startX: pt.x, startY: pt.y, origX: el.x, origY: el.y };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [disabled, toCanvasPoint],
  );

  const onResizePointerDown = useCallback(
    (event: React.PointerEvent, el: RestaurantAdCanvasElement) => {
      if (disabled) return;
      event.stopPropagation();
      event.preventDefault();
      const pt = toCanvasPoint(event.clientX, event.clientY);
      dragRef.current = { kind: "resize", id: el.id, startX: pt.x, startY: pt.y, origW: el.w, origH: el.h };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [disabled, toCanvasPoint],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      const pt = toCanvasPoint(event.clientX, event.clientY);
      if (drag.kind === "move") {
        updateElement(drag.id, {
          x: Math.round(drag.origX + (pt.x - drag.startX)),
          y: Math.round(drag.origY + (pt.y - drag.startY)),
        });
      } else {
        updateElement(drag.id, {
          w: Math.max(MIN_SIZE, Math.round(drag.origW + (pt.x - drag.startX))),
          h: Math.max(MIN_SIZE, Math.round(drag.origH + (pt.y - drag.startY))),
        });
      }
    },
    [toCanvasPoint, updateElement],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const addElement = useCallback(
    (type: RestaurantAdCanvasElement["type"]) => {
      const el = defaultElement(type, canvas);
      update((draft) => {
        draft.elements.push(el);
      });
      setSelectedId(el.id);
    },
    [canvas, update],
  );

  const removeElement = useCallback(
    (id: string) => {
      update((draft) => {
        draft.elements = draft.elements.filter((el) => el.id !== id);
      });
      setSelectedId(null);
    },
    [update],
  );

  const reorder = useCallback(
    (id: string, dir: 1 | -1) => {
      update((draft) => {
        const el = draft.elements.find((item) => item.id === id);
        if (!el) return;
        el.z = (el.z || 0) + dir;
      });
    },
    [update],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!selectedId || disabled) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      removeElement(selectedId);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, disabled, removeElement]);

  const sorted = useMemo(() => [...canvas.elements].sort((a, b) => (a.z || 0) - (b.z || 0)), [canvas.elements]);

  return (
    <div className="bo-adcanvas" data-testid="ad-canvas-editor">
      <div className="bo-adcanvasToolbar" role="toolbar" aria-label="Herramientas del lienzo" data-testid="ad-canvas-toolbar">
        <button type="button" disabled={disabled} onClick={() => addElement("text")} data-testid="ad-canvas-add-text">+ Texto</button>
        <button type="button" disabled={disabled} onClick={() => addElement("image")} data-testid="ad-canvas-add-image">+ Imagen</button>
        <button type="button" disabled={disabled} onClick={() => addElement("button")} data-testid="ad-canvas-add-button">+ Botón</button>
        <button type="button" disabled={disabled} onClick={() => addElement("shape")} data-testid="ad-canvas-add-shape">+ Forma</button>
        <span className="bo-adcanvasSpacer" />
        <label>
          Fondo
          <select
            disabled={disabled}
            value={canvas.background.type}
            onChange={(event) => update((draft) => { draft.background.type = event.target.value as "color" | "image"; })}
          >
            <option value="color">Color</option>
            <option value="image">Imagen</option>
          </select>
        </label>
        {canvas.background.type === "color" ? (
          <input
            type="color"
            disabled={disabled}
            value={/^#[0-9a-fA-F]{6}$/.test(canvas.background.value) ? canvas.background.value : "#ffffff"}
            onChange={(event) => update((draft) => { draft.background.value = event.target.value; })}
          />
        ) : (
          <input
            type="text"
            placeholder="https://.../fondo.webp"
            disabled={disabled}
            value={canvas.background.value}
            onChange={(event) => update((draft) => { draft.background.value = event.target.value; })}
            style={{ minWidth: 220 }}
          />
        )}
        <label>
          Lienzo
          <select
            disabled={disabled}
            value={`${canvas.width}x${canvas.height}`}
            onChange={(event) => {
              const [w, h] = event.target.value.split("x").map((v) => parseInt(v, 10));
              update((draft) => { draft.width = w; draft.height = h; });
            }}
          >
            <option value="800x500">800×500 (popover)</option>
            <option value="1080x1080">1080×1080 (1:1)</option>
            <option value="1080x1350">1080×1350 (4:5)</option>
            <option value="1080x1920">1080×1920 (9:16)</option>
          </select>
        </label>
      </div>
      <div
        className="bo-adcanvasStageWrap"
        /* The scaled stage keeps its unscaled layout box; sizing the wrap to
           the visual height avoids a dead band below the ad on mobile. */
        style={{ height: canvas.height * scale }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div
          ref={stageRef}
          className="bo-adcanvasStage"
          style={{
            width: canvas.width,
            height: canvas.height,
            transform: `scale(${scale})`,
            background:
              canvas.background.type === "image" && canvas.background.value
                ? `url(${canvas.background.value}) center/cover`
                : canvas.background.value || "#ffffff",
          }}
          onPointerDown={() => setSelectedId(null)}
        >
          {sorted.map((el) => {
            const isSel = el.id === selectedId;
            const common: React.CSSProperties = {
              left: el.x,
              top: el.y,
              width: el.w,
              height: el.h,
              transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
            };
            return (
              <div
                key={el.id}
                className={`bo-adcanvasEl${isSel ? " is-selected" : ""}`}
                style={common}
                onPointerDown={(event) => onElementPointerDown(event, el)}
              >
                <CanvasElementPreview el={el} />
                {isSel && !disabled ? (
                  <span className="bo-adcanvasHandle" onPointerDown={(event) => onResizePointerDown(event, el)} />
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      {selected ? (
        <div className="bo-adcanvasPanel" data-testid="ad-canvas-panel">
          <div className="bo-adcanvasPanelHead">
            <strong data-testid="ad-canvas-panel-type">{TYPE_LABEL[selected.type] ?? selected.type}</strong>
            <span className="bo-adcanvasSpacer" />
            <button type="button" disabled={disabled} onClick={() => reorder(selected.id, 1)} data-testid="ad-canvas-layer-up">Subir capa</button>
            <button type="button" disabled={disabled} onClick={() => reorder(selected.id, -1)} data-testid="ad-canvas-layer-down">Bajar capa</button>
            <button type="button" disabled={disabled} onClick={() => removeElement(selected.id)} data-tone="danger" data-testid="ad-canvas-delete">Eliminar</button>
          </div>
          <ElementInspector el={selected} disabled={disabled} onPatch={(props) => updateElement(selected.id, { props })} />
        </div>
      ) : null}
    </div>
  );
}

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
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,.08)", color: "#666", fontSize: 14 }}>Sin imagen</div>
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

function ElementInspector({ el, disabled, onPatch }: { el: RestaurantAdCanvasElement; disabled?: boolean; onPatch: (props: Record<string, unknown>) => void }) {
  const p = el.props as Record<string, unknown>;
  if (el.type === "text") {
    return (
      <div className="bo-adcanvasFields">
        <label>Texto<textarea disabled={disabled} rows={2} value={String(p.text || "")} onChange={(e) => onPatch({ text: e.target.value })} /></label>
        <label>Tamaño<input disabled={disabled} type="number" min={4} max={400} value={Number(p.fontSize) || 16} onChange={(e) => onPatch({ fontSize: Number(e.target.value) })} /></label>
        <label>Color<input disabled={disabled} type="color" value={String(p.color || "#111111")} onChange={(e) => onPatch({ color: e.target.value })} /></label>
        <label>Alinear
          <select disabled={disabled} value={String(p.align || "left")} onChange={(e) => onPatch({ align: e.target.value })}>
            <option value="left">Izquierda</option><option value="center">Centro</option><option value="right">Derecha</option>
          </select>
        </label>
        <label><input disabled={disabled} type="checkbox" checked={Boolean(p.bold)} onChange={(e) => onPatch({ bold: e.target.checked })} /> Negrita</label>
        <label><input disabled={disabled} type="checkbox" checked={Boolean(p.italic)} onChange={(e) => onPatch({ italic: e.target.checked })} /> Cursiva</label>
      </div>
    );
  }
  if (el.type === "image") {
    return (
      <div className="bo-adcanvasFields">
        <label>URL imagen<input disabled={disabled} type="text" value={String(p.src || "")} onChange={(e) => onPatch({ src: e.target.value })} placeholder="https://cdn.../imagen.webp" /></label>
        <label>Ajuste
          <select disabled={disabled} value={String(p.fit || "cover")} onChange={(e) => onPatch({ fit: e.target.value })}>
            <option value="cover">Cubrir</option><option value="contain">Contener</option>
          </select>
        </label>
        <label>Radio<input disabled={disabled} type="number" min={0} max={400} value={Number(p.radius) || 0} onChange={(e) => onPatch({ radius: Number(e.target.value) })} /></label>
        <label>Alt<input disabled={disabled} type="text" value={String(p.alt || "")} onChange={(e) => onPatch({ alt: e.target.value })} /></label>
      </div>
    );
  }
  if (el.type === "button") {
    return (
      <div className="bo-adcanvasFields">
        <label>Texto<input disabled={disabled} type="text" value={String(p.text || "")} onChange={(e) => onPatch({ text: e.target.value })} /></label>
        <label>Enlace<input disabled={disabled} type="text" value={String(p.href || "")} onChange={(e) => onPatch({ href: e.target.value })} placeholder="/reservas o https://..." /></label>
        <label>Fondo<input disabled={disabled} type="color" value={String(p.bg || "#111111")} onChange={(e) => onPatch({ bg: e.target.value })} /></label>
        <label>Texto color<input disabled={disabled} type="color" value={String(p.color || "#ffffff")} onChange={(e) => onPatch({ color: e.target.value })} /></label>
        <label>Radio<input disabled={disabled} type="number" min={0} max={200} value={Number(p.radius) || 0} onChange={(e) => onPatch({ radius: Number(e.target.value) })} /></label>
        <label>Tamaño<input disabled={disabled} type="number" min={4} max={200} value={Number(p.fontSize) || 16} onChange={(e) => onPatch({ fontSize: Number(e.target.value) })} /></label>
        <label><input disabled={disabled} type="checkbox" checked={Boolean(p.bold)} onChange={(e) => onPatch({ bold: e.target.checked })} /> Negrita</label>
        <label><input disabled={disabled} type="checkbox" checked={Boolean(p.newTab)} onChange={(e) => onPatch({ newTab: e.target.checked })} /> Abrir en pestaña nueva</label>
      </div>
    );
  }
  return (
    <div className="bo-adcanvasFields">
      <label>Forma
        <select disabled={disabled} value={String(p.shape || "rect")} onChange={(e) => onPatch({ shape: e.target.value })}>
          <option value="rect">Rectángulo</option><option value="ellipse">Elipse</option>
        </select>
      </label>
      <label>Relleno<input disabled={disabled} type="color" value={String(p.fill || "#f0e6d2")} onChange={(e) => onPatch({ fill: e.target.value })} /></label>
      <label>Borde color<input disabled={disabled} type="color" value={String(p.stroke || "#000000")} onChange={(e) => onPatch({ stroke: e.target.value })} /></label>
      <label>Borde ancho<input disabled={disabled} type="number" min={0} max={40} value={Number(p.strokeWidth) || 0} onChange={(e) => onPatch({ strokeWidth: Number(e.target.value) })} /></label>
      <label>Radio<input disabled={disabled} type="number" min={0} max={400} value={Number(p.radius) || 0} onChange={(e) => onPatch({ radius: Number(e.target.value) })} /></label>
    </div>
  );
}
