import React, { useEffect, useMemo, useState } from "react";
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

/**
 * Read-only salon map (same React Flow nodes as the reservas table manager).
 * Loads its own layout for `date`, lets the user switch floors, pan and zoom,
 * and reports table taps. Callers decide each table's status.
 */
export function SalonMap({ date, testId, getStatus, onTableClick }: {
  date: string;
  testId: string;
  getStatus?: (table: TableMapItem) => TableStatus;
  onTableClick?: (tableId: number) => void;
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
      <div className="bo-salonMapCanvas" data-testid={`${testId}-canvas`}>
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
            onNodeClick={(_event, node) => { if (node.type === "restaurantTable") onTableClick?.(Number(node.id)); }}
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
      </div>
    </div>
  );
}
