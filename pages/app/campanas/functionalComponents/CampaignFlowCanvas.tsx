import React, { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { FileText, Gauge, Mail, MessageCircle, Palette, PenLine, Send, Users } from "lucide-react";
import type { CampaignInput } from "../../../../api/types";
import { CAMPAIGN_RATE_LIMITS } from "./campaignsApi";

/**
 * Editor de campanas tipo React Flow (mejora UX 11): la campana como grafo de
 * nodos (datos -> audiencia -> mensaje -> estilo -> canales -> ritmo -> envio).
 * Cada nodo refleja el estado real del formulario y al pulsarlo salta a su
 * seccion del editor clasico. Coordination id: campaign_flow_editor_v1
 */

export type CampaignFlowSection =
  | "campaign-data-panel"
  | "campaign-audience-panel"
  | "campaign-content-panel"
  | "campaign-theme-panel"
  | "campaign-rate-panel"
  | "campaign-send-panel";

type NodeState = "ok" | "warn" | "off";

type CampaignNodeData = {
  icon: React.ReactNode;
  title: string;
  lines: string[];
  state: NodeState;
  section: CampaignFlowSection;
  onEdit: (section: CampaignFlowSection) => void;
};

const STATE_STYLES: Record<NodeState, { dot: string; ring: string }> = {
  ok: { dot: "var(--bo-state-ok)", ring: "var(--bo-state-ok-ring)" },
  warn: { dot: "var(--bo-state-warn)", ring: "var(--bo-state-warn-ring)" },
  off: { dot: "var(--bo-state-off)", ring: "var(--bo-state-off-ring)" },
};

const STATE_LABEL: Record<NodeState, string> = {
  ok: "listo",
  warn: "pendiente",
  off: "desactivado",
};

function CampaignFlowNode({ data }: NodeProps<CampaignNodeData>) {
  const st = STATE_STYLES[data.state];
  return (
    <button
      type="button"
      onClick={() => data.onEdit(data.section)}
      data-testid={`campaign-flow-node-${data.section}`}
      data-slot={`campaign-flow-node-${data.section}`}
      data-state={data.state}
      title={data.lines.filter(Boolean).join(" · ") || undefined}
      className="campaign-flowNode"
      style={{ boxShadow: `0 0 0 4px ${st.ring}` }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span aria-hidden="true" className="campaign-flowNodeIcon">
        {data.icon}
      </span>
      <span className="campaign-flowNodeText">
        <span className="campaign-flowNodeTitle">{data.title}</span>
        {data.lines.map((l, i) => (
          <span key={i} className="campaign-flowNodeLine" title={l}>{l}</span>
        ))}
      </span>
      <span className="campaign-flowNodeState" title={STATE_LABEL[data.state]} data-testid={`campaign-flow-node-state-${data.section}`}>
        <span aria-hidden="true" style={{ background: st.dot }} />
      </span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </button>
  );
}

const nodeTypes = { campaign: CampaignFlowNode };

function stripMarkdown(md: string): string {
  return md.replace(/^#+\s*/gm, "").replace(/[*_`>]/g, "").replace(/\s+/g, " ").trim();
}

export type CampaignFlowCanvasProps = {
  form: CampaignInput;
  audience: { total: number; emails: number; whatsapp: number } | null;
  status?: string | null;
  onEdit: (section: CampaignFlowSection) => void;
};

export function CampaignFlowCanvas({ form, audience, status, onEdit }: CampaignFlowCanvasProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node<CampaignNodeData>[] = [];
    const edges: Edge[] = [];
    const X = 300;
    const CH_X = { email: 200, whatsapp: 400 } as const;
    let y = 0;
    const STEP = 108;

    const add = (id: string, x: number, yy: number, data: CampaignNodeData) => {
      nodes.push({ id, type: "campaign", position: { x, y: yy }, data });
    };
    const link = (a: string, b: string) => {
      edges.push({
        id: `${a}-${b}`,
        source: a,
        target: b,
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "var(--bo-edge)" },
        style: { stroke: "var(--bo-edge)", strokeWidth: 1.5 },
      });
    };

    // 1. Datos de la campana
    const dataOk = form.name.trim() !== "" && form.subject.trim() !== "";
    add("data", X, y, {
      icon: <FileText size={15} />,
      title: "Campaña",
      lines: [form.name.trim() || "Sin nombre", form.subject.trim() || "Sin asunto"],
      state: dataOk ? "ok" : "warn",
      section: "campaign-data-panel",
      onEdit,
    });
    y += STEP;

    // 2. Audiencia
    const audLines = form.audience === "manual"
      ? ["Lista manual", `${form.manual_recipients.length} contacto(s)`]
      : [`Reservas (${form.audience_days}d)`, audience ? `${audience.total} contactos - ${audience.emails} email / ${audience.whatsapp} whatsapp` : "Recuento sin cargar"];
    const audOk = form.audience === "manual" ? form.manual_recipients.length > 0 : (audience?.total ?? 0) > 0;
    add("audience", X, y, {
      icon: <Users size={15} />,
      title: "Audiencia",
      lines: audLines,
      state: audOk ? "ok" : "warn",
      section: "campaign-audience-panel",
      onEdit,
    });
    link("data", "audience");
    y += STEP;

    // 3. Mensaje
    const body = stripMarkdown(form.body_markdown || "");
    const bodyOk = body !== "" && body !== "Hola Escribe aqui tu anuncio.";
    add("content", X, y, {
      icon: <PenLine size={15} />,
      title: "Mensaje",
      lines: [body ? (body.length > 64 ? `${body.slice(0, 64)}…` : body) : "Vacío"],
      state: bodyOk ? "ok" : "warn",
      section: "campaign-content-panel",
      onEdit,
    });
    link("audience", "content");
    y += STEP;

    // 4. Estilo (solo si el canal email esta activo)
    const hasEmail = form.channels.includes("email");
    const hasWa = form.channels.includes("whatsapp");
    let prev = "content";
    if (hasEmail) {
      add("theme", X, y, {
        icon: <Palette size={15} />,
        title: "Estilo del email",
        lines: ["Colores y logo de la marca"],
        state: "ok",
        section: "campaign-theme-panel",
        onEdit,
      });
      link(prev, "theme");
      prev = "theme";
      y += STEP;
    }

    // 5. Canales (en paralelo)
    const channelIds: string[] = [];
    if (hasEmail) {
      add("ch-email", hasWa ? CH_X.email : X, y, {
        icon: <Mail size={15} />,
        title: "Canal Email",
        lines: [`${form.email_per_minute}/min (max ${CAMPAIGN_RATE_LIMITS.email.max})`],
        state: "ok",
        section: "campaign-rate-panel",
        onEdit,
      });
      channelIds.push("ch-email");
    }
    if (hasWa) {
      add("ch-whatsapp", hasEmail ? CH_X.whatsapp : X, y, {
        icon: <MessageCircle size={15} />,
        title: "Canal WhatsApp",
        lines: [`${form.whatsapp_per_minute}/min (max ${CAMPAIGN_RATE_LIMITS.whatsapp.max})`],
        state: "ok",
        section: "campaign-rate-panel",
        onEdit,
      });
      channelIds.push("ch-whatsapp");
    }
    if (channelIds.length === 0) {
      add("ch-none", X, y, {
        icon: <Mail size={15} />,
        title: "Sin canales",
        lines: ["Activa email o WhatsApp"],
        state: "off",
        section: "campaign-data-panel",
        onEdit,
      });
      channelIds.push("ch-none");
    }
    for (const c of channelIds) link(prev, c);
    y += STEP;

    // 6. Envío
    const st = (status || "borrador").toLowerCase();
    const sendState: NodeState = st === "enviada" || st === "completada" ? "ok" : st === "enviando" ? "warn" : "off";
    add("send", X, y, {
      icon: st === "enviando" ? <Gauge size={15} /> : <Send size={15} />,
      title: "Envío",
      lines: [`Estado: ${status || "borrador"}`],
      state: sendState,
      section: "campaign-send-panel",
      onEdit,
    });
    for (const c of channelIds) link(c, "send");

    return { nodes, edges };
  }, [form, audience, status, onEdit]);

  return (
    <div className="campaign-flowWrap" data-testid="campaign-flow-canvas" data-slot="campaign-flow-canvas">
      <div className="campaign-flowLegend" data-testid="campaign-flow-legend" data-observe="campaign-flow-legend">
        {(
          [
            ["ok", "listo"],
            ["warn", "pendiente"],
            ["off", "desactivado"],
          ] as const
        ).map(([state, label]) => (
          <span key={state} className="campaign-flowLegendItem" data-testid={`campaign-flow-legend-${state}`}>
            <span aria-hidden="true" className="campaign-flowLegendDot" style={{ background: STATE_STYLES[state].dot }} />
            {label}
          </span>
        ))}
      </div>
      <div className="campaign-flowCanvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll
        panOnDrag
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="var(--bo-canvas-dot)" />
        <Controls showInteractive={false} position="bottom-left" />
      </ReactFlow>
      </div>
    </div>
  );
}
