import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, { Background, Controls, MarkerType, MiniMap, type Edge, type Node } from "reactflow";
import "reactflow/dist/style.css";
import { BrainCircuit, ChevronDown, GitBranch, RefreshCw, Search, X } from "lucide-react";

import { createClient } from "../../../../../api/client";
import type { BORestaurant, BotPipelineDecisionRecord, BotPipelineDspyInfo, BotPipelineDspyRun, BotPipelineNodeDetail, BotPipelineResponse } from "../../../../../api/types";
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

const STAGE_LABEL: Record<string, string> = {
  new_request: "Petición nueva",
  providing_data: "Da los datos pedidos",
  confirming: "Confirma la propuesta",
  rejecting: "Rechaza / corrige",
  choosing_option: "Elige una opción",
  small_talk: "Saludo / cortesía",
};

const OP_LABEL: Record<string, string> = {
  create: "Reserva nueva",
  modify_time: "Cambiar hora",
  modify_date: "Cambiar día",
  modify_people: "Cambiar personas",
  modify_rice: "Cambiar arroz",
  modify_other: "Otro cambio",
  cancel: "Cancelar",
  none: "No es de reserva",
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

function pct(v: number) {
  return `${Math.round(v * 100)} %`;
}

// Structured node detail (wa_bot_dspy_compiled_v4): what the node reads
// (Jev questions / DB facts), its exact condition, what happens, tools.
function NodeDetail({ d }: { d: BotPipelineNodeDetail }) {
  return (
    <dl className="bo-pipelineDetailList" data-testid="config-bot-pipeline-node-detail">
      {d.engine ? (<><dt data-testid="config-bot-pipeline-node-detail-engine-label">Motor</dt><dd data-testid="config-bot-pipeline-node-detail-engine"><span className="bo-pipelineEngine" data-testid="config-bot-pipeline-node-detail-engine-badge">{d.engine}</span>{d.latency ? <span className="bo-pipelineLatency" data-testid="config-bot-pipeline-node-detail-latency">{d.latency}</span> : null}</dd></>) : null}
      {d.jev?.length ? (
        <><dt data-testid="config-bot-pipeline-node-detail-jev-label">Preguntas a Jev</dt>
          <dd data-testid="config-bot-pipeline-node-detail-jev">
            <ul className="bo-pipelineTagList" data-testid="config-bot-pipeline-node-detail-jev-list">
              {d.jev.map((q) => <li key={q.question} className="bo-pipelineTag" data-testid={`config-bot-pipeline-node-detail-jev-${q.question}`}><code data-testid={`config-bot-pipeline-node-detail-jev-${q.question}-name`}>{q.question}</code> <span data-testid={`config-bot-pipeline-node-detail-jev-${q.question}-type`}>{q.type}</span></li>)}
            </ul>
          </dd></>
      ) : null}
      {d.facts?.length ? (<><dt data-testid="config-bot-pipeline-node-detail-facts-label">Datos que consulta</dt><dd data-testid="config-bot-pipeline-node-detail-facts"><ul className="bo-pipelineBullets" data-testid="config-bot-pipeline-node-detail-facts-list">{d.facts.map((f, i) => <li key={f} data-testid={`config-bot-pipeline-node-detail-fact-${i}`}>{f}</li>)}</ul></dd></>) : null}
      {d.dspy ? (<><dt data-testid="config-bot-pipeline-node-detail-dspy-label">Programa DSPy</dt><dd data-testid="config-bot-pipeline-node-detail-dspy"><code data-testid="config-bot-pipeline-node-detail-dspy-code">{d.dspy}</code></dd></>) : null}
      {d.condition ? (<><dt data-testid="config-bot-pipeline-node-detail-condition-label">Condición</dt><dd data-testid="config-bot-pipeline-node-detail-condition">{d.condition}</dd></>) : null}
      {d.outcome ? (<><dt data-testid="config-bot-pipeline-node-detail-outcome-label">Qué pasa</dt><dd data-testid="config-bot-pipeline-node-detail-outcome">{d.outcome}</dd></>) : null}
      {d.tools?.length ? (<><dt data-testid="config-bot-pipeline-node-detail-tools-label">Herramientas</dt><dd data-testid="config-bot-pipeline-node-detail-tools"><ul className="bo-pipelineTagList" data-testid="config-bot-pipeline-node-detail-tools-list">{d.tools.map((t) => <li key={t} className="bo-pipelineTag" data-testid={`config-bot-pipeline-node-detail-tool-${t}`}><code data-testid={`config-bot-pipeline-node-detail-tool-${t}-name`}>{t}</code></li>)}</ul></dd></>) : null}
      {d.directive ? (<><dt data-testid="config-bot-pipeline-node-detail-directive-label">Instrucción al agente</dt><dd className="bo-pipelineDirective" data-testid="config-bot-pipeline-node-detail-directive">{d.directive}</dd></>) : null}
      {d.examples?.length ? (<><dt data-testid="config-bot-pipeline-node-detail-examples-label">Ejemplos</dt><dd data-testid="config-bot-pipeline-node-detail-examples"><ul className="bo-pipelineBullets" data-testid="config-bot-pipeline-node-detail-examples-list">{d.examples.map((e, i) => <li key={e} data-testid={`config-bot-pipeline-node-detail-example-${i}`}>“{e}”</li>)}</ul></dd></>) : null}
    </dl>
  );
}

// "Cómo se aplica DSPy" explainer from the sidecar /dspy (wa_bot_dspy_compiled_v4).
function DspyPanel({ info, dspyRate }: { info: BotPipelineDspyInfo; dspyRate: string }) {
  const [open, setOpen] = useState(false);
  const byIntent = Object.entries(info.demos.by_intent).sort((a, b) => b[1] - a[1]);
  return (
    <section className="bo-pipelineDspy" data-testid="config-bot-pipeline-dspy">
      <button type="button" className="bo-pipelineDspyToggle bo-pressable" aria-expanded={open} onClick={() => setOpen((v) => !v)} data-testid="config-bot-pipeline-dspy-toggle">
        <BrainCircuit size={16} strokeWidth={1.5} aria-hidden="true" data-testid="config-bot-pipeline-dspy-icon" />
        <span className="bo-pipelineDspyTitle" data-testid="config-bot-pipeline-dspy-title">Cómo se aplica DSPy</span>
        <span className="bo-pipelineDspyMeta" data-testid="config-bot-pipeline-dspy-meta">DSPy {info.version} · se activa si Jev &lt; {pct(info.trigger.confidence_min)} · {dspyRate} de los mensajes · {info.demos.count} ejemplos</span>
        <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" className={open ? "bo-pipelineChevron is-open" : "bo-pipelineChevron"} data-testid="config-bot-pipeline-dspy-chevron" />
      </button>
      {open ? (
        <div className="bo-pipelineDspyBody" data-testid="config-bot-pipeline-dspy-body">
          <ol className="bo-pipelineDspyModules" data-testid="config-bot-pipeline-dspy-modules">
            {info.modules.map((m, i) => (
              <li key={m.name} className="bo-pipelineDspyModule" data-testid={`config-bot-pipeline-dspy-module-${i}`}>
                <strong data-testid={`config-bot-pipeline-dspy-module-${i}-name`}>{m.name}</strong> <code data-testid={`config-bot-pipeline-dspy-module-${i}-type`}>{m.type}</code>
                <p data-testid={`config-bot-pipeline-dspy-module-${i}-what`}>{m.what}</p>
              </li>
            ))}
          </ol>
          <div className="bo-pipelineDspyGrid" data-testid="config-bot-pipeline-dspy-grid">
            <div className="bo-pipelineDspyCard" data-testid="config-bot-pipeline-dspy-signature">
              <strong data-testid="config-bot-pipeline-dspy-signature-title">Firma <code data-testid="config-bot-pipeline-dspy-signature-name">{info.signature.name}</code></strong>
              <p className="bo-pipelineDirective" data-testid="config-bot-pipeline-dspy-signature-instructions">{info.signature.instructions}</p>
              <dl className="bo-pipelineDetailList" data-testid="config-bot-pipeline-dspy-signature-fields">
                {Object.entries(info.signature.inputs).map(([k, v]) => (<React.Fragment key={k}><dt data-testid={`config-bot-pipeline-dspy-input-${k}-name`}>Entrada <code data-testid={`config-bot-pipeline-dspy-input-${k}-code`}>{k}</code></dt><dd data-testid={`config-bot-pipeline-dspy-input-${k}`}>{v}</dd></React.Fragment>))}
                {Object.entries(info.signature.outputs).map(([k, v]) => (<React.Fragment key={k}><dt data-testid={`config-bot-pipeline-dspy-output-${k}-name`}>Salida <code data-testid={`config-bot-pipeline-dspy-output-${k}-code`}>{k}</code></dt><dd data-testid={`config-bot-pipeline-dspy-output-${k}`}>{v} (más un razonamiento paso a paso)</dd></React.Fragment>))}
              </dl>
              <span className="bo-pipelineDspyNote" data-testid="config-bot-pipeline-dspy-adapter">{info.signature.adapter} · máx. {String(info.lm_settings.max_tokens)} tokens · {String(info.lm_settings.timeout_s)} s</span>
            </div>
            <div className="bo-pipelineDspyCard" data-testid="config-bot-pipeline-dspy-demos">
              <strong data-testid="config-bot-pipeline-dspy-demos-title">Ejemplos (few-shot)</strong>
              <p className="bo-pipelineDirective" data-testid="config-bot-pipeline-dspy-demos-source">{info.demos.count} ejemplos · origen: {info.demos.source}. En cada llamada se usan los 4 más parecidos al mensaje.</p>
              <div className="bo-pipelineChips" data-testid="config-bot-pipeline-dspy-demos-intents">
                {byIntent.slice(0, 10).map(([k, v]) => <span key={k} className="bo-pipelineChip" data-testid={`config-bot-pipeline-dspy-demos-intent-${k}`}>{k} · {v}</span>)}
              </div>
              <ul className="bo-pipelineBullets" data-testid="config-bot-pipeline-dspy-demos-sample">
                {info.demos.sample.slice(0, 6).map((d, i) => <li key={`${d.message}-${i}`} data-testid={`config-bot-pipeline-dspy-demo-${i}`}>“{d.message}” → <code data-testid={`config-bot-pipeline-dspy-demo-${i}-intent`}>{d.intent}</code></li>)}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

// What DSPy did on one decision: model, reasoning, Jev candidates, demos.
function DspyRun({ run }: { run: BotPipelineDspyRun }) {
  return (
    <div className="bo-pipelineDspyRun" data-testid="config-bot-pipeline-detail-dspy">
      <strong className="flex items-center gap-1" data-testid="config-bot-pipeline-detail-dspy-title"><BrainCircuit size={14} strokeWidth={1.5} aria-hidden="true" data-testid="config-bot-pipeline-detail-dspy-icon" /> DSPy desambiguó · {run.model} → <code data-testid="config-bot-pipeline-detail-dspy-guess">{run.guess}</code></strong>
      {run.reasoning ? <p className="bo-pipelineDirective" data-testid="config-bot-pipeline-detail-dspy-reasoning"><strong data-testid="config-bot-pipeline-detail-dspy-reasoning-label">Razonamiento:</strong> {run.reasoning}</p> : null}
      {run.demos?.length ? (
        <ul className="bo-pipelineBullets" data-testid="config-bot-pipeline-detail-dspy-demos">
          {run.demos.map((d, i) => <li key={`${d.message}-${i}`} data-testid={`config-bot-pipeline-detail-dspy-demo-${i}`}>Ejemplo: “{d.message}” → <code data-testid={`config-bot-pipeline-detail-dspy-demo-${i}-intent`}>{d.intent}</code></li>)}
        </ul>
      ) : null}
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
  const dspyRate = useMemo(() => {
    const all = data?.decisions ?? [];
    if (!all.length) return "0 %";
    return pct(all.filter((d) => d.decision.classifier?.startsWith("dspy")).length / all.length);
  }, [data]);
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

        {data?.dspy ? <DspyPanel info={data.dspy} dspyRate={dspyRate} /> : null}

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
            {inspected.detail && Object.keys(inspected.detail).length ? <NodeDetail d={inspected.detail} /> : null}
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
                  {dec.stage || jev?.stage ? (<><dt data-testid="config-bot-pipeline-detail-stage-label">Fase</dt><dd data-testid="config-bot-pipeline-detail-stage">{STAGE_LABEL[dec.stage ?? jev?.stage ?? ""] ?? dec.stage ?? jev?.stage}</dd></>) : null}
                  {dec.booking_op || jev?.booking_op ? (<><dt data-testid="config-bot-pipeline-detail-op-label">Operación</dt><dd data-testid="config-bot-pipeline-detail-op">{OP_LABEL[dec.booking_op ?? jev?.booking_op ?? ""] ?? dec.booking_op ?? jev?.booking_op}</dd></>) : null}
                  {dec.missing_slots?.length ? (<><dt data-testid="config-bot-pipeline-detail-missing-label">Falta</dt><dd data-testid="config-bot-pipeline-detail-missing">{dec.missing_slots.join(", ")}</dd></>) : null}
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
                <Meter label="Tiene fecha" value={jev?.has_date} testId="config-bot-pipeline-meter-has-date" />
                <Meter label="Tiene hora" value={jev?.has_time} testId="config-bot-pipeline-meter-has-time" />
                <Meter label="Tiene personas" value={jev?.has_people} testId="config-bot-pipeline-meter-has-people" />
                <Meter label="Varias peticiones" value={jev?.multi_request} danger={thresholds.multi_min} testId="config-bot-pipeline-meter-multi" />
                <Meter label="Urgencia" value={jev?.urgency} max={2} danger={thresholds.urgency_high} testId="config-bot-pipeline-meter-urgency" />
                <Meter label="Trata de usted" value={jev?.formal} danger={thresholds.formal_min} testId="config-bot-pipeline-meter-formal" />
                <Meter label="Intento de manipulación" value={jev?.injection} danger={thresholds.injection_min} testId="config-bot-pipeline-meter-injection" />
                <Meter label="Spam / otro chat" value={jev?.off_topic} danger={thresholds.off_topic_min} testId="config-bot-pipeline-meter-off-topic" />
              </div>
            </div>
            {jev?.intent_top3?.length ? (
              <div className="bo-pipelineTop3" data-testid="config-bot-pipeline-detail-top3">
                <strong data-testid="config-bot-pipeline-detail-top3-title">Candidatas de Jev</strong>
                {jev.intent_top3.map(([k, v], i) => (
                  <div key={k} className="bo-pipelineTop3Row" data-testid={`config-bot-pipeline-detail-top3-${i}`}>
                    <code data-testid={`config-bot-pipeline-detail-top3-${i}-intent`}>{k}{k === dec.intent ? " ✓" : ""}</code>
                    <span className="bo-pipelineTop3Bar" data-testid={`config-bot-pipeline-detail-top3-${i}-bar`}><span style={{ width: `${Math.round(v * 100)}%` }} data-testid={`config-bot-pipeline-detail-top3-${i}-fill`} /></span>
                    <span className="bo-pipelineTop3Value" data-testid={`config-bot-pipeline-detail-top3-${i}-value`}>{pct(v)}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {dec.dspy ? <DspyRun run={dec.dspy} /> : null}
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
