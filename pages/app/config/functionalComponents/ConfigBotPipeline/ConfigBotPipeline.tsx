import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { GitBranch, RefreshCw } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { BORestaurant, BotPipelineDecisionRecord, BotPipelineResponse } from "../../../../../api/types";
import { SearchableSelect } from "../../../../../ui/inputs/SearchableSelect";

// Coordination id: wa_bot_dspy_pipeline_v1 - renders the DSPy/Jev decision
// tree served by the pipeline sidecar and overlays the real paths taken by
// recent WhatsApp turns (stored in the bot SQLite).

const COL_W = 250;
const ROW_H = 96;

// layoutGraph places nodes in layers by longest path from the root so the
// if/else tree reads top-to-bottom with no manual coordinates.
function layoutGraph(graph: NonNullable<BotPipelineResponse["graph"]>) {
  const depth = new Map<string, number>([[graph.nodes[0]?.id ?? "", 0]]);
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    for (const e of graph.edges) {
      const d = depth.get(e.from);
      if (d !== undefined && (depth.get(e.to) ?? -1) < d + 1) depth.set(e.to, d + 1);
    }
  }
  const rows = new Map<number, string[]>();
  for (const n of graph.nodes) {
    const d = depth.get(n.id) ?? 0;
    rows.set(d, [...(rows.get(d) ?? []), n.id]);
  }
  const pos = new Map<string, { x: number; y: number }>();
  rows.forEach((ids, d) => ids.forEach((id, i) => pos.set(id, { x: (i - (ids.length - 1) / 2) * COL_W, y: d * ROW_H })));
  return pos;
}

