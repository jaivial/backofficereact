import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeChange,
  type NodePositionChange,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";

import { createClient } from "../../../../api/client";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../../../../state/atoms";

type TableStatus = "available" | "occupied" | "reserved";

type TableRecord = {
  id: number;
  restaurant_id?: number;
  area_id?: number;
  name: string;
  capacity: number;
  x_pos: number;
  y_pos: number;
  status: TableStatus;
};

type TableNodeData = {
  name: string;
  capacity: number;
  status: TableStatus;
};

type TablesPatchInput = {
  x_pos?: number;
  y_pos?: number;
  status?: TableStatus;
};

type TablesCreateInput = {
  area_id?: number;
  name: string;
  capacity: number;
  x_pos: number;
  y_pos: number;
};

type PremiumTablesApi = {
  list?: () => Promise<unknown>;
  patch?: (id: number, input: TablesPatchInput) => Promise<unknown>;
  create?: (input: TablesCreateInput) => Promise<unknown>;
  getWebSocketUrl?: () => string;
};

type PremiumTablesClient = ReturnType<typeof createClient> & {
  premium?: {
    tables?: PremiumTablesApi;
  };
};

type TableWsMessage = {
  type?: string;
  event?: string;
  table_id?: number | string;
  id?: number | string;
  status?: string;
  x_pos?: number;
  y_pos?: number;
  table?: unknown;
};

type PositionedNodeChange = NodePositionChange & {
  position: { x: number; y: number };
};

function isPositionedNodeChange(change: NodeChange): change is PositionedNodeChange {
  return change.type === "position" && Boolean(change.position);
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(value: unknown): TableStatus {
  if (value === "occupied" || value === "reserved") return value;
  return "available";
}

function asTableRecord(value: unknown): TableRecord | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const id = toFiniteNumber(v.id, NaN);
  if (!Number.isFinite(id)) return null;

  return {
    id,
    restaurant_id: Number.isFinite(toFiniteNumber(v.restaurant_id, NaN)) ? toFiniteNumber(v.restaurant_id, NaN) : undefined,
    area_id: Number.isFinite(toFiniteNumber(v.area_id, NaN)) ? toFiniteNumber(v.area_id, NaN) : undefined,
    name: String(v.name ?? `Mesa ${id}`),
    capacity: Math.max(1, Math.round(toFiniteNumber(v.capacity, 4))),
    x_pos: toFiniteNumber(v.x_pos, 0),
    y_pos: toFiniteNumber(v.y_pos, 0),
    status: normalizeStatus(v.status),
  };
}

function extractTables(value: unknown): TableRecord[] {
  if (Array.isArray(value)) {
    return value.map(asTableRecord).filter((t): t is TableRecord => t !== null);
  }
  if (!value || typeof value !== "object") return [];

  const root = value as Record<string, unknown>;
  const direct = root.tables;
  if (Array.isArray(direct)) {
    return direct.map(asTableRecord).filter((t): t is TableRecord => t !== null);
  }

  const data = root.data;
  if (Array.isArray(data)) {
    return data.map(asTableRecord).filter((t): t is TableRecord => t !== null);
  }

  if (data && typeof data === "object") {
    const nested = (data as Record<string, unknown>).tables;
    if (Array.isArray(nested)) {
      return nested.map(asTableRecord).filter((t): t is TableRecord => t !== null);
    }
  }

  return [];
}

const statusClassByValue: Record<TableStatus, string> = {
  available: "is-available",
  occupied: "is-occupied",
  reserved: "is-reserved",
};

function TableNode({ data }: NodeProps<TableNodeData>) {
  const statusClass = statusClassByValue[data.status] ?? statusClassByValue.available;

  return (
    <div
      className={`bo-card bo-card--glass ${statusClass}`}
      style={{
        width: 112,
        height: 112,
        borderRadius: 999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid var(--bo-border)",
        boxShadow: "var(--bo-shadow-soft)",
        padding: 8,
        gap: 2,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.15, textAlign: "center" }}>{data.name}</div>
      <div className="bo-mutedText" style={{ fontSize: 12, lineHeight: 1 }}>{data.capacity} pax</div>
    </div>
  );
}

const nodeTypes = { restaurantTable: TableNode };

const LEGEND: Array<{ key: TableStatus; label: string }> = [
  { key: "available", label: "Libre" },
  { key: "reserved", label: "Reservada" },
  { key: "occupied", label: "Ocupada" },
];

