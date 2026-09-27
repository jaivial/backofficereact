import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { GitBranch, RefreshCw, Search, X } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { BORestaurant, BotPipelineDecisionRecord, BotPipelineResponse } from "../../../../../api/types";
import { SearchableSelect } from "../../../../../ui/inputs/SearchableSelect";

// Coordination id: wa_bot_dspy_pipeline_v1 / wa_bot_pipeline_visual_v2 -
// renders the DSPy + Jev decision tree served by the pipeline sidecar with
// node explanations, traffic heat, KPIs, Jev meters per decision and the
// requests forwarded to the management WhatsApp group.

const COL_W = 250;
const ROW_H = 100;

const KIND_LABEL: Record<string, string> = {
  start: "Inicio",
  classifier: "Clasificador",
  decision: "Decisión",
  handoff: "Deriva a gestión",
  agent: "Agente IA",
  enrich: "Enriquece el prompt",
};

const REASON_LABEL: Record<string, string> = {
  same_day: "Reserva para hoy",
  extras: "Extras",
  allergens: "Alérgenos",
  event_booking: "Evento",
  special_date_booking: "Fecha especial",
  human_anger: "Cliente molesto",
  human_cannot: "No puede resolverlo",
  human_repeat: "Insiste en el tema",
  agent_contact: "Derivado por el agente",
};

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

function seconds(ms?: number) {
  return ms ? `${(ms / 1000).toFixed(1)} s` : "—";
}

function Meter({ label, value, max = 1, danger, testId }: { label: string; value?: number; max?: number; danger?: number; testId: string }) {
  if (typeof value !== "number") return null;
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const hot = typeof danger === "number" && value >= danger;
  return (
    <div className="bo-pipelineMeter" data-testid={testId}>
      <div className="bo-pipelineMeterHead" data-testid={`${testId}-head`}>
        <span data-testid={`${testId}-label`}>{label}</span>
        <span className="bo-pipelineMeterValue" data-testid={`${testId}-value`}>{max === 1 ? `${Math.round(value * 100)}%` : `${value.toFixed(1)} / ${max}`}</span>
      </div>
      <div className="bo-pipelineMeterTrack" data-testid={`${testId}-track`}>
        <div className={`bo-pipelineMeterFill${hot ? " is-hot" : ""}`} style={{ width: `${pct}%` }} data-testid={`${testId}-fill`} />
      </div>
    </div>
  );
}

function Kpi({ label, value, hint, testId }: { label: string; value: string | number; hint?: string; testId: string }) {
  return (
    <div className="bo-pipelineKpi" data-testid={testId}>
      <span className="bo-pipelineKpiValue" data-testid={`${testId}-value`}>{value}</span>
      <span className="bo-pipelineKpiLabel" data-testid={`${testId}-label`}>{label}</span>
      {hint ? <span className="bo-pipelineKpiHint" data-testid={`${testId}-hint`}>{hint}</span> : null}
    </div>
  );
}

function topEntries(rec: Record<string, number> | undefined, n: number) {
  return Object.entries(rec ?? {}).sort((a, b) => b[1] - a[1]).slice(0, n);
}

