import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import ReactFlow, { Background, Controls, type Node } from "reactflow";
import "reactflow/dist/style.css";

import { createClient } from "../../../../../../api/client";
import type { ConfigFloor, TableMapArea, TableMapItem } from "../../../../../../api/types";
import { normalizeTableArea, floorNumberForArea, limitAreaTemplatePointsForFloor } from "../../areaLayout";
import { hasClosedLimitArea, normalizeLimitPoints } from "../../mapLimits";
import { projectFlowPointToOverlay, type FlowViewportTransform, type LinePoint } from "../../lineDrawing";
import { DEFAULT_TABLE_MAP_FIT_VIEW_OPTIONS } from "../../constants/tables";
import { clampCapacity, shortSidesFromMetadata } from "../../helpers/tables";
import { NODE_TYPES, normalizeLayoutElements } from "../../salonMapNodes";
import { LimitAreaOverlay } from "../LimitAreaOverlay/LimitAreaOverlay";
import type { DrawElement, DrawNodeData, TableNodeData, TableShape } from "../../types/tables";

type TableStatus = TableMapItem["status"];
const noop = () => undefined;
const POPOVER_GAP = 10;
/** Below this canvas width the popover docks to the bottom instead of following the table. */
const POPOVER_DOCK_WIDTH = 560;

type PopoverPlacement = { left: number; top: number; docked: boolean };

/**
 * Places the popover next to the table node (right, else left), clamped to the
 * canvas. Measured from the DOM so pan/zoom and node sizes are always honoured.
 */
function placePopover(canvas: HTMLElement, popover: HTMLElement, tableId: number): PopoverPlacement | null {
  const node = canvas.querySelector<HTMLElement>(`.react-flow__node[data-id="${tableId}"]`);
  if (!node) return null;
  const c = canvas.getBoundingClientRect();
  if (c.width < POPOVER_DOCK_WIDTH) return { left: 0, top: 0, docked: true };
  const r = node.getBoundingClientRect();
  const w = popover.offsetWidth;
  const h = popover.offsetHeight;
  const right = r.right - c.left + POPOVER_GAP;
  const left = right + w <= c.width - POPOVER_GAP ? right : Math.max(POPOVER_GAP, r.left - c.left - POPOVER_GAP - w);
  const top = Math.min(Math.max(POPOVER_GAP, r.top - c.top + r.height / 2 - h / 2), Math.max(POPOVER_GAP, c.height - h - POPOVER_GAP));
  return { left, top, docked: false };
}

/**
 * Read-only salon map (same React Flow nodes as the reservas table manager).
 * Loads its own layout for `date`, lets the user switch floors, pan and zoom,
 * and reports table taps. Callers decide each table's status. With
 * `renderPopover`, tapping a table opens that content in a popover anchored to
 * the table (closes on outside tap, pane tap, Escape or floor change).
 */
