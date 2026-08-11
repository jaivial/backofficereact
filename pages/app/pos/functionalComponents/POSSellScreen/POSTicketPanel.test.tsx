import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { POSTicketPanel } from "./POSTicketPanel";
import type { Ticket, TicketLine } from "../../hooks/usePOSRegister";

vi.mock("lucide-react", async () => {
  const { createElement } = await import("react");
  const icon = (name: string) => (props: Record<string, unknown>) => createElement("span", { "data-icon": name, ...props });
  return { ArrowRightLeft: icon("move"), Merge: icon("merge"), Minus: icon("minus"), Plus: icon("plus"), Receipt: icon("receipt"), Trash2: icon("trash"), Users: icon("users"), X: icon("x") };
});

const line: TicketLine = { id: 12, productName: "Agua", quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE" } as TicketLine;
const ticket: Ticket = { id: 11, version: 1, status: "OPEN", lines: [line], totalGrossCents: 250 } as Ticket;
const splitB = { id: 21, version: 1, status: "OPEN", lines: [], totalGrossCents: 0 } as Ticket;

const noop = () => {};

function renderPanel(overrides: Record<string, unknown> = {}) {
  return render(
    <POSTicketPanel
      ticket={ticket}
      visit={null}
      activeTicketLines={[line]}
      selectedLineId={line.id}
      onSelectLine={noop}
      onLineQuantity={vi.fn()}
      onVoidLine={noop}
      splitTickets={[ticket, splitB]}
      onMoveLine={noop}
      onMergeSplitTickets={noop}
      {...overrides}
    />,
  );
}

describe("POSTicketPanel readOnly", () => {
  it("locks every line action on a sealed day", () => {
    renderPanel({ readOnly: true });
    expect(screen.getByTestId("pos-line-minus-12")).toBeDisabled();
    expect(screen.getByTestId("pos-line-plus-12")).toBeDisabled();
    expect(screen.getByTestId("pos-line-move-12")).toBeDisabled();
    expect(screen.getByTestId("pos-line-void-12")).toBeDisabled();
    expect(screen.getByTestId("pos-split-merge")).toBeDisabled();
  });

  it("leaves the line actions clickable on an open day", () => {
    renderPanel({ readOnly: false });
    expect(screen.getByTestId("pos-line-minus-12")).toBeEnabled();
    expect(screen.getByTestId("pos-line-void-12")).toBeEnabled();
    expect(screen.getByTestId("pos-split-merge")).toBeEnabled();
  });
});