export function ConfigBotPipeline({ restaurants, activeRestaurantId }: { restaurants: BORestaurant[]; activeRestaurantId: number }) {
  const api = useMemo(() => createClient({ baseUrl: "" }), []);
  const [restaurantId, setRestaurantId] = useState<number>(activeRestaurantId || restaurants[0]?.id || 0);
  const [data, setData] = useState<BotPipelineResponse | null>(null);
  const [selected, setSelected] = useState<BotPipelineDecisionRecord | null>(null);
  const [inspectedNode, setInspectedNode] = useState<string | null>(null);
  const [query, setQuery] = useState("");
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

  const stats = data?.stats;
  const visits = stats?.node_visits ?? {};
  const maxVisits = Math.max(1, ...Object.values(visits));
  const nodeById = useMemo(() => new Map((data?.graph?.nodes ?? []).map((n) => [n.id, n])), [data?.graph?.nodes]);

  const { nodes, edges } = useMemo(() => {
    if (!data?.graph) return { nodes: [] as Node[], edges: [] as Edge[] };
    const pos = layoutGraph(data.graph);
    const onPath = new Set(selected?.decision.path ?? []);
    const pathEdges = new Set<string>();
    const p = selected?.decision.path ?? [];
    for (let i = 1; i < p.length; i++) pathEdges.add(`${p[i - 1]}->${p[i]}`);
    return {
      nodes: data.graph.nodes.map((n) => {
        const v = visits[n.id] ?? 0;
        const heat = v === 0 ? 0 : Math.ceil((v / maxVisits) * 3);
        return {
          id: n.id,
          position: pos.get(n.id) ?? { x: 0, y: 0 },
          data: { label: v ? `${n.label}\n· ${v} ${v === 1 ? "vez" : "veces"}` : n.label },
          className: `bo-pipelineNode bo-pipelineNode--${n.kind} bo-pipelineHeat--${heat}${onPath.has(n.id) ? " is-onPath" : ""}${inspectedNode === n.id ? " is-inspected" : ""}`,
          draggable: false,
          connectable: false,
        };
      }),
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
  }, [data?.graph, selected, visits, maxVisits, inspectedNode]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = data?.decisions ?? [];
    const byNode = inspectedNode ? list.filter((d) => d.decision.path?.includes(inspectedNode)) : list;
    if (!q) return byNode;
    return byNode.filter((d) => `${d.message} ${d.decision.intent} ${d.decision.node} ${d.userPhone}`.toLowerCase().includes(q));
  }, [data?.decisions, query, inspectedNode]);

  const restaurantOptions = useMemo(() => restaurants.map((r) => ({ value: String(r.id), label: r.name })), [restaurants]);
  const inspected = inspectedNode ? nodeById.get(inspectedNode) : null;
  const dec = selected?.decision;
  const jev = dec?.jev;
  const thresholds = data?.graph?.thresholds ?? {};

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
          Cada mensaje de WhatsApp recorre este árbol. Pulsa un nodo para ver qué hace y qué conversaciones han pasado por él;
          pulsa una conversación para ver el camino que siguió y lo que midió Jev.
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

        {stats ? (
          <div className="bo-pipelineKpis" data-testid="config-bot-pipeline-kpis">
            <Kpi label="Mensajes analizados" value={stats.total} testId="config-bot-pipeline-kpi-total" />
            <Kpi label="Clasificación" value={`${stats.pipeline_ms.p50} ms`} hint={`p90 ${stats.pipeline_ms.p90} ms`} testId="config-bot-pipeline-kpi-pipeline-ms" />
            <Kpi label="Respuesta total" value={seconds(stats.turn_ms.p50)} hint={`p90 ${seconds(stats.turn_ms.p90)}`} testId="config-bot-pipeline-kpi-turn-ms" />
            <Kpi label="Clientes molestos" value={stats.angry} testId="config-bot-pipeline-kpi-angry" />
            <Kpi label="No podía resolverlo" value={stats.cannot_handle} testId="config-bot-pipeline-kpi-cannot" />
            <Kpi label="Enviado a gestión (30 días)" value={data?.management?.total ?? 0} hint={`${stats.duplicates} repetidos no reenviados`} testId="config-bot-pipeline-kpi-management" />
          </div>
        ) : null}

        {stats ? (
          <div className="bo-pipelineBreakdown" data-testid="config-bot-pipeline-breakdown">
            <div data-testid="config-bot-pipeline-breakdown-intents">
              <strong data-testid="config-bot-pipeline-breakdown-intents-title">Intenciones más frecuentes</strong>
              {topEntries(stats.intents, 6).map(([k, v]) => (
                <span key={k} className="bo-pipelineChip" data-testid={`config-bot-pipeline-intent-${k}`}>{k} · {v}</span>
              ))}
            </div>
            <div data-testid="config-bot-pipeline-breakdown-models">
              <strong data-testid="config-bot-pipeline-breakdown-models-title">Modelos que respondieron</strong>
              {topEntries(stats.models, 4).map(([k, v]) => (
                <span key={k} className="bo-pipelineChip" data-testid={`config-bot-pipeline-model-${k.replace(/[^a-z0-9]/gi, "-")}`}>{k} · {v}</span>
              ))}
            </div>
            <div data-testid="config-bot-pipeline-breakdown-languages">
              <strong data-testid="config-bot-pipeline-breakdown-languages-title">Idiomas</strong>
              {topEntries(stats.languages, 3).map(([k, v]) => (
                <span key={k} className="bo-pipelineChip" data-testid={`config-bot-pipeline-language-${k}`}>{k.toUpperCase()} · {v}</span>
              ))}
            </div>
          </div>
        ) : null}

        <div className="bo-pipelineLegend" data-testid="config-bot-pipeline-legend">
          {Object.entries(KIND_LABEL).map(([k, l]) => (
            <span key={k} className={`bo-pipelineLegendItem bo-pipelineLegendItem--${k}`} data-testid={`config-bot-pipeline-legend-${k}`}>{l}</span>
          ))}
          <span className="bo-pipelineLegendItem bo-pipelineLegendItem--heat" data-testid="config-bot-pipeline-legend-heat">Borde más grueso = más tráfico</span>
        </div>

        <div className="bo-pipelineCanvas" data-testid="config-bot-pipeline-canvas">
          {nodes.length > 0 ? (
            <ReactFlow nodes={nodes} edges={edges} fitView nodesDraggable={false} nodesConnectable={false} proOptions={{ hideAttribution: true }}
              onNodeClick={(_, n) => setInspectedNode((cur) => (cur === n.id ? null : n.id))}>
              <Background gap={24} />
              <MiniMap pannable zoomable className="bo-pipelineMiniMap" />
              <Controls showInteractive={false} />
            </ReactFlow>
          ) : (
            <div className="bo-pipelineEmpty" data-testid="config-bot-pipeline-empty">Grafo no disponible.</div>
          )}
        </div>

        {inspected ? (
          <div className="bo-pipelineInspector" data-testid="config-bot-pipeline-inspector">
            <div className="flex items-start justify-between gap-2" data-testid="config-bot-pipeline-inspector-head">
              <div data-testid="config-bot-pipeline-inspector-title-wrap">
                <span className={`bo-pipelineKind bo-pipelineKind--${inspected.kind}`} data-testid="config-bot-pipeline-inspector-kind">{KIND_LABEL[inspected.kind]}</span>
                <strong className="block" data-testid="config-bot-pipeline-inspector-title">{inspected.label}</strong>
              </div>
              <button type="button" className="bo-btn bo-btn--ghost bo-pressable" aria-label="Cerrar detalle del nodo" onClick={() => setInspectedNode(null)} data-testid="config-bot-pipeline-inspector-close">
                <X size={14} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
            {inspected.help ? <p className="bo-pipelineInspectorHelp" data-testid="config-bot-pipeline-inspector-help">{inspected.help}</p> : null}
            <div className="bo-pipelineInspectorStats" data-testid="config-bot-pipeline-inspector-stats">
              <span data-testid="config-bot-pipeline-inspector-visits">Pasaron {visits[inspected.id] ?? 0} mensajes</span>
              {stats?.terminal[inspected.id] ? (
                <span data-testid="config-bot-pipeline-inspector-terminal">Terminaron aquí {stats.terminal[inspected.id].count} · respuesta media {seconds(stats.terminal[inspected.id].avg_turn_ms)}</span>
              ) : null}
            </div>
            <span className="bo-pipelineInspectorFilter" data-testid="config-bot-pipeline-inspector-filter">La lista de conversaciones está filtrada por este nodo.</span>
          </div>
        ) : null}

        {selected && dec ? (
          <div className="bo-pipelineDetail" data-testid="config-bot-pipeline-detail">
            <div className="bo-pipelineDetailHead" data-testid="config-bot-pipeline-detail-head">
              <span className="bo-pipelineDetailMsg" data-testid="config-bot-pipeline-detail-message">
                {dec.turn?.transcribed ? "🎤 " : ""}“{selected.message}”
              </span>
              <span className="bo-pipelineDetailMeta" data-testid="config-bot-pipeline-detail-meta">
                {timeLabel(selected.createdAtMs)} · …{selected.userPhone.slice(-4)}
                {dec.turn?.burst && dec.turn.burst > 1 ? ` · ${dec.turn.burst} mensajes juntos` : ""}
              </span>
            </div>
            <div className="bo-pipelineDetailGrid" data-testid="config-bot-pipeline-detail-grid">
              <div data-testid="config-bot-pipeline-detail-facts">
                <dl className="bo-pipelineFacts" data-testid="config-bot-pipeline-detail-facts-list">
                  <dt data-testid="config-bot-pipeline-detail-intent-label">Intención</dt>
                  <dd data-testid="config-bot-pipeline-detail-intent">{dec.intent} · {Math.round((dec.confidence ?? 0) * 100)}% ({dec.classifier})</dd>
                  <dt data-testid="config-bot-pipeline-detail-node-label">Resultado</dt>
                  <dd data-testid="config-bot-pipeline-detail-node">{nodeById.get(dec.node)?.label ?? dec.node}</dd>
                  {dec.handoff_reason ? (<><dt data-testid="config-bot-pipeline-detail-reason-label">Motivo</dt><dd data-testid="config-bot-pipeline-detail-reason">{REASON_LABEL[dec.handoff_reason] ?? dec.handoff_reason}</dd></>) : null}
                  {dec.duplicate_request ? (<><dt data-testid="config-bot-pipeline-detail-dup-label">Gestión</dt><dd data-testid="config-bot-pipeline-detail-dup">Misma solicitud ya enviada: no se reenvió</dd></>) : null}
                  {dec.special_date ? (<><dt data-testid="config-bot-pipeline-detail-special-label">Fecha especial</dt><dd data-testid="config-bot-pipeline-detail-special">{dec.special_date}</dd></>) : null}
                  <dt data-testid="config-bot-pipeline-detail-language-label">Idioma</dt>
                  <dd data-testid="config-bot-pipeline-detail-language">{(dec.language ?? jev?.language ?? "es").toUpperCase()}</dd>
                  <dt data-testid="config-bot-pipeline-detail-model-label">Modelo</dt>
                  <dd data-testid="config-bot-pipeline-detail-model">{selected.modelUsed || "sin llamada al modelo"}</dd>
                  <dt data-testid="config-bot-pipeline-detail-time-label">Tiempos</dt>
                  <dd data-testid="config-bot-pipeline-detail-time">clasificación {dec.elapsed_ms} ms · respuesta {seconds(dec.turn?.total_ms)}{dec.turn?.iterations ? ` · ${dec.turn.iterations} rondas` : ""}</dd>
                  {dec.turn?.tools?.length ? (<><dt data-testid="config-bot-pipeline-detail-tools-label">Herramientas</dt><dd data-testid="config-bot-pipeline-detail-tools">{dec.turn.tools.join(", ")}</dd></>) : null}
                  {dec.routes?.length ? (<><dt data-testid="config-bot-pipeline-detail-routes-label">Reglas RAG</dt><dd data-testid="config-bot-pipeline-detail-routes">{dec.routes.join(", ")}</dd></>) : null}
                </dl>
              </div>
              <div className="bo-pipelineMeters" data-testid="config-bot-pipeline-detail-meters">
                <strong data-testid="config-bot-pipeline-detail-meters-title">Lo que midió Jev</strong>
                <Meter label="Enfado" value={jev?.anger ?? dec.anger} max={3} danger={thresholds.anger_handoff} testId="config-bot-pipeline-meter-anger" />
                <Meter label="¿Puede resolverlo?" value={jev?.can_handle ?? dec.can_handle} testId="config-bot-pipeline-meter-can-handle" />
                <Meter label="Evento / negociación" value={jev?.event} danger={thresholds.event_min} testId="config-bot-pipeline-meter-event" />
                <Meter label="Necesidad especial" value={jev?.special_needs} testId="config-bot-pipeline-meter-special-needs" />
                <Meter label="Pide anotarlo" value={jev?.wants_note} testId="config-bot-pipeline-meter-wants-note" />
                <Meter label="Mismo tema abierto" value={jev?.same_topic} danger={thresholds.same_topic_min} testId="config-bot-pipeline-meter-same-topic" />
                <Meter label="Solicitud ya enviada" value={jev?.same_request} danger={thresholds.same_request_min} testId="config-bot-pipeline-meter-same-request" />
              </div>
            </div>
            <ol className="bo-pipelineSteps" data-testid="config-bot-pipeline-detail-steps">
              {dec.path.map((id, i) => (
                <li key={`${id}-${i}`} className={`bo-pipelineStep bo-pipelineStep--${nodeById.get(id)?.kind ?? "decision"}`} data-testid={`config-bot-pipeline-step-${i}`}>
                  {nodeById.get(id)?.label ?? id}
                </li>
              ))}
            </ol>
            {dec.directive ? (
              <p className="bo-pipelineDirective" data-testid="config-bot-pipeline-detail-directive"><strong>Instrucción al agente:</strong> {dec.directive}</p>
            ) : null}
          </div>
        ) : null}

        <div className="bo-pipelineSearch" data-testid="config-bot-pipeline-search">
          <Search size={14} strokeWidth={1.5} aria-hidden="true" />
          <input className="bo-input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por mensaje, intención, resultado o teléfono"
            aria-label="Buscar conversaciones" data-testid="config-bot-pipeline-search-input" />
          <span className="bo-pipelineSearchCount" data-testid="config-bot-pipeline-search-count">{filtered.length}</span>
        </div>

        <ul className="bo-pipelineList" data-testid="config-bot-pipeline-decisions">
          {filtered.map((d) => (
            <li key={d.id} data-testid={`config-bot-pipeline-decision-${d.id}`}>
              <button type="button" className={`bo-pipelineItem bo-pressable${selected?.id === d.id ? " is-selected" : ""}`}
                onClick={() => setSelected(d)} aria-pressed={selected?.id === d.id} data-testid={`config-bot-pipeline-decision-btn-${d.id}`}>
                <span className="bo-pipelineItemMeta" data-testid={`config-bot-pipeline-decision-meta-${d.id}`}>
                  {timeLabel(d.createdAtMs)} · …{d.userPhone.slice(-4)} · {d.decision.intent} → {nodeById.get(d.decision.node)?.label ?? d.decision.node}
                </span>
                <span className="bo-pipelineItemText" data-testid={`config-bot-pipeline-decision-text-${d.id}`}>{d.message}</span>
              </button>
            </li>
          ))}
          {data && filtered.length === 0 ? (
            <li className="bo-pipelineEmpty" data-testid="config-bot-pipeline-decisions-empty">No hay conversaciones con este filtro.</li>
          ) : null}
        </ul>

        {data?.management ? (
          <div className="bo-pipelineManagement" data-testid="config-bot-pipeline-management">
            <strong data-testid="config-bot-pipeline-management-title">Solicitudes enviadas al grupo de gestión (últimos 30 días)</strong>
            <div className="bo-pipelineBreakdownRow" data-testid="config-bot-pipeline-management-reasons">
              {topEntries(data.management.by_reason, 9).map(([k, v]) => (
                <span key={k} className="bo-pipelineChip" data-testid={`config-bot-pipeline-management-reason-${k}`}>{REASON_LABEL[k] ?? k} · {v}</span>
              ))}
            </div>
            <ul className="bo-pipelineList" data-testid="config-bot-pipeline-management-list">
              {data.management.recent.map((r, i) => (
                <li key={`${r.createdAtMs}-${i}`} className="bo-pipelineItem" data-testid={`config-bot-pipeline-management-item-${i}`}>
                  <span className="bo-pipelineItemMeta" data-testid={`config-bot-pipeline-management-item-meta-${i}`}>
                    {timeLabel(r.createdAtMs)} · …{r.userPhone.slice(-4)} · {REASON_LABEL[r.reason] ?? r.reason}{r.groupSent ? "" : " · no enviado (tarjeta)"}
                  </span>
                  <span className="bo-pipelineItemText" data-testid={`config-bot-pipeline-management-item-text-${i}`}>{r.summary}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
