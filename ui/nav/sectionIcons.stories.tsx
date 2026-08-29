import type { Meta, StoryObj } from "@storybook/react";
import { iconForSidebarItemKey } from "./sectionIcons";
import type { SidebarItemKey } from "../../lib/navigation";

const allKeys: SidebarItemKey[] = [
  "reservas",
  "menus",
  "comida",
  "miembros",
  "ajustes",
  "website",
  "site-builder",
  "fichaje",
  "horarios",
  "facturas",
  "reportes",
  "estadisticas",
  "estado_cuenta",
];

const meta = {
  title: "ui/nav/sectionIcons",
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
} satisfies Meta;

export default meta;

export const AllIcons: StoryObj = {
  name: "All Icons",
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "24px" }}>
      {allKeys.map((key) => (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
            padding: "16px",
            border: "1px solid #e5e5e5",
            borderRadius: "8px",
          }}
        >
          {iconForSidebarItemKey(key)}
          <span style={{ fontSize: "12px", color: "#666" }}>{key}</span>
        </div>
      ))}
    </div>
  ),
};

export const IconSizes: StoryObj = {
  name: "Icon Sizes",
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
      {[14, 16, 18, 20, 24, 32].map((size) => (
        <div
          key={size}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {iconForSidebarItemKey("reservas", { size })}
          <span style={{ fontSize: "12px", color: "#666" }}>{size}px</span>
        </div>
      ))}
    </div>
  ),
};

export const IconStrokeWidths: StoryObj = {
  name: "Icon Stroke Widths",
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "32px" }}>
      {[1.2, 1.5, 1.8, 2, 2.5].map((strokeWidth) => (
        <div
          key={strokeWidth}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "8px",
          }}
        >
          {iconForSidebarItemKey("reservas", { strokeWidth })}
          <span style={{ fontSize: "12px", color: "#666" }}>{strokeWidth}</span>
        </div>
      ))}
    </div>
  ),
};

export const CombinedOptions: StoryObj = {
  name: "Combined Options",
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
      {allKeys.map((key) => (
        <div
          key={key}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "12px" }}>
            {iconForSidebarItemKey(key, { size: 16 })}
            {iconForSidebarItemKey(key, { size: 20 })}
            {iconForSidebarItemKey(key, { size: 24 })}
          </div>
          <span style={{ fontSize: "11px", color: "#999" }}>{key}</span>
        </div>
      ))}
    </div>
  ),
};

export const DefaultIcon: StoryObj = {
  name: "Default Icon (unknown key)",
  render: () => (
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      {iconForSidebarItemKey("unknown" as SidebarItemKey)}
      <span style={{ fontSize: "14px" }}>Returns Settings icon for unknown keys</span>
    </div>
  ),
};