function timeLabel(ms: number) {
  return new Date(ms).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ConfigBotPipeline({ restaurants, activeRestaurantId }: { restaurants: BORestaurant[]; activeRestaurantId: number }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [restaurantId, setRestaurantId] = useState<number>(activeRestaurantId || restaurants[0]?.id || 0);
  const [data, setData] = useState<BotPipelineResponse | null>(null);
  const [selected, setSelected] = useState<BotPipelineDecisionRecord | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const res = await api.config.getBotPipeline(restaurantId);
      if (res.success) {
        setData(res);
        setSelected(res.decisions[0] ?? null);
      }
    } finally {
      setLoading(false);
    }
  }, [api.config, restaurantId]);

  useEffect(() => { void load(); }, [load]);

  const traffic = useMemo(() => {
    const counts = new Map<string, number>();
    for (const d of data?.decisions ?? []) for (const id of d.decision.path ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
    return counts;
  }, [data?.decisions]);

  const { nodes, edges } = useMemo(() => {
    if (!data?.graph) return { nodes: [] as Node[], edges: [] as Edge[] };
    const pos = layoutGraph(data.graph);
    const onPath = new Set(selected?.decision.path ?? []);
    const pathEdges = new Set<string>();
    const p = selected?.decision.path ?? [];
    for (let i = 1; i < p.length; i++) pathEdges.add(`${p[i - 1]}->${p[i]}`);
    return {
      nodes: data.graph.nodes.map((n) => ({
        id: n.id,
        position: pos.get(n.id) ?? { x: 0, y: 0 },
        data: { label: `${n.label}${traffic.get(n.id) ? ` · ${traffic.get(n.id)}` : ""}` },
        className: `bo-pipelineNode bo-pipelineNode--${n.kind}${onPath.has(n.id) ? " is-onPath" : ""}`,
        draggable: false,
        connectable: false,
      })),
      edges: data.graph.edges.map((e) => {
        const active = pathEdges.has(`${e.from}->${e.to}`);
        return {
          id: `${e.from}->${e.to}`,
          source: e.from,
          target: e.to,
          label: e.label,
          animated: active,
          className: active ? "bo-pipelineEdge is-onPath" : "bo-pipelineEdge",
          markerEnd: { type: MarkerType.ArrowClosed },
        };
      }),
    };
  }, [data?.graph, selected, traffic]);

  const restaurantOptions = useMemo(() => restaurants.map((r) => ({ value: String(r.id), label: r.name })), [restaurants]);

  return (
    <div className="bo-panel" data-ui="config-bot-pipeline" data-testid="config-bot-pipeline">
      <div className="bo-panelHead flex-col items-stretch gap-1" data-testid="config-bot-pipeline-head">
        <div className="flex items-center justify-between gap-2" data-testid="config-bot-pipeline-title-row">
          <div className="bo-panelTitle flex items-center gap-2" data-testid="config-bot-pipeline-title">
            <GitBranch size={18} strokeWidth={2} className="text-[var(--bo-accent)]" aria-hidden="true" />
            Pipeline de decisión del bot (DSPy + Jev)
          </div>
          <button type="button" className="bo-btn bo-btn--ghost gap-1.5 bo-pressable" onClick={() => void load()} disabled={loading} data-testid="config-bot-pipeline-refresh-btn">
            <RefreshCw size={14} strokeWidth={2} aria-hidden="true" /> {loading ? "Cargando..." : "Actualizar"}
          </button>
        </div>
        <div className="bo-panelMeta" data-testid="config-bot-pipeline-meta">
          Cada mensaje de WhatsApp recorre este árbol: Jev clasifica la intención, las necesidades especiales y la frustración;
          si la confianza es baja, DSPy desambigua con el historial. Pulsa una conversación para ver el camino que siguió.
          <span className={`bo-pipelineStatus${data?.online ? " is-online" : ""}`} data-testid="config-bot-pipeline-status">
            {data?.online ? "Pipeline en línea" : "Pipeline fuera de línea (se usan las reglas clásicas)"}
          </span>
        </div>
      </div>

      <div className="bo-panelBody flex flex-col gap-4" data-testid="config-bot-pipeline-body">
        {restaurants.length > 1 ? (
          <SearchableSelect value={String(restaurantId)} onChange={(v) => setRestaurantId(Number(v) || 0)} options={restaurantOptions}
            ariaLabel="Restaurante" searchPlaceholder="Buscar restaurante..." data-testid="config-bot-pipeline-restaurant-select" />
        ) : null}

        <div className="bo-pipelineCanvas" data-testid="config-bot-pipeline-canvas">
          {nodes.length > 0 ? (
            <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} proOptions={{ hideAttribution: true }}>
              <Background gap={24} />
              <Controls showInteractive={false} />
            </ReactFlow>
          ) : (
            <div className="bo-pipelineEmpty" data-testid="config-bot-pipeline-empty">Grafo no disponible.</div>
          )}
        </div>

        {selected ? (
          <div className="bo-pipelineDetail" data-testid="config-bot-pipeline-detail">
            <strong data-testid="config-bot-pipeline-detail-intent">{selected.decision.intent}</strong>
            <span data-testid="config-bot-pipeline-detail-confidence">confianza {Math.round((selected.decision.confidence ?? 0) * 100)}%</span>
            <span data-testid="config-bot-pipeline-detail-classifier">{selected.decision.classifier}</span>
            <span data-testid="config-bot-pipeline-detail-model">{selected.modelUsed || "sin llamada al modelo"}</span>
            <span data-testid="config-bot-pipeline-detail-ms">{selected.decision.elapsed_ms} ms</span>
            {typeof selected.decision.anger === "number" ? (
              <span data-testid="config-bot-pipeline-detail-anger">enfado {selected.decision.anger.toFixed(1)}/3</span>
            ) : null}
            {typeof selected.decision.can_handle === "number" ? (
              <span data-testid="config-bot-pipeline-detail-can-handle">puede resolverlo {Math.round(selected.decision.can_handle * 100)}%</span>
            ) : null}
          </div>
        ) : null}

        <ul className="bo-pipelineList" data-testid="config-bot-pipeline-decisions">
          {(data?.decisions ?? []).map((d) => (
            <li key={d.id} data-testid={`config-bot-pipeline-decision-${d.id}`}>
              <button type="button" className={`bo-pipelineItem bo-pressable${selected?.id === d.id ? " is-selected" : ""}`}
                onClick={() => setSelected(d)} aria-pressed={selected?.id === d.id} data-testid={`config-bot-pipeline-decision-btn-${d.id}`}>
                <span className="bo-pipelineItemMeta" data-testid={`config-bot-pipeline-decision-meta-${d.id}`}>
                  {timeLabel(d.createdAtMs)} · …{d.userPhone.slice(-4)} · {d.decision.node}
                </span>
                <span className="bo-pipelineItemText" data-testid={`config-bot-pipeline-decision-text-${d.id}`}>{d.message}</span>
              </button>
            </li>
          ))}
          {data && data.decisions.length === 0 ? (
            <li className="bo-pipelineEmpty" data-testid="config-bot-pipeline-decisions-empty">Todavía no hay conversaciones procesadas por el pipeline.</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
