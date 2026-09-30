import React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { POSTicketPanel } from "./POSTicketPanel";
import type { TicketLine } from "../../hooks/usePOSRegister";

vi.mock("lucide-react", async () => {
  const { createElement } = await import("react");
  const icon = (name: string) => (props: Record<string, unknown>) => createElement("span", { "data-icon": name, ...props });
  return { ArrowRightLeft: icon("move"), Merge: icon("merge"), Minus: icon("minus"), Plus: icon("plus"), Receipt: icon("receipt"), Trash2: icon("trash"), Users: icon("users"), X: icon("x"), AlertCircle: icon("alert"), CheckCircle2: icon("check"), Info: icon("info") };
});

const line = (id: number, productName: string, updatedAt?: string): TicketLine =>
  ({ id, productName, quantity: 1, unitPriceGrossCents: 250, lineTotalGrossCents: 250, status: "ACTIVE", updatedAt }) as TicketLine;

const noop = () => {};

/** The ids of the rendered lines, in DOM order. */
function renderedOrder(): number[] {
  return screen.getAllByTestId(/^pos-line-\d+$/).map((node) => Number(node.getAttribute("data-testid")!.replace("pos-line-", "")));
}

function renderLines(lines: TicketLine[]) {
  return render(
    <POSTicketPanel
      ticket={{ id: 11, version: 1, status: "OPEN", lines, totalGrossCents: 250 } as never}
      visit={null}
      activeTicketLines={lines}
      selectedLineId={lines[0]?.id ?? 0}
      onSelectLine={noop}
      onLineQuantity={noop}
      onVoidLine={noop}
    />,
  );
}

describe("POSTicketPanel line order", () => {
  it("orders lines by the most recently updated first", () => {
    renderLines([
      line(1, "Arroz", "2026-02-17T10:00:00Z"),
      line(2, "Agua", "2026-02-17T12:30:00Z"),
      line(3, "Cafe", "2026-02-17T11:15:00Z"),
    ]);
    expect(renderedOrder()).toEqual([2, 3, 1]);
  });

  it("shows the product names in that same order", () => {
    renderLines([
      line(1, "Arroz", "2026-02-17T10:00:00Z"),
      line(2, "Agua", "2026-02-17T12:30:00Z"),
    ]);
    const names = screen.getAllByTestId(/^pos-line-name-\d+$/).map((node) => node.textContent);
    expect(names).toEqual(["Agua", "Arroz"]);
  });

  it("keeps the server order when no timestamps are present", () => {
    renderLines([line(7, "Arroz"), line(8, "Agua"), line(9, "Cafe")]);
    expect(renderedOrder()).toEqual([7, 8, 9]);
  });

  it("puts lines with a timestamp ahead of ones without", () => {
    renderLines([line(5, "Arroz"), line(6, "Agua", "2026-02-17T12:00:00Z")]);
    // A known recency outranks an unknown one; the untimed line keeps its place.
    expect(renderedOrder()).toEqual([6, 5]);
  });

  it("keeps the incoming order for lines that share a timestamp", () => {
    renderLines([
      line(1, "Arroz", "2026-02-17T10:00:00Z"),
      line(2, "Agua", "2026-02-17T10:00:00Z"),
      line(3, "Cafe", "2026-02-17T10:00:00Z"),
    ]);
    expect(renderedOrder()).toEqual([1, 2, 3]);
  });

  it("ignores an unparseable timestamp instead of jumping to the front", () => {
    renderLines([line(1, "Arroz", "not-a-date"), line(2, "Agua", "2026-02-17T12:00:00Z")]);
    expect(renderedOrder()).toEqual([2, 1]);
  });

  it("does not reorder the caller array in place", () => {
    const lines = [line(1, "Arroz", "2026-02-17T10:00:00Z"), line(2, "Agua", "2026-02-17T12:00:00Z")];
    renderLines(lines);
    expect(lines.map((l) => l.id)).toEqual([1, 2]);
  });
});
