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
  ok: { dot: "#10b981", ring: "rgba(16, 185, 129, 0.25)" },
  warn: { dot: "#f59e0b", ring: "rgba(245, 158, 11, 0.25)" },
  off: { dot: "#94a3b8", ring: "rgba(148, 163, 184, 0.2)" },
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
      style={{
        display: "grid",
        gridTemplateColumns: "auto 1fr auto",
        alignItems: "center",
        gap: 10,
        width: 240,
        padding: "10px 12px",
        textAlign: "left",
        background: "var(--bo-surface, #fff)",
        border: "1px solid var(--bo-border-2, rgba(15,23,42,.14))",
        borderRadius: 12,
        boxShadow: `0 1px 2px rgba(15,23,42,.06), 0 0 0 4px ${st.ring}`,
        cursor: "pointer",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: 30,
          height: 30,
          borderRadius: 8,
          background: "var(--bo-surface-2, #f1f5f9)",
          color: "var(--bo-accent, #6366f1)",
        }}
      >
        {data.icon}
      </span>
      <span style={{ display: "grid", gap: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 650, color: "var(--bo-text, #0f172a)" }}>{data.title}</span>
        {data.lines.map((l, i) => (
          <span key={i} style={{ fontSize: 11, color: "var(--bo-muted, #64748b)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l}</span>
        ))}
      </span>
      <span style={{ display: "flex", alignItems: "center", gap: 5 }} title={STATE_LABEL[data.state]}>
        <span style={{ width: 8, height: 8, borderRadius: 99, background: st.dot }} />
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
        markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color: "#94a3b8" },
        style: { stroke: "#94a3b8", strokeWidth: 1.5 },
      });
    };

    // 1. Datos de la campana
    const dataOk = form.name.trim() !== "" && form.subject.trim() !== "";
    add("data", X, y, {
      icon: <FileText size={15} />,
      title: "Campana",
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
      lines: [body ? (body.length > 44 ? body.slice(0, 44) + "…" : body) : "Vacio"],
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

    // 6. Envio
    const st = (status || "borrador").toLowerCase();
    const sendState: NodeState = st === "enviada" || st === "completada" ? "ok" : st === "enviando" ? "warn" : "off";
    add("send", X, y, {
      icon: st === "enviando" ? <Gauge size={15} /> : <Send size={15} />,
      title: "Envio",
      lines: [`Estado: ${status || "borrador"}`],
      state: sendState,
      section: "campaign-send-panel",
      onEdit,
    });
    for (const c of channelIds) link(c, "send");

    return { nodes, edges };
  }, [form, audience, status, onEdit]);

  return (
    <div
      data-testid="campaign-flow-canvas"
      data-slot="campaign-flow-canvas"
      style={{ height: 560, border: "1px solid var(--bo-border-2, rgba(15,23,42,.14))", borderRadius: 12, overflow: "hidden", background: "var(--bo-surface-2, #f8fafc)" }}
    >
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
        <Background variant={BackgroundVariant.Dots} gap={18} size={1} color="rgba(100,116,139,.25)" />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