export function SalonMap({ date, testId, getStatus, onTableClick, renderPopover, onLayout }: {
  date: string;
  testId: string;
  getStatus?: (table: TableMapItem) => TableStatus;
  onTableClick?: (tableId: number) => void;
  renderPopover?: (table: TableMapItem, close: () => void) => ReactNode;
  /** Raw day layout of the shown floor (e.g. booking_states), for callers that need it. */
  onLayout?: (layout: Record<string, unknown>) => void;
}) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [floors, setFloors] = useState<ConfigFloor[]>([]);
  const [floor, setFloor] = useState(0);
  const [areas, setAreas] = useState<TableMapArea[]>([]);
  const [elements, setElements] = useState<DrawElement[]>([]);
  const [limitPoints, setLimitPoints] = useState<LinePoint[]>([]);
  const [viewport, setViewport] = useState<FlowViewportTransform>({ x: 0, y: 0, zoom: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTableId, setActiveTableId] = useState<number | null>(null);
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const onLayoutRef = useRef(onLayout);
  onLayoutRef.current = onLayout;

  useEffect(() => {
    void api.config.getFloors(date).then((res) => { if (res.success) setFloors(res.floors.filter((f) => f.active)); });
  }, [api, date]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    void api.tables.list({ date, floor_number: floor }).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (!res.success) { setError(res.message || "Error cargando el salón"); return; }
      setError("");
      const loaded = (res.areas || res.data || []).map((a: any) => normalizeTableArea(a));
      const layout = ((res.layout as any)?.map || res.layout || {}) as Record<string, unknown>;
      const perDay = normalizeLayoutElements(layout.elements);
      const override = normalizeLayoutElements(layout._draw_elements_template_override);
      setAreas(loaded);
      onLayoutRef.current?.(layout);
      setElements(perDay.length ? perDay : override.length ? override : normalizeLayoutElements(layout.draw_elements_template));
      const limit = [layout.limit_points, layout._limit_area_template_points_override, layout.limit_area_template_points]
        .map(normalizeLimitPoints).find(hasClosedLimitArea);
      setLimitPoints(limit || limitAreaTemplatePointsForFloor(loaded, floor));
    });
    return () => { alive = false; };
  }, [api, date, floor]);

  const nodes = useMemo<Node[]>(() => [
    ...areas.filter((a) => floorNumberForArea(a) === floor).flatMap((a) => a.tables || []).map((table) => {
      const metadata = (table.metadata || {}) as Record<string, unknown>;
      const width = Number(metadata.width);
      const height = Number(metadata.height);
      return {
        id: String(table.id),
        type: "restaurantTable",
        draggable: false,
        position: { x: table.x_pos || 0, y: table.y_pos || 0 },
        data: {
          id: table.id,
          name: table.name || `Mesa ${table.id}`,
          numeroMesa: table.numero_mesa || String(table.id),
          capacity: clampCapacity(table.capacity || 4),
          status: getStatus ? getStatus(table) : "available",
          shape: (table.shape || "round") as TableShape,
          fillColor: table.fill_color || "",
          outlineColor: table.outline_color || "",
          textureImageUrl: table.texture_image_url || "",
          rotationDeg: Number(metadata.rotation_deg || 0),
          rectShortSides: shortSidesFromMetadata(metadata.short_side_seats, table.capacity || 4),
          width: width > 0 ? Math.round(width) : undefined,
          height: height > 0 ? Math.round(height) : undefined,
        } as TableNodeData,
      };
    }),
    ...elements.map((item) => ({
      id: item.id,
      type: "drawElement",
      draggable: false,
      selectable: false,
      position: { x: item.x, y: item.y },
      data: { ...item, isSelected: false, editable: false } as DrawNodeData,
    })),
  ], [areas, elements, floor, getStatus]);

  const activeTable = useMemo(
    () => (activeTableId === null ? null : areas.flatMap((a) => a.tables || []).find((t) => t.id === activeTableId) || null),
    [activeTableId, areas],
  );
  const closePopover = useMemo(() => () => setActiveTableId(null), []);
  useEffect(() => { setActiveTableId(null); }, [floor]);

  const [popoverSize, setPopoverSize] = useState(0);
  useLayoutEffect(() => {
    if (!activeTable || !canvasRef.current || !popoverRef.current) { setPlacement(null); return; }
    setPlacement(placePopover(canvasRef.current, popoverRef.current, activeTable.id));
  }, [activeTable, viewport, nodes, popoverSize]);
  // Content loads asynchronously (comanda, reservas): re-place when it grows.
  useEffect(() => {
    const el = popoverRef.current;
    if (!activeTable || !el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setPopoverSize(el.offsetHeight * 10000 + el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [activeTable]);

  // Outside taps close it; taps inside the canvas are left to React Flow
  // (pane click closes, node click switches table, pan/zoom keeps it open).
  // Escape is captured so it closes only the popover, not the dialog around the map.
  useEffect(() => {
    if (activeTableId === null) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (canvasRef.current?.contains(target) || popoverRef.current?.contains(target))) return;
      setActiveTableId(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      setActiveTableId(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [activeTableId]);

  const overlayPoints = useMemo(() => limitPoints.map((p) => projectFlowPointToOverlay(p, viewport)), [limitPoints, viewport]);

  return (
    <div className="bo-salonMap" data-testid={testId}>
      {floors.length > 1 ? (
        <div className="bo-salonMapFloors" role="tablist" aria-label="Plantas" data-testid={`${testId}-floors`}>
          {floors.map((f) => (
            <button key={f.floorNumber} type="button" role="tab" aria-selected={floor === f.floorNumber} className="pos-modal__secondary" onClick={() => setFloor(f.floorNumber)} data-testid={`${testId}-floor-${f.floorNumber}`}>{f.name}</button>
          ))}
        </div>
      ) : null}
      {error ? <p className="pos-modal__error" role="alert" data-testid={`${testId}-error`}>{error}</p> : null}
      <div className="bo-salonMapCanvas" ref={canvasRef} data-testid={`${testId}-canvas`}>
        {loading ? <div className="bo-tableMapLoading" data-testid={`${testId}-loading`}>Cargando mapa...</div> : null}
        <div className="bo-tableMapFlowWrap" data-testid={`${testId}-flow-wrap`}>
          <ReactFlow
            key={floor}
            nodes={nodes}
            edges={[]}
            nodeTypes={NODE_TYPES}
            className="bo-tableMapFlow"
            fitView
            fitViewOptions={DEFAULT_TABLE_MAP_FIT_VIEW_OPTIONS}
            minZoom={0.08}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            onInit={(instance) => setViewport(instance.getViewport())}
            onMove={(_event, vp) => setViewport(vp)}
            onNodeClick={(_event, node) => {
              if (node.type !== "restaurantTable") { setActiveTableId(null); return; }
              if (renderPopover) setActiveTableId(Number(node.id));
              else onTableClick?.(Number(node.id));
            }}
            onPaneClick={closePopover}
          >
            <Background gap={24} size={1} />
            <Controls showInteractive={false} />
          </ReactFlow>
          {overlayPoints.length ? (
            <LimitAreaOverlay points={overlayPoints} isEditing={false} isDrawing={false} activeVertexIndex={null} screenToFlow={(p) => p}
              onVertexActivate={noop} onVertexDragStart={noop} onVertexDragMove={noop} onVertexDragEnd={noop} onVertexDeactivate={noop}
              onDeleteVertex={noop} onAddVertexOnSegment={noop} onAddVertexOnClosingSegment={noop} />
          ) : null}
        </div>
        {activeTable && renderPopover ? (
          <div
            ref={popoverRef}
            className={placement?.docked ? "bo-salonMapPopover is-docked" : "bo-salonMapPopover"}
            role="dialog"
            aria-label={`Mesa ${activeTable.name}`}
            style={placement && !placement.docked ? { left: placement.left, top: placement.top } : placement ? undefined : { visibility: "hidden" }}
            data-testid={`${testId}-popover`}
            data-table-id={activeTable.id}
          >
            {renderPopover(activeTable, closePopover)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
