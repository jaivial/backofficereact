import React, { useEffect, useState, useCallback, useRef } from "react";
import ReactFlow, { 
  Background, 
  Controls, 
  Node, 
  Edge, 
  useNodesState, 
  useEdgesState,
  NodeChange,
  applyNodeChanges
} from "reactflow";
import "reactflow/dist/style.css";

import { createClient } from "../../../../api/client";
import { useToasts } from "../../../../ui/feedback/useToasts";
import { useErrorToast } from "../../../../ui/feedback/useErrorToast";
import { useAtomValue } from "jotai";
import { sessionAtom } from "../../../../state/atoms";
import { Button } from "../../../../ui/actions/Button";

interface TableElement {
  id: number;
  restaurant_id: number;
  area_id: number;
  name: string;
  capacity: int;
  x_pos: number;
  y_pos: number;
  status: "available" | "occupied" | "reserved";
}

interface TableArea {
  id: number;
  restaurant_id: number;
  name: string;
  bg_color: string;
  tables: TableElement[];
}

const TableNode = ({ data }: any) => {
  const statusColors = {
    available: "bg-green-500",
    occupied: "bg-red-500",
    reserved: "bg-yellow-500",
  };
  
  return (
    <div className={`w-24 h-24 rounded-full flex flex-col items-center justify-center border-4 border-slate-800 text-white ${statusColors[data.status as keyof typeof statusColors] || "bg-slate-600"} shadow-lg transition-colors`}>
      <span className="font-bold text-lg">{data.name}</span>
      <span className="text-xs opacity-80">{data.capacity} pax</span>
    </div>
  );
};

const nodeTypes = {
  restaurantTable: TableNode,
};

export default function TableManagerPage() {
  const { addToast } = useToasts();
  const { handleError } = useErrorToast();
  const client = createClient();
  const session = useAtomValue(sessionAtom);

  const [areas, setAreas] = useState<TableArea[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [nodes, setNodes] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    loadTables();
  }, []);

  useEffect(() => {
    if (!session) return;
    
    const isSecure = window.location.protocol === "https:";
    const wsUrl = `${isSecure ? "wss" : "ws"}://${window.location.host}/api/admin/tables/ws`;
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "table_updated") {
          setNodes((nds) => 
            nds.map((n) => {
              if (n.id === data.table_id.toString()) {
                return {
                  ...n,
                  position: { x: data.x_pos || n.position.x, y: data.y_pos || n.position.y },
                  data: { ...n.data, status: data.status || n.data.status },
                };
              }
              return n;
            })
          );
        } else if (data.type === "table_created") {
          const t = data.table;
          setNodes((nds) => [
            ...nds, 
            {
              id: t.id.toString(),
              type: "restaurantTable",
              position: { x: t.x_pos, y: t.y_pos },
              data: { name: t.name, capacity: t.capacity, status: t.status },
            }
          ]);
        }
      } catch (e) {
        console.error("WS parse error", e);
      }
    };

    return () => {
      ws.current?.close();
    };
  }, [session]);

  async function loadTables() {
    try {
      setLoading(true);
      const res = await client.request<{ success: boolean; data: TableArea[] }>("/admin/tables", {
        method: "GET",
      });
      if (res.success && res.data) {
        setAreas(res.data);
        
        const initialNodes: Node[] = [];
        res.data.forEach(area => {
          area.tables.forEach(t => {
            initialNodes.push({
              id: t.id.toString(),
              type: "restaurantTable",
              position: { x: t.x_pos, y: t.y_pos },
              data: { name: t.name, capacity: t.capacity, status: t.status },
            });
          });
        });
        setNodes(initialNodes);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  }

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      
      changes.forEach(change => {
        if (change.type === "position" && change.dragging === false && change.position) {
          saveTablePosition(change.id, change.position.x, change.position.y);
        }
      });
    },
    [setNodes]
  );

  async function saveTablePosition(id: string, x: number, y: number) {
    try {
      await client.request("/admin/tables", {
        method: "PUT",
        body: JSON.stringify({ id: parseInt(id), x_pos: Math.round(x), y_pos: Math.round(y) }),
      });
    } catch (err) {
      console.error("Failed to save position", err);
    }
  }

  async function handleAddTable() {
    if (areas.length === 0) {
      try {
        const resArea = await client.request<{ success: boolean; data: any }>("/admin/areas", {
          method: "POST",
          body: JSON.stringify({ name: "Salón Principal" }),
        });
        if (resArea.success) {
          setAreas([resArea.data]);
          createTableAPI(resArea.data.id);
        }
      } catch (err) {
        handleError(err);
      }
      return;
    }
    createTableAPI(areas[0].id);
  }

  async function createTableAPI(areaId: number) {
    try {
      await client.request<{ success: boolean; data: any }>("/admin/tables", {
        method: "POST",
        body: JSON.stringify({ 
          area_id: areaId,
          name: "Mesa " + (nodes.length + 1),
          capacity: 4,
          x_pos: 100 + (nodes.length * 20),
          y_pos: 100 + (nodes.length * 20)
        }),
      });
    } catch (err) {
      handleError(err);
    }
  }

  if (loading) {
    return <div className="p-6">Cargando mapa...</div>;
  }

  return (
    <div className="flex flex-col h-screen max-h-screen">
      <header className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900">
        <div>
          <h1 className="text-xl font-bold text-slate-100">Table Manager</h1>
          <p className="text-xs text-slate-400 mt-1">Arrastra las mesas para organizar tu sala en tiempo real</p>
        </div>
        <div className="flex items-center gap-4">
          <Button variant="primary" onClick={handleAddTable}>
            + Añadir Mesa
          </Button>
        </div>
      </header>

      <div className="flex-1 w-full bg-slate-800 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView
          className="bg-slate-800"
        >
          <Background color="#475569" gap={20} />
          <Controls className="bg-slate-900 border-slate-700 fill-slate-200" />
        </ReactFlow>
        
        <div className="absolute bottom-6 left-6 flex gap-4 bg-slate-900/80 p-3 rounded-lg border border-slate-700 shadow-xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500 border border-slate-900"></div>
            <span className="text-xs text-slate-300 font-medium">Libre</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-yellow-500 border border-slate-900"></div>
            <span className="text-xs text-slate-300 font-medium">Reservada</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500 border border-slate-900"></div>
            <span className="text-xs text-slate-300 font-medium">Ocupada</span>
          </div>
        </div>
      </div>
    </div>
  );
}