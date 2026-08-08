import React from "react";
import { Users } from "lucide-react";
import ReactFlow, {
  Background,
  ControlButton,
  Controls,
  NodeResizer,
} from "reactflow";
import type { Node, NodeChange } from "reactflow";
import type { TableNodeData, DrawNodeData, DrawElementPreset } from "../../types/tables";
import type { LinePoint } from "../../lineDrawing";
import { STATUS_LABEL, DRAW_PRESET_ICONS } from "../../constants/tables";
import { previewGeometry } from "../../helpers/tables";
import { drawPresetAssetImageUrl } from "../../drawPresets";

// === Table Node Component ===

function TableFromRFNode(data: TableNodeData): React.JSX.Element {
  const geom = previewGeometry(data.shape, data.capacity, data.rectShortSides);
  const shape = data.shape === "square" ? "is-square" : "is-round";
  const style: React.CSSProperties = {
    ["--bo-table-fill" as any]: data.fillColor || "var(--bo-surface-2)",
    ["--bo-table-outline" as any]: data.outlineColor || "var(--bo-border-2)",
    ["--bo-table-texture" as any]: data.textureImageUrl ? `url(${data.textureImageUrl})` : "none",
    transform: `rotate(${Number.isFinite(data.rotationDeg) ? data.rotationDeg : 0}deg)`,
    width: `${geom.width}px`,
    height: `${geom.height}px`,
  };
  return (
    <div
      data-ui="table-node"
      className={`bo-tableMapNode ${shape}${data.assignMode ? " is-assign-mode" : ""}${data.isSelected ? " is-selected" : ""}`}
      style={style}
    >
      {geom.chairs.map((chair, idx) => (
        <span key={`node-chair-${idx}`} data-ui="chair" className="bo-tableMapChair" style={{ transform: `translate(${chair.x}px, ${chair.y}px)` }} />
      ))}
      <div data-ui="node-pax" className="bo-tableMapNodePax">
        <Users size={11} strokeWidth={1.8} aria-hidden="true" />
        <span data-ui="node-pax-value">{data.capacity} pax</span>
      </div>
      <div data-ui="node-number" className="bo-tableMapNodeNum">{data.numeroMesa || data.id}</div>
      <div data-ui="node-status" className={`bo-tableMapNodeStatus is-${data.status}`}>{STATUS_LABEL[data.status]}</div>
    </div>
  );
}

export const TableNode = ({ data }: { data: TableNodeData }) => TableFromRFNode(data);

// === Draw Element Node Component ===

export const DrawElementNode = ({ data }: { data: DrawNodeData }) => {
  const assetImageUrl = drawPresetAssetImageUrl(data.preset);
  const showAsset = data.displayMode === "asset" || data.displayMode === "both";
  const showText = data.displayMode === "text" || data.displayMode === "both";
  const style: React.CSSProperties = {
    width: `${data.width}px`,
    height: `${data.height}px`,
    transform: `rotate(${data.rotationDeg}deg)`,
  };
  const cls = data.kind === "wall" ? "is-wall" : data.kind === "image" ? "is-image" : "is-obstacle";
  return (
    <div data-ui="draw-element" className={`bo-drawElementNode ${cls}${data.isSelected ? " is-selected" : ""}${assetImageUrl && showAsset ? " has-asset" : ""}${showText ? " has-text" : " no-text"}`} style={style}>
      <NodeResizer
        isVisible={data.editable}
        minWidth={24}
        minHeight={24}
        lineStyle={{ borderColor: "var(--bo-accent)" }}
        handleStyle={{ width: 10, height: 10, border: "1px solid var(--bo-accent)", background: "var(--bo-surface)" }}
      />
      {showAsset ? (
        assetImageUrl ? (
          <img data-ui="draw-asset" className="bo-drawElementNodeAsset" src={assetImageUrl} alt="" aria-hidden="true" />
        ) : (
          <span data-ui="draw-icon" className="bo-drawElementNodeIcon" aria-hidden="true">{DRAW_PRESET_ICONS[data.preset]}</span>
        )
      ) : null}
      {showText ? <span data-ui="draw-label" className="bo-drawElementNodeLabel">{data.label}</span> : null}
    </div>
  );
};

// === Node Types export ===

export const NODE_TYPES = {
  restaurantTable: TableNode,
  drawElement: DrawElementNode,
};