export default function TableManagerPage() {
  const session = useAtomValue(sessionAtom);
  const client = useMemo(() => createClient({ baseUrl: "" }) as PremiumTablesClient, []);
  const { pushToast } = useToasts();

  const [tables, setTables] = useState<TableRecord[]>([]);
  const [busy, setBusy] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  useErrorToast(error);

  const reconnectAttemptRef = useRef<number>(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const tablesApi = client.premium?.tables;

  const nodes = useMemo<Node<TableNodeData>[]>(() => {
    return tables.map((table) => ({
      id: String(table.id),
      type: "restaurantTable",
      position: {
        x: table.x_pos,
        y: table.y_pos,
      },
      data: {
        name: table.name,
        capacity: table.capacity,
        status: table.status,
      },
      draggable: true,
    }));
  }, [tables]);

  const edges = useMemo<Edge[]>(() => [], []);

  const upsertTable = useCallback((next: TableRecord) => {
    setTables((prev) => {
      const idx = prev.findIndex((t) => t.id === next.id);
      if (idx === -1) return [...prev, next];
      const copy = prev.slice();
      copy[idx] = { ...copy[idx], ...next };
      return copy;
    });
  }, []);

  const loadInitial = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      if (typeof tablesApi?.list !== "function") {
        setTables([]);
        setError("No se pudo cargar el mapa de mesas.");
        return;
      }

      const payload = await tablesApi.list();
      setTables(extractTables(payload));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el mapa de mesas.");
    } finally {
      setBusy(false);
    }
  }, [tablesApi]);

  useEffect(() => {
    if (!session) {
      setTables([]);
      setBusy(false);
      return;
    }
    void loadInitial();
  }, [loadInitial, session]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const moves = changes.filter(isPositionedNodeChange);
    if (moves.length === 0) return;

    setTables((prev) => {
      let next = prev;
      for (const move of moves) {
        const tableId = Number(move.id);
        if (!Number.isFinite(tableId)) continue;
        next = next.map((table) => {
          if (table.id !== tableId) return table;
          return {
            ...table,
            x_pos: move.position.x,
            y_pos: move.position.y,
          };
        });
      }
      return next;
    });
  }, []);

  const patchTablePosition = useCallback(
    async (tableId: number, x: number, y: number) => {
      if (typeof tablesApi?.patch !== "function") return;
      try {
        await tablesApi.patch(tableId, {
          x_pos: Math.round(x),
          y_pos: Math.round(y),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "No se pudo guardar la posición de la mesa.");
      }
    },
    [tablesApi],
  );

  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node<TableNodeData>) => {
      const tableId = Number(node.id);
      if (!Number.isFinite(tableId)) return;

      const x = Math.round(node.position.x);
      const y = Math.round(node.position.y);

      setTables((prev) => prev.map((table) => (table.id === tableId ? { ...table, x_pos: x, y_pos: y } : table)));
      void patchTablePosition(tableId, x, y);
    },
    [patchTablePosition],
  );

  useEffect(() => {
    if (!session) return;
    if (typeof tablesApi?.getWebSocketUrl !== "function") return;

    let cancelled = false;

    const scheduleReconnect = () => {
      if (cancelled) return;
      reconnectAttemptRef.current = reconnectAttemptRef.current + 1;
      const delay = Math.min(5000, 500 * 2 ** Math.min(5, reconnectAttemptRef.current));
      reconnectTimerRef.current = setTimeout(connect, delay);
    };

    const connect = () => {
      if (cancelled) return;

      try {
        const wsUrl = tablesApi.getWebSocketUrl?.();
        if (!wsUrl) return;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          reconnectAttemptRef.current = 0;
        };

        ws.onmessage = (event: MessageEvent<string>) => {
          let msg: TableWsMessage;
          try {
            msg = JSON.parse(event.data) as TableWsMessage;
          } catch {
            return;
          }

          const type = String(msg.type ?? msg.event ?? "");

          if (
            type === "table_updated" ||
            type === "table.position.updated" ||
            type === "table.status.updated" ||
            type === "table_status_changed" ||
            type === "table_position_rebased"
          ) {
            const tableIdRaw = msg.table_id ?? msg.id;
            const tableId = Number(tableIdRaw);
            if (!Number.isFinite(tableId)) return;

            setTables((prev) => {
              let changed = false;
              const next = prev.map((table) => {
                if (table.id !== tableId) return table;

                const updated: TableRecord = {
                  ...table,
                  status: msg.status ? normalizeStatus(msg.status) : table.status,
                  x_pos: Number.isFinite(toFiniteNumber(msg.x_pos, NaN)) ? toFiniteNumber(msg.x_pos, table.x_pos) : table.x_pos,
                  y_pos: Number.isFinite(toFiniteNumber(msg.y_pos, NaN)) ? toFiniteNumber(msg.y_pos, table.y_pos) : table.y_pos,
                };

                const same =
                  updated.status === table.status &&
                  updated.x_pos === table.x_pos &&
                  updated.y_pos === table.y_pos;

                if (!same) changed = true;
                return same ? table : updated;
              });

              return changed ? next : prev;
            });
            return;
          }

          if (type === "table_created") {
            const created = asTableRecord(msg.table);
            if (created) upsertTable(created);
          }
        };

        ws.onclose = () => {
          if (cancelled) return;
          scheduleReconnect();
        };

        ws.onerror = () => {
          ws.close();
        };
      } catch {
        scheduleReconnect();
      }
    };

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [session, tablesApi, upsertTable]);

  const canAddTable = typeof tablesApi?.create === "function";

  const handleAddTable = useCallback(async () => {
    if (!canAddTable || !tablesApi?.create) return;
    setError(null);

    const nextIndex = tables.length + 1;
    const input: TablesCreateInput = {
      name: `Mesa ${nextIndex}`,
      capacity: 4,
      x_pos: 120 + nextIndex * 12,
      y_pos: 120 + nextIndex * 10,
    };

    try {
      const payload = await tablesApi.create(input);
      const [created] = extractTables(payload);
      if (created) {
        upsertTable(created);
      }
      pushToast({ kind: "success", title: "Mesa creada" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear la mesa.");
    }
  }, [canAddTable, pushToast, tables.length, tablesApi, upsertTable]);

  if (busy) {
    return <div className="bo-panel">Cargando mapa de mesas...</div>;
  }

  return (
    <div className="bo-stack" style={{ height: "calc(100vh - 140px)", minHeight: 520 }}>
      <div className="bo-toolbar">
        <div className="bo-toolbarLeft">
          <h1 className="bo-panelTitle">Mapa de mesas</h1>
          <span className="bo-mutedText">Arrastra para reorganizar en tiempo real</span>
        </div>
        <div className="bo-toolbarRight">
          {canAddTable ? (
            <button className="bo-btn bo-btn--primary" type="button" onClick={() => void handleAddTable()}>
              + Añadir mesa
            </button>
          ) : null}
        </div>
      </div>

      <div className="bo-panel" style={{ flex: 1, minHeight: 0, padding: 0, overflow: "hidden" }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          className="bo-flow"
          minZoom={0.3}
          maxZoom={2}
        >
          <Background gap={20} color="var(--bo-border)" />
          <Controls />
        </ReactFlow>

        <div
          className="bo-card bo-card--glass"
          style={{
            position: "absolute",
            left: 16,
            bottom: 16,
            zIndex: 20,
            display: "flex",
            gap: 12,
            padding: "10px 12px",
          }}
        >
          {LEGEND.map((item) => (
            <div key={item.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span
                aria-hidden="true"
                className={statusClassByValue[item.key]}
                style={{ width: 10, height: 10, borderRadius: 999, display: "inline-block" }}
              />
              <span className="bo-mutedText" style={{ fontSize: 12 }}>
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .bo-flow {
          background:
            radial-gradient(circle at 20% 20%, color-mix(in srgb, var(--bo-surface) 70%, transparent), transparent 55%),
            var(--bo-bg);
        }

        .bo-flow .react-flow__controls {
          background: var(--bo-surface);
          border: 1px solid var(--bo-border);
          border-radius: 10px;
        }

        .is-available {
          background: color-mix(in srgb, #18a957 22%, var(--bo-surface));
        }

        .is-reserved {
          background: color-mix(in srgb, #d8b118 24%, var(--bo-surface));
        }

        .is-occupied {
          background: color-mix(in srgb, #d13e3e 24%, var(--bo-surface));
        }
      `}</style>
    </div>
  );
}
