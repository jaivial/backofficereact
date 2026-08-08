import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";

// ReactFlow is heavy and irrelevant to the node renderer; stub its exports so
// the module loads under jsdom. NodeResizer is referenced at module top-level.
vi.mock("reactflow", () => ({
  default: (() => null) as unknown,
  Background: () => null,
  ControlButton: (() => null) as unknown,
  Controls: () => null,
  NodeResizer: () => null,
}));

// draw preset assets are only used by DrawElementNode; keep them out of jsdom.
vi.mock("../../drawPresets", () => ({ drawPresetAssetImageUrl: () => "" }));

// constants/tables builds DRAW_PRESET_ICONS at import time from lucide-react, so
// the mock must cover every icon it references (plus Users used by the node).
vi.mock("lucide-react", () => {
  const React = require("react");
  const icon = (name: string) => (props: object) =>
    React.createElement("span", { "data-testid": `lucide-${name}`, ...props });
  return {
    Users: icon("users"),
    Square: icon("square"),
    Leaf: icon("leaf"),
    Sofa: icon("sofa"),
    GripVertical: icon("grip"),
    Circle: icon("circle"),
    Trash2: icon("trash"),
    DoorOpen: icon("door"),
  };
});

import { TableNode } from "./TableCanvas";
import type { TableNodeData } from "../../types/tables";

const baseData: TableNodeData = {
  id: 7,
  name: "Mesa 7",
  numeroMesa: "7B",
  capacity: 4,
  status: "available",
  shape: "round",
  fillColor: "",
  outlineColor: "",
  textureImageUrl: "",
  rotationDeg: 0,
  rectShortSides: { left: false, right: false },
};

describe("TableNode", () => {
  it("renders numero_mesa big, pax value and status", () => {
    render(<TableNode data={baseData} />);
    expect(screen.getByText("7B")).toBeInTheDocument();
    expect(screen.getByText("4 pax")).toBeInTheDocument();
    expect(screen.getByText("Libre")).toBeInTheDocument();
    expect(screen.getByTestId("lucide-users")).toBeInTheDocument();
  });

  it("falls back to the table id when numero_mesa is missing", () => {
    render(<TableNode data={{ ...baseData, numeroMesa: "" }} />);
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("reflects capacity in the pax row", () => {
    render(<TableNode data={{ ...baseData, capacity: 6 }} />);
    expect(screen.getByText("6 pax")).toBeInTheDocument();
  });
});
